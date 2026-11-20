import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    HW_NETWORK_REQUESTS_INGEST_URL: "http://worker" as string | undefined,
    HW_NETWORK_REQUESTS_INGEST_TOKEN: "tok" as string | undefined,
    HW_NETWORK_REQUESTS_TRACK_LOCAL: undefined as string | undefined,
    NEXTAUTH_SECRET: "s",
  },
}));
vi.mock("~/env", () => envMock);
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import { recordEvent } from "~/server/events";

const event = {
  ts: Date.now(),
  procedure: "post.list",
  type: "query",
  status: "OK",
  durationMs: 5,
  userHash: null,
};

describe("recordEvent gating", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL", "");
    envMock.env.HW_NETWORK_REQUESTS_INGEST_URL = "http://worker";
    envMock.env.HW_NETWORK_REQUESTS_INGEST_TOKEN = "tok";
    envMock.env.HW_NETWORK_REQUESTS_TRACK_LOCAL = undefined;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not track locally without the flag, even with url + token", () => {
    recordEvent(event);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tracks locally when the flag is true", () => {
    envMock.env.HW_NETWORK_REQUESTS_TRACK_LOCAL = "true";
    recordEvent(event);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tracks on Vercel without the flag", () => {
    vi.stubEnv("VERCEL", "1");
    recordEvent(event);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not track without url or token", () => {
    vi.stubEnv("VERCEL", "1");
    envMock.env.HW_NETWORK_REQUESTS_INGEST_TOKEN = undefined;
    recordEvent(event);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
