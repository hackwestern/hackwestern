import { describe, expect, test } from "vitest";

import {
  cellRef,
  parseClockLabel,
  parseOpsSchedule,
  parseOwners,
  parseTimeValue,
  type SheetMerge,
} from "~/lib/ops-run-of-show";

// A small copy of the live "Schedule View" layout: title row, a blank row,
// the header row, day markers and times in column A, tasks in the columns.
const HEADERS = [
  "Time",
  "Big Event",
  "Sponsor Workshop",
  "Non-Sponsor Workshop",
  "Activities",
  "More Activities",
  "Food",
  "Spon Booths / Coffee Chats",
  "Scavenger Hunt / Storefront",
  "Other / Ops (hardware, judging, logistics)",
  "Other / Ops (hardware, judging, logistics)",
];

function sheet(rows: Record<number, Record<number, string>>, size = 50) {
  const grid: string[][] = [
    ["", "Hack Western 13: Run of Show [show up at least 15 minutes before event starts]"],
    [],
    HEADERS,
  ];
  for (let r = 3; r < size; r++) {
    const row: string[] = [];
    for (const [c, v] of Object.entries(rows[r] ?? {})) row[Number(c)] = v;
    grid[r] = Array.from(row, (v) => v ?? "");
  }
  return grid;
}

const merge = (startRow: number, endRow: number, startCol: number, endCol = startCol + 1): SheetMerge => ({
  startRow,
  endRow,
  startCol,
  endCol,
});

describe("times", () => {
  test("column A labels", () => {
    expect(parseClockLabel("12:30 PM")).toBe("12:30");
    expect(parseClockLabel("12:00 AM")).toBe("00:00");
    expect(parseClockLabel("7:45 AM")).toBe("07:45");
    expect(parseClockLabel("FRIDAY")).toBeNull();
    expect(parseClockLabel("Friday night to Saturday morning")).toBeNull();
  });

  test("time line values, with uneven spacing", () => {
    expect(parseTimeValue("1:00 PM", "12:30")).toEqual({ start: "13:00", end: null });
    expect(parseTimeValue(" 5:00 PM", null)).toEqual({ start: "17:00", end: null });
    expect(parseTimeValue("12:00 PM - 2:00 PM", "11:30")).toEqual({ start: "12:00", end: "14:00" });
    expect(parseTimeValue("1PM - 4PM ", "12:30")).toEqual({ start: "13:00", end: "16:00" });
    expect(parseTimeValue("7:00pm", "19:00")).toEqual({ start: "19:00", end: null });
    expect(parseTimeValue("When busses arrive, 6pm-7pm", "18:00")).toEqual({
      start: "18:00",
      end: "19:00",
    });
    expect(parseTimeValue("12:00 AM", "00:00")).toEqual({ start: "00:00", end: null });
  });

  test("a side with no am/pm takes the other side's", () => {
    expect(parseTimeValue("11-1pm", null)).toEqual({ start: "11:00", end: "13:00" });
    expect(parseTimeValue("3:00-6:00 PM", null)).toEqual({ start: "15:00", end: "18:00" });
  });

  test("no time, or numbers that aren't times", () => {
    expect(parseTimeValue("TBD", "13:00")).toBeNull();
    expect(parseTimeValue("Rm 2230", "13:00")).toBeNull();
    expect(parseTimeValue("Scotiabank Workshop #1", "13:00")).toBeNull();
  });
});

