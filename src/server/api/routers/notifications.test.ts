import { setRound2Open } from "~/server/api/utils/sponsor-judging-settings";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import { buildHackerNotices, nextSeenKeys } from "~/lib/hacker-notifications";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  teams,
  users,
} from "~/server/db/schema";
import { slotsKey } from "~/lib/sponsor-presentations";

// The bot token per test (unset = no Slack check on save).
const slack = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get: (target, prop) =>
        prop === "SLACK_BOT_TOKEN" ? slack.token : target[prop],
    }),
  };
});

afterEach(() => {
  slack.token = undefined;
  vi.unstubAllGlobals();
});

/** Mocked Slack users.lookupByEmail: `people` maps email to display name. */
function mockSlackLookup(people: Record<string, string>) {
  const lookups: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://slack.com/api/users.lookupByEmail");
      const email = new URLSearchParams(String(init?.body)).get("email") ?? "";
      lookups.push(email);
      const name = people[email];
      const body =
        name === undefined
          ? { ok: false, error: "users_not_found" }
          : { ok: true, user: { id: "U1", profile: { display_name: name } } };
      return new Response(JSON.stringify(body));
    }),
  );
  return lookups;
}

async function hacker() {
  const session = await mockSession(db);
  return {
    session,
    caller: createCaller(createInnerTRPCContext({ session })),
  };
}

async function sponsor(name = `Sponsor ${faker.string.alphanumeric(8)}`) {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
    .returning();
  return row!;
}

describe("buildHackerNotices", () => {
  const chat = {
    chatId: "c1",
    sponsorName: "StarTech",
    status: "pending" as const,
    slotTime: "10:15",
    durationMinutes: 15,
    room: "Rm 2241",
    createdAt: new Date("2026-11-21T14:00:00Z"),
    respondedAt: null,
  };
  const presentations = {
    slots: [
      { sponsorId: "s2", sponsorName: "QNX", room: "Rm 2235", start: 610 },
      { sponsorId: "s1", sponsorName: "Scotia", room: "Rm 2110", start: 600 },
    ],
    sentAt: new Date("2026-11-22T13:00:00Z"),
    channel: "email" as const,
  };

  test("newest first; judging slots in time order; unread unless seen", () => {
    const notices = buildHackerNotices({ chats: [chat], presentations }, []);
    expect(notices.map((n) => n.sponsorName)).toEqual([
      "Scotia",
      "QNX",
      "StarTech",
    ]);
    expect(notices.every((n) => n.unread)).toBe(true);
    expect(notices[0]).toMatchObject({
      kind: "presentation",
      channel: "email",
    });

    const seen = buildHackerNotices(
      { chats: [chat], presentations },
      notices.map((n) => n.key),
    );
    expect(seen.some((n) => n.unread)).toBe(false);
  });

  test("a status or room change is unread again", () => {
    const [first] = buildHackerNotices(
      { chats: [chat], presentations: { ...presentations, slots: [] } },
      [],
    );
    for (const changed of [
      { ...chat, status: "accepted" as const },
      { ...chat, room: "Rm 2242" },
    ]) {
      const [n] = buildHackerNotices(
        { chats: [changed], presentations: { ...presentations, slots: [] } },
        [first!.key],
      );
      expect(n!.unread).toBe(true);
    }
  });

  test("no judging notices until the team was sent its times", () => {
    expect(
      buildHackerNotices(
        { chats: [], presentations: { ...presentations, sentAt: null } },
        [],
      ),
    ).toEqual([]);
  });
});

