import { describe, expect, test } from "vitest";

import { SPONSOR_BAY_BOOTHS, boothFor } from "./sponsor-bay-layout";

describe("boothFor", () => {
  test("matches sponsor names loosely", () => {
    expect(boothFor("Sunlife")?.sponsor).toBe("Sun Life");
    expect(boothFor("StarTech.com")?.sponsor).toBe("StarTech");
    expect(boothFor("canada life")?.side).toBe("top");
  });

  test("unknown or missing sponsors have no booth", () => {
    expect(boothFor("Test Sponsor")).toBeNull();
    expect(boothFor(null)).toBeNull();
  });

  test("no two booths share a cell", () => {
    const cells = SPONSOR_BAY_BOOTHS.map((b) => `${b.col}:${b.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});
