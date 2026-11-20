import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import {
  desiredReminder,
  planReminder,
  reminderText,
  syncAllCoffeeChatReminders,
  syncCoffeeChatReminder,
  type ReminderContent,
  type StoredReminder,
} from "~/server/api/utils/coffee-chat-reminder";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatReminders,
  coffeeChatReps,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return { env: { ...original.env, SLACK_BOT_TOKEN: "xoxb-test-token" } };
});

// The sheet mirror writes to the real run-of-show sheet: never from a test.
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: vi.fn(async () => undefined),
}));

/** Chat day, Eastern (UTC-5). */
const at = (clock: string) => new Date(`2026-11-21T${clock}:00-05:00`);

const CONTENT: ReminderContent = {
  sponsorName: "Acme",
  slotTime: "10:00",
  durationMinutes: 30,
  room: "Rm 2241",
  group: true,
};
const accepted = { ...CONTENT, status: "accepted" as const, expiresAt: null };

describe("reminder text", () => {
  test("group chat", () => {
    expect(reminderText(CONTENT, 15)).toBe(
      "☕ Your Group Coffee Chat with *Acme* starts in 15 min!\n🕒 Saturday 10:00 AM · 30 min\n📍 Rm 2241 (near the Sponsor Bay)",
    );
  });

  test("1-on-1, room TBA, escaped sponsor", () => {
    expect(
      reminderText(
        {
          ...CONTENT,
          sponsorName: "A&B <Co>",
          durationMinutes: 15,
          room: null,
          group: false,
        },
        15,
      ),
    ).toBe(
      "☕ Your 1-on-1 Coffee Chat with *A&amp;B &lt;Co&gt;* starts in 15 min!\n🕒 Saturday 10:00 AM · 15 min\n📍 room TBA",
    );
  });

  test("unknown style: plain coffee chat", () => {
    expect(reminderText({ ...CONTENT, group: null }, 15)).toMatch(
      /^☕ Your coffee chat with \*Acme\*/,
    );
  });
});

describe("desiredReminder (time math)", () => {
  test("scheduled 15 minutes before", () => {
    const d = desiredReminder(accepted, at("09:00"))!;
    expect(d.mode).toBe("schedule");
    expect(d.postAt).toEqual(at("09:45"));
    expect(d.text).toMatch(/starts in 15 min!/);
  });

  test("under 15 minutes away: sent now with the real minutes", () => {
    const d = desiredReminder(accepted, at("09:52"))!;
    expect(d.mode).toBe("now");
    expect(d.text).toMatch(/starts in 8 min!/);
  });

  test("post time under 2 minutes away: sent now, not scheduled", () => {
    const d = desiredReminder(accepted, new Date(at("09:44").getTime()))!;
    expect(d.mode).toBe("now");
    expect(d.text).toMatch(/starts in 16 min!/);
  });

  test("already started: nothing", () => {
    expect(desiredReminder(accepted, at("10:00"))).toBeNull();
    expect(desiredReminder(accepted, at("10:10"))).toBeNull();
  });

  test("only accepted chats", () => {
    for (const status of ["pending", "declined", "cancelled", "expired"]) {
      expect(
        desiredReminder(
          { ...accepted, status: status as "pending" },
          at("09:00"),
        ),
      ).toBeNull();
    }
  });
});

