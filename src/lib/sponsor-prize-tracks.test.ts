import { describe, expect, test } from "vitest";

import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import {
  hasPrizeTrack,
  isDigitalJudging,
  prizeTrackOf,
  sponsorNameKey,
} from "./sponsor-prize-tracks";

describe("prize tracks", () => {
  test("PCBWay judges in person and keeps its prize track", () => {
    expect(hasPrizeTrack("PCBWay")).toBe(true);
    expect(isDigitalJudging("PCBWay")).toBe(false);
  });

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

  test("a sheet entry with a bracketed aside matches the registered name", () => {
    const sheet = ["QNX (BlackBerry)", "Sun Life", "Canada Life"];
    expect(prizeTrackOf("QNX", sheet)).toBe("QNX (BlackBerry)");
    expect(prizeTrackOf("  qnx ", sheet)).toBe("QNX (BlackBerry)");
    expect(prizeTrackOf("QNX (BlackBerry)", sheet)).toBe("QNX (BlackBerry)");
    expect(prizeTrackOf("Sunlife", sheet)).toBe("Sun Life");
    // Still no match on part of a name.
    expect(hasPrizeTrack("BlackBerry", sheet)).toBe(false);
    expect(hasPrizeTrack("Canada", sheet)).toBe(false);
    expect(hasPrizeTrack("Life", sheet)).toBe(false);
  });
});

describe("sponsorNameKey", () => {
  test("treats bracketed asides, case and punctuation as the same sponsor", () => {
    expect(sponsorNameKey("QNX (BlackBerry)")).toBe(sponsorNameKey("QNX"));
    expect(sponsorNameKey("Sun Life")).toBe(sponsorNameKey("sunlife"));
    expect(sponsorNameKey("Canada")).not.toBe(sponsorNameKey("Canada Life"));
  });
});
