import { describe, expect, test, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "./unsubscribe";
import * as subs from "~/server/subscribers";

function mockRes() {
  const res = {} as NextApiResponse & {
    _status?: number; _redirect?: string; _headers: Record<string, string>;
  };
  res._headers = {};
  res.status = vi.fn(function (this: typeof res, c: number) { this._status = c; return this; }) as never;
  res.setHeader = vi.fn(function (this: typeof res, k: string, v: string) { this._headers[k] = v; return this; }) as never;
  res.redirect = vi.fn(function (this: typeof res, code: number, url: string) { this._status = code; this._redirect = url; return this; }) as never;
  res.end = vi.fn(function (this: typeof res) { return this; }) as never;
  return res;
}

describe("/api/unsubscribe", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("POST with valid token unsubscribes + returns 200", async () => {
    const spy = vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(true);
    const req = { method: "POST", query: { token: "xyz" }, body: {} } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(spy).toHaveBeenCalledWith("xyz");
    expect(res._status).toBe(200);
  });

  test("POST with missing token returns 400", async () => {
    const req = { method: "POST", query: {}, body: {} } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  test("GET redirects (307) to the /unsubscribe page with the token", async () => {
    const req = { method: "GET", query: { token: "abc" } } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(307);
    expect(res._redirect).toBe("/unsubscribe?token=abc");
  });
});
