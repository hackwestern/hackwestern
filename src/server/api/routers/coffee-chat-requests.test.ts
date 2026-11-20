import { COFFEE_CHAT_ROOMS } from "~/lib/coffee-chat-requests";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type { CoffeeChatSetup } from "~/lib/run-of-show";
import type * as Notify from "~/server/api/utils/coffee-chat-notify";
import type * as RunOfShowSheet from "~/server/api/utils/run-of-show-sheet";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { createCaller } from "~/server/api/root";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

// Notifications (email, Slack, sheet) have their own tests; never send
// real ones from here, even when the shell has Mailjet keys set.
vi.mock("~/server/api/utils/coffee-chat-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof Notify>()),
  notifyCoffeeChat: vi.fn(async () => undefined),
}));

// The Coffee Chats sheet tab, per test sponsor name.
const setups: CoffeeChatSetup[] = [];
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => {
  const original = await importOriginal<typeof RunOfShowSheet>();
  return {
    ...original,
    getRunOfShow: vi.fn(async () => ({
      readAt: new Date().toISOString(),
      items: [],
      tasks: [],
      coffeeChats: setups,
    })),
  };
});

const caller = createCaller(createInnerTRPCContext({ session: null }));
const errors = coffeeChatCopy.errors;

// Saturday morning before chats start (only Date is faked, so PGlite's
// timers keep working).
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
});
afterAll(() => {
  vi.useRealTimers();
});

let n = 0;
async function makeSponsor(reps: number, setup: Partial<CoffeeChatSetup> = {}) {
  const name = `Offer Sponsor ${++n}`;
  // The sponsor's request: a group runs one chat of the group size, else
  // 1-on-1s with `reps` reps.
  const group = (setup.groupSize ?? 1) > 1;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({
      name,
      coffeeChatStyle: group ? "group" : "oneOnOne",
      coffeeChatPerSlot: group ? setup.groupSize! : reps,
    })
    .returning();
  const full: CoffeeChatSetup = {
    sponsor: name,
    windowStart: "10:00",
    windowEnd: "12:00",
    durationMinutes: 15,
    groupSize: 1,
    chattingHours: null,
    slots: null,
    hackers: null,
    format: "Individual (15 mins)",
    notes: null,
    room: `Rm ${2240 + n}`,
    ...setup,
  };
  setups.push(full);
  // Offers need a room block: one over the sheet window, in the sheet's
  // room (written directly, so test rooms needn't be 2241-2243).
  if (full.room && full.windowStart && full.windowEnd) {
    await db.insert(coffeeChatHolds).values({
      sponsorId: row!.id,
      room: full.room,
      startTime: full.windowStart,
      endTime: full.windowEnd,
    });
  }
  return row!.id;
}

async function makeHacker(
  opts: {
    status?: (typeof applications.$inferInsert)["status"];
    type?: "hacker" | "organizer";
    share?: boolean;
    firstName?: string;
  } = {},
) {
  const id = `hacker-${++n}`;
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    name: `${opts.firstName ?? "Alex"} Secretlastname`,
    type: opts.type ?? "hacker",
  });
  await db.insert(applications).values({
    userId: id,
    status: opts.status ?? "CONFIRMED",
    firstName: opts.firstName ?? "Alex",
    lastName: "Secretlastname",
    githubLink: "https://github.com/alex",
    linkedInLink: "https://linkedin.com/in/alex",
    devpostLink: "https://devpost.com/alex",
    resumeLink: "https://example.com/resume.pdf",
    agreeShareWithSponsors: opts.share ?? false,
  });
  return id;
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(TRPCError);
  return error as TRPCError;
}

