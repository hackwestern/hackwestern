import { Readable } from "stream";
import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import interactionsRoute from "~/pages/api/slack/interactions";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import {
  handleCoffeeChatInteraction,
  handleSlackInteractionRequest,
} from "~/server/slack/coffee-chat-interactions";
import { slackSignature } from "~/server/slack/verify";

const SECRET = "test-signing-secret";

// The sheet mirror, made to hang for the slow-path test.
const mirror = vi.hoisted(() => ({ hang: false }));
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: () =>
    mirror.hang ? new Promise(() => undefined) : Promise.resolve(),
}));

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: undefined,
      // Safe dummy so modules that read it at import load with no .env.
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_SIGNING_SECRET: "test-signing-secret",
    },
  };
});

const MORNING = new Date("2026-11-21T08:00:00-05:00");
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MORNING);
});
afterAll(() => {
  vi.useRealTimers();
});

const RESPONSE_URL = "https://hooks.slack.com/actions/T1/123/abc";

/** Mocked Slack: users.info by Slack user id, and response_url posts. */
function mockSlack(emails: Record<string, string>) {
  const replies: Record<string, unknown>[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target === "https://slack.com/api/users.info") {
      const id = new URLSearchParams(String(init?.body)).get("user") ?? "";
      const email = emails[id];
      const body = email
        ? { ok: true, user: { id, profile: { email } } }
        : { ok: false, error: "user_not_found" };
      return new Response(JSON.stringify(body));
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
async function makeHacker() {
  const id = `slack-hacker-${++n}`;
  await db
    .insert(users)
    .values({ id, email: `${id}@Example.com`, name: "Kim", type: "hacker" });
  await db.insert(applications).values({
    userId: id,
    status: "CONFIRMED",
    firstName: "Kim",
    githubLink: "",
    linkedInLink: "",
    devpostLink: "",
    resumeLink: "",
  });
  return { id, email: `${id}@example.com` };
}

async function makeChat(userId: string, slotTime = "10:15") {
  const [sponsor] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Slack Sponsor ${++n}` })
    .returning();
  const [chat] = await db
    .insert(coffeeChats)
    .values({ sponsorId: sponsor!.id, userId, room: "Rm 2243", slotTime })
    .returning();
  return chat!.id;
}

async function statusOf(chatId: string) {
  const [row] = await db
    .select({ status: coffeeChats.status })
    .from(coffeeChats)
    .where(eq(coffeeChats.id, chatId));
  return row!.status;
}

function clickPayload(
  slackUser: string,
  chatId: string,
  action: "coffee_chat_accept" | "coffee_chat_decline",
) {
  return {
    type: "block_actions",
    user: { id: slackUser },
    response_url: RESPONSE_URL,
    actions: [{ action_id: action, value: chatId }],
  };
}

function signedRequest(payload: unknown, at = new Date()) {
  const rawBody = new URLSearchParams({
    payload: JSON.stringify(payload),
  }).toString();
  const timestamp = String(Math.floor(at.getTime() / 1000));
  return {
    rawBody,
    timestamp,
    signature: slackSignature(SECRET, timestamp, rawBody),
  };
}

describe("/api/slack/interactions signature (T23)", () => {
  test("a bad signature is a 401 and changes nothing", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: kim.email });
    const request = signedRequest(
      clickPayload("U1", chatId, "coffee_chat_accept"),
    );

    const result = await handleSlackInteractionRequest(
      { ...request, signature: "v0=" + "f".repeat(64) },
      { fetch: slack.fetch },
    );

    expect(result.status).toBe(401);
    expect(await statusOf(chatId)).toBe("pending");
    expect(slack.fetch).not.toHaveBeenCalled();
  });

  test("a stale signature (over 5 minutes old) is a 401", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: kim.email });
    const sixMinutesAgo = new Date(Date.now() - 6 * 60_000);

    const result = await handleSlackInteractionRequest(
      signedRequest(
        clickPayload("U1", chatId, "coffee_chat_accept"),
        sixMinutesAgo,
      ),
      { fetch: slack.fetch },
    );

    expect(result.status).toBe(401);
    expect(await statusOf(chatId)).toBe("pending");
  });

  test("no signing secret configured is a 401", async () => {
    const result = await handleSlackInteractionRequest(
      signedRequest({ type: "block_actions" }),
      { signingSecret: undefined },
    );
    expect(result.status).toBe(401);
  });

  test("a signed request with no readable payload is a 400", async () => {
    const rawBody = "payload=not-json";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const result = await handleSlackInteractionRequest({
      rawBody,
      timestamp,
      signature: slackSignature(SECRET, timestamp, rawBody),
    });
    expect(result.status).toBe(400);
  });

  test("a signed click by the chat's hacker accepts it and updates the DM", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: kim.email });

    const result = await handleSlackInteractionRequest(
      signedRequest(clickPayload("U1", chatId, "coffee_chat_accept")),
      { fetch: slack.fetch },
    );

    expect(result).toEqual({ status: 200, outcome: "accepted" });
    expect(await statusOf(chatId)).toBe("accepted");
    expect(slack.replies).toHaveLength(1);
    const reply = slack.replies[0]!;
    expect(reply.replace_original).toBe(true);
    expect(reply.text).toBe("You accepted this coffee chat. See you there!");
    expect(JSON.stringify(reply.blocks)).toContain("Rm 2243");
    expect(JSON.stringify(reply.blocks)).not.toContain("coffee_chat_accept");
  });
});

describe("Slack click matching (T23)", () => {
  test("only the hacker matched to the clicking Slack user can answer", async () => {
    const kim = await makeHacker();
    const lee = await makeHacker();
    const kimsChat = await makeChat(kim.id);
    // U2 is Lee on Slack; the payload names Kim's chat.
    const slack = mockSlack({ U1: kim.email, U2: lee.email });

    const outcome = await handleCoffeeChatInteraction(
      clickPayload("U2", kimsChat, "coffee_chat_decline"),
      { fetch: slack.fetch },
    );

    expect(outcome).toBe("notYours");
    expect(await statusOf(kimsChat)).toBe("pending");
    expect(slack.replies[0]).toMatchObject({
      response_type: "ephemeral",
      replace_original: false,
    });
  });

  test("a hacker whose Slack is on their Slack email can answer", async () => {
    const kim = await makeHacker();
    await db
      .update(users)
      .set({ slackEmail: "kim@slack.dev" })
      .where(eq(users.id, kim.id));
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: "Kim@Slack.dev" });

    expect(
      await handleCoffeeChatInteraction(
        clickPayload("U1", chatId, "coffee_chat_accept"),
        { fetch: slack.fetch },
      ),
    ).toBe("accepted");
    expect(await statusOf(chatId)).toBe("accepted");
  });

  test("a Slack user with no matching site account changes nothing", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U9: "stranger@example.com" });

    expect(
      await handleCoffeeChatInteraction(
        clickPayload("U9", chatId, "coffee_chat_accept"),
        { fetch: slack.fetch },
      ),
    ).toBe("notYours");
    expect(
      await handleCoffeeChatInteraction(
        clickPayload("U404", chatId, "coffee_chat_accept"),
        { fetch: slack.fetch },
      ),
    ).toBe("failed");
    expect(await statusOf(chatId)).toBe("pending");
  });

  test("with no bot token nothing changes", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: kim.email });

    const outcome = await handleCoffeeChatInteraction(
      clickPayload("U1", chatId, "coffee_chat_accept"),
      { fetch: slack.fetch, token: undefined },
    );

    expect(outcome).toBe("failed");
    expect(await statusOf(chatId)).toBe("pending");
  });

  test("other payloads and actions are ignored", async () => {
    const slack = mockSlack({});
    expect(
      await handleCoffeeChatInteraction(
        { type: "view_submission" },
        { fetch: slack.fetch },
      ),
    ).toBe("ignored");
    expect(
      await handleCoffeeChatInteraction(
        {
          type: "block_actions",
          user: { id: "U1" },
          actions: [{ action_id: "something_else", value: "x" }],
        },
        { fetch: slack.fetch },
      ),
    ).toBe("ignored");
    expect(slack.fetch).not.toHaveBeenCalled();
  });
});

describe("Slack answers use the /live respond rules (T16)", () => {
  test("decline after accepting frees the seat, before the chat starts", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const slack = mockSlack({ U1: kim.email });

    await handleCoffeeChatInteraction(
      clickPayload("U1", chatId, "coffee_chat_accept"),
      { fetch: slack.fetch },
    );
    const outcome = await handleCoffeeChatInteraction(
      clickPayload("U1", chatId, "coffee_chat_decline"),
      { fetch: slack.fetch },
    );

    expect(outcome).toBe("declined");
    expect(await statusOf(chatId)).toBe("declined");
  });

  test("an expired request can't be accepted", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id, "10:15");
    const slack = mockSlack({ U1: kim.email });

    const outcome = await handleCoffeeChatInteraction(
      clickPayload("U1", chatId, "coffee_chat_accept"),
      { fetch: slack.fetch, now: new Date("2026-11-21T09:56:00-05:00") },
    );

    expect(outcome).toBe("notPending");
    expect(await statusOf(chatId)).toBe("pending");
    expect(slack.replies[0]).toMatchObject({
      replace_original: true,
      text: "This request can't be answered anymore.",
    });
  });
});

describe("the Next.js route", () => {
  function fakeRes() {
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      setHeader(name: string, value: string) {
        res.headers[name] = value;
        return res;
      },
      end() {
        return res;
      },
    };
    return res;
  }

  function fakeReq(
    method: string,
    body: string,
    headers: Record<string, string>,
  ) {
    return Object.assign(Readable.from([Buffer.from(body)]), {
      method,
      headers,
    });
  }

  test("reads the raw body and 401s a bad signature", async () => {
    const res = fakeRes();
    await interactionsRoute(
      fakeReq("POST", "payload=%7B%7D", {
        "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-slack-signature": "v0=bad",
      }) as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(401);
  });

  test("a signed request through the route is a 200", async () => {
    const request = signedRequest({ type: "view_submission" });
    const res = fakeRes();
    await interactionsRoute(
      fakeReq("POST", request.rawBody, {
        "x-slack-request-timestamp": request.timestamp,
        "x-slack-signature": request.signature,
      }) as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(200);
  });

  test("anything but POST is a 405", async () => {
    const res = fakeRes();
    await interactionsRoute(
      fakeReq("GET", "", {}) as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(405);
  });

  test("answers Slack well within 3 s even when every call is slow", async () => {
    const kim = await makeHacker();
    const chatId = await makeChat(kim.id);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // users.info answers after 400 ms; response_url never answers (only
    // the abort signal ends it); the sheet mirror hangs.
    mirror.hang = true;
    const slow = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === "https://slack.com/api/users.info") {
        await new Promise((r) => setTimeout(r, 400));
        return new Response(
          JSON.stringify({ ok: true, user: { profile: { email: kim.email } } }),
        );
      }
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      );
    }) as typeof fetch;

    const started = performance.now();
    const result = await handleSlackInteractionRequest(
      signedRequest(clickPayload("U1", chatId, "coffee_chat_accept")),
      { fetch: slow },
    );
    const elapsed = performance.now() - started;

    expect(result).toEqual({ status: 200, outcome: "accepted" });
    expect(await statusOf(chatId)).toBe("accepted");
    expect(elapsed).toBeLessThan(2500);
    mirror.hang = false;
    log.mockRestore();
  });
});
