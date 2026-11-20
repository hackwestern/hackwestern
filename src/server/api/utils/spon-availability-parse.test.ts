import { describe, expect, test } from "vitest";
import {
  parseDayTimes,
  parseSponAvailability,
  parseTimePhrase,
  runOfShowColumns,
} from "./spon-availability-parse";
import type { SheetGrid } from "./run-of-show-parse";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("parseTimePhrase", () => {
  test.each([
    ["All day", 0, 1440],
    ["all day", 0, 1440],
    ["After 2:30PM", h(14, 30), 1440],
    ["After 9AM", h(9), 1440],
    ["After 3PM", h(15), 1440],
    ["After 5PM", h(17), 1440],
    ["after 1 pm", h(13), 1440],
    // No AM/PM: 8-11 morning, 12-7 afternoon.
    ["Before 2:30", 0, h(14, 30)],
    ["After 3:30", h(15, 30), 1440],
    ["After 9", h(9), 1440],
    ["Before 12AM", 0, 1440],
    ["4PM-7PM", h(16), h(19)],
    ["7:30AM-6:30PM", h(7, 30), h(18, 30)],
    ["1AM-4AM", h(1), h(4)],
    ["4AM-8:30AM", h(4), h(8, 30)],
    // Ends at midnight.
    ["11PM-12AM", h(23), 1440],
    // The start takes the end's AM/PM.
    ["11-11:30AM", h(11), h(11, 30)],
    ["11-1PM", h(11), h(13)],
    ["2 to 4", h(14), h(16)],
    ["14:00-16:30", h(14), h(16, 30)],
    // Past midnight: end runs into the next day.
    ["11PM-2AM", h(23), 1440 + h(2)],
  ])("%s", (text, start, end) => {
    expect(parseTimePhrase(text)).toEqual({ start, end });
  });

  test.each(["", "maybe", "TBD", "ask me", "After lunch", "25:00-26:00", "13PM-2PM", "9:75AM-10AM"])(
    "%j is not a time",
    (text) => {
      expect(parseTimePhrase(text)).toBeNull();
    },
  );
});

describe("parseDayTimes", () => {
  test("a list with its own days", () => {
    const { ranges, unread } = parseDayTimes("friday 4PM-7PM, sunday 7:30AM-6:30PM");
    expect(ranges.Friday).toEqual([{ start: h(16), end: h(19) }]);
    expect(ranges.Saturday).toEqual([]);
    expect(ranges.Sunday).toEqual([{ start: h(7, 30), end: h(18, 30) }]);
    expect(unread).toEqual([]);
  });

  test("day before or after the time", () => {
    expect(parseDayTimes("Saturday 1AM-4AM").ranges.Saturday).toEqual([
      { start: h(1), end: h(4) },
    ]);
    expect(parseDayTimes("11-11:30AM sunday").ranges.Sunday).toEqual([
      { start: h(11), end: h(11, 30) },
    ]);
  });

  test("an overnight window is split across the two calendar days", () => {
    const { ranges } = parseDayTimes("Saturday 11PM-2AM");
    expect(ranges.Saturday).toEqual([{ start: h(23), end: 1440 }]);
    expect(ranges.Sunday).toEqual([{ start: 0, end: h(2) }]);
  });

  test("past Sunday night is dropped, not wrapped to Friday", () => {
    const { ranges } = parseDayTimes("Sunday 11PM-2AM");
    expect(ranges.Sunday).toEqual([{ start: h(23), end: 1440 }]);
    expect(ranges.Friday).toEqual([]);
  });

  test("a part without a day takes the previous part's", () => {
    expect(parseDayTimes("Saturday 1AM-2AM, 3AM-4AM").ranges.Saturday).toEqual([
      { start: h(1), end: h(2) },
      { start: h(3), end: h(4) },
    ]);
  });

  test("--, none and blank are no windows", () => {
    for (const text of ["--", "-", "none", "N/A", ""]) {
      const { ranges, unread } = parseDayTimes(text);
      expect(ranges.Friday.length + ranges.Saturday.length + ranges.Sunday.length).toBe(0);
      expect(unread).toEqual([]);
    }
  });

  test("a time with no day can't be placed: kept as written", () => {
    expect(parseDayTimes("1AM-4AM")).toMatchObject({
      unread: [{ day: null, text: "1AM-4AM" }],
    });
  });

  test("garbage is kept as written, readable parts still count", () => {
    const { ranges, unread } = parseDayTimes("Before 2:30, maybe later??", "Saturday");
    expect(ranges.Saturday).toEqual([{ start: 0, end: h(14, 30) }]);
    expect(unread).toEqual([{ day: "Saturday", text: "maybe later??" }]);
  });

  test("words like 'stepping out' are stripped when asked", () => {
    const away = /\bstepping\s+out\b/gi;
    const { ranges, unread } = parseDayTimes(
      "stepping out 11PM-12AM friday, 11-11:30AM sunday",
      null,
      away,
    );
    expect(ranges.Friday).toEqual([{ start: h(23), end: 1440 }]);
    expect(ranges.Sunday).toEqual([{ start: h(11), end: h(11, 30) }]);
    expect(unread).toEqual([]);
  });
});

