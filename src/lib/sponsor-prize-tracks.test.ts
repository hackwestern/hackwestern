import { describe, expect, test } from "vitest";

import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import { hasPrizeTrack, prizeTrackOf } from "./sponsor-prize-tracks";

describe("prize tracks", () => {
  test("the list Jazz gave", () => {
    expect([...SPONSOR_PRIZE_TRACKS]).toEqual([
      "Scotiabank",
      "Sunlife",
      "Canada Life",
      "QNX",
      "TinyFish",
      "PCBWay",
    ]);
  });

  test("matches loosely: case, spaces, punctuation, a longer name", () => {
    expect(prizeTrackOf("Scotiabank")).toBe("Scotiabank");
    expect(prizeTrackOf("SCOTIABANK")).toBe("Scotiabank");
    expect(prizeTrackOf("Sun Life")).toBe("Sunlife");
    expect(prizeTrackOf("Sun Life Financial")).toBe("Sunlife");
    expect(prizeTrackOf("Canada-Life")).toBe("Canada Life");
    expect(prizeTrackOf("CanadaLife")).toBe("Canada Life");
    expect(prizeTrackOf("Tiny Fish")).toBe("TinyFish");
    expect(prizeTrackOf("PCB Way")).toBe("PCBWay");
    expect(prizeTrackOf("QNX​")).toBe("QNX");
  });

  test("everyone else has no track", () => {
    for (const name of ["Google", "Canada", "Life", "Bank", "", "  "]) {
      expect(hasPrizeTrack(name)).toBe(false);
    }
  });

  test("takes another list (for tests and edits)", () => {
    expect(hasPrizeTrack("Acme Corp", ["Acme"])).toBe(true);
    expect(hasPrizeTrack("Scotiabank", ["Acme"])).toBe(false);
  });
});
