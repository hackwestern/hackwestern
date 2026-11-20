import { describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import { slotsKey } from "~/lib/sponsor-presentations";
import { teamConfirmedAt } from "~/server/api/utils/presentation-confirm";
import { db } from "~/server/db";
import {
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  teams,
  users,
} from "~/server/db/schema";
import { handleSlackInteractionRequest } from "~/server/slack/coffee-chat-interactions";
import {
  PRESENTATION_CONFIRM_ACTION,
  encodeConfirmValue,
} from "~/server/slack/presentation-dm";
import { slackSignature } from "~/server/slack/verify";

const SECRET = "test-signing-secret";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: undefined,
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_SIGNING_SECRET: "test-signing-secret",
    },
  };
});

const RESPONSE_URL = "https://hooks.slack.com/actions/T1/456/def";

/** Mocked Slack: users.info by Slack user id, and response_url posts. */
function mockSlack(emails: Record<string, string>) {
  const replies: Record<string, unknown>[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target === "https://slack.com/api/users.info") {
      const id = new URLSearchParams(String(init?.body)).get("user") ?? "";
      const email = emails[id];
      return new Response(
        JSON.stringify(
          email
            ? { ok: true, user: { id, profile: { email } } }
            : { ok: false, error: "user_not_found" },
        ),
      );
    }
    if (target === RESPONSE_URL) {
      replies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response("ok");
    }
    throw new Error(`unexpected fetch ${target}`);
  });
  return { fetch: fn as unknown as typeof fetch, replies };
}

let n = 0;
/** A team with one member, told its one presentation time. */
async function toldTeam() {
  const id = `PT${++n}`.padEnd(8, "x");
  await db
    .insert(teams)
    .values({ id, name: `Team ${n}`, joinCode: `J${n}`.padEnd(6, "0") });
  const userId = `pres-hacker-${n}`;
  await db.insert(users).values({
    id: userId,
    email: `${userId}@Example.com`,
    name: "Ana",
    type: "hacker",
    teamId: id,
  });
  const [sponsor] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `QNX pres ${n}` })
    .returning();
  await db.insert(sponsorPresentations).values({
    sponsorId: sponsor!.id,
    teamId: id,
    room: "Rm 2235",
    startMinute: 600,
  });
  const key = slotsKey([
    { sponsorId: sponsor!.id, room: "Rm 2235", start: 600 },
  ]);
  await db.insert(sponsorPresentationNotices).values({
    userId,
    teamId: id,
    status: "sent",
    slotsKey: key,
    sentAt: new Date(),
  });
  return { teamId: id, email: `${userId}@example.com`, key };
}

function signed(payload: unknown) {
  const rawBody = new URLSearchParams({
    payload: JSON.stringify(payload),
  }).toString();
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    rawBody,
    timestamp,
    signature: slackSignature(SECRET, timestamp, rawBody),
  };
}

const click = (
  slackUser: string,
  value: string,
  channel = `D-${slackUser}`,
) => ({
  type: "block_actions",
  user: { id: slackUser },
  channel: { id: channel },
  response_url: RESPONSE_URL,
  actions: [{ action_id: PRESENTATION_CONFIRM_ACTION, value }],
});

describe("presentation Confirm button", () => {
  test("a team member's click accepts for the team and updates the DM", async () => {
    const t = await toldTeam();
    const slack = mockSlack({ U1: t.email });
    const result = await handleSlackInteractionRequest(
      signed(click("U1", encodeConfirmValue(t))),
      { fetch: slack.fetch },
    );
    expect(result).toEqual({ status: 200, outcome: "confirmed" });
    expect(await teamConfirmedAt(t.teamId, t.key)).not.toBeNull();
    expect(slack.replies[0]).toMatchObject({ replace_original: true });
    expect(JSON.stringify(slack.replies[0])).toContain("confirmed");
    expect(JSON.stringify(slack.replies[0])).not.toContain(
      PRESENTATION_CONFIRM_ACTION,
    );
  });

  test("someone not on the team can't confirm", async () => {
    const t = await toldTeam();
    const slack = mockSlack({ U2: "stranger@example.com" });
    const result = await handleSlackInteractionRequest(
      signed(click("U2", encodeConfirmValue(t))),
      { fetch: slack.fetch },
    );
    expect(result.outcome).toBe("notYours");
    expect(await teamConfirmedAt(t.teamId, t.key)).toBeNull();
  });

  test("only in the bot's DM", async () => {
    const t = await toldTeam();
    const slack = mockSlack({ U1: t.email });
    const result = await handleSlackInteractionRequest(
      signed(click("U1", encodeConfirmValue(t), "C-general")),
      { fetch: slack.fetch },
    );
    expect(result.outcome).toBe("notYours");
  });

  test("a button from before the times changed is refused", async () => {
    const t = await toldTeam();
    const slack = mockSlack({ U1: t.email });
    const result = await handleSlackInteractionRequest(
      signed(click("U1", encodeConfirmValue({ ...t, key: "old" }))),
      { fetch: slack.fetch },
    );
    expect(result.outcome).toBe("changed");
    expect(await teamConfirmedAt(t.teamId, t.key)).toBeNull();
  });
});
