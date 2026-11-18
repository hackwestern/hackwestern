import { describe, expect, it } from "vitest";
import {
  addInFlight,
  removeInFlight,
  sponsorStatusIn,
  withSponsorStatus,
} from "./status-writes";

const list = [
  { name: "StarTech", status: "Not arrived", room: "1" },
  { name: "Sun Life", status: "Checked in", room: "2" },
];

describe("sponsor status writes", () => {
  it("changes only the named sponsor, ignoring case", () => {
    const next = withSponsorStatus(list, "startech", "Checked in");
    expect(next).toEqual([
      { name: "StarTech", status: "Checked in", room: "1" },
      list[1],
    ]);
    expect(withSponsorStatus(undefined, "StarTech", "Left")).toBeUndefined();
  });

  it("rolls back one sponsor without undoing another's change", () => {
    const prevA = sponsorStatusIn(list, "StarTech");
    // A then B change optimistically; A's write fails.
    let cache = withSponsorStatus(list, "StarTech", "Checked in");
    cache = withSponsorStatus(cache, "Sun Life", "Booth set up");
    cache = withSponsorStatus(cache, "StarTech", prevA!);
    expect(sponsorStatusIn(cache, "StarTech")).toBe("Not arrived");
    expect(sponsorStatusIn(cache, "Sun Life")).toBe("Booth set up");
  });

  it("tracks in-flight sponsors independently", () => {
    let set: ReadonlySet<string> = new Set();
    set = addInFlight(set, "StarTech");
    set = addInFlight(set, "Sun Life");
    set = removeInFlight(set, "STARTECH");
    expect([...set]).toEqual(["sun life"]);
  });
});
