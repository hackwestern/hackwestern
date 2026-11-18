import { describe, expect, test } from "vitest";

import {
  SPONSOR_PALETTE,
  sponsorColor,
  sponsorColorIndexes,
} from "~/lib/sponsor-colors";

const names = ["Canada Life", "Shopify", "RBC", "Google", "Ford", "Bell"];

describe("sponsor colours", () => {
  test("distinct for up to the palette size", () => {
    const map = sponsorColorIndexes(names);
    expect(names.length).toBe(SPONSOR_PALETTE.length);
    expect(new Set(map.values()).size).toBe(names.length);
  });

  test("stable: same names in any order get the same colours", () => {
    const a = sponsorColorIndexes(names);
    const b = sponsorColorIndexes([...names].reverse());
    for (const n of names) expect(b.get(n)).toBe(a.get(n));
    // And on every call.
    expect(sponsorColorIndexes(names)).toEqual(a);
  });

  test("more sponsors than colours: everyone still gets one", () => {
    const many = [...names, "Extra 1", "Extra 2", "Extra 3"];
    const map = sponsorColorIndexes(many);
    expect(map.size).toBe(many.length);
    for (const i of map.values()) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(SPONSOR_PALETTE.length);
    }
    // The first six (sorted) still fill every colour once.
    const first = [...many].sort().slice(0, SPONSOR_PALETTE.length);
    expect(new Set(first.map((n) => map.get(n))).size).toBe(
      SPONSOR_PALETTE.length,
    );
  });

  test("unknown names fall back to a hash colour, the same every time", () => {
    const map = sponsorColorIndexes(names);
    expect(sponsorColor(map, "Not registered")).toBe(
      sponsorColor(new Map(), "Not registered"),
    );
    expect(sponsorColor(map, "Shopify")).toBe(
      SPONSOR_PALETTE[map.get("Shopify")!],
    );
  });

  test("palette classes only use dashboard tokens", () => {
    for (const c of SPONSOR_PALETTE) {
      for (const cls of [c.fill, c.edge, c.dot].join(" ").split(" ")) {
        expect(cls).toMatch(/dashboard-|^ring-2$|^ring-inset$/);
      }
    }
  });
});
