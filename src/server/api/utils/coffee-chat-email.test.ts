import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import type { CoffeeChatSetup } from "~/lib/run-of-show";
import type * as Env from "~/env";
import type * as RunOfShowSheet from "~/server/api/utils/run-of-show-sheet";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { coffeeChatOfferEmail } from "~/server/api/utils/coffee-chat-email";
import {
  NOTIFY_TIMEOUT_MS,
  notifyCoffeeChat,
} from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import { sendViaMailjet } from "~/server/mail-mailjet";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: "test-key",
      // Safe dummy so modules that read it at import load with no .env.
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
      MAILJET_SECRET_KEY: "test-secret",
      // Never a real Slack call: no token means the DM is skipped.
      SLACK_BOT_TOKEN: undefined,
    },
  };
});

// Mocked Mailjet: never a real send.
vi.mock("~/server/mail-mailjet", () => ({
  sendViaMailjet: vi.fn(async () => ({
    data: { delivered: [], queued: [], bounced: [] },
    error: null,
  })),
}));

// The sheet mirror writes to the real run-of-show sheet: never from a test.
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: vi.fn(async () => undefined),
}));

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

const send = vi.mocked(sendViaMailjet);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  send.mockClear();
});

let n = 0;
async function makeSponsor(room: string | null = "Rm 2241") {
  const name = `Email Sponsor ${++n}`;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name, coffeeChatStyle: "oneOnOne", coffeeChatPerSlot: 2 })
    .returning();
  setups.push({
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
    room,
  });
  // Offers need a room block (blocks own rooms; v2).
  // Its own room, so sponsors from other tests never share it at once.
  if (room) {
    await db.insert(coffeeChatHolds).values({
      sponsorId: row!.id,
      room: `${room} ${n}`,
      startTime: "10:00",
      endTime: "11:30",
    });
  }
  return { id: row!.id, name };
}

async function makeHacker(
  status: "CONFIRMED" | "PENDING_REVIEW" = "CONFIRMED",
) {
  const id = `email-hacker-${++n}`;
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    name: "Sam Lastname",
    type: "hacker",
  });
  await db.insert(applications).values({
    userId: id,
    status,
    firstName: "Sam",
    lastName: "Lastname",
    githubLink: "",
    linkedInLink: "",
    devpostLink: "",
    resumeLink: "",
  });
  return id;
}

async function makeChat(
  sponsorId: string,
  userId: string,
  room: string | null = "Rm 2241",
) {
  const [chat] = await db
    .insert(coffeeChats)
    .values({ sponsorId, userId, room, slotTime: "10:15", durationMinutes: 15 })
    .returning();
  return chat!;
}

describe("coffee chat offer email (T17)", () => {
  test("one email per offer with sponsor, room, time, and a /live link", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker();
    const chat = await makeChat(sponsor.id, hacker);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(send).toHaveBeenCalledTimes(1);
    const [options, creds] = send.mock.calls[0]!;
    expect(options.to).toBe(`${hacker}@example.com`);
    expect(options.subject).toContain(sponsor.name);
    for (const part of [options.html, options.text ?? ""]) {
      expect(part).toContain(sponsor.name);
      expect(part).toContain("Rm 2241");
      expect(part).toContain("10:15 AM");
      expect(part).toContain("https://www.hackwestern.com/live");
      expect(part).toContain("Sam");
    }
    expect(creds).toEqual({ apiKey: "test-key", secretKey: "test-secret" });
  });

  test('says "room TBA" when the sponsor has no room yet', async () => {
    const sponsor = await makeSponsor(null);
    const hacker = await makeHacker();
    const chat = await makeChat(sponsor.id, hacker, null);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].text).toContain("room TBA");
  });

  test("no email to a hacker who isn't admitted", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker("PENDING_REVIEW");
    const chat = await makeChat(sponsor.id, hacker);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(send).not.toHaveBeenCalled();
  });

  test("no email for answers", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker();
    const chat = await makeChat(sponsor.id, hacker);

    for (const event of ["accepted", "declined"] as const) {
      await notifyCoffeeChat(event, { id: chat.id });
    }

    expect(send).not.toHaveBeenCalled();
  });

  test("a Mailjet failure is logged, never thrown", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker();
    const chat = await makeChat(sponsor.id, hacker);
    send.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      notifyCoffeeChat("offered", { id: chat.id }),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      "coffee chat email notification failed (offered):",
      "Mailjet send failed: boom",
    );
    log.mockRestore();
  });

  test("the offer mutation sends exactly one email after it commits", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker();
    const caller = createCaller(createInnerTRPCContext({ session: null }));

    const offer = await caller.coffeeChatRequests.offer({
      sponsor: sponsor.id,
      userId: hacker,
      slotTime: "10:00",
    });

    expect(offer.status).toBe("pending");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0].to).toBe(`${hacker}@example.com`);
  });

  test("a hanging channel holds the offer up no longer than the cap", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker();
    const caller = createCaller(createInnerTRPCContext({ session: null }));
    // Mailjet never answers.
    let mailjetCalled!: () => void;
    const called = new Promise<void>((resolve) => (mailjetCalled = resolve));
    send.mockImplementationOnce(() => {
      mailjetCalled();
      return new Promise(() => undefined);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
    let settledAt: number | null = null;

    const offer = caller.coffeeChatRequests
      .offer({ sponsor: sponsor.id, userId: hacker, slotTime: "10:30" })
      .finally(() => (settledAt = Date.now()));
    // The DB work runs on real I/O; the cap timer starts before Mailjet.
    await called;
    const start = Date.now();
    for (let t = 0; settledAt === null && t < NOTIFY_TIMEOUT_MS * 3; t += 100) {
      await vi.advanceTimersByTimeAsync(100);
    }

    expect((await offer).status).toBe("pending");
    expect(send).toHaveBeenCalledTimes(1);
    expect(settledAt).not.toBeNull();
    expect(settledAt! - start).toBeGreaterThan(0);
    expect(settledAt! - start).toBeLessThanOrEqual(NOTIFY_TIMEOUT_MS + 100);
    log.mockRestore();
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
  });

  test("escapes the sponsor name in the HTML", () => {
    const { html } = coffeeChatOfferEmail({
      sponsorName: "<b>Evil</b> & Co",
      hackerFirstName: "Sam",
      slotTime: "13:00",
      durationMinutes: 30,
      room: null,
    });
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(html).toContain("1:00 PM (30 min)");
  });
});