describe("coffeeChatRequests: sponsor UUID", () => {
  test("a bad UUID is a 400 on every sponsor procedure", async () => {
    const hacker = await makeHacker();
    for (const sponsor of ["StarTech", "not-a-uuid", ""]) {
      expect(
        (
          await codeOf(
            caller.coffeeChatRequests.hacker({ sponsor, userId: hacker }),
          )
        ).code,
      ).toBe("BAD_REQUEST");
      expect(
        (await codeOf(caller.coffeeChatRequests.freeTimes({ sponsor }))).code,
      ).toBe("BAD_REQUEST");
      expect(
        (
          await codeOf(
            caller.coffeeChatRequests.offer({
              sponsor,
              userId: hacker,
              slotTime: "10:00",
            }),
          )
        ).code,
      ).toBe("BAD_REQUEST");
    }
  });

  test("an unknown UUID is a 404", async () => {
    const hacker = await makeHacker();
    const error = await codeOf(
      caller.coffeeChatRequests.offer({
        sponsor: "00000000-0000-4000-8000-000000000000",
        userId: hacker,
        slotTime: "10:00",
      }),
    );
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("coffeeChatRequests: scanned badge", () => {
  test("anything but an admitted hacker is a 404 that names no one", async () => {
    const sponsor = await makeSponsor(1);
    const ids = [
      "no-such-user",
      await makeHacker({ status: "REJECTED", firstName: "Rejected" }),
      await makeHacker({ status: "WAITLISTED", firstName: "Waitlisted" }),
      await makeHacker({ type: "organizer", firstName: "Organizer" }),
    ];
    // A hacker account with no application at all.
    await db.insert(users).values({
      id: "no-app",
      email: "no-app@example.com",
      name: "Noapp Person",
    });
    ids.push("no-app");

    for (const userId of ids) {
      for (const call of [
        caller.coffeeChatRequests.hacker({ sponsor, userId }),
        caller.coffeeChatRequests.freeTimes({ sponsor, userId }),
        caller.coffeeChatRequests.offer({ sponsor, userId, slotTime: "10:00" }),
      ]) {
        const error = await codeOf(call);
        expect(error.code).toBe("NOT_FOUND");
        expect(error.message).not.toMatch(
          /Rejected|Waitlisted|Organizer|Noapp|Secretlastname/,
        );
      }
    }
  });

  test("reveals only the first name; links only with consent", async () => {
    const sponsor = await makeSponsor(1);
    const quiet = await makeHacker({ firstName: "Quinn" });
    const sharer = await makeHacker({ firstName: "Sam", share: true });

    await expect(
      caller.coffeeChatRequests.hacker({ sponsor, userId: quiet }),
    ).resolves.toEqual({ userId: quiet, firstName: "Quinn", links: null });
    await expect(
      caller.coffeeChatRequests.hacker({ sponsor, userId: sharer }),
    ).resolves.toEqual({
      userId: sharer,
      firstName: "Sam",
      links: {
        resume: "https://example.com/resume.pdf",
        github: "https://github.com/alex",
        linkedIn: "https://linkedin.com/in/alex",
        devpost: "https://devpost.com/alex",
      },
    });

    const offer = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: quiet,
      slotTime: "10:00",
    });
    expect(offer).toMatchObject({
      firstName: "Quinn",
      slotTime: "10:00",
      durationMinutes: 15,
      status: "pending",
    });
    expect(JSON.stringify(offer)).not.toMatch(/Secretlastname|@example\.com/);
  });
});

describe("coffeeChatRequests.offer: rules", () => {
  test("seats used never pass hackersPerSlot (chat type x reps)", async () => {
    // 2 reps of 1-on-1s: 2 seats per start time.
    const sponsor = await makeSponsor(2);
    const [a, b, c] = [
      await makeHacker(),
      await makeHacker(),
      await makeHacker(),
    ];
    await caller.coffeeChatRequests.offer({
      sponsor,
      userId: a,
      slotTime: "10:00",
    });
    await caller.coffeeChatRequests.offer({
      sponsor,
      userId: b,
      slotTime: "10:00",
    });
    const error = await codeOf(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: c,
        slotTime: "10:00",
      }),
    );
    expect(error.code).toBe("CONFLICT");

    // At most 3 hackers per slot, even if a row says 4 reps.
    const big = await makeSponsor(4);
    const hackers = [];
    for (let i = 0; i < 4; i++) hackers.push(await makeHacker());
    for (const userId of hackers.slice(0, 3)) {
      await caller.coffeeChatRequests.offer({
        sponsor: big,
        userId,
        slotTime: "10:00",
      });
    }
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor: big,
            userId: hackers[3]!,
            slotTime: "10:00",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
  });

  test("groups of 3: three hackers share one 30-min start", async () => {
    const sponsor = await makeSponsor(4, {
      durationMinutes: 30,
      groupSize: 3,
      format: "Groups (30 mins with 3 people)",
    });
    const hackers = [];
    for (let i = 0; i < 4; i++) hackers.push(await makeHacker());
    for (const userId of hackers.slice(0, 3)) {
      const offer = await caller.coffeeChatRequests.offer({
        sponsor,
        userId,
        slotTime: "10:30",
      });
      expect(offer.durationMinutes).toBe(30);
    }
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor,
            userId: hackers[3]!,
            slotTime: "10:30",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
    // Off the half-hour grid for 30-min groups.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor,
            userId: hackers[3]!,
            slotTime: "10:15",
          }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
  });

  test("start must be inside the sponsor's window", async () => {
    const sponsor = await makeSponsor(1);
    const userId = await makeHacker();
    for (const slotTime of ["09:45", "12:00", "11:50", "10:10", "25:00"]) {
      expect(
        (
          await codeOf(
            caller.coffeeChatRequests.offer({ sponsor, userId, slotTime }),
          )
        ).code,
      ).toBe("BAD_REQUEST");
    }
    const notSetUp = await makeSponsor(1, {
      windowStart: null,
      windowEnd: null,
    });
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor: notSetUp,
            userId,
            slotTime: "10:00",
          }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
  });

  test("a hacker is never double booked (30-min overlaps)", async () => {
    const groupSponsor = await makeSponsor(1, {
      durationMinutes: 30,
      groupSize: 3,
      format: "Groups (30 mins with 3 people)",
    });
    const quickSponsor = await makeSponsor(3);
    const userId = await makeHacker();
    await caller.coffeeChatRequests.offer({
      sponsor: groupSponsor,
      userId,
      slotTime: "10:00",
    });
    for (const slotTime of ["10:00", "10:15"]) {
      const error = await codeOf(
        caller.coffeeChatRequests.offer({
          sponsor: quickSponsor,
          userId,
          slotTime,
        }),
      );
      expect(error.code).toBe("CONFLICT");
    }
    await expect(
      caller.coffeeChatRequests.offer({
        sponsor: quickSponsor,
        userId,
        slotTime: "10:30",
      }),
    ).resolves.toMatchObject({ slotTime: "10:30" });
  });

  test("two concurrent offers for the last seat: exactly one succeeds", async () => {
    const sponsor = await makeSponsor(1);
    const [a, b] = [await makeHacker(), await makeHacker()];
    const results = await Promise.allSettled([
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: a,
        slotTime: "11:00",
      }),
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: b,
        slotTime: "11:00",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "CONFLICT",
    });
  });

  test("too close to the start (past the reply cutoff) is refused", async () => {
    const sponsor = await makeSponsor(1);
    const userId = await makeHacker();
    vi.setSystemTime(new Date("2026-11-21T09:41:00-05:00"));
    try {
      expect(
        (
          await codeOf(
            caller.coffeeChatRequests.offer({
              sponsor,
              userId,
              slotTime: "10:00",
            }),
          )
        ).code,
      ).toBe("CONFLICT");
    } finally {
      vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
    }
  });

  test("room comes from the block; no block, no offer", async () => {
    const sponsor = await makeSponsor(1, { room: null });
    const error = await codeOf(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: await makeHacker(),
        slotTime: "10:00",
      }),
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe(errors.noBlock);
  });
});

describe("coffeeChatRequests.freeTimes", () => {
  test("open start times, earliest first, minus full and clashing ones", async () => {
    const sponsor = await makeSponsor(1, { windowEnd: "11:00" });
    const other = await makeSponsor(1);
    const taken = await makeHacker();
    const busy = await makeHacker();
    await caller.coffeeChatRequests.offer({
      sponsor,
      userId: taken,
      slotTime: "10:15",
    });
    await caller.coffeeChatRequests.offer({
      sponsor: other,
      userId: busy,
      slotTime: "10:30",
    });

    const all = await caller.coffeeChatRequests.freeTimes({ sponsor });
    expect(all.times.map((t) => t.slotTime)).toEqual([
      "10:00",
      "10:30",
      "10:45",
    ]);
    expect(all).toMatchObject({
      durationMinutes: 15,
      request: { style: "oneOnOne", perSlot: 1, source: "sponsor" },
    });

    const forBusy = await caller.coffeeChatRequests.freeTimes({
      sponsor,
      userId: busy,
    });
    expect(forBusy.times.map((t) => t.slotTime)).toEqual(["10:00", "10:45"]);
  });
});

