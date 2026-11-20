import { describe, expect, it } from "vitest";
import type { RunOfShowItem } from "~/lib/run-of-show";
import {
  assignLanes,
  axisOffset,
  buildAxis,
  buildSponsorTimeline,
  formatMinutes,
  isAlwaysShown,
  isSameEvent,
  layoutGrid,
  liveDayEntries,
  minutesIntoDay,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import type { DaySchedule } from "~/types/schedule";

const cell = (title: string, location = "") => ({ title, location });

const live: DaySchedule[] = [
  {
    day: "Saturday",
    events: [
      { time: "8:00 AM", food: cell("Breakfast", "Atrium") },
      { time: "8:30 AM", food: cell("Breakfast", "Atrium") },
      {
        time: "9:00 AM",
        bigEvent: cell("Opening Ceremony"),
        sponsorWorkshop: cell("Scotiabank Workshop", "Rm 2110"),
        otherWorkshop: cell("Opening Ceremony"),
      },
      { time: "9:30 AM", sponsorWorkshop: cell("Scotiabank Workshop") },
      { time: "10:00 AM", otherWorkshop: cell("Intro to Git") },
      { time: "11:30 PM", other: cell("Movie Night") },
      { time: "12:00 AM", other: cell("Movie Night") },
    ],
  },
];

const ros = (
  over: Partial<RunOfShowItem> & Pick<RunOfShowItem, "title" | "start" | "end">,
): RunOfShowItem => ({
  id: `Saturday-${over.start}-${over.column ?? "big-event"}`,
  day: "Saturday",
  column: "big-event",
  location: null,
  sponsors: [],
  ...over,
});

const items: RunOfShowItem[] = [
  ros({ title: "Opening Ceremony!", start: "09:00", end: "10:00" }),
  ros({ title: "Lunch", start: "12:00", end: "13:00", column: "food" }),
  ros({
    title: "Scotiabank Workshop",
    start: "09:00",
    end: "10:00",
    column: "sponsor-workshop",
    sponsors: ["Scotiabank"],
    location: "Rm 2110",
  }),
  ros({
    title: "Sponsor Bay",
    start: "10:00",
    end: "16:00",
    column: "spon-booth",
  }),
  ros({
    title: "Breakfast",
    start: "08:00",
    end: "09:00",
    column: "food",
    day: "Friday",
  }),
];

describe("liveDayEntries", () => {
  const entries = liveDayEntries(live[0]);

  it("merges consecutive rows into one block ending at the next row", () => {
    const breakfast = entries.find((e) => e.title === "Breakfast");
    expect(breakfast).toMatchObject({
      start: 480,
      end: 540,
      location: "Atrium",
    });
    const ws = entries.find((e) => e.title === "Scotiabank Workshop");
    expect(ws).toMatchObject({ start: 540, end: 600, category: "sponsor" });
  });

  it("keeps an event spread over several columns once", () => {
    expect(entries.filter((e) => e.title === "Opening Ceremony")).toHaveLength(
      1,
    );
  });

  it("counts rows after midnight as past 24:00, and the last row as 30 min", () => {
    expect(entries.find((e) => e.title === "Movie Night")).toMatchObject({
      start: 1410,
      end: 1470,
    });
    expect(entries.find((e) => e.title === "Intro to Git")?.end).toBe(1410);
  });

  it("is empty for a missing day", () => {
    expect(liveDayEntries(undefined)).toEqual([]);
  });
});

describe("isSameEvent", () => {
  const e = (title: string, start: number, end: number) => ({
    title,
    start,
    end,
  });
  it("matches titles ignoring case and punctuation when times overlap", () => {
    expect(
      isSameEvent(
        e("Opening Ceremony!", 540, 600),
        e("opening ceremony", 540, 570),
      ),
    ).toBe(true);
    expect(
      isSameEvent(e("Lunch", 720, 780), e("Lunch (Pizza)", 720, 780)),
    ).toBe(true);
  });
  it("doesn't match different times or different events", () => {
    expect(isSameEvent(e("Lunch", 720, 780), e("Lunch", 780, 840))).toBe(false);
    expect(isSameEvent(e("Lunch", 720, 780), e("Dinner", 720, 780))).toBe(
      false,
    );
    expect(isSameEvent(e("AI", 720, 780), e("AI Workshop", 720, 780))).toBe(
      false,
    );
  });
});

describe("isAlwaysShown", () => {
  it("is true for food and opening/closing ceremonies", () => {
    expect(isAlwaysShown({ category: "food", title: "Lunch" })).toBe(true);
    expect(
      isAlwaysShown({ category: "big-event", title: "Opening Ceremony!" }),
    ).toBe(true);
    expect(
      isAlwaysShown({ category: "main", title: "closing ceremonies" }),
    ).toBe(true);
  });
  it("is false for other hackathon events", () => {
    expect(isAlwaysShown({ category: "workshop", title: "Intro to Git" })).toBe(
      false,
    );
    expect(isAlwaysShown({ category: "other", title: "Movie Night" })).toBe(
      false,
    );
  });
});

describe("buildSponsorTimeline", () => {
  const build = (showHackathon = true, l: DaySchedule[] | undefined = live) =>
    buildSponsorTimeline({
      day: "Saturday",
      items,
      live: l,
      sponsorName: "Scotiabank",
      showHackathon,
    });

  it("shows an event in both sources once, as a hackathon event", () => {
    const opening = build().filter((e) => /opening/i.test(e.title));
    expect(opening).toHaveLength(1);
    expect(opening[0]).toMatchObject({
      kind: "hackathon",
      title: "Opening Ceremony",
    });
  });

  it("keeps the sponsor's own copy when /live also lists their item", () => {
    const ws = build().filter((e) => e.title === "Scotiabank Workshop");
    expect(ws).toHaveLength(1);
    expect(ws[0]?.kind).toBe("yours");
    expect(ws[0]?.item?.sponsors).toEqual(["Scotiabank"]);
  });

  it("marks Sponsor Bay hours as the sponsor's", () => {
    expect(build().find((e) => e.title === "Sponsor Bay")?.kind).toBe("yours");
  });

  it("keeps all-hands items /live doesn't list, as hackathon events", () => {
    expect(build().find((e) => e.title === "Lunch")?.kind).toBe("hackathon");
    // /live failed to load: the run-of-show's all-hands items still show.
    const fallback = build(true, []);
    expect(
      fallback.filter((e) => e.kind === "hackathon").map((e) => e.title),
    ).toEqual(["Opening Ceremony!", "Lunch"]);
  });

  it("keeps only food and ceremonies from the hackathon when switched off", () => {
    expect(build(false).map((e) => [e.title, e.kind])).toEqual([
      ["Breakfast", "hackathon"],
      ["Scotiabank Workshop", "yours"],
      ["Opening Ceremony", "hackathon"],
      ["Sponsor Bay", "yours"],
      ["Lunch", "hackathon"],
    ]);
  });

  it("only uses the chosen day and sorts by time, yours first on ties", () => {
    const all = build();
    expect(all.some((e) => e.start === 480 && e.kind === "yours")).toBe(false);
    expect(all.map((e) => e.start)).toEqual(
      [...all.map((e) => e.start)].sort((a, b) => a - b),
    );
    const at540 = all.filter((e) => e.start === 540);
    expect(at540[0]?.kind).toBe("yours");
  });
});

const entry = (id: string, start: number, end: number): TimelineEntry => ({
  id,
  kind: "yours",
  category: "food",
  title: id,
  location: null,
  start,
  end,
});

describe("assignLanes", () => {
  it("puts overlapping entries side by side and reuses free lanes", () => {
    const out = assignLanes([
      entry("a", 540, 600),
      entry("b", 540, 570),
      entry("c", 570, 600),
      entry("d", 600, 660),
    ]);
    expect(out.map((e) => [e.id, e.lane, e.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
      ["d", 0, 1],
    ]);
  });
});

describe("buildAxis / axisOffset", () => {
  const rows = buildAxis([
    entry("a", 540, 600),
    entry("b", 900, 960),
    entry("c", 990, 1020),
  ]);

  it("folds empty stretches over two hours and keeps shorter ones", () => {
    expect(rows).toEqual([
      { type: "slot", minute: 540 },
      { type: "slot", minute: 570 },
      { type: "gap", from: 600, to: 900 },
      { type: "slot", minute: 900 },
      { type: "slot", minute: 930 },
      { type: "slot", minute: 960 },
      { type: "slot", minute: 990 },
    ]);
  });

  it("maps minutes to pixels across slots and gaps", () => {
    expect(axisOffset(rows, 540, 60, 40)).toBe(0);
    expect(axisOffset(rows, 585, 60, 40)).toBe(90);
    expect(axisOffset(rows, 700, 60, 40)).toBe(140);
    expect(axisOffset(rows, 900, 60, 40)).toBe(160);
    expect(axisOffset(rows, 2000, 60, 40)).toBeNull();
  });

  it("is empty with no entries", () => {
    expect(buildAxis([])).toEqual([]);
  });
});

describe("time helpers", () => {
  it("formats minutes past midnight", () => {
    expect(formatMinutes(870)).toBe("2:30 PM");
    expect(formatMinutes(1470)).toBe("12:30 AM");
  });
  it("measures minutes into an event day in Eastern time", () => {
    expect(
      minutesIntoDay("Saturday", new Date("2026-11-21T14:30:00-05:00")),
    ).toBe(870);
  });
});

describe("layoutGrid", () => {
  const e = (
    id: string,
    category: TimelineEntry["category"],
    start: number,
    end: number,
  ): TimelineEntry => ({ ...entry(id, start, end), category });

  it("puts each entry in its sheet column, /live categories mapped in", () => {
    const grid = layoutGrid([
      e("opening", "main", 540, 600),
      e("git", "workshop", 570, 630),
      e("ws", "sponsor-workshop", 540, 600),
      e("bay", "spon-booth", 540, 1020),
      e("hunt", "scavenger", 780, 840),
    ]);
    expect(
      grid.map((c) => [
        c.column,
        c.entries.map((x) => [x.id, x.lane, x.lanes]),
      ]),
    ).toEqual([
      ["hackathon", [["opening", 0, 1]]],
      [
        "sponsor-workshop",
        [
          ["ws", 0, 2],
          ["git", 1, 2],
        ],
      ],
      ["food", []],
      ["spon-booth", [["bay", 0, 1]]],
      ["coffee-chats", []],
      ["other", [["hunt", 0, 1]]],
    ]);
  });

  it("puts Main event items in Hackathon events and every meal in Food", () => {
    const grid = layoutGrid([
      { ...e("dinner", "food", 1080, 1140), kind: "hackathon" },
      e("opening", "big-event", 540, 600),
      e("lunch", "food", 720, 780),
    ]);
    expect(grid.map((c) => [c.column, c.entries.map((x) => x.id)])).toEqual([
      ["hackathon", ["opening"]],
      ["sponsor-workshop", []],
      ["food", ["lunch", "dinner"]],
      ["spon-booth", []],
      ["coffee-chats", []],
    ]);
  });

  it("puts sponsor judging items in their own Judging column", () => {
    const judging = {
      ...e("judging", "sponsor-workshop", 600, 720),
      title: "Sponsor Track Judging",
      item: {} as TimelineEntry["item"],
    };
    const workshop = {
      ...e("jw", "sponsor-workshop", 540, 600),
      title: "Sponsor Judging Workshop",
      item: {} as TimelineEntry["item"],
    };
    const grid = layoutGrid([judging, workshop]);
    expect(
      grid.find((c) => c.column === "judging")?.entries.map((x) => x.id),
    ).toEqual(["judging"]);
    expect(
      grid
        .find((c) => c.column === "sponsor-workshop")
        ?.entries.map((x) => x.id),
    ).toEqual(["jw"]);
  });

  it("drops empty columns except Workshops, Food, Sponsor Bay and Coffee chats", () => {
    expect(layoutGrid([]).map((c) => c.column)).toEqual([
      "sponsor-workshop",
      "food",
      "spon-booth",
      "coffee-chats",
    ]);
  });
});
