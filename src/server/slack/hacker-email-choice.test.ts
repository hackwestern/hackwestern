import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import { slackEmailToStore, slackLookupEmails } from "~/lib/slack-email";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { dmHacker } from "~/server/slack/dm";

/**
 * The email-choice rule for reaching a hacker (src/lib/slack-email.ts):
 * Slack by the email they use on Slack first, then the email they applied
 * with; if Slack finds neither, Mailjet to the email they applied with.
 * Slack (fetch) and Mailjet are mocked: nothing real is ever sent.
 */

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      SLACK_BOT_TOKEN: "xoxb-test",
      MAILJET_API_KEY: "test-key",
      MAILJET_SECRET_KEY: "test-secret",
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
    },
  };
});
vi.mock("~/server/mail-mailjet", () => ({
  sendViaMailjet: vi.fn(async () => ({
    data: { delivered: [], queued: [], bounced: [] },
    error: null,
  })),
}));
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: vi.fn(async () => undefined),
}));
vi.mock("~/server/api/utils/sponsor-judging-scores-mirror", () => ({
  mirrorJudgingScoresLater: vi.fn(),
}));
vi.mock("~/server/api/utils/sponsor-judging-sheet-mirror", () => ({
  mirrorSponsorJudging: vi.fn(async () => ({ ok: true, rows: 0 })),
  mirrorSponsorJudgingLater: vi.fn(),
  mirrorSponsorJudgingSoon: vi.fn(async () => undefined),
}));
vi.mock("~/server/api/utils/sponsor-judging-board", () => ({
  judgingRoomsById: vi.fn(),
}));
// Notify waits for every sponsor's room; sponsors from other tests stay in
// the database without one, and this file is about the email choice.
vi.mock("~/server/api/utils/judging-board-data", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/judging-board-data")
  >()),
  sponsorsWithoutRoom: vi.fn(async () => []),
}));

const mail = vi.mocked(sendViaMailjet);
const rooms = vi.mocked(judgingRoomsById);

/**
 * A mocked Slack API: `onSlack` are the emails that have a Slack account.
 * Records the email of every users.lookupByEmail and every DM posted.
 */