function hackerCaller(userId: string) {
  return createCaller(
    createInnerTRPCContext({
      session: {
        user: { id: userId },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
    }),
  );
}

describe("coffeeChatRequests.respond / mine (T16)", () => {
  test("only the hacker on the chat can respond", async () => {
    const sponsor = await makeSponsor(1);
    const owner = await makeHacker();
    const stranger = await makeHacker();
    const { chatId } = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: owner,
      slotTime: "10:00",
    });

    for (const answer of ["accept", "decline"] as const) {
      const error = await codeOf(
        hackerCaller(stranger).coffeeChatRequests.respond({ chatId, answer }),
      );
      expect(error.code).toBe("NOT_FOUND");
    }
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.respond({ chatId, answer: "accept" }),
        )
      ).code,
    ).toBe("UNAUTHORIZED");
    expect(await hackerCaller(stranger).coffeeChatRequests.mine()).toEqual([]);

    await expect(
      hackerCaller(owner).coffeeChatRequests.respond({
        chatId,
        answer: "accept",
      }),
    ).resolves.toMatchObject({ chatId, status: "accepted" });
    const [mine] = await hackerCaller(owner).coffeeChatRequests.mine();
    expect(mine).toMatchObject({
      chatId,
      slotTime: "10:00",
      status: "accepted",
      room: setups.at(-1)!.room,
      sponsorName: setups.at(-1)!.sponsor,
    });
  });

  test("declining frees the seat", async () => {
    const sponsor = await makeSponsor(1);
    const [first, second] = [await makeHacker(), await makeHacker()];
    const { chatId } = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: first,
      slotTime: "10:00",
    });
    expect(
      (await caller.coffeeChatRequests.freeTimes({ sponsor })).times.map(
        (t) => t.slotTime,
      ),
    ).not.toContain("10:00");
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor,
            userId: second,
            slotTime: "10:00",
          }),
        )
      ).code,
    ).toBe("CONFLICT");

    await hackerCaller(first).coffeeChatRequests.respond({
      chatId,
      answer: "decline",
    });

    expect(
      (await caller.coffeeChatRequests.freeTimes({ sponsor })).times[0],
    ).toMatchObject({ slotTime: "10:00", seatsLeft: 1 });
    await expect(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: second,
        slotTime: "10:00",
      }),
    ).resolves.toMatchObject({ status: "pending" });
    // Declined is final: it can't be accepted afterwards.
    expect(
      (
        await codeOf(
          hackerCaller(first).coffeeChatRequests.respond({
            chatId,
            answer: "accept",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
  });

  test("pending past slot start - 20 min reads as expired and can't be accepted", async () => {
    const sponsor = await makeSponsor(1);
    const userId = await makeHacker();
    const { chatId, expiresAt } = await caller.coffeeChatRequests.offer({
      sponsor,
      userId,
      slotTime: "10:00",
    });
    expect(expiresAt).toBe("2026-11-21T14:40:00.000Z");

    vi.setSystemTime(new Date("2026-11-21T09:40:00-05:00"));
    try {
      const [mine] = await hackerCaller(userId).coffeeChatRequests.mine();
      expect(mine).toMatchObject({ chatId, status: "expired" });
      expect(
        (
          await codeOf(
            hackerCaller(userId).coffeeChatRequests.respond({
              chatId,
              answer: "accept",
            }),
          )
        ).code,
      ).toBe("CONFLICT");
    } finally {
      vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
    }
  });
});

describe("coffeeChatRequests organizer actions (T26)", () => {
  async function organizerCaller() {
    const id = `organizer-${++n}`;
    await db
      .insert(users)
      .values({ id, email: `${id}@example.com`, type: "organizer" });
    return hackerCaller(id);
  }

  test("logged out is a 401; hackers are a 403", async () => {
    const chatId = "00000000-0000-4000-8000-000000000000";
    for (const call of [
      caller.coffeeChatRequests.organizerChats(),
      caller.coffeeChatRequests.cancel({ chatId }),
      caller.coffeeChatRequests.moveRoom({ chatId, room: "Rm 2241" }),
    ]) {
      expect((await codeOf(call)).code).toBe("UNAUTHORIZED");
    }
    const hacker = hackerCaller(await makeHacker());
    expect(
      (await codeOf(hacker.coffeeChatRequests.cancel({ chatId }))).code,
    ).toBe("FORBIDDEN");
  });

  test("cancel frees the seat, once", async () => {
    const organizer = await organizerCaller();
    const sponsor = await makeSponsor(1);
    const [a, b] = [await makeHacker(), await makeHacker()];
    const { chatId } = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: a,
      slotTime: "10:00",
    });
    await hackerCaller(a).coffeeChatRequests.respond({
      chatId,
      answer: "accept",
    });

    await expect(
      organizer.coffeeChatRequests.cancel({ chatId }),
    ).resolves.toEqual({ chatId, status: "cancelled" });
    const [mine] = await hackerCaller(a).coffeeChatRequests.mine();
    expect(mine?.status).toBe("cancelled");
    await expect(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: b,
        slotTime: "10:00",
      }),
    ).resolves.toMatchObject({ status: "pending" });

    expect(
      (await codeOf(organizer.coffeeChatRequests.cancel({ chatId }))).code,
    ).toBe("CONFLICT");
    expect(
      (
        await codeOf(
          hackerCaller(a).coffeeChatRequests.respond({
            chatId,
            answer: "decline",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
  });

  test("move room follows the same room rules as offers", async () => {
    const organizer = await organizerCaller();
    // Evening, so morning blocks of other tests aren't in these rooms.
    const evening = { windowStart: "20:00", windowEnd: "21:00" };
    const mover = await makeSponsor(1, { ...evening, room: "Rm 2241" });
    const neighbour = await makeSponsor(1, { ...evening, room: "Rm 2242" });
    const { chatId } = await caller.coffeeChatRequests.offer({
      sponsor: mover,
      userId: await makeHacker(),
      slotTime: "20:00",
    });
    await caller.coffeeChatRequests.offer({
      sponsor: neighbour,
      userId: await makeHacker(),
      slotTime: "20:00",
    });

    // Another sponsor has Rm 2242 at 20:00.
    expect(
      (
        await codeOf(
          organizer.coffeeChatRequests.moveRoom({ chatId, room: "Rm 2242" }),
        )
      ).code,
    ).toBe("CONFLICT");
    // Not a coffee chat room.
    expect(
      (
        await codeOf(
          organizer.coffeeChatRequests.moveRoom({ chatId, room: "Rm 9999" }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
    // A free room works, matched to its listed spelling; the chat's
    // block moves with it.
    await expect(
      organizer.coffeeChatRequests.moveRoom({ chatId, room: " rm 2243 " }),
    ).resolves.toEqual({ chatIds: [chatId], room: "Rm 2243" });

    const { chats, rooms } =
      await organizer.coffeeChatRequests.organizerChats();
    expect(rooms).toEqual(expect.arrayContaining([...COFFEE_CHAT_ROOMS]));
    const moved = chats.find((c) => c.chatId === chatId);
    const board = await organizer.coffeeChatRequests.organizerChatBoard();
    expect(board.holds.find((h) => h.sponsorId === mover)?.room).toBe(
      "Rm 2243",
    );
    expect(moved).toMatchObject({
      room: "Rm 2243",
      status: "pending",
      firstName: "Alex",
      lastName: "Secretlastname",
    });

    // A cancelled chat can't be moved.
    await organizer.coffeeChatRequests.cancel({ chatId });
    expect(
      (
        await codeOf(
          organizer.coffeeChatRequests.moveRoom({ chatId, room: "Rm 2241" }),
        )
      ).code,
    ).toBe("CONFLICT");
  });

  test("unknown chat is a 404", async () => {
    const organizer = await organizerCaller();
    expect(
      (
        await codeOf(
          organizer.coffeeChatRequests.cancel({
            chatId: "00000000-0000-4000-8000-000000000000",
          }),
        )
      ).code,
    ).toBe("NOT_FOUND");
  });
});

describe("coffeeChatRequests.sponsorChats (T19)", () => {
  test("bad UUID 400, unknown UUID 404", async () => {
    expect(
      (await codeOf(caller.coffeeChatRequests.sponsorChats({ sponsor: "x" })))
        .code,
    ).toBe("BAD_REQUEST");
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.sponsorChats({
            sponsor: "00000000-0000-4000-8000-000000000000",
          }),
        )
      ).code,
    ).toBe("NOT_FOUND");
  });

  test("lists only this sponsor's chats with first name, rep and effective status", async () => {
    const sponsor = await makeSponsor(3);
    const other = await makeSponsor(3);
    const [a, b, c, d] = [
      await makeHacker({ firstName: "Ana" }),
      await makeHacker({ firstName: "Ben" }),
      await makeHacker({ firstName: "Cy" }),
      await makeHacker({ firstName: "Di" }),
    ];
    const pending = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: a,
      slotTime: "11:00",
      repName: "Sam",
    });
    const accepted = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: b,
      slotTime: "10:00",
    });
    const declined = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: c,
      slotTime: "10:00",
    });
    await caller.coffeeChatRequests.offer({
      sponsor: other,
      userId: d,
      slotTime: "10:00",
    });
    await hackerCaller(b).coffeeChatRequests.respond({
      chatId: accepted.chatId,
      answer: "accept",
    });
    await hackerCaller(c).coffeeChatRequests.respond({
      chatId: declined.chatId,
      answer: "decline",
    });

    const result = await caller.coffeeChatRequests.sponsorChats({ sponsor });
    expect(result.chats.map((chat) => [chat.firstName, chat.status])).toEqual([
      ["Ben", "accepted"],
      ["Cy", "declined"],
      ["Ana", "pending"],
    ]);
    expect(result.chats[2]).toMatchObject({
      chatId: pending.chatId,
      slotTime: "11:00",
      repName: "Sam",
      room: setups.find((s) => s.sponsor === result.sponsorName)!.room,
    });
    expect(JSON.stringify(result)).not.toContain("Secretlastname");

    // Past the 11:00 chat's cutoff (10:40), the unanswered one is expired.
    vi.setSystemTime(new Date("2026-11-21T10:45:00-05:00"));
    try {
      const later = await caller.coffeeChatRequests.sponsorChats({ sponsor });
      expect(
        later.chats.find((chat) => chat.chatId === pending.chatId),
      ).toMatchObject({ status: "expired" });
    } finally {
      vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
    }
  });
});