describe("planReminder", () => {
  const now = at("09:00");
  const want = desiredReminder(accepted, now)!;
  const stored = (over: Partial<StoredReminder> = {}): StoredReminder => ({
    chatId: "c",
    slackChannel: "D1",
    messageId: "Q1",
    kind: "scheduled",
    postAt: at("09:45"),
    contentKey: want.contentKey,
    createdAt: now,
    ...over,
  });

  test("same content: keep", () => {
    expect(planReminder(stored(), want, now)).toEqual({ action: "keep" });
  });

  test("changed: cancel and schedule again", () => {
    const moved = desiredReminder({ ...accepted, room: "Rm 2242" }, now)!;
    expect(planReminder(stored(), moved, now)).toMatchObject({
      action: "change",
      cancel: { messageId: "Q1" },
      create: { mode: "schedule" },
    });
  });

  test("no longer wanted: cancel only", () => {
    expect(planReminder(stored(), null, now)).toMatchObject({
      action: "change",
      create: null,
    });
  });

  test("an unfinished send-now claim over a minute old is retried", () => {
    const claim = stored({
      kind: "sent",
      messageId: "",
      postAt: at("08:58"),
      createdAt: at("08:58"),
    });
    expect(planReminder(claim, want, now)).toMatchObject({
      action: "change",
      cancel: { messageId: "" },
      create: want,
    });
    const fresh = stored({
      kind: "sent",
      messageId: "",
      postAt: now,
      createdAt: new Date(now.getTime() - 10_000),
    });
    expect(planReminder(fresh, want, now)).toEqual({ action: "keep" });
  });

  test("already delivered: never re-sent, only replaced by a later one", () => {
    const sent = stored({ kind: "sent", postAt: at("08:55") });
    expect(planReminder(sent, null, now)).toEqual({ action: "keep" });
    const soon = desiredReminder(
      { ...accepted, room: "Rm 2242" },
      at("09:50"),
    )!;
    expect(planReminder(sent, soon, at("09:50"))).toEqual({ action: "keep" });
    const later = desiredReminder({ ...accepted, slotTime: "11:00" }, now)!;
    expect(planReminder(sent, later, now)).toMatchObject({ action: "change" });
  });
});

type Call = { method: string; args: URLSearchParams };

/** A mocked Slack API: answers per method, records every call. */
function mockSlack(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let n = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).replace("https://slack.com/api/", "");
    calls.push({ method, args: new URLSearchParams(String(init?.body ?? "")) });
    const defaults: Record<string, unknown> = {
      "users.lookupByEmail": { ok: true, user: { id: "U1" } },
      "conversations.open": { ok: true, channel: { id: "D1" } },
      "chat.scheduleMessage": method === "chat.scheduleMessage" && {
        ok: true,
        scheduled_message_id: `Q${++n}`,
      },
      "chat.deleteScheduledMessage": { ok: true },
      "chat.postMessage": { ok: true, ts: "1.2" },
    };
    const body = answers[method] ?? defaults[method] ?? { ok: false };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const of = (method: string) => calls.filter((c) => c.method === method);
  return { fn: fn as unknown as typeof fetch, calls, of };
}

