import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import type * as EnvModule from "~/env";
import type { NextApiRequest, NextApiResponse } from "next";

const slackEnv = vi.hoisted(() => ({
  values: {} as Record<string, string | undefined>,
}));

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof EnvModule>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (
          typeof prop === "string" &&
          (prop.startsWith("SPONSOR_HELP_SLACK_") || prop.startsWith("SLACK_"))
        ) {
          return slackEnv.values[prop];
        }
        return target[prop];
      },
    }),
  };
});

import handler from "~/pages/api/slack/events";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { handleSlackEvent, slackSignature } from "./sponsor-help-events";

const SECRET = "test-signing-secret";
const BOT_USER = "UBOT";
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function signed(payload: unknown, opts: { secret?: string; age?: number } = {}) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000) - (opts.age ?? 0));
  return {
    rawBody,
    timestamp,
    signature: slackSignature(opts.secret ?? SECRET, timestamp, rawBody),
  };
}

function eventCallback(event: Record<string, unknown>) {
  return {
    type: "event_callback",
    event,
    authorizations: [{ user_id: BOT_USER, is_bot: true }],
  };
}

const reaction = (user: string, ts = "111.222", channel = "C123") =>
  eventCallback({
    type: "reaction_added",
    user,
    reaction: "eyes",
    item: { type: "message", channel, ts },
  });

const reply = (extra: Record<string, unknown>) =>
  eventCallback({
    type: "message",
    channel: "C123",
    user: "U2",
    text: "on it",
    ts: "111.999",
    thread_ts: "111.222",
    ...extra,
  });

function slackApiCalls(method: string) {
  return fetchMock.mock.calls.filter(([url]) =>
    url.endsWith(`/${method}`),
  );
}

let requestId: string;

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/users.info")) {
      const user = new URLSearchParams(String(init.body)).get("user");
      return new Response(
        JSON.stringify({
          ok: true,
          user: { name: user, profile: { display_name: `Name ${user}` } },
        }),
      );
    }
    return new Response(JSON.stringify({ ok: true, ts: "999.000" }));
  });
  vi.stubGlobal("fetch", fetchMock);
  slackEnv.values = {
    SLACK_SIGNING_SECRET: SECRET,
    SLACK_BOT_TOKEN: "xoxb-shared",
    SPONSOR_HELP_SLACK_CHANNEL: "C123",
  };
  await db.delete(sponsorHelpRequests).where(sql`true`);
  await db.delete(sponsorJudgingSponsors).where(sql`true`);
  const [s] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: "Scotiabank" })
    .returning();
  const [r] = await db
    .insert(sponsorHelpRequests)
    .values({
      sponsorId: s!.id,
      reason: "swag",
      slackChannel: "C123",
      slackTs: "111.222",
    })
    .returning();
  requestId = r!.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function request() {
  return db.query.sponsorHelpRequests.findFirst({
    where: eq(sponsorHelpRequests.id, requestId),
  });
}

describe("signature", () => {
  test("bad signature is 401", async () => {
    const s = signed({ type: "url_verification", challenge: "x" }, {
      secret: "wrong",
    });
    expect((await handleSlackEvent(s)).status).toBe(401);
  });

  test("stale timestamp (over 5 minutes) is 401", async () => {
    const s = signed({ type: "url_verification", challenge: "x" }, { age: 301 });
    expect((await handleSlackEvent(s)).status).toBe(401);
  });

  test("missing headers or tampered body is 401", async () => {
    const s = signed(reaction("U1"));
    expect(
      (await handleSlackEvent({ ...s, signature: undefined })).status,
    ).toBe(401);
    expect(
      (await handleSlackEvent({ ...s, rawBody: s.rawBody.replace("U1", "U9") }))
        .status,
    ).toBe(401);
  });

  test("no signing secret configured is 401", async () => {
    slackEnv.values.SLACK_SIGNING_SECRET = undefined;
    const s = signed({ type: "url_verification", challenge: "x" });
    expect((await handleSlackEvent(s)).status).toBe(401);
  });

  test("SPONSOR_HELP_SLACK_SIGNING_SECRET overrides the shared one", async () => {
    slackEnv.values.SPONSOR_HELP_SLACK_SIGNING_SECRET = "help-only";
    const s = signed({ type: "url_verification", challenge: "x" }, {
      secret: "help-only",
    });
    expect((await handleSlackEvent(s)).status).toBe(200);
  });
});

describe("url_verification", () => {
  test("echoes the challenge", async () => {
    const res = await handleSlackEvent(
      signed({ type: "url_verification", challenge: "abc123" }),
    );
    expect(res).toEqual({ status: 200, body: { challenge: "abc123" } });
  });
});

