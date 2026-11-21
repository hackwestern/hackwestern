import { describe, expect, test } from "vitest";
import { formatClock } from "./clock";

describe("formatClock", () => {
  test("formats m:ss, rounding partial seconds up", () => {
    expect(formatClock(600_000)).toBe("10:00");
    expect(formatClock(599_001)).toBe("10:00");
    expect(formatClock(61_000)).toBe("1:01");
    expect(formatClock(0)).toBe("0:00");
  });
});