/** The RUN OF SHOW tab as read on 2026-11-18, columns A-X. */
function sheetGrid(): SheetGrid {
  const grid: SheetGrid = Array.from({ length: 20 }, () => Array<string>(24).fill(""));
  const put = (ref: string, text: string) => {
    const col = ref.charCodeAt(0) - 65;
    const row = Number(ref.slice(1)) - 1;
    grid[row]![col] = text;
  };
  put("A2", "Time (EST)");
  put("B2", "Big Event");
  put("G2", "Task");
  put("H2", "Owner");
  put("J2", "Owner");
  put("B3", "Friday");
  put("A4", "4:00 PM");
  put("B4", "Spon Team Arrives");
  put("G4", "Get settled");
  put("H4", "All");
  put("A5", "4:30 PM");
  put("J5", "SPON TEAM AVAILABILITY");
  put("K5", "FRIDAY");
  put("L5", "SATURDAY");
  put("M5", "SUNDAY");
  const avail: [string, string, string, string][] = [
    ["Noah", "All day", "All day", "All day"],
    ["Caroline", "After 2:30PM", "All day", "All day"],
    ["Daniel", "All day", "After 9AM", "All day"],
    ["Alice", "After 3PM", "Before 2:30, After 3:30", "All day"],
    ["Aniya", "After 1PM", "After 5PM", "All day"],
  ];
  avail.forEach(([name, fri, sat, sun], i) => {
    put(`J${6 + i}`, name);
    put(`K${6 + i}`, fri);
    put(`L${6 + i}`, sat);
    put(`M${6 + i}`, sun);
  });
  put("N8", "find Daniel a sleep time somewhere");
  put("J12", "SPON TEAM NECESSARY SHIFTS");
  put("K12", "SHIFT");
  put("L12", "ON-CALL (remote)");
  const onCall = [
    ["Noah", "Saturday 1AM-4AM"],
    ["Caroline", "Sunday 4AM-7:30AM"],
    ["Daniel", "--"],
    ["Alice", "Saturday 4AM-8:30AM"],
    ["Aniya", "Sunday 1AM-4AM"],
  ];
  onCall.forEach(([name, text], i) => {
    put(`J${13 + i}`, name!);
    put(`L${13 + i}`, text!);
  });
  put("N13", "everyone:");
  put("O13", "friday 4PM-7PM, sunday 7:30AM-6:30PM");
  put("P13", "daniel: stepping out 11PM-12AM friday, 11-11:30AM sunday");
  return grid;
}

describe("parseSponAvailability", () => {
  const parsed = parseSponAvailability(sheetGrid());
  const person = (name: string) => parsed.organizers.find((o) => o.name === name)!;

  test("one organizer per name, in sheet order", () => {
    expect(parsed.organizers.map((o) => o.name)).toEqual([
      "Noah",
      "Caroline",
      "Daniel",
      "Alice",
      "Aniya",
    ]);
  });

  test("free hours per day", () => {
    expect(person("Noah").available.Friday).toEqual([{ start: 0, end: 1440 }]);
    expect(person("Caroline").available.Friday).toEqual([{ start: h(14, 30), end: 1440 }]);
    expect(person("Alice").available.Saturday).toEqual([
      { start: 0, end: h(14, 30) },
      { start: h(15, 30), end: 1440 },
    ]);
    expect(person("Aniya").available.Saturday).toEqual([{ start: h(17), end: 1440 }]);
  });

  test("on-call windows land on their calendar day", () => {
    expect(person("Noah").onCall.Saturday).toEqual([{ start: h(1), end: h(4) }]);
    expect(person("Caroline").onCall.Sunday).toEqual([{ start: h(4), end: h(7, 30) }]);
    expect(person("Daniel").onCall).toEqual({ Friday: [], Saturday: [], Sunday: [] });
    expect(person("Alice").onCall.Saturday).toEqual([{ start: h(4), end: h(8, 30) }]);
  });

  test("everyone's required windows", () => {
    expect(parsed.required.Friday).toEqual([{ start: h(16), end: h(19) }]);
    expect(parsed.required.Sunday).toEqual([{ start: h(7, 30), end: h(18, 30) }]);
  });

  test("time away is matched to the person by label", () => {
    expect(person("Daniel").away.Friday).toEqual([{ start: h(23), end: 1440 }]);
    expect(person("Daniel").away.Sunday).toEqual([{ start: h(11), end: h(11, 30) }]);
  });

  test("free notes stay as written", () => {
    expect(person("Daniel").notes).toEqual([
      { day: null, text: "find Daniel a sleep time somewhere" },
    ]);
    expect(parsed.notes).toEqual([]);
  });

  test("an unreadable cell becomes a note on that day", () => {
    const grid = sheetGrid();
    grid[6]![10] = "ask her";
    const caroline = parseSponAvailability(grid).organizers[1]!;
    expect(caroline.available.Friday).toEqual([]);
    expect(caroline.notes).toContainEqual({ day: "Friday", text: "ask her" });
  });

  test("blocks are found by header text wherever they move", () => {
    const moved = sheetGrid().map((row) => ["", "", ...row]);
    const again = parseSponAvailability([[""], ...moved]);
    expect(again.organizers.map((o) => o.name)).toHaveLength(5);
    expect(again.required.Friday).toEqual([{ start: h(16), end: h(19) }]);
  });

  test("no blocks: no one listed", () => {
    expect(parseSponAvailability([["Time (EST)"]])).toEqual({
      organizers: [],
      required: { Friday: [], Saturday: [], Sunday: [] },
      notes: [],
    });
  });

  test("the run-of-show parser still sees only A:J", () => {
    const { grid, merges } = runOfShowColumns(sheetGrid(), [
      { startRow: 3, endRow: 5, startCol: 1, endCol: 2 },
      { startRow: 4, endRow: 5, startCol: 9, endCol: 13 },
      { startRow: 4, endRow: 6, startCol: 12, endCol: 14 },
    ]);
    expect(grid.every((row) => row.length <= 10)).toBe(true);
    expect(grid[1]).toEqual(sheetGrid()[1]!.slice(0, 10));
    expect(merges).toEqual([
      { startRow: 3, endRow: 5, startCol: 1, endCol: 2 },
      { startRow: 4, endRow: 5, startCol: 9, endCol: 10 },
    ]);
  });
});
