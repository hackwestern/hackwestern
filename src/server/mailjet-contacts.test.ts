import { afterEach, describe, expect, test, vi } from "vitest";
import { getContactList, manageContact } from "~/server/mailjet-contacts";

const CREDS = { apiKey: "pub", secretKey: "priv" };

interface Captured {
  url: string;
  auth: string;
  body: string;
  method: string;
}

function stubFetch(body: unknown, ok = true, status = 200) {
  const captured: Captured = { url: "", auth: "", body: "{}", method: "GET" };
  const fn = vi.fn((url: string | URL, init?: RequestInit): Promise<Response> => {
    captured.url = String(url);
    captured.method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    captured.auth = headers.Authorization ?? "";
    captured.body = typeof init?.body === "string" ? init.body : "{}";
    return Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  });
  vi.stubGlobal("fetch", fn);
  return captured;
}

afterEach(() => vi.unstubAllGlobals());

describe("manageContact", () => {
  test("posts Email + Action to the list's managecontact endpoint", async () => {
    const captured = stubFetch({ Count: 1, Data: [{ ID: 5 }] });
    const res = await manageContact("10532038", "a@gmail.com", CREDS);

    expect(res.ok).toBe(true);
    expect(captured.method).toBe("POST");
    expect(captured.url).toBe(
      "https://api.mailjet.com/v3/REST/contactslist/10532038/managecontact",
    );
    expect(captured.auth).toBe(
      `Basic ${Buffer.from("pub:priv").toString("base64")}`,
    );
    expect(JSON.parse(captured.body)).toEqual({
      Email: "a@gmail.com",
      Action: "addnoforce",
    });
  });

  // The whole point of the default. addforce resets IsUnsubscribed to false,
  // so defaulting to it would silently re-subscribe people who opted out.
  test("defaults to addnoforce so an existing unsubscribe survives", async () => {
    const captured = stubFetch({ Count: 1, Data: [{ ID: 5 }] });
    await manageContact("1", "a@gmail.com", CREDS);
    expect(JSON.parse(captured.body)).toMatchObject({ Action: "addnoforce" });

    const forced = stubFetch({ Count: 1, Data: [{ ID: 5 }] });
    await manageContact("1", "a@gmail.com", CREDS, "addforce");
    expect(JSON.parse(forced.body)).toMatchObject({ Action: "addforce" });
  });

  // Callers include the signup path, where the row is already committed.
  test("returns an error instead of throwing on an API failure", async () => {
    stubFetch({ ErrorMessage: "nope" }, false, 400);
    const res = await manageContact("1", "a@gmail.com", CREDS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("400");
  });

  test("returns an error instead of throwing when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );
    const res = await manageContact("1", "a@gmail.com", CREDS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("network down");
  });
});

describe("getContactList", () => {
  test("returns the list's name and subscriber count", async () => {
    stubFetch({
      Count: 1,
      Data: [{ ID: 10532038, Name: "HW13 Announce", SubscriberCount: 2705 }],
    });
    const list = await getContactList("10532038", CREDS);
    expect(list).toEqual({
      id: 10532038,
      name: "HW13 Announce",
      subscriberCount: 2705,
    });
  });

  // A wrong ID must stop the backfill, not write 2.7k contacts somewhere else.
  test("returns null for an unknown list", async () => {
    stubFetch({ Data: [] }, false, 404);
    expect(await getContactList("999", CREDS)).toBeNull();
  });

  test("throws on a non-404 API failure", async () => {
    stubFetch({ ErrorMessage: "boom" }, false, 500);
    await expect(getContactList("1", CREDS)).rejects.toThrow("500");
  });
});
