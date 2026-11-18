import { describe, expect, test } from "vitest";

import type { RunOfShowItem, SponsorCeremonySegment } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { nextOwnEvent } from "~/lib/sponsor-next-event";

const item = (
  over: Partial<RunOfShowItem> &
    Pick<RunOfShowItem, "day" | "start" | "end" | "column" | "title">,
): RunOfShowItem => ({
  id: `${over.day}-${over.start}-${over.column}`,
  location: null,
  sponsors: [],
  ...over,
});

const items: RunOfShowItem[] = [
  item({
    day: "Friday",
    start: "19:30",
    end: "20:30",
    column: "big-event",
    title: "OPENING CEREMONY",
    location: "Ivey BMO Auditorium",
  }),
  item({
    day: "Friday",
    start: "17:00",
    end: "24:00",
    column: "spon-booth",
    title: "Sponsor Bay Open",
    location: "SM Atrium",
  }),
  item({
    day: "Saturday",
    start: "10:00",
    end: "11:00",
    column: "sponsor-workshop",
    title: "Scotiabank Workshop",
    location: "2230 (50)",
    sponsors: ["Scotiabank"],
  }),
  item({
    day: "Saturday",
    start: "12:00",
    end: "13:00",
    column: "food",
    title: "Lunch",
  }),
];
const slot: SponsorCeremonySegment = {
  ceremony: "opening",
  order: 4,
  start: null,
  durationMinutes: 3,
  title: "Scotiabank",
  sponsor: "Scotiabank",
  speakers: [],
  yours: true,
};
const at = (day: RunOfShowItem["day"], time: string) =>
  runOfShowInstant(day, time);
const base = {
  sponsorName: "Scotiabank",
  items,
  ceremonies: [slot],
  coffeeChat: null,
};

describe("nextOwnEvent", () => {
  test("before the event: the first own item, with minutes until it", () => {
    const next = nextOwnEvent({ ...base, now: at("Friday", "16:00") });
    expect(next).toMatchObject({
      kind: "item",
      title: "Sponsor Bay Open",
      now: false,
      minutesUntil: 60,
    });
  });

  test("ongoing Sponsor Bay hours don't hide the speaking slot", () => {
    const next = nextOwnEvent({ ...base, now: at("Friday", "18:00") });
    expect(next).toMatchObject({
      kind: "ceremony",
      ceremony: "opening",
      start: "19:30",
      location: "Ivey BMO Auditorium",
      minutesUntil: 90,
    });
  });

  test("a slot with its own time ends after its duration", () => {
    const timed = { ...slot, start: "19:42" };
    const during = nextOwnEvent({
      ...base,
      ceremonies: [timed],
      now: at("Friday", "19:43"),
    });
    expect(during).toMatchObject({
      kind: "ceremony",
      now: true,
      minutesUntil: 0,
    });
    const after = nextOwnEvent({
      ...base,
      ceremonies: [timed],
      now: at("Friday", "19:46"),
    });
    // Sponsor Bay is still open, but the next real item wins.
    expect(after).toMatchObject({ title: "Scotiabank Workshop", now: false });
  });

  test("ongoing Sponsor Bay hours show when nothing else is coming", () => {
    const next = nextOwnEvent({
      ...base,
      ceremonies: [],
      items: items.filter((i) => i.column !== "sponsor-workshop"),
      now: at("Friday", "21:00"),
    });
    expect(next).toMatchObject({ title: "Sponsor Bay Open", now: true });
  });

  test("all-hands meals are not 'yours'; coffee chat window counts", () => {
    const next = nextOwnEvent({
      ...base,
      coffeeChat: {
        sponsor: "Scotiabank",
        windowStart: "11:00",
        windowEnd: "15:00",
        durationMinutes: 15,
        groupSize: 1,
        chattingHours: null,
        slots: null,
        hackers: null,
        format: null,
        notes: null,
        room: "Rm 2241",
      },
      now: at("Saturday", "11:30"),
    });
    expect(next).toMatchObject({
      kind: "coffee",
      now: true,
      location: "Rm 2241",
    });
  });

  test("after everything: null", () => {
    expect(nextOwnEvent({ ...base, now: at("Sunday", "23:00") })).toBeNull();
  });
});

describe("info under the run of show follows the picked day", () => {
  test("shows the opening ceremony on Friday and the closing on Sunday", async () => {
    const { ceremonySegmentsForDay } = await import("./sponsor-next-event");
    const segments = [
      { ceremony: "opening" as const, title: "A" },
      { ceremony: "closing" as const, title: "B" },
    ];
    // No ceremony blocks in the sheet: opening = Friday, closing = Sunday.
    expect(ceremonySegmentsForDay(segments, [], "Friday")).toEqual([
      segments[0],
    ]);
    expect(ceremonySegmentsForDay(segments, [], "Saturday")).toEqual([]);
    expect(ceremonySegmentsForDay(segments, [], "Sunday")).toEqual([
      segments[1],
    ]);
  });

  test("only lists workshops on the picked day", async () => {
    const { workshopsForDay } = await import("./sponsor-next-event");
    const workshops = [
      { day: "Friday" as const, title: "F" },
      { day: "Saturday" as const, title: "S" },
      { day: null, title: "No day" },
    ];
    expect(workshopsForDay(workshops, "Saturday").map((w) => w.title)).toEqual([
      "S",
    ]);
  });
});
