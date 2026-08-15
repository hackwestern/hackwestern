import { afterEach, describe, expect, test, vi } from "vitest";
import { parseAddress, sendViaMailjet } from "~/server/mail-mailjet";

const CREDS = { apiKey: "pub", secretKey: "priv" };
const BASE = { to: "user@example.com", subject: "Hi", html: "<p>Hi</p>" };

interface MailjetPayload {
  Messages: {
    From: { Email: string; Name?: string };
    To: { Email: string }[];
    Subject: string;
    HTMLPart: string;
    TextPart: string;
    ReplyTo?: { Email: string };
    Headers?: Record<string, string>;
  }[];
}

/** Stub global fetch and capture what the transport sent. */
function stubFetch(body: unknown, ok = true, status = 200) {
  let capturedUrl = "";
  let capturedAuth = "";
  let capturedBody = "{}";
  const fn = vi.fn(
    (url: string | URL, init?: RequestInit): Promise<Response> => {
      capturedUrl = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedAuth = headers.Authorization ?? "";
      capturedBody = typeof init?.body === "string" ? init.body : "{}";
      return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
        text: () =>
          Promise.resolve(
            typeof body === "string" ? body : JSON.stringify(body),
          ),
      } as Response);
    },
  );
  vi.stubGlobal("fetch", fn);
  return {
    url: () => capturedUrl,
    auth: () => capturedAuth,
    payload: () => JSON.parse(capturedBody) as MailjetPayload,
  };
}

describe("parseAddress", () => {
  test("splits the display-name form", () => {
    expect(parseAddress("Hack Western <hello@hackwestern.com>")).toEqual({
      Email: "hello@hackwestern.com",
      Name: "Hack Western",
    });
  });
  test("passes through a bare address", () => {
    expect(parseAddress("hello@hackwestern.com")).toEqual({
      Email: "hello@hackwestern.com",
    });
  });
});

describe("sendViaMailjet", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("success returns the delivered recipients", async () => {
    stubFetch({
      Messages: [
        {
          Status: "success",
          To: [{ Email: "user@example.com", MessageID: "1" }],
        },
      ],
    });
    const res = await sendViaMailjet(BASE, CREDS);
    expect(res.error).toBeNull();
    expect(res.data?.delivered).toEqual(["user@example.com"]);
  });

  test("per-message error surfaces Mailjet's message (HTTP still 200)", async () => {
    stubFetch({
      Messages: [
        { Status: "error", Errors: [{ ErrorMessage: "invalid domain" }] },
      ],
    });
    const res = await sendViaMailjet(BASE, CREDS);
    expect(res.data).toBeNull();
    expect(res.error?.message).toContain("invalid domain");
  });

  test("HTTP error returns the status", async () => {
    stubFetch("Unauthorized", false, 401);
    const res = await sendViaMailjet(BASE, CREDS);
    expect(res.data).toBeNull();
    expect(res.error?.message).toContain("401");
  });

  test("network throw is caught", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await sendViaMailjet(BASE, CREDS);
    expect(res.data).toBeNull();
    expect(res.error?.message).toBe("down");
  });

  test("sends Basic auth + a v3.1 payload with from/replyTo/headers/text", async () => {
    const cap = stubFetch({
      Messages: [{ Status: "success", To: [{ Email: "user@example.com" }] }],
    });
    await sendViaMailjet(
      {
        ...BASE,
        from: "Hack Western <updates@mail.hackwestern.com>",
        replyTo: "hello@hackwestern.com",
        text: "Hi",
        headers: { "List-Unsubscribe": "<mailto:x>" },
      },
      CREDS,
    );
    expect(cap.url()).toBe("https://api.mailjet.com/v3.1/send");
    expect(cap.auth()).toBe(
      `Basic ${Buffer.from("pub:priv").toString("base64")}`,
    );
    const msg = cap.payload().Messages[0]!;
    expect(msg.From).toEqual({
      Email: "updates@mail.hackwestern.com",
      Name: "Hack Western",
    });
    expect(msg.To).toEqual([{ Email: "user@example.com" }]);
    expect(msg.ReplyTo).toEqual({ Email: "hello@hackwestern.com" });
    expect(msg.Headers).toEqual({ "List-Unsubscribe": "<mailto:x>" });
    expect(msg.TextPart).toBe("Hi");
  });

  test("derives TextPart from html when text is omitted", async () => {
    const cap = stubFetch({
      Messages: [{ Status: "success", To: [{ Email: "user@example.com" }] }],
    });
    await sendViaMailjet({ ...BASE, html: "<p>Hello</p>" }, CREDS);
    expect(cap.payload().Messages[0]!.TextPart).toBe("Hello");
  });
});
