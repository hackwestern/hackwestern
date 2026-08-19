import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { generateUnsubscribeToken } from "~/server/subscribers";
import { env } from "~/env";
import handler from "~/pages/api/mailjet-webhook";

// Built from env so it matches whatever the test-mode fallback (or a real .env)
// supplies — the same value the handler compares against.
const AUTH = `Basic ${Buffer.from(
  `${env.MAILJET_WEBHOOK_USER}:${env.MAILJET_WEBHOOK_PASSWORD}`,
).toString("base64")}`;

function mockRes() {
  const res = {} as NextApiResponse & {
    _status?: number;
    _json?: unknown;
  };
  res.status = vi.fn(function (this: typeof res, c: number) {
    this._status = c;
    return this;
  }) as never;
  res.json = vi.fn(function (this: typeof res, body: unknown) {
    this._json = body;
    return this;
  }) as never;
  return res;
}

// `null` = send no Authorization header at all (an explicit `undefined` would
// just fall back to the default parameter).
function post(body: unknown, auth: string | null = AUTH) {
  return {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body,
  } as unknown as NextApiRequest;
}

const event = (extra: Record<string, unknown>) => ({
  time: 1430812195,
  MessageID: 13792286917004336,
  Message_GUID: "1ab23cd4-e567-8901-2345-6789f0gh1i2j",
  mj_campaign_id: 0,
  mj_contact_id: 0,
  customcampaign: "",
  CustomID: "",
  Payload: "",
  ...extra,
});

describe("/api/mailjet-webhook", () => {
  const PREFIX = "zz-mjtest-";
  const cleanup = () =>
    db
      .delete(emailSubscribers)
      .where(like(emailSubscribers.email, `${PREFIX}%`));

  beforeEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });
  afterEach(cleanup);

  const seed = (email: string) =>
    db.insert(emailSubscribers).values({
      email,
      source: "hw12",
      unsubscribeToken: generateUnsubscribeToken(),
    });

  const bouncedAt = async (email: string) => {
    const row = await db.query.emailSubscribers.findFirst({
      where: (t, { eq }) => eq(t.email, email),
      columns: { bouncedAt: true },
    });
    return row?.bouncedAt ?? null;
  };

  test("rejects a request with no Authorization header (401)", async () => {
    const res = mockRes();
    await handler(post([], null), res);
    expect(res._status).toBe(401);
  });

  test("rejects a request with wrong credentials (401)", async () => {
    const res = mockRes();
    const wrong = `Basic ${Buffer.from("nope:nope").toString("base64")}`;
    await handler(post([], wrong), res);
    expect(res._status).toBe(401);
  });

  test("rejects a non-POST method (405)", async () => {
    const res = mockRes();
    const req = {
      method: "GET",
      headers: { authorization: AUTH },
    } as unknown as NextApiRequest;
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  test("hard bounce marks the subscriber (matching on the normalized email)", async () => {
    const email = `${PREFIX}hardbounce@gmail.com`;
    await seed(email);

    const res = mockRes();
    // Mailjet reports the address as sent; normalizeEmail canonicalizes the
    // gmail dots/+tag back to the stored form.
    await handler(
      post([
        event({
          event: "bounce",
          email: `${PREFIX}hard.bounce+hw@gmail.com`,
          blocked: false,
          hard_bounce: true,
          error_related_to: "recipient",
          error: "user unknown",
        }),
      ]),
      res,
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ processed: 1, marked: 1 });
    expect(await bouncedAt(email)).toBeInstanceOf(Date);
  });

  test("soft bounce (hard_bounce false) does not mark the subscriber", async () => {
    const email = `${PREFIX}softbounce@outlook.com`;
    await seed(email);

    const res = mockRes();
    await handler(
      post([
        event({
          event: "bounce",
          email,
          blocked: false,
          hard_bounce: false,
          error_related_to: "recipient",
          error: "mailbox inactive",
        }),
      ]),
      res,
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ processed: 1, marked: 0 });
    expect(await bouncedAt(email)).toBeNull();
  });

  test("blocked/preblocked marks the subscriber", async () => {
    const email = `${PREFIX}preblocked@outlook.com`;
    await seed(email);

    const res = mockRes();
    await handler(
      post([
        event({
          event: "blocked",
          email,
          error_related_to: "recipient",
          error: "preblocked",
        }),
      ]),
      res,
    );

    expect(res._json).toEqual({ processed: 1, marked: 1 });
    expect(await bouncedAt(email)).toBeInstanceOf(Date);
  });

  test("blocked with any other error does not mark the subscriber", async () => {
    const email = `${PREFIX}dupe@outlook.com`;
    await seed(email);

    const res = mockRes();
    await handler(
      post([
        event({
          event: "blocked",
          email,
          error_related_to: "recipient",
          error: "duplicate in campaign",
        }),
      ]),
      res,
    );

    expect(res._json).toEqual({ processed: 1, marked: 0 });
    expect(await bouncedAt(email)).toBeNull();
  });

  test("spam complaint marks the subscriber", async () => {
    const email = `${PREFIX}spam@outlook.com`;
    await seed(email);

    const res = mockRes();
    await handler(
      post([event({ event: "spam", email, source: "JMRPP" })]),
      res,
    );

    expect(res._json).toEqual({ processed: 1, marked: 1 });
    expect(await bouncedAt(email)).toBeInstanceOf(Date);
  });

  test("ignores event types it doesn't act on, without erroring", async () => {
    const email = `${PREFIX}opened@outlook.com`;
    await seed(email);

    const res = mockRes();
    await handler(
      post([
        event({ event: "sent", email }),
        event({ event: "open", email }),
        event({ event: "unsub", email }),
        event({ event: "something-new", email }),
      ]),
      res,
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ processed: 4, marked: 0 });
    expect(await bouncedAt(email)).toBeNull();
  });

  test("malformed body still returns 200 (Mailjet would retry for 24h)", async () => {
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const res = mockRes();
    await handler(post("not json at all"), res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ processed: 0, marked: 0 });

    const res2 = mockRes();
    await handler(post({ event: "bounce" }), res2); // object, not the array
    expect(res2._status).toBe(200);

    expect(logged).toHaveBeenCalled();
  });
});
