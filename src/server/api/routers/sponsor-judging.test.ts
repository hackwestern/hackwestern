import { describe, expect, test } from "vitest";

import {
  lookupHwContactPhones,
  normalizeOptionalText,
  normalizePersonName,
  normalizePhoneNumber,
  parseSponsorInfoColumns,
} from "./sponsor-judging";

function phoneMap(entries: [string, string][]) {
  return new Map(entries.map(([n, p]) => [normalizePersonName(n), p]));
}

const sheet = phoneMap([
  ["Noah Medland", "289-962-9190"],
  ["Jessica Wang", "647-278-2956"],
  ["Jessica Xing", "647-588-9887"],
  ["William", "4163474090"],
  ["Daniel Wang", "6047210184"],
  ["Natalie Wang", "647-718-0340‬"],
]);

describe("normalizePersonName", () => {
  test("lowercases, collapses space, strips invisible chars", () => {
    expect(normalizePersonName("  Noah\u202c  Medland ")).toBe("noah medland");
  });
});

describe("normalizePhoneNumber", () => {
  test("strips invisible chars, keeps display formatting", () => {
    expect(normalizePhoneNumber("647-718-0340‬")).toBe("647-718-0340");
  });

  test("trims and collapses internal whitespace", () => {
    expect(normalizePhoneNumber(" +1 647 718 0340 ")).toBe("+1 647 718 0340");
  });

  test("empty when blank", () => {
    expect(normalizePhoneNumber("  ")).toBe("");
  });
});

describe("lookupHwContactPhones", () => {
  test("exact full-name match", () => {
    expect(lookupHwContactPhones("Noah Medland", sheet)).toEqual([
      "289-962-9190",
    ]);
  });

  test("case and spacing insensitive", () => {
    expect(lookupHwContactPhones("  noah  medland ", sheet)).toEqual([
      "289-962-9190",
    ]);
  });

  test("unique first-name-only sheet row matches a full name", () => {
    expect(lookupHwContactPhones("William Jiang", sheet)).toEqual([
      "4163474090",
    ]);
  });

  test("first-name-only query hits first-name-only row", () => {
    expect(lookupHwContactPhones("William", sheet)).toEqual(["4163474090"]);
  });

  test("ambiguous first name with distinct last names picks the right row", () => {
    expect(lookupHwContactPhones("Jessica Xing", sheet)).toEqual([
      "647-588-9887",
    ]);
    expect(lookupHwContactPhones("Jessica Wang", sheet)).toEqual([
      "647-278-2956",
    ]);
  });

  test("ambiguous bare first name returns nothing", () => {
    expect(lookupHwContactPhones("Jessica", sheet)).toEqual([]);
  });

  test("multiple contacts split on slash", () => {
    expect(lookupHwContactPhones("Noah / Daniel", sheet)).toEqual([
      "289-962-9190",
      "6047210184",
    ]);
  });

  test("placeholder and unknown names return empty", () => {
    expect(lookupHwContactPhones("—", sheet)).toEqual([]);
    expect(lookupHwContactPhones("Nobody Real", sheet)).toEqual([]);
  });
});

describe("normalizeOptionalText", () => {
  test("trims and keeps real values", () => {
    expect(normalizeOptionalText("  Room 1330  ")).toBe("Room 1330");
  });

  test("empty and blank stay empty (no TBD)", () => {
    expect(normalizeOptionalText(undefined)).toBe("");
    expect(normalizeOptionalText("   ")).toBe("");
    expect(normalizeOptionalText("TBD")).toBe("TBD");
  });
});

describe("parseSponsorInfoColumns", () => {
  test("canonical A–H header maps workshop + coffee chat columns", () => {
    const cols = parseSponsorInfoColumns([
      "Sponsor Name",
      "Status",
      "Judging Room Number",
      "Booth Location",
      "HW Contact",
      "Workshop Location",
      "Workshop Time",
      "Coffee Chat Max Minutes",
    ]);
    expect(cols).toEqual({
      nameCol: 0,
      statusCol: 1,
      roomCol: 2,
      boothCol: 3,
      hwContactCol: 4,
      workshopLocationCol: 5,
      workshopTimeCol: 6,
      maxMinutesCol: 7,
    });
  });

  test("defaults when header row is empty", () => {
    expect(parseSponsorInfoColumns([])).toEqual({
      nameCol: 0,
      statusCol: 1,
      roomCol: 2,
      boothCol: 3,
      hwContactCol: 4,
      workshopLocationCol: 5,
      workshopTimeCol: 6,
      maxMinutesCol: 7,
    });
  });

  test("does not steal HW Contact for workshop headers", () => {
    const cols = parseSponsorInfoColumns([
      "Company Name",
      "Status",
      "Room",
      "Booth",
      "HW Contact",
      "Workshop Time",
      "Workshop Location",
    ]);
    expect(cols.hwContactCol).toBe(4);
    expect(cols.workshopTimeCol).toBe(5);
    expect(cols.workshopLocationCol).toBe(6);
    expect(cols.maxMinutesCol).toBe(7);
  });

  test("maps a coffee chat allowance header wherever it sits", () => {
    const cols = parseSponsorInfoColumns([
      "Company Name",
      "Coffee Chat Max Minutes",
      "Status",
    ]);
    expect(cols.maxMinutesCol).toBe(1);
  });
});
