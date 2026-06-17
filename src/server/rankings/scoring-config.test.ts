import { describe, expect, test } from "vitest";
import { parseRankingAdjustments } from "./scoring-config";

describe("parseRankingAdjustments", () => {
  test("returns an empty list when the value is undefined or blank", () => {
    expect(parseRankingAdjustments(undefined)).toEqual([]);
    expect(parseRankingAdjustments("")).toEqual([]);
    expect(parseRankingAdjustments("   ")).toEqual([]);
  });

  test("parses a valid JSON array of adjustments", () => {
    const raw = JSON.stringify([
      { field: "gender", multipliers: { Male: 0.8, Female: 1.2 } },
    ]);
    expect(parseRankingAdjustments(raw)).toEqual([
      { field: "gender", multipliers: { Male: 0.8, Female: 1.2 } },
    ]);
  });

  test("throws on malformed JSON so misconfiguration is loud", () => {
    expect(() => parseRankingAdjustments("{not json")).toThrow();
  });

  test("throws when a multiplier is not a number", () => {
    const raw = JSON.stringify([
      { field: "gender", multipliers: { Male: "lots" } },
    ]);
    expect(() => parseRankingAdjustments(raw)).toThrow();
  });
});
