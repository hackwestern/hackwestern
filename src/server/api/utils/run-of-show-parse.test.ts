import { describe, expect, test } from "vitest";

import {
  applySponsorNames,
  matchSponsors,
  parseCoffeeChatsTab,
  parseRunOfShowTab,
  splitLocation,
  type SheetMerge,
} from "./run-of-show-parse";

// Trimmed copy of the live "RUN OF SHOW" tab (read 2026-11-14), 0-based rows.
const HEADER = [
  "Time (EST)", "Big Event", "Sponsor Workshop", "Food", "Spon Booth",
  "Coffee Chats", "Task", "Owner", "Task", "Owner",
];
const ROS: string[][] = [
  /* 0 */ ["", "Hack Western 2026 Schedule"],
  /* 1 */ HEADER,
  /* 2 */ ["", "Friday"],
  /* 3 */ ["4:30 PM", "", "", "", "", "", "Guide sponsors to tables + help set up", "All", "", "SPON TEAM AVAILABILITY"],
  /* 4 */ ["5:00 PM", "Registration\n\nLocation: Grand Hall (Rm 1110)", "", "", "Sponsor Bay Open\n\nLocation: SM Atrium", "", "Ensure sponsors eat dinner first", "All", "", "Noah"],
  /* 5 */ ["5:30 PM", "", "", "Dinner \n\nLocation: Rm 1230", "", "", "Sponsor Bay coverage", "Noah", "Second-pair task", "Caroline"],
  /* 6 */ ["6:00 PM"],
  /* 7 */ ["6:30 PM"],
  /* 8 */ ["9:00 PM", "Hacking Begins", "", "", "", "", "Coffee Chat deadline", "Alice"],
  /* 9 */ ["9:30 PM", "", "", "", "", "", "Support MLH Workshop setup"],
  /* 10 */ ["10:00 PM", "", "MLH Workshop\nLocation: Rm 2230 (50)"],
  /* 11 */ ["11:30 PM"],
  /* 12 */ ["", "Saturday"],
  /* 13 */ ["12:00 AM", "Hacking Continues"],
  /* 14 */ ["12:30 AM"],
  /* 15 */ [],
  /* 16 */ ["1:00 PM", "", "Canada Life Workshop\nLocation: 2230 (50)"],
  /* 17 */ ["1:30 PM"],
  /* 18 */ ["2:30 PM", "", "Sunlife Workshop\nLocation: 2230 (50)", "", "", "", "", "", "Talk to Sunlife", "Daniel"],
  /* 19 */ ["3:00 PM"],
  /* 20 */ ["6:00 PM", "Buses Depart\nLocation: ____"],
];
const MERGES: SheetMerge[] = [
  { startRow: 2, endRow: 3, startCol: 1, endCol: 8 }, // day marker
  { startRow: 4, endRow: 8, startCol: 4, endCol: 5 }, // Sponsor Bay 5:00-
  { startRow: 5, endRow: 7, startCol: 3, endCol: 4 }, // Dinner 5:30-6:30
  { startRow: 8, endRow: 12, startCol: 1, endCol: 2 }, // Hacking Begins to midnight
  { startRow: 8, endRow: 10, startCol: 7, endCol: 8 }, // Owner "Alice" merged
  { startRow: 13, endRow: 16, startCol: 1, endCol: 2 }, // runs into a blank row
  { startRow: 16, endRow: 18, startCol: 2, endCol: 3 }, // Canada Life 1:00-
];

const parsed = parseRunOfShowTab(ROS, MERGES);
const byTitle = (title: string) => parsed.items.find((i) => i.title === title);

describe("parseRunOfShowTab", () => {
  test("assigns day markers to the rows under them", () => {
    expect(byTitle("Registration")?.day).toBe("Friday");
    expect(byTitle("Hacking Continues")).toMatchObject({ day: "Saturday", start: "00:00" });
    expect(byTitle("Sunlife Workshop")?.day).toBe("Saturday");
  });

  test("merged block ends at the row after the merge", () => {
    expect(byTitle("Dinner")).toMatchObject({ start: "17:30", end: "18:30", column: "food" });
    // Merge ends on 6:30 PM; the next row is 9:00 PM.
    expect(byTitle("Sponsor Bay Open")).toMatchObject({ start: "17:00", end: "21:00", column: "spon-booth" });
    expect(byTitle("Canada Life Workshop")).toMatchObject({ start: "13:00", end: "14:30" });
  });

  test("unmerged block lasts 30 minutes", () => {
    expect(byTitle("Registration")).toMatchObject({ start: "17:00", end: "17:30" });
    expect(byTitle("MLH Workshop")).toMatchObject({ start: "22:00", end: "22:30" });
  });

  test("a block running to the day marker ends at 24:00", () => {
    expect(byTitle("Hacking Begins")).toMatchObject({ start: "21:00", end: "24:00" });
  });

  test("a merge into a blank row ends 30 min after its last timed row", () => {
    expect(byTitle("Hacking Continues")?.end).toBe("01:00");
  });

  test("splits title and location", () => {
    expect(byTitle("Dinner")?.location).toBe("Rm 1230");
    expect(byTitle("MLH Workshop")?.location).toBe("Rm 2230 (50)");
    expect(byTitle("Hacking Begins")?.location).toBeNull();
    expect(byTitle("Buses Depart")?.location).toBeNull();
  });

  test("ids are day-start-column and items are in time order", () => {
    expect(byTitle("Dinner")?.id).toBe("Friday-17:30-food");
    const ids = parsed.items.map((i) => i.id);
    expect(ids.indexOf("Friday-17:00-big-event")).toBeLessThan(ids.indexOf("Friday-17:00-spon-booth"));
    expect(ids.at(-1)).toBe("Saturday-18:00-big-event");
  });

  test("reads tasks from both Task/Owner pairs", () => {
    expect(parsed.tasks).toContainEqual({ day: "Friday", start: "17:30", task: "Sponsor Bay coverage", owner: "Noah" });
    expect(parsed.tasks).toContainEqual({ day: "Friday", start: "17:30", task: "Second-pair task", owner: "Caroline" });
    expect(parsed.tasks).toContainEqual({ day: "Saturday", start: "14:30", task: "Talk to Sunlife", owner: "Daniel" });
    // Owner-only cells (team availability list) are not tasks.
    expect(parsed.tasks.some((t) => t.task === "SPON TEAM AVAILABILITY")).toBe(false);
    expect(parsed.tasks.filter((t) => t.start === "17:00")).toHaveLength(1);
  });

  test("a merged owner cell covers every task inside it; blank owner is null", () => {
    expect(parsed.tasks.find((t) => t.task === "Support MLH Workshop setup")?.owner).toBe("Alice");
    expect(parsed.tasks.find((t) => t.task === "Coffee Chat deadline")?.owner).toBe("Alice");
  });

  test("throws without a header row", () => {
    expect(() => parseRunOfShowTab([["", "Friday"]], [])).toThrow();
  });
});

