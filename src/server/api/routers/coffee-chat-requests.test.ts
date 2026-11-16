import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type { CoffeeChatSetup } from "~/lib/run-of-show";
import type * as RunOfShowSheet from "~/server/api/utils/run-of-show-sheet";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  applications,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

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
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name, coffeeChatReps: reps })
    .returning();
  setups.push({
    sponsor: name,
    windowStart: "10:00",
    windowEnd: "12:00",
    durationMinutes: 15,
    groupSize: 1,
    slots: null,
    hackers: null,
    format: "Individual (15 mins)",
    room: `Rm ${2240 + n}`,
    ...setup,
  });
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
  test("seats used never pass coffeeChatSeats(reps, group size)", async () => {
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

    // 10 reps still cap at 3 parallel 1-on-1s: the room fits 6 people.
    const big = await makeSponsor(10);
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

  test("another sponsor in the same room at that time blocks the offer", async () => {
    const first = await makeSponsor(1, { room: "Rm Shared" });
    const second = await makeSponsor(1, { room: "rm  shared" });
    await caller.coffeeChatRequests.offer({
      sponsor: first,
      userId: await makeHacker(),
      slotTime: "10:00",
    });
    expect(
      (
        await codeOf(
          caller.coffeeChatRequests.offer({
            sponsor: second,
            userId: await makeHacker(),
            slotTime: "10:00",
          }),
        )
      ).code,
    ).toBe("CONFLICT");
  });

  test("room comes from the sheet row and may be unassigned", async () => {
    const sponsor = await makeSponsor(1, { room: null });
    const offer = await caller.coffeeChatRequests.offer({
      sponsor,
      userId: await makeHacker(),
      slotTime: "10:00",
    });
    expect(offer.room).toBeNull();
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
    expect(all).toMatchObject({ durationMinutes: 15, groupSize: 1, reps: 1 });

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
    ).toEqual({ slotTime: "10:00", seatsLeft: 1 });
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
    const mover = await makeSponsor(1, { room: "Rm 2241" });
    const neighbour = await makeSponsor(1, { room: "Rm 2242" });
    const { chatId } = await caller.coffeeChatRequests.offer({
      sponsor: mover,
      userId: await makeHacker(),
      slotTime: "10:00",
    });
    await caller.coffeeChatRequests.offer({
      sponsor: neighbour,
      userId: await makeHacker(),
      slotTime: "10:00",
    });

    // Another sponsor is in Rm 2242 at 10:00.
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
    // A free room works, matched to its listed spelling.
    await expect(
      organizer.coffeeChatRequests.moveRoom({ chatId, room: " rm 2243 " }),
    ).resolves.toEqual({ chatId, room: "Rm 2243" });

    const { chats, rooms } =
      await organizer.coffeeChatRequests.organizerChats();
    expect(rooms).toEqual(
      expect.arrayContaining(["Rm 2241", "Rm 2242", "Rm 2243"]),
    );
    const moved = chats.find((c) => c.chatId === chatId);
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