describe("owners", () => {
  test("a plain list", () => {
    expect(parseOwners("Emily Liu, Sarah Lieng, Natalie Wang").map((o) => o.name)).toEqual([
      "Emily Liu",
      "Sarah Lieng",
      "Natalie Wang",
    ]);
  });

  test("groups, alone and mixed with people", () => {
    expect(parseOwners("Everyone")).toEqual([
      { raw: "Everyone", name: "Everyone", role: null, group: "everyone" },
    ]);
    expect(parseOwners("ALL OF SPON, Jasmine, Lucas")).toEqual([
      { raw: "ALL OF SPON", name: "ALL OF SPON", role: null, group: "spon" },
      { raw: "Jasmine", name: "Jasmine", role: null, group: null },
      { raw: "Lucas", name: "Lucas", role: null, group: null },
    ]);
    expect(parseOwners("All of Spon")[0]!.group).toBe("spon");
    expect(parseOwners("Caroline, Noah, Spon").map((o) => o.group)).toEqual([null, null, "spon"]);
    expect(parseOwners("Noah Medland (lead), Sponsorship")).toEqual([
      { raw: "Noah Medland (lead)", name: "Noah Medland", role: "lead", group: null },
      { raw: "Sponsorship", name: "Sponsorship", role: null, group: "spon" },
    ]);
  });

  test("roles in parentheses, separators inside them don't split", () => {
    expect(parseOwners("Aleeza (Photos), Allison (Slack + Comms)")).toEqual([
      { raw: "Aleeza (Photos)", name: "Aleeza", role: "Photos", group: null },
      { raw: "Allison (Slack + Comms)", name: "Allison", role: "Slack + Comms", group: null },
    ]);
  });

  test("slashes, ampersands, 'and', trailing commas", () => {
    expect(parseOwners("William/Daniel, Noah, Spon").map((o) => o.name)).toEqual([
      "William",
      "Daniel",
      "Noah",
      "Spon",
    ]);
    expect(parseOwners("Noah & Caroline").map((o) => o.name)).toEqual(["Noah", "Caroline"]);
    expect(parseOwners("Julian and Brittney").map((o) => o.name)).toEqual(["Julian", "Brittney"]);
    expect(parseOwners("Allison Ye, Brittney Chong, William,").map((o) => o.name)).toEqual([
      "Allison Ye",
      "Brittney Chong",
      "William",
    ]);
    // "Andy" isn't split on "and".
    expect(parseOwners("Andy Liu").map((o) => o.name)).toEqual(["Andy Liu"]);
  });
});

