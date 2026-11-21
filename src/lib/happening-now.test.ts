import { describe, expect, it } from "vitest";
import { easternClock, eventDayAt, happeningNow } from "~/lib/happening-now";
import type { RunOfShowItem, RunOfShowTask } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";

const item = (
  day: RunOfShowItem["day"],
  start: string,
  end: string,
  title: string,
): RunOfShowItem => ({
  id: `${day}-${start}-${title}`,
  day,
  start,
  end,
  column: "food",
  title,
  location: null,
  sponsors: [],
});
const at = (day: RunOfShowItem["day"], time: string) =>
  runOfShowInstant(day, time);

const items = [
  item("Friday", "17:00", "18:00", "Check-in"),
  item("Saturday", "11:00", "12:00", "Lunch"),
  item("Saturday", "11:30", "13:00", "Workshop"),
  item("Saturday", "23:00", "24:00", "Night owl"),
  item("Sunday", "10:00", "11:00", "Closing"),
];
const tasks: RunOfShowTask[] = [
  { day: "Saturday", start: "11:00", task: "Restock", owner: "Sam" },
];

describe("happeningNow", () => {
  it("is before the event until the first item starts", () => {
    const r = happeningNow({ items, now: at("Friday", "16:59") });
    expect(r.phase).toBe("before");
    expect(r.items).toEqual([]);
    expect(r.firstStart).toEqual({ day: "Friday", start: "17:00" });
    expect(r.next.map((i) => i.title)).toEqual(["Check-in"]);
  });

  it("includes the start minute and excludes the end minute", () => {
    expect(
      happeningNow({ items, now: at("Friday", "17:00") }).items,
    ).toHaveLength(1);
    const end = happeningNow({ items, now: at("Friday", "18:00") });
    expect(end.items).toEqual([]);
    expect(end.phase).toBe("during");
    expect(end.next[0]?.title).toBe("Lunch");
  });

  it("lists overlapping items in start order", () => {
    const r = happeningNow({ items, now: at("Saturday", "11:30") });
    expect(r.items.map((i) => i.title)).toEqual(["Lunch", "Workshop"]);
  });

  it("handles an item ending at 24:00", () => {
    expect(
      happeningNow({ items, now: at("Saturday", "23:59") }).items[0]?.title,
    ).toBe("Night owl");
    const after = happeningNow({ items, now: at("Sunday", "00:00") });
    expect(after.items).toEqual([]);
    expect(after.next[0]?.title).toBe("Closing");
  });

  it("is over after the last item ends", () => {
    const r = happeningNow({ items, now: at("Sunday", "11:00") });
    expect(r.phase).toBe("after");
    expect(r.next).toEqual([]);
  });

  it("returns every item that shares the next start", () => {
    const two = [
      item("Saturday", "09:00", "10:00", "A"),
      item("Saturday", "10:00", "11:00", "B"),
      item("Saturday", "10:00", "11:00", "C"),
    ];
    expect(
      happeningNow({ items: two, now: at("Saturday", "09:30") }).next,
    ).toHaveLength(2);
  });

  it("drops an item the sheet repeats across columns", () => {
    const dup = [
      item("Saturday", "09:00", "10:00", "A"),
      item("Saturday", "09:00", "10:00", "a"),
    ];
    expect(
      happeningNow({ items: dup, now: at("Saturday", "09:10") }).items,
    ).toHaveLength(1);
  });

  it("only returns tasks when given, for 30 minutes from their start", () => {
    const now = at("Saturday", "11:29");
    expect(happeningNow({ items, now }).tasks).toEqual([]);
    expect(happeningNow({ items, tasks, now }).tasks).toHaveLength(1);
    expect(
      happeningNow({ items, tasks, now: at("Saturday", "11:30") }).tasks,
    ).toEqual([]);
  });

  it("handles an empty sheet", () => {
    expect(
      happeningNow({ items: [], now: at("Saturday", "11:00") }).phase,
    ).toBe("before");
  });
});

describe("clock helpers", () => {
  it("reads Eastern time", () => {
    expect(easternClock(at("Saturday", "10:30"))).toBe("10:30");
    expect(easternClock(at("Saturday", "00:05"))).toBe("00:05");
  });
  it("finds the event day", () => {
    expect(eventDayAt(at("Saturday", "10:30"))).toBe("Saturday");
    expect(eventDayAt(new Date("2026-11-16T12:00:00Z"))).toBeNull();
  });
});
