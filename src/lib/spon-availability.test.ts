import { describe, expect, test } from "vitest";
import {
  availabilitySegments,
  availabilityWindow,
  emptyAvailability,
  emptyDayRanges,
  presentRanges,
  shortNames,
  subtractRanges,
  unionRanges,
  type SponOrganizer,
} from "./spon-availability";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

function person(name: string, parts: Partial<SponOrganizer> = {}): SponOrganizer {
  return {
    name,
    available: emptyDayRanges(),
    shifts: emptyDayRanges(),
    onCall: emptyDayRanges(),
    away: emptyDayRanges(),
    notes: [],
    ...parts,
  };
}

describe("ranges", () => {
  test("union merges overlapping and touching ranges", () => {
    expect(
      unionRanges([
        { start: 60, end: 120 },
        { start: 0, end: 30 },
        { start: 120, end: 180 },
        { start: 30, end: 30 },
      ]),
    ).toEqual([
      { start: 0, end: 30 },
      { start: 60, end: 180 },
    ]);
  });

  test("subtract cuts holes", () => {
    expect(
      subtractRanges([{ start: 0, end: 1440 }], [{ start: h(11), end: h(11, 30) }]),
    ).toEqual([
      { start: 0, end: h(11) },
      { start: h(11, 30), end: 1440 },
    ]);
  });
});

describe("presentRanges", () => {
  test("free or on shift, minus time away", () => {
    const daniel = person("Daniel", {
      available: { ...emptyDayRanges(), Friday: [{ start: 0, end: 1440 }] },
      away: { ...emptyDayRanges(), Friday: [{ start: h(23), end: 1440 }] },
    });
    expect(presentRanges(daniel, "Friday")).toEqual([{ start: 0, end: h(23) }]);
  });
});

describe("availabilitySegments", () => {
  const noah = person("Noah", {
    available: { ...emptyDayRanges(), Saturday: [{ start: h(9), end: 1440 }] },
    onCall: { ...emptyDayRanges(), Saturday: [{ start: h(1), end: h(4) }] },
  });
  // "All day" but on call (remote) overnight: on call wins.
  const caroline = person("Caroline", {
    available: { ...emptyDayRanges(), Sunday: [{ start: 0, end: 1440 }] },
    onCall: { ...emptyDayRanges(), Sunday: [{ start: h(4), end: h(7, 30) }] },
  });

  test("on call wins over free", () => {
    expect(availabilitySegments([caroline], "Sunday", h(3), h(8))).toEqual([
      { start: h(3), end: h(4), present: ["Caroline"], onCall: [] },
      { start: h(4), end: h(7, 30), present: [], onCall: ["Caroline"] },
      { start: h(7, 30), end: h(8), present: ["Caroline"], onCall: [] },
    ]);
  });
  const alice = person("Alice", {
    available: {
      ...emptyDayRanges(),
      Saturday: [
        { start: 0, end: h(14, 30) },
        { start: h(15, 30), end: 1440 },
      ],
    },
  });

  test("stretches with the same people, gaps included", () => {
    expect(availabilitySegments([noah, alice], "Saturday", 0, h(16))).toEqual([
      { start: 0, end: h(1), present: ["Alice"], onCall: [] },
      { start: h(1), end: h(4), present: ["Alice"], onCall: ["Noah"] },
      { start: h(4), end: h(9), present: ["Alice"], onCall: [] },
      { start: h(9), end: h(14, 30), present: ["Noah", "Alice"], onCall: [] },
      { start: h(14, 30), end: h(15, 30), present: ["Noah"], onCall: [] },
      { start: h(15, 30), end: h(16), present: ["Noah", "Alice"], onCall: [] },
    ]);
  });

  test("nobody around is its own stretch", () => {
    expect(availabilitySegments([noah], "Saturday", h(4), h(10))).toEqual([
      { start: h(4), end: h(9), present: [], onCall: [] },
      { start: h(9), end: h(10), present: ["Noah"], onCall: [] },
    ]);
  });

  test("no organizers: nothing to draw", () => {
    expect(availabilitySegments([], "Friday", 0, 1440)).toEqual([]);
  });
});

describe("shortNames", () => {
  test("two letters keep Alice and Aniya apart", () => {
    expect([...shortNames(["Noah", "Alice", "Aniya", "Mary Ann"]).values()]).toEqual([
      "No",
      "Al",
      "An",
      "MA",
    ]);
  });

  test("still equal: one more letter", () => {
    expect([...shortNames(["Sam", "Sandy"]).values()]).toEqual(["Sa", "San"]);
  });
});

describe("availabilityWindow", () => {
  test("run-of-show hours stretched to fit windows; All day doesn't stretch", () => {
    const availability = emptyAvailability();
    availability.organizers.push(
      person("Noah", {
        available: { ...emptyDayRanges(), Friday: [{ start: 0, end: 1440 }] },
      }),
      person("Aniya", {
        available: { ...emptyDayRanges(), Friday: [{ start: h(13), end: 1440 }] },
      }),
    );
    expect(
      availabilityWindow(availability, "Friday", [{ start: h(16), end: h(23, 30) }]),
    ).toEqual({ start: h(13), end: 1440 });
  });

  test("nothing to go on: the whole day", () => {
    expect(availabilityWindow(emptyAvailability(), "Sunday", [])).toEqual({
      start: 0,
      end: 1440,
    });
  });
});
