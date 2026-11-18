import { describe, expect, test } from "vitest";

import { opsOwnerAliases } from "~/content/ops-pings-aliases";
import {
  editDistance,
  foldAliases,
  foldName,
  matchName,
  type NameCandidate,
} from "~/lib/ops-owners";

const ORGANIZERS: NameCandidate[] = [
  { id: "U-JX", name: "Jessica Xing" },
  { id: "U-JW", name: "Jessica Wang" },
  { id: "U-JG", name: "Jasmine Gu", otherNames: ["Jazz Gu"] },
  { id: "U-LV", name: "Lucas Vanderwielen" },
  { id: "U-BC", name: "Brittney Chong" },
  { id: "U-EL", name: "Émily Liu" },
  { id: "U-AW", name: "Anson Wang" },
  { id: "U-AL", name: "Alex Li" },
  { id: "U-AX", name: "Alex Xu" },
];
const aliases = foldAliases(opsOwnerAliases);

describe("matchName", () => {
  test("the seeded alias: Jess is Jessica Xing, never Jessica Wang", () => {
    expect(matchName("Jess", ORGANIZERS, aliases)).toEqual({
      status: "one",
      id: "U-JX",
      name: "Jessica Xing",
      via: "alias",
    });
    expect(matchName("Jessica Wang", ORGANIZERS, aliases)).toMatchObject({ id: "U-JW", via: "full" });
  });

  test("an alias whose person isn't here matches nobody (no fallback guess)", () => {
    const only = ORGANIZERS.filter((o) => o.id !== "U-JX");
    expect(matchName("Jess", only, aliases)).toEqual({ status: "none" });
  });

  test("full name, any case, accents and spacing", () => {
    expect(matchName("  jasmine   GU ", ORGANIZERS)).toMatchObject({ id: "U-JG", via: "full" });
    expect(matchName("Emily Liu", ORGANIZERS)).toMatchObject({ id: "U-EL", via: "full" });
    expect(matchName("Jazz Gu", ORGANIZERS)).toMatchObject({ id: "U-JG", via: "full" });
  });

  test("a first name only one organizer has", () => {
    expect(matchName("Jasmine", ORGANIZERS)).toMatchObject({ id: "U-JG", via: "first" });
    expect(matchName("Anson", ORGANIZERS)).toMatchObject({ id: "U-AW", via: "first" });
  });

  test("a first name several organizers have is ambiguous", () => {
    expect(matchName("Jessica", ORGANIZERS)).toEqual({
      status: "many",
      candidates: ["Jessica Wang", "Jessica Xing"],
    });
    expect(matchName("Alex", ORGANIZERS)).toEqual({ status: "many", candidates: ["Alex Li", "Alex Xu"] });
  });

  test("one letter off, when only one organizer is that close", () => {
    expect(matchName("Lucus", ORGANIZERS)).toMatchObject({ id: "U-LV", via: "close" });
    expect(matchName("Brittany", ORGANIZERS)).toMatchObject({ id: "U-BC", via: "close" });
    expect(matchName("Brittany Chong", ORGANIZERS)).toMatchObject({ id: "U-BC", via: "close" });
  });

  test("missing commas and unknown names match nobody", () => {
    expect(matchName("Anson Holia", ORGANIZERS)).toEqual({ status: "none" });
    expect(matchName("William Jessica Wang", ORGANIZERS)).toEqual({ status: "none" });
    expect(matchName("WEB", ORGANIZERS)).toEqual({ status: "none" });
    expect(matchName("", ORGANIZERS)).toEqual({ status: "none" });
    // Short names get no close match: "Ali" is not "Alex".
    expect(matchName("Ali", ORGANIZERS)).toEqual({ status: "none" });
  });
});

test("foldName and editDistance", () => {
  expect(foldName("  Émily   LIU ")).toBe("emily liu");
  expect(editDistance("lucus", "lucas")).toBe(1);
  expect(editDistance("anson", "alice", 1)).toBe(2);
});
