import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    APP_MAP_TOKEN: "secret-token" as string | undefined,
    NEXTAUTH_URL: "http://x",
  },
}));
vi.mock("~/env", () => envMock);

import handler from "./app";

function run(method: string, authorization?: string) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  handler(
    { method, headers: { authorization } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return res;
}

describe("GET /api/docs/app", () => {
  beforeEach(() => {
    envMock.env.APP_MAP_TOKEN = "secret-token";
  });

  it("rejects non-GET", () => {
    expect(run("POST", "Bearer secret-token").statusCode).toBe(405);
  });
  it("is disabled (503) when no token is configured", () => {
    envMock.env.APP_MAP_TOKEN = undefined;
    expect(run("GET", "Bearer anything").statusCode).toBe(503);
  });
  it("rejects missing and wrong tokens", () => {
    expect(run("GET").statusCode).toBe(401);
    expect(run("GET", "Bearer nope").statusCode).toBe(401);
    expect(run("GET", "secret-token").statusCode).toBe(401);
  });
  it("serves the map with the right token, uncached", () => {
    const res = run("GET", "Bearer secret-token");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(Array.isArray((res.body as { trpc: unknown[] }).trpc)).toBe(true);
  });
});
