import { describe, expect, it } from "vitest";
import type { RunOfShowItem, RunOfShowTask } from "~/lib/run-of-show";
import {
  blockTextLayout,
  buildAxis,
  buildOrganizerTimeline,
  columnMinWidth,
  fluidColumnMinWidth,
  entriesAt,
  GRID_SIZES,
  layoutGrid,
  taskEntries,
  tasksInEntry,
  workshopForEntry,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import type { DaySchedule } from "~/types/schedule";

const cell = (title: string, location = "") => ({ title, location });

const live: DaySchedule[] = [
  {
    day: "Saturday",
    events: [
      { time: "9:00 AM", bigEvent: cell("Opening Ceremony") },
      { time: "9:30 AM", bigEvent: cell("Opening Ceremony") },
      { time: "10:00 AM", otherWorkshop: cell("Intro to Git", "Rm 1") },
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
  ros({
    title: "Scotiabank Workshop",
    start: "11:00",
    end: "12:00",
    column: "sponsor-workshop",
    sponsors: ["Scotiabank"],
  }),
  ros({ title: "Friday thing", start: "09:00", end: "10:00", day: "Friday" }),
];

const task = (
  start: string,
  text: string,
  owner: string | null = null,
): RunOfShowTask => ({ day: "Saturday", start, task: text, owner });

const span = (start: number, end: number) => ({ start, end });

describe("buildOrganizerTimeline", () => {
  it("shows run-of-show items full strength, Main events muted with new /live events", () => {
    const entries = buildOrganizerTimeline({
      day: "Saturday",
      items,
      live,
      showHackathon: true,
    });
    expect(entries.map((e) => [e.title, e.kind])).toEqual([
      ["Opening Ceremony!", "hackathon"],
      ["Intro to Git", "hackathon"],
      ["Scotiabank Workshop", "yours"],
    ]);
    // The sheet's copy of the opening is kept (it has the details).
    expect(entries[0]?.item).toBeDefined();
  });

  it("puts Main event items and /live events in one Hackathon events column", () => {
    const columns = layoutGrid(
      buildOrganizerTimeline({
        day: "Saturday",
        items,
        live,
        showHackathon: true,
      }),
    );
    const hackathon = columns.find((c) => c.column === "hackathon");
    expect(hackathon?.entries.map((e) => e.title)).toEqual([
      "Opening Ceremony!",
      "Intro to Git",
    ]);
    expect(columns.some((c) => (c.column as string) === "big-event")).toBe(
      false,
    );
  });

  it("keeps only ceremonies and food from the hackathon when hidden", () => {
    const entries = buildOrganizerTimeline({
      day: "Saturday",
      items,
      live,
      showHackathon: false,
    });
    expect(entries.map((e) => [e.title, e.kind])).toEqual([
      ["Opening Ceremony!", "hackathon"],
      ["Scotiabank Workshop", "yours"],
    ]);
    expect(
      layoutGrid(entries)
        .find((c) => c.column === "hackathon")
        ?.entries.map((e) => e.title),
    ).toEqual(["Opening Ceremony!"]);
  });
});

describe("tasksInEntry", () => {
  const tasks = [
    task("09:30", "Mic check"),
    task("09:00", "Doors"),
    task("10:00", "Reset room"),
    task("09:15", "Other day", null),
  ];
  tasks[3] = { ...tasks[3]!, day: "Friday" };

  it("keeps the day's tasks starting inside the event, in time order", () => {
    expect(
      tasksInEntry(span(540, 600), "Saturday", tasks).map((t) => t.task),
    ).toEqual(["Doors", "Mic check"]);
  });

  it("reads early-morning tasks as after midnight for late events", () => {
    const late = [task("00:30", "Lights out")];
    expect(tasksInEntry(span(1380, 1500), "Saturday", late)).toHaveLength(1);
    expect(tasksInEntry(span(540, 600), "Saturday", late)).toHaveLength(0);
  });
});

describe("workshopForEntry", () => {
  const workshops = [
    {
      title: "Scotiabank Workshop: APIs",
      day: "Saturday" as const,
      start: "11:00",
    },
    { title: "Intro to Git", day: null, start: null },
  ];
  it("matches by title, day and start inside the event", () => {
    const entry = { title: "Scotiabank Workshop", ...span(660, 720) };
    expect(workshopForEntry(entry, "Saturday", workshops)?.title).toBe(
      "Scotiabank Workshop: APIs",
    );
    expect(workshopForEntry(entry, "Friday", workshops)).toBeNull();
    expect(
      workshopForEntry({ ...entry, ...span(780, 840) }, "Saturday", workshops),
    ).toBeNull();
  });
  it("matches undated workshops by title alone", () => {
    expect(
      workshopForEntry(
        { title: "Intro to Git", ...span(600, 630) },
        "Sunday",
        workshops,
      )?.title,
    ).toBe("Intro to Git");
  });
});

describe("taskEntries", () => {
  const tasks = [
    task("09:00", "Doors", "Ana"),
    task("09:00", "Badges"),
    task("13:15", "Lunch cleanup", "Ben"),
    { ...task("09:00", "Friday task"), day: "Friday" as const },
  ];

  it("puts each task in its own half-hour row from its start", () => {
    const entries = taskEntries("Saturday", tasks);
    expect(entries.map((e) => [e.title, e.start, e.end, e.kind])).toEqual([
      ["Badges", 540, 570, "task"],
      ["Doors", 540, 570, "task"],
      ["Lunch cleanup", 795, 825, "task"],
    ]);
    expect(entries[1]?.task?.owner).toBe("Ana");
  });

  it("lays tasks out in the rightmost Team tasks column, same-time tasks side by side", () => {
    const columns = layoutGrid([
      ...buildOrganizerTimeline({
        day: "Saturday",
        items,
        live: undefined,
        showHackathon: false,
      }),
      ...taskEntries("Saturday", tasks),
    ]);
    const last = columns[columns.length - 1]!;
    expect(last.column).toBe("tasks");
    expect(last.entries.map((e) => [e.title, e.lane, e.lanes])).toEqual([
      ["Badges", 0, 2],
      ["Doors", 1, 2],
      ["Lunch cleanup", 0, 1],
    ]);
  });

  it("puts task times on the axis instead of folding them away", () => {
    const rows = buildAxis([
      {
        id: "a",
        kind: "yours",
        category: "big-event",
        title: "A",
        location: null,
        ...span(540, 600),
      },
      ...taskEntries("Saturday", tasks),
    ]);
    expect(rows).toContainEqual({ type: "slot", minute: 780 });
  });

  it("leaves the Team tasks column out when there are none", () => {
    expect(layoutGrid([]).some((c) => c.column === "tasks")).toBe(false);
  });
});

describe("entriesAt", () => {
  it("lists events (not tasks) running at a minute", () => {
    const entries: TimelineEntry[] = [
      ...buildOrganizerTimeline({
        day: "Saturday",
        items,
        live,
        showHackathon: true,
      }),
      ...taskEntries("Saturday", [task("09:30", "Mic check")]),
    ];
    expect(entriesAt(570, entries).map((e) => e.title)).toEqual([
      "Opening Ceremony!",
    ]);
    expect(entriesAt(615, entries).map((e) => e.title)).toEqual([
      "Intro to Git",
    ]);
  });
});

describe("blockTextLayout", () => {
  it("fits two title lines and a location in a 30-minute block", () => {
    expect(blockTextLayout(GRID_SIZES.slot, true)).toEqual({
      titleLines: 2,
      showLocation: true,
    });
    expect(blockTextLayout(GRID_SIZES.slot, false)).toEqual({
      titleLines: 3,
      showLocation: false,
    });
  });

  it("always gives the title at least one line, dropping the location first", () => {
    expect(blockTextLayout(GRID_SIZES.minBlock, true)).toEqual({
      titleLines: 1,
      showLocation: false,
    });
    expect(blockTextLayout(10, false).titleLines).toBe(1);
  });

  it("gives long blocks more title lines", () => {
    expect(blockTextLayout(GRID_SIZES.slot * 2, true).titleLines).toBe(6);
  });
});

describe("columnMinWidth", () => {
  it("keeps each lane readable", () => {
    expect(columnMinWidth([])).toBe(GRID_SIZES.column);
    expect(columnMinWidth([{ lanes: 1 }])).toBe(GRID_SIZES.column);
    expect(columnMinWidth([{ lanes: 3 }])).toBe(3 * GRID_SIZES.lane);
  });
});

describe("columnMinWidth for team tasks", () => {
  it("uses the narrower task lane", () => {
    expect(columnMinWidth([{ lanes: 3 }], GRID_SIZES.taskLane)).toBe(
      3 * GRID_SIZES.taskLane,
    );
  });
});

describe("fluidColumnMinWidth", () => {
  it("lets columns share wide screens without going unreadable", () => {
    expect(fluidColumnMinWidth([])).toBe(GRID_SIZES.fluid.empty);
    expect(fluidColumnMinWidth([{ lanes: 1 }])).toBe(GRID_SIZES.fluid.column);
    expect(fluidColumnMinWidth([{ lanes: 3 }])).toBe(3 * GRID_SIZES.fluid.lane);
  });
});
