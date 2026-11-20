import { describe, expect, test } from "vitest";
import { deriveStatus, formatClock, remainingMs } from "./clock";

const base = { durationMs: 300_000 };

describe("deriveStatus", () => {
  test("idle / running / paused", () => {
    expect(deriveStatus({ endsAt: null, pausedRemainingMs: null })).toBe(
      "idle",
    );
    expect(deriveStatus({ endsAt: new Date(), pausedRemainingMs: null })).toBe(
      "running",
    );
    expect(deriveStatus({ endsAt: null, pausedRemainingMs: 1000 })).toBe(
      "paused",
    );
  });
});

describe("remainingMs", () => {
  test("running counts down against the server clock via offset", () => {
    const state = {
      ...base,
      status: "running" as const,
      endsAtMs: 1_000_000,
      pausedRemainingMs: null,
    };
    // Server says it is 900_000 while this device's clock reads 400_000
    // (device is 500s behind), so the offset is +500_000.
    const clientNow = 400_000;
    const offset = 900_000 - clientNow;
    expect(remainingMs(state, clientNow, offset)).toBe(100_000);
    // Once past the end it clamps to zero rather than going negative.
    expect(remainingMs(state, clientNow + 200_000, offset)).toBe(0);
  });

  test("paused returns frozen time; idle returns full duration", () => {
    expect(
      remainingMs(
        {
          ...base,
          status: "paused",
          endsAtMs: null,
          pausedRemainingMs: 42_000,
        },
        123,
        999,
      ),
    ).toBe(42_000);
    expect(
      remainingMs(
        { ...base, status: "idle", endsAtMs: null, pausedRemainingMs: null },
        123,
        999,
      ),
    ).toBe(300_000);
  });
});

describe("formatClock", () => {
  test("formats m:ss, rounding partial seconds up", () => {
    expect(formatClock(300_000)).toBe("5:00");
    expect(formatClock(299_001)).toBe("5:00");
    expect(formatClock(61_000)).toBe("1:01");
    expect(formatClock(0)).toBe("0:00");
  });
});
