import { describe, expect, test } from "vitest";

import { JUDGING_UNLOCKS_AT, judgingUnlocked } from "./sponsor-judging-unlock";

describe("judgingUnlocked", () => {
  test("locked before Sunday 9:00 AM Eastern", () => {
    expect(judgingUnlocked(new Date("2026-11-22T08:59:00-05:00"))).toBe(false);
    expect(judgingUnlocked(new Date("2026-11-21T12:00:00-05:00"))).toBe(false);
  });

  test("open from Sunday 9:00 AM Eastern", () => {
    expect(judgingUnlocked(JUDGING_UNLOCKS_AT)).toBe(true);
    expect(judgingUnlocked(new Date("2026-11-22T10:30:00-05:00"))).toBe(true);
  });
});