describe("splitLocation", () => {
  test("joins multi-line locations", () => {
    expect(splitLocation("Sponsor Track Judging\nLocation: \nScotiabank: Rm 2110\nQNX: Rm 2235")).toEqual({
      title: "Sponsor Track Judging",
      location: "Scotiabank: Rm 2110, QNX: Rm 2235",
    });
  });
});

describe("sponsor matching", () => {
  const names = ["Canada Life", "Sun Life", "Scotiabank"];

  test("ignores case and spaces", () => {
    expect(matchSponsors("Sunlife Workshop", names)).toEqual(["Sun Life"]);
    expect(matchSponsors("Canada Life Workshop", names)).toEqual(["Canada Life"]);
    expect(matchSponsors("Hacking Begins", names)).toEqual([]);
  });

  test("applySponsorNames fills items and renames coffee chat rows", () => {
    const named = applySponsorNames(
      { ...parsed, coffeeChats: parseCoffeeChatsTab(COFFEE), ceremonies: [], workshops: [] },
      names,
    );
    expect(named.items.find((i) => i.title === "Sunlife Workshop")?.sponsors).toEqual(["Sun Life"]);
    expect(named.items.find((i) => i.title === "Dinner")?.sponsors).toEqual([]);
    expect(named.coffeeChats.map((c) => c.sponsor)).toEqual(["StarTech", "Sun Life", "Canada Life", "Scotiabank", "CSE"]);
  });

  test("matches sponsors named only in the location (Sunday judging rooms)", () => {
    const judging = {
      ...parsed.items[0]!,
      title: "Sponsor Track Judging",
      location: "Scotiabank: Rm 2110, Canada Life: Rm 2230",
    };
    const named = applySponsorNames(
      { ...parsed, coffeeChats: [], ceremonies: [], workshops: [], items: [judging] },
      names,
    );
    expect(named.items[0]?.sponsors.sort()).toEqual(["Canada Life", "Scotiabank"]);
  });
});

const COFFEE: string[][] = [
  ["Sponsor", "AVAILABILITY START", "AVAILABILITY END", "CHATTING HOURS", "SLOTS", "HACKERS CHATTING", "FORMAT", "NOTES"],
  ["StarTech", "9:00 AM", "1:00 PM", "2", "24", "24", "Individual (15 mins)", "3-4 reps (notes based on 3)"],
  ["Sunlife", "10:00 AM", "4:00 PM", "3", "12", "36", "Groups (30 mins with 3 people)"],
  ["Canada Life", "10:00 AM", "12:00 PM", "3", "4", "12", "Groups (30 mins with 3 people)"],
  ["Scotiabank"],
  ["CSE"],
  [],
  ["Total", "", "", "", "", "72"],
];

describe("parseCoffeeChatsTab", () => {
  const setups = parseCoffeeChatsTab(COFFEE);

  test("reads a set-up sponsor", () => {
    expect(setups[0]).toEqual({
      sponsor: "StarTech",
      windowStart: "09:00",
      windowEnd: "13:00",
      durationMinutes: 15,
      groupSize: 1,
      chattingHours: 2,
      slots: 24,
      hackers: 24,
      format: "Individual (15 mins)",
      notes: "3-4 reps (notes based on 3)",
      room: null,
    });
    expect(setups[1]).toMatchObject({
      durationMinutes: 30,
      groupSize: 3,
      windowEnd: "16:00",
      chattingHours: 3,
      notes: null,
    });
  });

  test("a name-only row is not set up yet", () => {
    expect(setups.find((s) => s.sponsor === "Scotiabank")).toMatchObject({
      windowStart: null,
      windowEnd: null,
      slots: null,
      hackers: null,
      chattingHours: null,
      format: null,
      notes: null,
    });
  });

  test("skips the Total row and blank rows", () => {
    expect(setups.map((s) => s.sponsor)).toEqual(["StarTech", "Sunlife", "Canada Life", "Scotiabank", "CSE"]);
  });

  test("matches columns by header name and reads ROOM when present", () => {
    const withRoom = parseCoffeeChatsTab([
      ["FORMAT", "Room", "Sponsor", "AVAILABILITY START"],
      ["Individual (15 mins)", "Rm 2241", "StarTech", "9:00 AM"],
    ]);
    expect(withRoom[0]).toMatchObject({ sponsor: "StarTech", room: "Rm 2241", windowStart: "09:00", windowEnd: null });
  });
});