describe("coffee chat rooms: lock and moving a block", () => {
  async function organizer() {
    const id = `room-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id, email: `${id}@example.com`, type: "organizer" });
    return hackerCaller(id);
  }

  test("two sponsors racing for one room at one time: exactly one wins", async () => {
    // Their sponsor row locks don't cover each other; the room lock (and
    // room check) does. PGlite runs one transaction at a time, so this is
    // a sequential simulation of the race.
    const org = await organizer();
    const late = { windowStart: "21:00", windowEnd: "21:30", room: null };
    const [first, second] = [
      await makeSponsor(1, late),
      await makeSponsor(1, late),
    ];
    const results = await Promise.allSettled(
      [first, second].map((sponsorId) =>
        org.coffeeChatRequests.createHold({
          sponsorId,
          room: "Rm 2243",
          startTime: "21:00",
          endTime: "21:30",
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "CONFLICT",
    });
  });

  test("move room moves the chat's whole block, and later offers follow", async () => {
    const org = await organizer();
    const late = { windowStart: "21:30", windowEnd: "23:00", room: null };
    const sponsor = await makeSponsor(3, late);
    const other = await makeSponsor(1, late);
    await org.coffeeChatRequests.createHold({
      sponsorId: sponsor,
      room: "Rm 2241",
      startTime: "21:30",
      endTime: "22:30",
    });
    await org.coffeeChatRequests.createHold({
      sponsorId: other,
      room: "Rm 2243",
      startTime: "22:15",
      endTime: "22:45",
    });
    const booked = [
      await caller.coffeeChatRequests.offer({
        sponsor,
        userId: await makeHacker(),
        slotTime: "21:30",
      }),
      await caller.coffeeChatRequests.offer({
        sponsor,
        userId: await makeHacker(),
        slotTime: "21:30",
      }),
      await caller.coffeeChatRequests.offer({
        sponsor,
        userId: await makeHacker(),
        slotTime: "21:45",
      }),
    ];

    // Rm 2243 is the other sponsor's from 22:15, inside this block.
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.moveRoom({
            chatId: booked[0]!.chatId,
            room: "Rm 2243",
          }),
        )
      ).code,
    ).toBe("CONFLICT");

    const moved = await org.coffeeChatRequests.moveRoom({
      chatId: booked[0]!.chatId,
      room: "Rm 2242",
    });
    expect(moved.room).toBe("Rm 2242");
    expect([...moved.chatIds].sort()).toEqual(
      booked.map((o) => o.chatId).sort(),
    );
    const { chats } = await org.coffeeChatRequests.organizerChats();
    expect(
      booked.map((o) => chats.find((c) => c.chatId === o.chatId)?.room),
    ).toEqual(["Rm 2242", "Rm 2242", "Rm 2242"]);

    // A later offer in the block joins the moved room.
    await expect(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: await makeHacker(),
        slotTime: "22:00",
      }),
    ).resolves.toMatchObject({ room: "Rm 2242" });
  });
});

describe("coffeeChatRequests.hackerByCode (typed or scanned code)", () => {
  test("finds a hacker by hacker ID (any case/spacing) or user id, first name only", async () => {
    const sponsor = await makeSponsor(1);
    const id = await makeHacker({ firstName: "Robin" });
    const hackerId = "brave-otter-kite";
    await db.update(users).set({ hackerId }).where(eq(users.id, id));

    for (const code of [
      hackerId,
      ` ${hackerId.toUpperCase().replace(/-/g, " ")} `,
      id,
    ]) {
      const found = await caller.coffeeChatRequests.hackerByCode({
        sponsor,
        code,
      });
      expect(found).toEqual({ userId: id, firstName: "Robin", links: null });
    }
  });

  test("same 404 for unknown codes and non-admitted hackers; bad UUID 400", async () => {
    const sponsor = await makeSponsor(1);
    const pendingApp = await makeHacker({ status: "PENDING_REVIEW" });
    await db
      .update(users)
      .set({ hackerId: "calm-panda-lamp" })
      .where(eq(users.id, pendingApp));
    for (const code of [
      "calm-panda-lamp",
      "nobody-here-atall",
      pendingApp,
      "zzz",
    ]) {
      const error = await codeOf(
        caller.coffeeChatRequests.hackerByCode({ sponsor, code }),
      );
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("That badge isn't a Hack Western hacker.");
    }
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.hackerByCode({ sponsor: "x", code: "a" }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
  });
});

describe("coffeeChatRequests.myHackerId (T36)", () => {
  test("returns only the caller's own code, null when none, 401 signed out", async () => {
    const me = await makeHacker();
    const other = await makeHacker();
    await db
      .update(users)
      .set({ hackerId: "merry-moose-lamp-t36" })
      .where(eq(users.id, me));
    await db
      .update(users)
      .set({ hackerId: "quiet-heron-kite-t36" })
      .where(eq(users.id, other));
    const noCode = await makeHacker();

    expect(await hackerCaller(me).coffeeChatRequests.myHackerId()).toEqual({
      hackerId: "merry-moose-lamp-t36",
    });
    expect(await hackerCaller(other).coffeeChatRequests.myHackerId()).toEqual({
      hackerId: "quiet-heron-kite-t36",
    });
    // No code yet: null, and reading it doesn't issue one.
    expect(await hackerCaller(noCode).coffeeChatRequests.myHackerId()).toEqual({
      hackerId: null,
    });
    const [row] = await db
      .select({ hackerId: users.hackerId })
      .from(users)
      .where(eq(users.id, noCode));
    expect(row?.hackerId).toBeNull();

    expect((await codeOf(caller.coffeeChatRequests.myHackerId())).code).toBe(
      "UNAUTHORIZED",
    );
  });
});

describe("coffeeChatRequests room blocks", () => {
  async function organizer() {
    const id = `block-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id, email: `${id}@example.com`, type: "organizer" });
    return hackerCaller(id);
  }
  // Afternoon, no sheet room: no block until a test gives one. Each test
  // uses its own hour so blocks from other tests aren't in the way.
  const afternoon = (start: string, end: string) => ({
    windowStart: start,
    windowEnd: end,
    room: null,
  });

  test("organizers only; a coffee chat room, 15 min to 1 hr 30", async () => {
    const sponsorId = await makeSponsor(1, afternoon("13:00", "14:00"));
    const give = { sponsorId, room: "Rm 2241", startTime: "13:00" };
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.createHold({ ...give, endTime: "13:30" }),
        )
      ).code,
    ).toBe("UNAUTHORIZED");
    const org = await organizer();
    for (const room of ["Rm 2230", "2241"]) {
      expect(
        (
          await codeOf(
            org.coffeeChatRequests.createHold({
              ...give,
              room,
              endTime: "13:30",
            }),
          )
        ).code,
      ).toBe("BAD_REQUEST");
    }
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.createHold({ ...give, endTime: "14:45" }),
        )
      ).message,
    ).toBe(errors.holdTimes);
    await expect(
      org.coffeeChatRequests.createHold({
        ...give,
        room: " rm  2241 ",
        endTime: "14:30",
      }),
    ).resolves.toMatchObject({ chatIds: [] });
  });

  test("two sponsors never overlap a room; a sponsor is in one room at a time", async () => {
    const org = await organizer();
    const first = await makeSponsor(1, afternoon("15:00", "16:00"));
    const second = await makeSponsor(1, afternoon("15:00", "16:00"));
    await org.coffeeChatRequests.createHold({
      sponsorId: first,
      room: "Rm 2242",
      startTime: "15:00",
      endTime: "15:30",
    });
    const clash = await codeOf(
      org.coffeeChatRequests.createHold({
        sponsorId: second,
        room: "Rm 2242",
        startTime: "15:15",
        endTime: "15:45",
      }),
    );
    expect(clash.code).toBe("CONFLICT");
    expect(clash.message).toContain("Rm 2242");
    // Back to back is fine; so is another room.
    await org.coffeeChatRequests.createHold({
      sponsorId: second,
      room: "Rm 2242",
      startTime: "15:30",
      endTime: "16:00",
    });
    // The first sponsor can't be in Rm 2243 while they're in Rm 2242.
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.createHold({
            sponsorId: first,
            room: "Rm 2243",
            startTime: "15:15",
            endTime: "15:45",
          }),
        )
      ).message,
    ).toBe(errors.ownBlockOverlap);
  });

  test("a block must fit one of the sponsor's chats", async () => {
    const org = await organizer();
    const groups = await makeSponsor(1, {
      ...afternoon("16:00", "17:00"),
      durationMinutes: 30,
      groupSize: 3,
    });
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.createHold({
            sponsorId: groups,
            room: "Rm 2243",
            startTime: "16:00",
            endTime: "16:15",
          }),
        )
      ).message,
    ).toBe(errors.blockTooShort(30));
  });

  test("offers land in the block; no block = ask the sponsor team", async () => {
    const org = await organizer();
    const sponsor = await makeSponsor(3, afternoon("17:00", "18:00"));
    const [a, b] = [await makeHacker(), await makeHacker()];
    const noBlock = await codeOf(
      caller.coffeeChatRequests.offer({
        sponsor,
        userId: a,
        slotTime: "17:00",
      }),
    );
    expect(noBlock.message).toBe(errors.noBlock);

    const { holdId } = await org.coffeeChatRequests.createHold({
      sponsorId: sponsor,
      room: "Rm 2241",
      startTime: "17:00",
      endTime: "17:30",
    });
    const offer = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: a,
      slotTime: "17:15",
    });
    expect(offer.room).toBe("Rm 2241");
    await caller.coffeeChatRequests.offer({
      sponsor,
      userId: b,
      slotTime: "17:15",
    });

    // 1-on-1 with 3 reps: each slot needs 3 hackers (0/3), not people / 6.
    const board = await org.coffeeChatRequests.organizerChatBoard();
    const block = board.holds.find((h) => h.holdId === holdId)!;
    expect(block.slots.map((s) => [s.slotTime, s.booked, s.needed])).toEqual([
      ["17:00", 0, 3],
      ["17:15", 2, 3],
    ]);
    expect(block.needsHacker).toBe(true);

    // The sponsor sees their block filling up.
    const mine = await caller.coffeeChatRequests.sponsorChats({ sponsor });
    expect(mine.holds[0]).toMatchObject({
      room: "Rm 2241",
      filled: 2,
      total: 6,
      firstOpen: "17:00",
    });

    // Cutting the booked slot off, or releasing the room, is refused.
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.moveHold({
            holdId,
            room: "Rm 2241",
            startTime: "17:00",
            endTime: "17:15",
          }),
        )
      ).message,
    ).toBe(errors.blockDropsChats);
    expect(
      (await codeOf(org.coffeeChatRequests.deleteHold({ holdId }))).message,
    ).toBe(errors.blockHasChats);
    // Longer is fine.
    await org.coffeeChatRequests.moveHold({
      holdId,
      room: "Rm 2241",
      startTime: "17:00",
      endTime: "17:45",
    });
  });

  test("an empty block can be released", async () => {
    const org = await organizer();
    const sponsor = await makeSponsor(1, afternoon("18:00", "19:00"));
    const { holdId } = await org.coffeeChatRequests.createHold({
      sponsorId: sponsor,
      room: "Rm 2243",
      startTime: "18:00",
      endTime: "18:30",
    });
    await expect(
      org.coffeeChatRequests.deleteHold({ holdId }),
    ).resolves.toEqual({ holdId });
    expect(
      (await codeOf(org.coffeeChatRequests.deleteHold({ holdId }))).code,
    ).toBe("NOT_FOUND");
  });
});