describe("parseOpsSchedule", () => {
  test("a full task cell: title, owners, Starts, Location, Notes", () => {
    const grid = sheet({
      3: { 0: "All days" },
      4: { 0: "FRIDAY" },
      5: { 0: "12:00 PM" },
      6: {
        0: "12:30 PM",
        6: "Costco Run\nOwner: Emily Liu, Sarah Lieng, Natalie Wang\nStarts:1:00 PM\nLocation: Costco\nNotes: last minute water run, breakfast run, snacks for wagon, etc.\n",
      },
      7: { 0: "1:00 PM" },
    });
    const { tasks, issues, foundHeader } = parseOpsSchedule(grid, []);
    expect(foundHeader).toBe(true);
    expect(issues).toEqual([]);
    expect(tasks).toEqual([
      {
        cell: "G7",
        column: "Food",
        day: "Friday",
        start: "13:00",
        end: null,
        endSource: null,
        title: "Costco Run",
        ownerText: "Emily Liu, Sarah Lieng, Natalie Wang",
        owners: expect.any(Array) as unknown,
        location: "Costco",
        blurb: "last minute water run, breakfast run, snacks for wagon, etc.",
      },
    ]);
  });

  test("no Starts line: the row's time; To-Do is the blurb; one-row cell has no end", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      8: {
        0: "2:00 PM",
        1: "Venue setup and sponsor check-in\nOwner: Everyone\nLocation: Grand Hall\nTo-Do: Blow up air mattresses, set up workshop rooms (test tech)",
      },
      9: { 0: "4:30 PM" },
    });
    const [t] = parseOpsSchedule(grid, [merge(8, 9, 1, 10)]).tasks;
    expect(t).toMatchObject({
      start: "14:00",
      end: null,
      location: "Grand Hall",
      blurb: "Blow up air mattresses, set up workshop rooms (test tech)",
    });
    expect(t!.owners[0]!.group).toBe("everyone");
  });

  test("end from the cell's height (merged rows in the time grid)", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      9: { 0: "4:30 PM" },
      10: { 0: "5:00 PM", 7: "Sponsor Bay\nOwner: ALL OF SPON\nStarts: 5:30 PM\nLocation: SM Atrium\n\n" },
      11: { 0: "6:00 PM" },
      12: { 0: "6:30 PM" },
      13: { 0: "7:00 PM" },
    });
    const [t] = parseOpsSchedule(grid, [merge(10, 13, 7, 8)]).tasks;
    expect(t).toMatchObject({ start: "17:30", end: "19:00", endSource: "cell" });
  });

  test("a range in the time line wins over the cell's height", () => {
    const grid = sheet({
      23: { 0: "SATURDAY" },
      34: { 0: "11:30 AM", 4: "Photobooth\nOwner: Sarah, Jamie, Lillian\nStarts:12:00 PM - 2:00 PM\nLocation: Grand Hall\nNotes: " },
      36: { 0: "12:30 PM" },
      40: { 0: "2:15 PM" },
    });
    const [t] = parseOpsSchedule(grid, [merge(34, 40, 4, 5)], ).tasks;
    expect(t).toMatchObject({ day: "Saturday", start: "12:00", end: "14:00", endSource: "text", blurb: null });
  });

  test("'Time: When busses arrive, 6pm-7pm' and a bare '2pm-3pm' line", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      8: { 0: "2:00 PM", 10: "MLH Coach John Pierre Arrival\n2pm-3pm\nOwner: Brittney, Julian" },
      11: { 0: "6:00 PM", 10: "Greet the bus driver and the arrived hackers\nOwner: Alex Li\nTime: When busses arrive, 6pm-7pm" },
    });
    const { tasks } = parseOpsSchedule(grid, []);
    expect(tasks.map((t) => [t.title, t.start, t.end, t.location])).toEqual([
      ["MLH Coach John Pierre Arrival", "14:00", "15:00", null],
      ["Greet the bus driver and the arrived hackers", "18:00", "19:00", null],
    ]);
  });

  test("'Start: 7:00pm', 'Judging starts:', Setup lines and unlabeled lines", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      13: { 0: "7:00 PM", 10: "Position volunteers along the path from SEI to Ivey\nOwner: Jess\nStart: 7:00pm" },
      23: { 0: "SUNDAY" },
      24: {
        0: "11:30 AM",
        1: "Demo Fair and Judging\nOwner: All judges and assigned crew\nSetup: 11:30 AM\nJudging starts: 11:45 AM\nLocation: Grand Hall (Rm 1110)\nJasmine: Run the judging platform.\nBy 1:00 PM: Noah collects winners.",
      },
      27: { 0: "1:00 PM" },
    });
    const { tasks } = parseOpsSchedule(grid, [merge(24, 27, 1, 3)]);
    expect(tasks[0]).toMatchObject({ start: "19:00", title: "Position volunteers along the path from SEI to Ivey" });
    expect(tasks[1]).toMatchObject({
      day: "Sunday",
      start: "11:45",
      end: "13:00",
      location: "Grand Hall (Rm 1110)",
      blurb: "Setup: 11:30 AM\nJudging starts: 11:45 AM\nJasmine: Run the judging platform.\nBy 1:00 PM: Noah collects winners.",
    });
  });

  test("'Do by' is a deadline in the blurb; the row's time comes from a merged column A cell", () => {
    const grid = sheet({
      23: { 0: "SATURDAY" },
      29: { 0: "9:00 AM" },
      30: { 9: "Convert to 2110 and 2235 back to workshop rooms\nOwner: Sarah Lieng\nDo by 9:45 AM" },
      31: { 0: "9:30 AM" },
    });
    const [t] = parseOpsSchedule(grid, [merge(29, 31, 0, 1)]).tasks;
    expect(t).toMatchObject({ start: "09:00", end: null, blurb: "Do by 9:45 AM" });
  });

  test("'Starts: TBD' keeps the text and uses the row's time", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      6: { 0: "1:00 PM", 6: "Water\nOwner: Emily Liu\nStarts: TBD" },
    });
    const [t] = parseOpsSchedule(grid, []).tasks;
    expect(t).toMatchObject({ start: "13:00", blurb: "Time: TBD" });
  });

  test("midnight rows belong to the next day", () => {
    const grid = sheet({
      22: { 0: "11:30 PM" },
      23: { 0: "SATURDAY" },
      24: { 0: "12:00 AM", 4: "Krillion + Puffer Party\nOwner: Kevin, Anson, Jessica Wang\nStarts:12:00 AM\nLocation: Rm 2230\nNotes: " },
    });
    const [t] = parseOpsSchedule(grid, []).tasks;
    expect(t).toMatchObject({ day: "Saturday", start: "00:00" });
  });

  test("a cell ending at a day marker or a column A note has no end", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      21: { 0: "11:00 PM", 3: "Late\nOwner: Alex\nStarts: 11:00 PM" },
      22: { 0: "11:30 PM" },
      23: { 0: "SATURDAY" },
      24: { 0: "12:00 AM", 4: "Night\nOwner: Ethan\nStarts: 12:00 AM" },
      25: { 0: "12:30 AM" },
      26: { 0: "Friday night to Saturday morning | Overnight coverage\nNo scheduled events." },
      27: { 0: "7:45 AM" },
    });
    const { tasks, issues } = parseOpsSchedule(grid, [merge(21, 23, 3, 4), merge(24, 26, 4, 5), merge(26, 27, 0, 10)]);
    expect(tasks.map((t) => t.end)).toEqual([null, null]);
    expect(issues).toEqual([
      {
        cell: "A27",
        day: "Saturday",
        time: null,
        title: "Friday night to Saturday morning | Overnight coverage",
        reason: "note",
      },
    ]);
  });

  test("cells with no Owner line are issues, not tasks", () => {
    const grid = sheet({
      4: { 0: "FRIDAY" },
      18: { 0: "9:00 PM", 1: "HACKING STARTS" },
      23: { 0: "SUNDAY" },
      24: {
        0: "2:00 PM",
        1: "Closing Ceremony\nSpeakers: Julian and Brittney\nHorses: Lillian and Jessica Wang\nStarts: 2:00 PM\nLocation: Ivey BMO Auditorium",
      },
    });
    const { tasks, issues } = parseOpsSchedule(grid, []);
    expect(tasks).toEqual([]);
    expect(issues.map((i) => [i.cell, i.title, i.reason, i.day, i.time])).toEqual([
      ["B19", "HACKING STARTS", "no-owner", "Friday", "21:00"],
      ["B25", "Closing Ceremony", "no-owner", "Sunday", "14:00"],
    ]);
  });

  test("a task under 'All days' or before any time is reported", () => {
    const grid = sheet({
      3: { 0: "All days", 1: "Wear lanyards\nOwner: Everyone" },
      4: { 0: "FRIDAY", 2: "Early\nOwner: Alex" },
    });
    const { tasks, issues } = parseOpsSchedule(grid, []);
    expect(tasks).toEqual([]);
    expect(issues.map((i) => i.reason)).toEqual(["no-day", "no-time"]);
  });

  test("no header row: nothing is read", () => {
    expect(parseOpsSchedule([["Hello"]], [])).toEqual({ tasks: [], issues: [], foundHeader: false });
  });

  test("cell references", () => {
    expect(cellRef(0, 0)).toBe("A1");
    expect(cellRef(9, 10)).toBe("K10");
    expect(cellRef(0, 26)).toBe("AA1");
  });
});