describe("claiming", () => {
  const run = handleSlackEvent;

  test("claims in the database before any Slack call", async () => {
    let statusAtFirstCall: string | undefined;
    fetchMock.mockImplementation(async () => {
      statusAtFirstCall ??= (await request())?.status;
      return new Response(JSON.stringify({ ok: true }));
    });
    const res = await run(signed(reaction("U1")));
    expect(res.status).toBe(200);
    expect(statusAtFirstCall).toBe("claimed");
  });

  test("Slack down: still claimed, still 200, fallback name", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error("timeout"));
    const res = await run(signed(reaction("U1")));
    expect(res.status).toBe(200);
    const row = await request();
    expect(row?.status).toBe("claimed");
    expect(row?.claimedByName).toBe("Someone from the sponsor team");
  });

  test("each Slack call has a timeout", async () => {
    await run(signed(reaction("U1")));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  test("Slack retries are acked without reprocessing", async () => {
    const res = await run({
      rawBody: "not even json",
      timestamp: undefined,
      signature: undefined,
      retryNum: "1",
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect((await request())?.status).toBe("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("users.info failure stores the fallback name", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/users.info")
        ? new Response(JSON.stringify({ ok: false, error: "user_not_found" }))
        : new Response(JSON.stringify({ ok: true })),
    );
    await run(signed(reaction("U1")));
    const row = await request();
    expect(row?.status).toBe("claimed");
    expect(row?.claimedByName).toBe("Someone from the sponsor team");
  });

  test("first reaction claims it, posts 'on it' and edits the message", async () => {
    const res = await run(signed(reaction("U1")));
    expect(res.status).toBe(200);
    const row = await request();
    expect(row?.status).toBe("claimed");
    expect(row?.claimedBySlackId).toBe("U1");
    expect(row?.claimedByName).toBe("Name U1");
    expect(row?.claimedAt).toBeInstanceOf(Date);
    const posts = slackApiCalls("chat.postMessage");
    expect(posts).toHaveLength(1);
    expect(String(posts[0]![1].body)).toContain(
      '"thread_ts":"111.222"',
    );
    expect(slackApiCalls("chat.update")).toHaveLength(1);
  });

  test("a thread reply from a person claims it", async () => {
    await run(signed(reply({})));
    expect((await request())?.claimedBySlackId).toBe("U2");
  });

  test("two claims at once: only the first wins", async () => {
    const [a, b] = await Promise.all([
      run(signed(reaction("U1"))),
      run(signed(reaction("U2"))),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const row = await request();
    expect(row?.status).toBe("claimed");
    expect(["U1", "U2"]).toContain(row?.claimedBySlackId);
    expect(slackApiCalls("chat.postMessage")).toHaveLength(1);
    expect(slackApiCalls("chat.update")).toHaveLength(1);

    // A later reaction doesn't steal it.
    const first = row?.claimedBySlackId;
    await run(signed(reaction("U3")));
    expect((await request())?.claimedBySlackId).toBe(first);
  });

  test("reaction on an unrelated message is ignored", async () => {
    const res = await run(signed(reaction("U1", "555.666")));
    expect(res.status).toBe(200);
    expect((await request())?.status).toBe("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("bot messages and the bot's own reactions are ignored", async () => {
    await run(signed(reply({ bot_id: "B1", subtype: "bot_message" })));
    await run(signed(reply({ bot_id: "B1" })));
    await run(signed(reply({ user: BOT_USER })));
    await run(signed(reaction(BOT_USER)));
    expect((await request())?.status).toBe("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("edits and top-level channel messages don't claim", async () => {
    await run(signed(reply({ subtype: "message_changed" })));
    await run(signed(reply({ thread_ts: undefined })));
    expect((await request())?.status).toBe("open");
  });

  test("resolved or cancelled requests can't be claimed", async () => {
    await db
      .update(sponsorHelpRequests)
      .set({ status: "cancelled" })
      .where(eq(sponsorHelpRequests.id, requestId));
    await run(signed(reaction("U1")));
    expect((await request())?.status).toBe("cancelled");
  });

  test("event types it doesn't handle get 200 and do nothing", async () => {
    for (const event of [
      { type: "app_mention", user: "U1", channel: "C123", ts: "1.1" },
      { type: "message", channel_type: "im", user: "U1", channel: "D1", ts: "1.1" },
      { type: "team_join", user: { id: "U9" } },
    ]) {
      const res = await run(signed(eventCallback(event)));
      expect(res.status).toBe(200);
    }
    expect((await run(signed({ type: "app_rate_limited" }))).status)
      .toBe(200);
    expect((await request())?.status).toBe("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("API route", () => {
  function mockRes() {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      headers: {} as Record<string, string>,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(body: unknown) {
        res.body = body;
        return res;
      },
      setHeader(k: string, v: string) {
        res.headers[k] = v;
        return res;
      },
    };
    return res;
  }

  function mockReq(method: string, s: ReturnType<typeof signed>) {
    const req = Readable.from([Buffer.from(s.rawBody)]) as unknown as NextApiRequest;
    req.method = method;
    req.headers = {
      "x-slack-request-timestamp": s.timestamp,
      "x-slack-signature": s.signature,
    };
    return req;
  }

  test("reads the raw body and answers url_verification", async () => {
    const res = mockRes();
    await handler(
      mockReq("POST", signed({ type: "url_verification", challenge: "zz" })),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ challenge: "zz" });
  });

  test("GET is 405", async () => {
    const res = mockRes();
    await handler(
      mockReq("GET", signed({})),
      res as unknown as NextApiResponse,
    );
    expect(res.statusCode).toBe(405);
  });
});