function mockSlack(onSlack: readonly string[]) {
  const lookups: string[] = [];
  const posts: string[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).replace("https://slack.com/api/", "");
    const args = new URLSearchParams(String(init?.body ?? ""));
    let body: unknown = { ok: false, error: "unknown_method" };
    if (method === "users.lookupByEmail") {
      const email = args.get("email") ?? "";
      lookups.push(email);
      body = onSlack.includes(email)
        ? { ok: true, user: { id: `U-${email}` } }
        : { ok: false, error: "users_not_found" };
    } else if (method === "conversations.open") {
      body = { ok: true, channel: { id: `D-${args.get("users")}` } };
    } else if (method === "chat.postMessage") {
      posts.push(args.get("channel") ?? "");
      body = { ok: true, ts: "1.2" };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return { fn: fn as unknown as typeof fetch, lookups, posts };
}

beforeEach(() => {
  mail.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the rule (pure)", () => {
  test("Slack email first, then the application email", () => {
    expect(
      slackLookupEmails({ slackEmail: "me@slack.dev", email: "me@uwo.ca" }),
    ).toEqual(["me@slack.dev", "me@uwo.ca"]);
  });

  test("no Slack email: just the application email", () => {
    expect(slackLookupEmails({ slackEmail: null, email: "me@uwo.ca" })).toEqual(
      ["me@uwo.ca"],
    );
    expect(slackLookupEmails({ email: "me@uwo.ca" })).toEqual(["me@uwo.ca"]);
  });

  test("the same address twice is looked up once", () => {
    expect(
      slackLookupEmails({ slackEmail: "Me@UWO.ca ", email: "me@uwo.ca" }),
    ).toEqual(["Me@UWO.ca"]);
  });

  test("what gets stored: trimmed, lowercased; blank or own email is null", () => {
    expect(slackEmailToStore("  Me@Slack.dev ", "me@uwo.ca")).toBe(
      "me@slack.dev",
    );
    expect(slackEmailToStore("", "me@uwo.ca")).toBeNull();
    expect(slackEmailToStore("   ", "me@uwo.ca")).toBeNull();
    expect(slackEmailToStore("ME@uwo.ca", "me@uwo.ca")).toBeNull();
  });
});

describe("dmHacker", () => {
  test("found by the Slack email: one lookup, DM sent", async () => {
    const slack = mockSlack(["me@slack.dev", "me@uwo.ca"]);
    expect(
      await dmHacker(
        "xoxb-t",
        { slackEmail: "me@slack.dev", email: "me@uwo.ca" },
        { text: "hi" },
        slack.fn,
      ),
    ).toBe("sent");
    expect(slack.lookups).toEqual(["me@slack.dev"]);
    expect(slack.posts).toEqual(["D-U-me@slack.dev"]);
  });

  test("Slack email not on Slack: falls back to the application email", async () => {
    const slack = mockSlack(["me@uwo.ca"]);
    expect(
      await dmHacker(
        "xoxb-t",
        { slackEmail: "typo@slack.dev", email: "me@uwo.ca" },
        { text: "hi" },
        slack.fn,
      ),
    ).toBe("sent");
    expect(slack.lookups).toEqual(["typo@slack.dev", "me@uwo.ca"]);
    expect(slack.posts).toEqual(["D-U-me@uwo.ca"]);
  });

  test("neither on Slack: not-found, nothing posted", async () => {
    const slack = mockSlack([]);
    expect(
      await dmHacker(
        "xoxb-t",
        { slackEmail: "me@slack.dev", email: "me@uwo.ca" },
        { text: "hi" },
        slack.fn,
      ),
    ).toBe("not-found");
    expect(slack.lookups).toEqual(["me@slack.dev", "me@uwo.ca"]);
    expect(slack.posts).toEqual([]);
  });
});

/** An admitted hacker with a pending coffee chat. */
async function hackerWithChat(slackEmail: string | null) {
  const id = `choice-${faker.string.alphanumeric(10).toLowerCase()}`;
  const email = `${id}@uwo.ca`;
  const [sponsor] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Choice Sponsor ${id}` })
    .returning();
  await db.insert(users).values({ id, email, slackEmail, type: "hacker" });
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
      room: "Rm 2241",
      slotTime: "10:15",
    })
    .returning();
  return { chat: chat!, email };
}

describe("coffee chat offer", () => {
  test("Slack email on Slack: DM there, no email", async () => {
    const { chat, email } = await hackerWithChat("sam@slack.dev");
    const slack = mockSlack(["sam@slack.dev", email]);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(slack.lookups).toEqual(["sam@slack.dev"]);
    expect(slack.posts).toHaveLength(1);
    expect(mail).not.toHaveBeenCalled();
  });

  test("Slack email not found: DM at the application email, no email", async () => {
    const { chat, email } = await hackerWithChat("sam@slack.dev");
    const slack = mockSlack([email]);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(slack.lookups).toEqual(["sam@slack.dev", email]);
    expect(slack.posts).toEqual([`D-U-${email}`]);
    expect(mail).not.toHaveBeenCalled();
  });

  test("not on Slack by either: Mailjet to the application email", async () => {
    const { chat, email } = await hackerWithChat("sam@slack.dev");
    const slack = mockSlack([]);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(slack.lookups).toEqual(["sam@slack.dev", email]);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0]![0].to).toBe(email);
  });

  test("no Slack email given, not on Slack: Mailjet to the application email", async () => {
    const { chat, email } = await hackerWithChat(null);
    const slack = mockSlack([]);

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(slack.lookups).toEqual([email]);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0]![0].to).toBe(email);
  });
});

describe("presentation notify", () => {
  /** One scheduled team with one hacker; their organizer caller. */
  async function scheduledHacker(slackEmail: string | null) {
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
    await db.delete(sponsorPresentationNotices);
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
    await db.delete(sponsorPresentations);
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
    await db.delete(sponsorShortlistSends);
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const [sponsor] = await db
      .insert(sponsorJudgingSponsors)
      // A prize track sponsor: only those are scheduled.
      .values({ name: `QNX Choice Judge ${faker.string.alphanumeric(8)}` })
      .returning();
    const teamId = faker.string.alphanumeric(12);
    await db.insert(teams).values({
      id: teamId,
      name: `Team ${faker.string.alphanumeric(8)}`,
      joinCode: faker.string.alphanumeric(6),
      submissionStatus: "submitted",
      tracks: ["General"],
    });
    await db
      .insert(sponsorShortlistSends)
      .values({ sponsorId: sponsor!.id, teamIds: [teamId] });
    rooms.mockResolvedValue(new Map([[sponsor!.id, "Rm 2110"]]));
    await organizer.sponsorPresentations.schedule();
    await organizer.sponsorPresentations.setRound2({ open: true });
    const session = await mockSession(db);
    await db
      .update(users)
      .set({ teamId, slackEmail })
      .where(eq(users.id, session.user.id));
    return { organizer, email: session.user.email! };
  }

  test("Slack email first, then the application email", async () => {
    const { organizer, email } = await scheduledHacker("pat@slack.dev");
    const slack = mockSlack([email]);

    const res = await organizer.sponsorPresentations.notify();

    expect(res).toMatchObject({ sent: 1, emailed: 0 });
    expect(slack.lookups).toEqual(["pat@slack.dev", email]);
    expect(mail).not.toHaveBeenCalled();
  });

  test("not on Slack by either: Mailjet to the application email", async () => {
    const { organizer, email } = await scheduledHacker("pat@slack.dev");
    const slack = mockSlack([]);

    const res = await organizer.sponsorPresentations.notify();

    expect(res).toMatchObject({ sent: 0, emailed: 1 });
    expect(slack.lookups).toEqual(["pat@slack.dev", email]);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0]![0].to).toBe(email);
  });
});
