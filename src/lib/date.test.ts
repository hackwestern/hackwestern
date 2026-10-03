import { afterEach, describe, expect, test, vi } from "vitest";
import { isPastDeadline } from "~/lib/date";

// Applications close at 11:59 PM Toronto time on Oct 18. Toronto is still on
// daylight time then (EDT, UTC-4; clocks change Nov 1), so that is 03:59 UTC.
describe("isPastDeadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("open at 11:58:59 PM Eastern on Oct 18", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T03:58:59Z"));
    expect(isPastDeadline()).toBe(false);
  });

  test("closed at 11:59 PM Eastern on Oct 18", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T03:59:00Z"));
    expect(isPastDeadline()).toBe(true);
  });
});