describe("coffeeChatRequests organizer ad hoc chats (T43)", () => {
  async function organizer() {
    const id = `adhoc-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id, email: `${id}@example.com`, type: "organizer" });
    return hackerCaller(id);
  }
  // A block 19:00-20:00 in a test-only room (see makeSponsor).
  const evening = {
    windowStart: "19:00",
    windowEnd: "20:00",
    room: "Rm Evening",
  };

  test("search finds admitted hackers by name, email or hacker ID", async () => {
    const org = await organizer();
    const hacker = await makeHacker({ firstName: "Zebulon" });
    const code = `quiet-heron-${n}`;
    await db.update(users).set({ hackerId: code }).where(eq(users.id, hacker));
    const pending = await makeHacker({
      firstName: "Zebulon",
      status: "PENDING_REVIEW",
    });

    const byName = await org.coffeeChatRequests.searchHackers({
      query: "zebulon secret",
    });
    expect(byName.map((h) => h.userId)).toEqual([hacker]);
    expect(byName[0]).toMatchObject({
      name: "Zebulon Secretlastname",
      email: `${hacker}@example.com`,
      hackerId: code,
    });
    expect(
      (
        await org.coffeeChatRequests.searchHackers({ query: `${hacker}@ex` })
      ).map((h) => h.userId),
    ).toEqual([hacker]);
    expect(
      (
        await org.coffeeChatRequests.searchHackers({ query: "Quiet Heron" })
      ).map((h) => h.userId),
    ).toContain(hacker);
    // Not admitted: never listed. Wildcards are literal.
    expect(
      (await org.coffeeChatRequests.searchHackers({ query: `${pending}@` }))
        .length,
    ).toBe(0);
    expect(
      (await org.coffeeChatRequests.searchHackers({ query: "%%" })).length,
    ).toBe(0);

    expect(
      (await codeOf(caller.coffeeChatRequests.searchHackers({ query: "ze" })))
        .code,
    ).toBe("UNAUTHORIZED");
    expect(
      (
        await codeOf(
          hackerCaller(hacker).coffeeChatRequests.searchHackers({
            query: "ze",
          }),
        )
      ).code,
    ).toBe("FORBIDDEN");
  });

  test("adds a pending chat with the sponsor offer's rules and notification", async () => {
    const org = await organizer();
    const sponsorId = await makeSponsor(1, evening);
    const hacker = await makeHacker();
    const notify = vi.mocked(notifyCoffeeChat);
    notify.mockClear();

    const chat = await org.coffeeChatRequests.organizerOffer({
      sponsorId,
      userId: hacker,
      slotTime: "19:00",
      repName: "Priya",
    });
    expect(chat).toMatchObject({ status: "pending", slotTime: "19:00" });
    expect(notify.mock.calls).toEqual([["offered", { id: chat.chatId }]]);
    const [mine] = await hackerCaller(hacker).coffeeChatRequests.mine();
    expect(mine).toMatchObject({ chatId: chat.chatId, repName: "Priya" });

    // Same rules as the sponsor's offer: one rep -> the slot is full,
    // outside a block is refused, the hacker can't be double booked.
    const other = await makeHacker();
    const rule = (slotTime: string, userId = other) =>
      codeOf(
        org.coffeeChatRequests.organizerOffer({ sponsorId, userId, slotTime }),
      );
    expect((await rule("19:00")).message).toBe(coffeeChatCopy.errors.full);
    expect((await rule("20:30")).message).toBe(coffeeChatCopy.errors.noBlock);
    const second = await makeSponsor(1, evening);
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.organizerOffer({
            sponsorId: second,
            userId: hacker,
            slotTime: "19:00",
          }),
        )
      ).message,
    ).toBe(coffeeChatCopy.errors.hackerBusy);

    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.organizerOffer({
            sponsorId,
            userId: other,
            slotTime: "19:15",
          }),
        )
      ).code,
    ).toBe("UNAUTHORIZED");
  });
});

describe("coffeeChatRequests.setCoffeeChatWatcher (T44)", () => {
  test("organizers set who watches; sponsors see the name", async () => {
    const orgId = `watch-organizer-${++n}`;
    await db.insert(users).values({
      id: orgId,
      email: `${orgId}@example.com`,
      name: "Watcher Wendy",
      type: "organizer",
    });
    const org = hackerCaller(orgId);
    const sponsor = await makeSponsor(1);

    expect(
      (await caller.coffeeChatRequests.freeTimes({ sponsor })).watcherName,
    ).toBeNull();
    await expect(
      org.coffeeChatRequests.setCoffeeChatWatcher({
        sponsorId: sponsor,
        watcher: "  Wendy  ",
      }),
    ).resolves.toEqual({ sponsorId: sponsor, watcher: "Wendy" });
    expect(
      (await caller.coffeeChatRequests.freeTimes({ sponsor })).watcherName,
    ).toBe("Wendy");
    expect(
      (await caller.coffeeChatRequests.sponsorChats({ sponsor })).watcherName,
    ).toBe("Wendy");
    const board = await org.coffeeChatRequests.organizerChatBoard();
    expect(board.sponsors.find((s) => s.sponsorId === sponsor)?.watcher).toBe(
      "Wendy",
    );
    expect(board.watchers).toContain("Watcher Wendy");

    // Blank clears it.
    await org.coffeeChatRequests.setCoffeeChatWatcher({
      sponsorId: sponsor,
      watcher: " ",
    });
    expect(
      (await caller.coffeeChatRequests.freeTimes({ sponsor })).watcherName,
    ).toBeNull();

    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.setCoffeeChatWatcher({
            sponsorId: sponsor,
            watcher: "Me",
          }),
        )
      ).code,
    ).toBe("UNAUTHORIZED");
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.setCoffeeChatWatcher({
            sponsorId: "00000000-0000-4000-8000-000000000000",
            watcher: "Wendy",
          }),
        )
      ).code,
    ).toBe("NOT_FOUND");
  });
});

describe("coffeeChatRequests.organizerChatBoard (T48)", () => {
  test("401 logged out, 403 for hackers", async () => {
    expect(
      (await codeOf(caller.coffeeChatRequests.organizerChatBoard())).code,
    ).toBe("UNAUTHORIZED");
    const hacker = hackerCaller(await makeHacker());
    expect(
      (await codeOf(hacker.coffeeChatRequests.organizerChatBoard())).code,
    ).toBe("FORBIDDEN");
  });

  test("every sponsor with request, chats, hacker codes and blocks", async () => {
    const orgId = `board-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id: orgId, email: `${orgId}@example.com`, type: "organizer" });
    const org = hackerCaller(orgId);
    const sponsor = await makeSponsor(2, {
      windowStart: "13:00",
      windowEnd: "14:00",
      durationMinutes: 30,
      groupSize: 3,
      room: "Rm Board",
    });
    const hacker = await makeHacker({ firstName: "Boardy" });
    await db
      .update(users)
      .set({ hackerId: `board-code-${n}` })
      .where(eq(users.id, hacker));
    const { chatId } = await org.coffeeChatRequests.organizerOffer({
      sponsorId: sponsor,
      userId: hacker,
      slotTime: "13:30",
      repName: "Riley",
    });

    const board = await org.coffeeChatRequests.organizerChatBoard();
    const column = board.sponsors.find((s) => s.sponsorId === sponsor)!;
    expect(column).toMatchObject({
      setUp: true,
      request: { style: "group", perSlot: 3, durationMinutes: 30 },
      counts: { accepted: 0, pending: 1, total: 1 },
      blockMinutes: 60,
      booked: 1,
    });
    const block = board.holds.find((h) => h.sponsorId === sponsor)!;
    expect(block.slots.find((x) => x.slotTime === "13:30")).toMatchObject({
      booked: 1,
      needed: 3,
      chatIds: [chatId],
    });
    expect(board.chats.find((c) => c.chatId === chatId)).toMatchObject({
      firstName: "Boardy",
      hackerId: `board-code-${n}`,
      repName: "Riley",
      status: "pending",
    });
    expect(board.slots).toContain("13:45");
    expect(board.assignableRooms).toEqual([...COFFEE_CHAT_ROOMS]);
  });
});