describe("nextSeenKeys", () => {
  test("keeps seen and shown keys that still exist, nothing else", () => {
    expect(nextSeenKeys(["a", "b", "c", "d"], ["a", "gone"], ["b"])).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("notifications router", () => {
  test("signed in only", async () => {
    const anon = createCaller(createInnerTRPCContext({ session: null }));
    await expect(anon.notifications.center()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("lists coffee chats and judging, then markSeen clears unread", async () => {
    const { session, caller } = await hacker();
    const s = await sponsor("Chat Co");
    await db.insert(coffeeChats).values({
      sponsorId: s.id,
      userId: session.user.id,
      room: "Rm 2241",
      slotTime: "10:15",
      status: "accepted",
    });
    const judge = await sponsor("Judge Co");
    const teamId = faker.string.alphanumeric(12);
    await db.insert(teams).values({
      id: teamId,
      name: "Team N",
      joinCode: faker.string.alphanumeric(6),
    });
    await db.update(users).set({ teamId }).where(eq(users.id, session.user.id));
    await db.insert(sponsorPresentations).values({
      sponsorId: judge.id,
      teamId,
      room: "Rm 2110",
      startMinute: 600,
    });
    await db.insert(sponsorPresentationNotices).values({
      userId: session.user.id,
      teamId,
      status: "sent",
      slotsKey: slotsKey([
        { sponsorId: judge.id, room: "Rm 2110", start: 600 },
      ]),
      sentAt: new Date(),
    });

    await setRound2Open(false);
    const closed = await caller.notifications.center();
    expect(closed.notices.map((notice) => notice.kind)).toEqual(["coffeeChat"]);
    await setRound2Open(true);
    const before = await caller.notifications.center();
    expect(before.unread).toBe(2);
    expect(before.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "coffeeChat",
          sponsorName: "Chat Co",
          status: "accepted",
          room: "Rm 2241",
        }),
        expect.objectContaining({
          kind: "presentation",
          sponsorName: "Judge Co",
          room: "Rm 2110",
          start: 600,
          channel: "slack",
        }),
      ]),
    );

    await caller.notifications.markSeen({
      keys: before.notices.map((n) => n.key),
    });
    const after = await caller.notifications.center();
    expect(after.unread).toBe(0);
    expect(after.notices).toHaveLength(2);
  });

  test("markSeen only marks what was shown; a later notice stays unread", async () => {
    const { session, caller } = await hacker();
    const first = await sponsor("First Co");
    await db.insert(coffeeChats).values({
      sponsorId: first.id,
      userId: session.user.id,
      room: "Rm 2241",
      slotTime: "10:15",
    });
    // The panel opens and shows this list.
    const shown = (await caller.notifications.center()).notices.map(
      (n) => n.key,
    );
    // A new offer arrives before markSeen runs.
    const later = await sponsor("Later Co");
    await db.insert(coffeeChats).values({
      sponsorId: later.id,
      userId: session.user.id,
      room: "Rm 2242",
      slotTime: "11:00",
    });

    // Keys that don't exist are dropped.
    expect(
      await caller.notifications.markSeen({ keys: [...shown, "chat:nope"] }),
    ).toEqual({ unread: 1 });
    const after = await caller.notifications.center();
    expect(after.unread).toBe(1);
    expect(after.notices.find((n) => n.unread)?.sponsorName).toBe("Later Co");
    const [row] = await db
      .select({ seen: users.notificationsSeen })
      .from(users)
      .where(eq(users.id, session.user.id));
    expect(row!.seen).toEqual(shown);
  });

  test("Slack email: saved lowercased, blank or own email clears, bad input refused", async () => {
    const { session, caller } = await hacker();

    expect(
      await caller.notifications.setSlackEmail({
        slackEmail: " Me@Slack.dev ",
      }),
    ).toEqual({ slackEmail: "me@slack.dev", slack: { status: "unchecked" } });
    expect((await caller.notifications.center()).slackEmail).toBe(
      "me@slack.dev",
    );

    await expect(
      caller.notifications.setSlackEmail({ slackEmail: "not an email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await caller.notifications.center()).slackEmail).toBe(
      "me@slack.dev",
    );

    expect(
      await caller.notifications.setSlackEmail({
        slackEmail: session.user.email!.toUpperCase(),
      }),
    ).toMatchObject({ slackEmail: null });
    await caller.notifications.setSlackEmail({ slackEmail: "me@slack.dev" });
    expect(
      await caller.notifications.setSlackEmail({ slackEmail: "" }),
    ).toMatchObject({ slackEmail: null });
  });

  test("saving looks the address up on Slack and says who it found", async () => {
    slack.token = "xoxb-test";
    const { session, caller } = await hacker();
    const lookups = mockSlackLookup({ "jane@slack.dev": "Jane Doe" });

    expect(
      await caller.notifications.setSlackEmail({
        slackEmail: "Jane@Slack.dev",
      }),
    ).toEqual({
      slackEmail: "jane@slack.dev",
      slack: { status: "found", email: "jane@slack.dev", name: "Jane Doe" },
    });

    // A typo: not on Slack, but saved anyway.
    expect(
      await caller.notifications.setSlackEmail({
        slackEmail: "jnae@slack.dev",
      }),
    ).toEqual({
      slackEmail: "jnae@slack.dev",
      slack: { status: "not-found", email: "jnae@slack.dev" },
    });
    expect((await caller.notifications.center()).slackEmail).toBe(
      "jnae@slack.dev",
    );

    // Cleared: the application email is what Slack will try.
    expect(
      await caller.notifications.setSlackEmail({ slackEmail: "" }),
    ).toEqual({
      slackEmail: null,
      slack: { status: "not-found", email: session.user.email },
    });
    expect(lookups).toEqual([
      "jane@slack.dev",
      "jnae@slack.dev",
      session.user.email,
    ]);
  });

  test("a Slack outage never blocks the save", async () => {
    slack.token = "xoxb-test";
    const { caller } = await hacker();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(
      await caller.notifications.setSlackEmail({ slackEmail: "me@slack.dev" }),
    ).toEqual({ slackEmail: "me@slack.dev", slack: { status: "unchecked" } });
    log.mockRestore();
  });
});