async function makeChat(
  over: Partial<typeof coffeeChats.$inferInsert> = {},
  sponsorOver: Partial<typeof sponsorJudgingSponsors.$inferInsert> = {},
) {
  const id = randomUUID();
  const [sponsor] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Reminder Sponsor ${id}`, ...sponsorOver })
    .returning();
  await db
    .insert(users)
    .values({ id, email: `${id}@example.com`, type: "hacker" });
  await db.insert(applications).values({
    userId: id,
    status: "CONFIRMED",
    firstName: "Sam",
    githubLink: "",
    linkedInLink: "",
    devpostLink: "",
    resumeLink: "",
  });
  const [chat] = await db
    .insert(coffeeChats)
    .values({
      sponsorId: sponsor!.id,
      userId: id,
      room: "Rm 2242",
      slotTime: "11:00",
      status: "accepted",
      ...over,
    })
    .returning();
  return { chat: chat!, sponsor: sponsor! };
}

const reminderOf = async (chatId: string) =>
  (
    await db
      .select()
      .from(coffeeChatReminders)
      .where(eq(coffeeChatReminders.chatId, chatId))
  )[0];

const deps = (slack: ReturnType<typeof mockSlack>, now: Date) => ({
  token: "xoxb-test",
  fetch: slack.fn,
  now,
});

describe("syncCoffeeChatReminder", () => {
  test("schedules once at start - 15 min, then keeps it", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00"))),
    ).toBe("scheduled");
    const [call] = slack.of("chat.scheduleMessage");
    expect(call!.args.get("channel")).toBe("D1");
    expect(Number(call!.args.get("post_at"))).toBe(
      at("10:45").getTime() / 1000,
    );
    expect(call!.args.get("text")).toMatch(/starts in 15 min!/);
    expect(await reminderOf(chat.id)).toMatchObject({
      messageId: "Q1",
      kind: "scheduled",
      slackChannel: "D1",
    });

    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:05"))),
    ).toBe("kept");
    expect(slack.of("chat.scheduleMessage")).toHaveLength(1);
  });

  test("room move: deletes the old reminder and schedules a new one", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00")));
    await db
      .update(coffeeChats)
      .set({ room: "Rm 1348" })
      .where(eq(coffeeChats.id, chat.id));
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:10"))),
    ).toBe("scheduled");
    const [del] = slack.of("chat.deleteScheduledMessage");
    expect(del!.args.get("scheduled_message_id")).toBe("Q1");
    expect(slack.of("chat.scheduleMessage")[1]!.args.get("text")).toMatch(
      /Rm 1348, Ivey building/,
    );
    expect((await reminderOf(chat.id))!.messageId).toBe("Q2");
  });

  test("cancel or decline after accept: deletes it", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00")));
    await db
      .update(coffeeChats)
      .set({ status: "cancelled" })
      .where(eq(coffeeChats.id, chat.id));
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:10"))),
    ).toBe("cancelled");
    expect(slack.of("chat.deleteScheduledMessage")).toHaveLength(1);
    expect(await reminderOf(chat.id)).toBeUndefined();
  });

  test("a message Slack already posted counts as gone", async () => {
    const { chat } = await makeChat({ status: "accepted" });
    const first = mockSlack();
    await syncCoffeeChatReminder(chat.id, deps(first, at("09:00")));
    await db
      .update(coffeeChats)
      .set({ status: "declined" })
      .where(eq(coffeeChats.id, chat.id));
    const slack = mockSlack({
      "chat.deleteScheduledMessage": {
        ok: false,
        error: "invalid_scheduled_message_id",
      },
    });
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:10"))),
    ).toBe("cancelled");
    expect(await reminderOf(chat.id)).toBeUndefined();
  });

  test("accepted under 15 minutes before: posted now, once", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("10:50"))),
    ).toBe("sent");
    expect(slack.of("chat.scheduleMessage")).toHaveLength(0);
    expect(slack.of("chat.postMessage")[0]!.args.get("text")).toMatch(
      /starts in 10 min!/,
    );
    expect(await reminderOf(chat.id)).toMatchObject({
      kind: "sent",
      messageId: "1.2",
    });
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("10:52"))),
    ).toBe("kept");
    expect(slack.of("chat.postMessage")).toHaveLength(1);
  });

  test("a failed send-now is unclaimed so the next sync retries", async () => {
    const { chat } = await makeChat();
    const failing = mockSlack({
      "chat.postMessage": { ok: false, error: "ratelimited" },
    });
    expect(
      await syncCoffeeChatReminder(chat.id, deps(failing, at("10:50"))),
    ).toBe("failed");
    expect(await reminderOf(chat.id)).toBeUndefined();
    expect(
      await syncCoffeeChatReminder(chat.id, deps(mockSlack(), at("10:51"))),
    ).toBe("sent");
  });

  test("chat already started: nothing sent", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("11:00"))),
    ).toBe("none");
    expect(slack.calls).toHaveLength(0);
  });

  test("not on Slack: nothing stored, no other channel", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack({
      "users.lookupByEmail": { ok: false, error: "users_not_found" },
    });
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00"))),
    ).toBe("not-found");
    expect(await reminderOf(chat.id)).toBeUndefined();
    expect(slack.of("chat.postMessage")).toHaveLength(0);
  });

  test("Slack down: logged, never thrown", async () => {
    const { chat } = await makeChat();
    const fn = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    await expect(
      syncCoffeeChatReminder(chat.id, {
        token: "xoxb-test",
        fetch: fn,
        now: at("09:00"),
      }),
    ).resolves.toBe("failed");
  });

  test("off without a token or the switch", async () => {
    const { chat } = await makeChat();
    expect(await syncCoffeeChatReminder(chat.id)).toBe("off");
  });

  test("session chat: group from the sponsor's hackers per chat", async () => {
    const one = await makeChat();
    const [rep] = await db
      .insert(coffeeChatReps)
      .values({ sponsorId: one.sponsor.id, name: "Rep", phone: "1" })
      .returning();
    const [placement] = await db
      .insert(coffeeChatPlacements)
      .values({ repId: rep!.id, sessionId: "11", room: "2243" })
      .returning();
    await db
      .update(coffeeChats)
      .set({ placementId: placement!.id, room: "Rm 2243" })
      .where(eq(coffeeChats.id, one.chat.id));
    const slack = mockSlack();
    await syncCoffeeChatReminder(one.chat.id, deps(slack, at("09:00")));
    expect(slack.of("chat.scheduleMessage")[0]!.args.get("text")).toMatch(
      /Your 1-on-1 Coffee Chat with/,
    );

    await db
      .insert(coffeeChatPrefs)
      .values({ sponsorId: one.sponsor.id, hackersPerChat: 3 });
    await syncCoffeeChatReminder(one.chat.id, deps(slack, at("09:01")));
    expect(slack.of("chat.scheduleMessage")[1]!.args.get("text")).toMatch(
      /Your Group Coffee Chat with/,
    );
  });

  test("old per-slot chat: the sponsor's chat style", async () => {
    const { chat } = await makeChat({}, { coffeeChatStyle: "group" });
    const slack = mockSlack();
    await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00")));
    expect(slack.of("chat.scheduleMessage")[0]!.args.get("text")).toMatch(
      /Your Group Coffee Chat with/,
    );
  });
});

describe("hooked into chat changes", () => {
  test("accept schedules it, cancel deletes it (notifyCoffeeChat)", async () => {
    const { chat } = await makeChat({ slotTime: "16:00" });
    const slack = mockSlack();
    vi.stubGlobal("fetch", slack.fn);
    vi.stubEnv("COFFEE_CHAT_REMINDERS", "1");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("09:00"));
    try {
      await notifyCoffeeChat("accepted", { id: chat.id });
      expect(slack.of("chat.scheduleMessage")).toHaveLength(1);
      await db
        .update(coffeeChats)
        .set({ status: "cancelled" })
        .where(eq(coffeeChats.id, chat.id));
      await notifyCoffeeChat("cancelled", { id: chat.id });
      expect(slack.of("chat.deleteScheduledMessage")).toHaveLength(1);
      expect(await reminderOf(chat.id)).toBeUndefined();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe("review fixes: unfinished claims and late cancels", () => {
  const claim = (chatId: string, createdAt: Date) =>
    db.insert(coffeeChatReminders).values({
      chatId,
      slackChannel: "D1",
      messageId: "",
      kind: "sent",
      postAt: createdAt,
      contentKey: "x",
      createdAt,
    });

  test("a claim cut off before the post counts as unsent after a minute", async () => {
    const { chat } = await makeChat();
    await claim(chat.id, at("10:48"));
    const slack = mockSlack();
    // Still fresh: someone may be posting it right now.
    expect(
      await syncCoffeeChatReminder(
        chat.id,
        deps(slack, new Date(at("10:48").getTime() + 30_000)),
      ),
    ).toBe("kept");
    expect(slack.of("chat.postMessage")).toHaveLength(0);
    // Over a minute old: it never went out. Sent now, once.
    expect(
      await syncCoffeeChatReminder(chat.id, deps(slack, at("10:50"))),
    ).toBe("sent");
    expect(slack.of("chat.postMessage")).toHaveLength(1);
    expect((await reminderOf(chat.id))!.messageId).toBe("1.2");
  });

  test("the sweep drops a stale claim on a chat that was cancelled", async () => {
    const { chat } = await makeChat({ status: "cancelled" });
    await claim(chat.id, at("10:40"));
    const sweep = await syncAllCoffeeChatReminders(
      deps(mockSlack(), at("10:50")),
    );
    expect(sweep.cancelled).toBeGreaterThanOrEqual(1);
    expect(await reminderOf(chat.id)).toBeUndefined();
  });

  test("posted but the save failed: the claim stays, nothing is sent twice", async () => {
    const { chat } = await makeChat();
    const slack = mockSlack();
    const update = vi.spyOn(db, "update").mockImplementation(() => {
      throw new Error("db down");
    });
    try {
      expect(
        await syncCoffeeChatReminder(chat.id, deps(slack, at("10:50"))),
      ).toBe("sent");
    } finally {
      update.mockRestore();
    }
    expect(await reminderOf(chat.id)).toMatchObject({
      kind: "sent",
      messageId: "",
    });
    expect(
      await syncCoffeeChatReminder(
        chat.id,
        deps(slack, new Date(at("10:50").getTime() + 30_000)),
      ),
    ).toBe("kept");
    expect(slack.of("chat.postMessage")).toHaveLength(1);
  });

  test("a failed delete close to the post time: the row goes, the cancel succeeds", async () => {
    const { chat } = await makeChat();
    await syncCoffeeChatReminder(chat.id, deps(mockSlack(), at("09:00")));
    await db
      .update(coffeeChats)
      .set({ status: "declined" })
      .where(eq(coffeeChats.id, chat.id));
    const failing = mockSlack({
      "chat.deleteScheduledMessage": { ok: false, error: "internal_error" },
    });
    // Ten minutes out: a real failure, kept for the next sync to retry.
    expect(
      await syncCoffeeChatReminder(chat.id, deps(failing, at("10:35"))),
    ).toBe("failed");
    expect(await reminderOf(chat.id)).toBeDefined();
    // A minute before the post: can't recall it; let it go.
    expect(
      await syncCoffeeChatReminder(chat.id, deps(failing, at("10:44"))),
    ).toBe("cancelled");
    expect(await reminderOf(chat.id)).toBeUndefined();
  });
});

describe("syncAllCoffeeChatReminders (backfill)", () => {
  test("idempotent: a second sweep schedules nothing new", async () => {
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
    await db.delete(coffeeChatReminders);
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
    await db.delete(coffeeChats);
    const a = await makeChat({ slotTime: "13:00" });
    const b = await makeChat({ slotTime: "10:30" });
    await makeChat({ slotTime: "13:30", status: "pending" });
    await makeChat({ slotTime: "08:30" }); // already over
    const slack = mockSlack();
    const first = await syncAllCoffeeChatReminders(deps(slack, at("09:00")));
    expect(first).toMatchObject({ scheduled: 2, failed: 0, left: 0 });
    // Soonest chat first.
    expect(
      slack
        .of("chat.scheduleMessage")
        .map((c) => Number(c.args.get("post_at"))),
    ).toEqual([at("10:15").getTime() / 1000, at("12:45").getTime() / 1000]);
    const second = await syncAllCoffeeChatReminders(deps(slack, at("09:10")));
    expect(second).toMatchObject({ scheduled: 0, kept: 2 });
    expect(slack.of("chat.scheduleMessage")).toHaveLength(2);
    expect(await reminderOf(a.chat.id)).toBeDefined();
    expect(await reminderOf(b.chat.id)).toBeDefined();
  });

  test("a deleted chat's waiting reminder is cancelled", async () => {
    const { chat } = await makeChat({ slotTime: "14:00" });
    const slack = mockSlack();
    await syncCoffeeChatReminder(chat.id, deps(slack, at("09:00")));
    // A placement delete cascades the chat row; the reminder row stays.
    await db.delete(coffeeChats).where(eq(coffeeChats.id, chat.id));
    const sweep = await syncAllCoffeeChatReminders(deps(slack, at("09:20")));
    expect(sweep.cancelled).toBeGreaterThanOrEqual(1);
    expect(await reminderOf(chat.id)).toBeUndefined();
  });
});