describe("coffeeChatRequests: chat requests and asks for fewer (v2)", () => {
  test("a sponsor sets their own request; organizers can set it for them", async () => {
    const a = await makeSponsor(1);
    const b = await makeSponsor(1);
    await caller.coffeeChatRequests.setChatRequest({
      sponsor: a,
      style: "group",
      perSlot: 3,
    });
    // Never more than 3 hackers per slot.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.setChatRequest({
            sponsor: a,
            style: "group",
            perSlot: 4,
          }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
    const mine = await caller.coffeeChatRequests.sponsorChats({ sponsor: a });
    expect(mine.request).toMatchObject({
      style: "group",
      perSlot: 3,
      source: "sponsor",
    });
    expect(
      (await caller.coffeeChatRequests.sponsorChats({ sponsor: b })).request
        .perSlot,
    ).toBe(1);
    // Organizer only.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.organizerSetChatRequest({
            sponsorId: b,
            style: "oneOnOne",
            perSlot: 3,
          }),
        )
      ).code,
    ).toBe("UNAUTHORIZED");
    const orgId = `request-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id: orgId, email: `${orgId}@example.com`, type: "organizer" });
    await hackerCaller(orgId).coffeeChatRequests.organizerSetChatRequest({
      sponsorId: b,
      style: "oneOnOne",
      perSlot: 3,
    });
    expect(
      (await caller.coffeeChatRequests.sponsorChats({ sponsor: b })).request,
    ).toMatchObject({ style: "oneOnOne", perSlot: 3 });
  });

  test("ask for fewer lowers a slot, refuses below booked, and clears", async () => {
    // 1-on-1 with 2 reps, block 10:00-12:00.
    const sponsor = await makeSponsor(2);
    const hacker = await makeHacker();
    await caller.coffeeChatRequests.offer({
      sponsor,
      userId: hacker,
      slotTime: "10:00",
    });
    await caller.coffeeChatRequests.askForFewer({
      sponsor,
      startTime: "11:00",
      endTime: "12:00",
      hackers: 0,
    });
    let mine = await caller.coffeeChatRequests.sponsorChats({ sponsor });
    expect(mine.limits).toEqual([
      { sponsorId: sponsor, startTime: "11:00", endTime: "12:00", hackers: 0 },
    ]);
    const slot = (t: string) =>
      mine.holds[0]!.slots.find((x) => x.slotTime === t)!;
    expect(slot("11:00")).toMatchObject({ needed: 0, lowered: true });
    expect(slot("10:45")).toMatchObject({ needed: 2, lowered: false });
    // No chat then: an offer at 11:15 is full.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor,
            userId: await makeHacker(),
            slotTime: "11:15",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
    // One hacker is booked at 10:00: asking for 0 then is refused.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.askForFewer({
            sponsor,
            startTime: "10:00",
            endTime: "10:15",
            hackers: 0,
          }),
        )
      ).code,
    ).toBe("CONFLICT");
    // Asking for the full request again clears the ask.
    await expect(
      caller.coffeeChatRequests.askForFewer({
        sponsor,
        startTime: "11:00",
        endTime: "12:00",
        hackers: 2,
      }),
    ).resolves.toEqual({ cleared: true });
    mine = await caller.coffeeChatRequests.sponsorChats({ sponsor });
    expect(mine.limits).toEqual([]);
  });
});

describe("coffeeChatRequests v2: review fixes", () => {
  async function organizer() {
    const orgId = `fix-organizer-${++n}`;
    await db
      .insert(users)
      .values({ id: orgId, email: `${orgId}@example.com`, type: "organizer" });
    return hackerCaller(orgId);
  }

  test("a request can't drop below hackers already booked in a slot", async () => {
    const sponsor = await makeSponsor(2);
    for (const userId of [await makeHacker(), await makeHacker()]) {
      await caller.coffeeChatRequests.offer({
        sponsor,
        userId,
        slotTime: "10:00",
      });
    }
    const lower = await codeOf(
      caller.coffeeChatRequests.setChatRequest({
        sponsor,
        style: "oneOnOne",
        perSlot: 1,
      }),
    );
    expect(lower.code).toBe("CONFLICT");
    expect(lower.message).toBe(errors.requestBelowBooked("10:00 AM", 2));
    const org = await organizer();
    expect(
      (
        await codeOf(
          org.coffeeChatRequests.organizerSetChatRequest({
            sponsorId: sponsor,
            style: "group",
            perSlot: 1,
          }),
        )
      ).code,
    ).toBe("CONFLICT");
    // Same count or more is fine.
    await expect(
      caller.coffeeChatRequests.setChatRequest({
        sponsor,
        style: "group",
        perSlot: 2,
      }),
    ).resolves.toMatchObject({ style: "group", perSlot: 2 });
  });

  test("ask for fewer: one slot or inside one hour, inside own block", async () => {
    // Block 10:00-12:00.
    const sponsor = await makeSponsor(2);
    const bad = async (startTime: string, endTime: string) =>
      (
        await codeOf(
          caller.coffeeChatRequests.askForFewer({
            sponsor,
            startTime,
            endTime,
            hackers: 1,
          }),
        )
      ).code;
    expect(await bad("10:00", "12:00")).toBe("BAD_REQUEST"); // two hours
    expect(await bad("10:30", "11:15")).toBe("BAD_REQUEST"); // across 11:00
    expect(await bad("12:00", "12:15")).toBe("BAD_REQUEST"); // past the block
    expect(await bad("09:45", "10:00")).toBe("BAD_REQUEST"); // before it
    await caller.coffeeChatRequests.askForFewer({
      sponsor,
      startTime: "11:00",
      endTime: "12:00",
      hackers: 1,
    });
  });

  test("a sponsor's ask for fewer never touches another sponsor", async () => {
    const a = await makeSponsor(2);
    const b = await makeSponsor(2, {
      windowStart: "13:00",
      windowEnd: "14:00",
    });
    // A asks inside its own block; B's block and slots don't change.
    await caller.coffeeChatRequests.askForFewer({
      sponsor: a,
      startTime: "10:00",
      endTime: "10:15",
      hackers: 0,
    });
    // A can't reach into B's block time.
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.askForFewer({
            sponsor: a,
            startTime: "13:00",
            endTime: "13:15",
            hackers: 0,
          }),
        )
      ).code,
    ).toBe("BAD_REQUEST");
    const theirs = await caller.coffeeChatRequests.sponsorChats({ sponsor: b });
    expect(theirs.limits).toEqual([]);
    expect(theirs.holds[0]!.slots.every((x) => x.needed === 2)).toBe(true);
    const mine = await caller.coffeeChatRequests.sponsorChats({ sponsor: a });
    expect(mine.limits.map((l) => l.sponsorId)).toEqual([a]);
  });

  test("Give room still works while the sheet can't be read", async () => {
    const sponsor = await makeSponsor(1, { room: null });
    const org = await organizer();
    vi.mocked(getRunOfShow).mockRejectedValueOnce(new Error("sheet down"));
    await expect(
      org.coffeeChatRequests.createHold({
        sponsorId: sponsor,
        room: "Rm 2241",
        startTime: "19:00",
        endTime: "19:30",
      }),
    ).resolves.toMatchObject({ chatIds: [] });
  });
});
