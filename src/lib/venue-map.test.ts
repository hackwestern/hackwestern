import { describe, expect, test } from "vitest";
import type { DaySchedule } from "~/types/schedule";
import {
  eventsFromSchedule,
  formatRange,
  roomsForLocation,
} from "~/lib/venue-map";

describe("roomsForLocation", () => {
  test("reads room numbers, the Grand Hall, the atrium and the help desk", () => {
    expect(roomsForLocation("SM 2235")).toEqual(["2235"]);
    expect(roomsForLocation("Grand Hall")).toEqual(["1110"]);
    expect(roomsForLocation("SM Atrium")).toEqual(["1235"]);
    expect(
      roomsForLocation("Help Desk (in front of Grand Hall/Grand Hall)"),
    ).toEqual(["help"]);
  });

  test("reads the Ivey auditorium and breakout rooms", () => {
    expect(roomsForLocation("Ivey BMO Auditorium")).toEqual(["1100"]);
    expect(
      roomsForLocation("Rm 2241, 2242, 2243 & Ivey Breakout Rooms"),
    ).toEqual(["2241", "2242", "2243", "1354", "1352", "1348", "1356", "1358"]);
  });

  test("ignores places that are not on the map", () => {
    expect(roomsForLocation("Outside of Morrissette")).toEqual([]);
    expect(roomsForLocation("Josephine Spencer Niblett Law Building")).toEqual(
      [],
    );
    expect(roomsForLocation("")).toEqual([]);
  });
});

describe("eventsFromSchedule", () => {
  const days: DaySchedule[] = [
    {
      day: "Saturday",
      events: [
        {
          time: "10:00 AM",
          sponsorWorkshop: { title: "Workshop A", location: "2235" },
          bigEvent: { title: "Hacking", location: "" },
        },
        {
          time: "10:30 AM",
          sponsorWorkshop: { title: "Workshop A", location: "2235" },
          other: { title: "Closing", location: "Grand Hall" },
          food: { title: "Closing", location: "Grand Hall" },
        },
        {
          time: "11:00 AM",
          sponsorWorkshop: { title: "Workshop B", location: "2235" },
        },
      ],
    },
  ];

  test("joins back-to-back slots, keeps one copy of repeated rows, skips off-map rows", () => {
    const evs = eventsFromSchedule(days);
    expect(
      evs.map((e) => [e.title, formatRange(e.start, e.end), e.rooms.join()]),
    ).toEqual([
      ["Workshop A", "10–11 am", "2235"],
      ["Closing", "10:30–11 am", "1110"],
      ["Workshop B", "11–11:30 am", "2235"],
    ]);
    expect(evs.every((e) => e.day === 1)).toBe(true);
  });
});
