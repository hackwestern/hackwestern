import { describe, expect, test } from "vitest";

import type { RunOfShowItem } from "~/lib/run-of-show";
import {
  applySponsorNames,
  attachWorkshopTimes,
  parseCeremoniesTab,
  parseClockTime,
  parseWorkshopsTab,
} from "./run-of-show-parse";

// Copy of the "Opening + Closing Ceremonies" tab (sheet export, 2026-11-14).
const CEREMONIES: string[][] = [
  ["Task", "Who", "Notes"],
  ["Make sure all speakers are there for each company and tell them their order", "Noah"],
  [],
  ["Opening Speakers"],
  ["Company", "Speaker"],
  ["Canada Life (1 min)", "Rob Craig, Manager Emerging Talent and Programs"],
  ["Manulife (1 min)"],
  ["QNX (1 min)", "John Dallas, Principal Academic Partnerships Manager"],
  ["Scotiabank (3 mins)"],
  ["Sunlife (3 mins)", "Nassima Younes, Talent Acquisition Consultant"],
  [],
  ["Closing Speakers"],
  ["Company", "Speaker"],
  ["Scotiabank (1 mins)"],
  ["Sunlife (1 mins)", "Nassima Younes, Talent Acquisition Consultant"],
];

// Copy of the "Workshops" tab (descriptions shortened).
const WORKSHOPS: string[][] = [
  ["Workshop", "Description", "Notes"],
  ["MLH"],
  ["Scotiabank Workshop 1"],
  ["Canada Life: Women in Technology Panel", "Join a panel of accomplished women working across technology."],
  ["Sun Life Workshop 1: Don't Wait for AI to Happen to You", "This session is designed to inspire."],
  ["QNX: Intro to QNX: Foundational Software for Embedded Systems", "A high-level overview of QNX."],
  ["TinyFish: Build your first AI web agent with TinyFish", "A fun, no-pressure hour."],
  ["Scotiabank Workshop 2"],
  [],
  ["Notes", "Noah will make sure hosts are there!"],
  ["", "Make sure sponsors have water"],
];

const NAMES = ["Canada Life", "QNX", "Scotiabank", "Sun Life"];

describe("parseCeremoniesTab (real layout)", () => {
  const segments = parseCeremoniesTab(CEREMONIES);

  test("reads both sections in row order, skipping the task table", () => {
    expect(segments.map((s) => `${s.ceremony} ${s.order} ${s.sponsor}`)).toEqual([
      "opening 1 Canada Life",
      "opening 2 Manulife",
      "opening 3 QNX",
      "opening 4 Scotiabank",
      "opening 5 Sunlife",
      "closing 1 Scotiabank",
      "closing 2 Sunlife",
    ]);
  });

  test("duration comes from '(N min)'; speaker titles keep their comma", () => {
    expect(segments[0]).toEqual({
      ceremony: "opening",
      order: 1,
      start: null,
      durationMinutes: 1,
      title: "Canada Life",
      sponsor: "Canada Life",
      speakers: ["Rob Craig, Manager Emerging Talent and Programs"],
    });
    expect(segments[3]).toMatchObject({ durationMinutes: 3, speakers: [] });
  });

  test("applySponsorNames maps to registered names and keeps unknown companies", () => {
    const named = applySponsorNames(
      { items: [], tasks: [], coffeeChats: [], workshops: [], ceremonies: segments },
      NAMES,
    );
    expect(named.ceremonies.map((s) => s.sponsor)).toEqual([
      "Canada Life", "Manulife", "QNX", "Scotiabank", "Sun Life", "Scotiabank", "Sun Life",
    ]);
  });
});

describe("parseCeremoniesTab (columns organizers may add)", () => {
  test("Order, Time, Duration, Topic and multi-line speakers", () => {
    const segments = parseCeremoniesTab([
      ["Closing Ceremony"],
      ["#", "Time", "Sponsor", "Topic", "Speakers", "Duration"],
      ["2", "4:05 PM", "QNX", "Prize: best embedded hack", "Ana\nBo; Cy", "2 min"],
      ["1", "4:00 PM", "Scotiabank", "Prize: best fintech hack", "Dee", "5"],
    ]);
    expect(segments).toEqual([
      {
        ceremony: "closing", order: 1, start: "16:00", durationMinutes: 5,
        title: "Prize: best fintech hack", sponsor: "Scotiabank", speakers: ["Dee"],
      },
      {
        ceremony: "closing", order: 2, start: "16:05", durationMinutes: 2,
        title: "Prize: best embedded hack", sponsor: "QNX", speakers: ["Ana", "Bo", "Cy"],
      },
    ]);
  });

  test("one combined table with a Ceremony column", () => {
    const segments = parseCeremoniesTab([
      ["Ceremony", "Company", "Speaker"],
      ["Opening", "QNX", "Ana"],
      ["Closing", "QNX", "Bo"],
    ]);
    expect(segments.map((s) => `${s.ceremony}:${s.speakers[0]}`)).toEqual([
      "opening:Ana",
      "closing:Bo",
    ]);
  });

  test("an empty or unknown tab is an empty list, never an error", () => {
    expect(parseCeremoniesTab([])).toEqual([]);
    expect(parseCeremoniesTab([["Something else"], ["a", "b"]])).toEqual([]);
  });
});

describe("parseWorkshopsTab", () => {
  const workshops = parseWorkshopsTab(WORKSHOPS);

  test("reads rows until the Notes row", () => {
    expect(workshops.map((w) => w.title)).toEqual([
      "MLH",
      "Scotiabank Workshop 1",
      "Canada Life: Women in Technology Panel",
      "Sun Life Workshop 1: Don't Wait for AI to Happen to You",
      "QNX: Intro to QNX: Foundational Software for Embedded Systems",
      "TinyFish: Build your first AI web agent with TinyFish",
      "Scotiabank Workshop 2",
    ]);
    expect(workshops[0]).toEqual({
      title: "MLH", sponsor: null, runners: [], day: null, start: null,
      room: null, description: null,
    });
    expect(workshops[2]?.description).toMatch(/^Join a panel/);
  });

  test("optional Runner(s)/Day/Time/Room/Sponsor columns", () => {
    const [w] = parseWorkshopsTab([
      ["Title", "Sponsor", "Runner(s)", "Day", "Time", "Room", "Description"],
      ["Intro to QNX", "QNX", "Ana Li\nBo Chen", "Sat", "3:30 PM", "Rm 2230", "Overview"],
    ]);
    expect(w).toEqual({
      title: "Intro to QNX", sponsor: "QNX", runners: ["Ana Li", "Bo Chen"],
      day: "Saturday", start: "15:30", room: "Rm 2230", description: "Overview",
    });
  });

  test("an empty or unknown tab is an empty list", () => {
    expect(parseWorkshopsTab([])).toEqual([]);
    expect(parseWorkshopsTab([["Task", "Who"]])).toEqual([]);
  });
});

describe("workshop times from RUN OF SHOW", () => {
  const block = (
    day: RunOfShowItem["day"],
    start: string,
    title: string,
    location: string | null,
  ): RunOfShowItem => ({
    id: `${day}-${start}`, day, start, end: start, column: "sponsor-workshop",
    title, location, sponsors: [],
  });
  const items = [
    block("Friday", "22:00", "MLH Workshop", "Rm 2230 (50)"),
    block("Saturday", "10:00", "Scotiabank Workshop", "2230 (50)"),
    block("Saturday", "13:00", "Canada Life Workshop", "2230 (50)"),
    block("Saturday", "14:30", "Sunlife Workshop", "2230 (50)"),
    block("Saturday", "20:30", "Scotiabank Workshop", "Rm 2230 (50)"),
    block("Sunday", "10:00", "Sponsor Track Judging", "Scotiabank: Rm 2110, Canada Life: Rm 2230"),
  ];

  test("the Nth workshop row takes the sponsor's Nth block; judging is skipped", () => {
    const named = applySponsorNames(
      {
        items, tasks: [], coffeeChats: [], ceremonies: [],
        workshops: parseWorkshopsTab(WORKSHOPS),
      },
      NAMES,
    );
    const at = (title: string) => {
      const w = named.workshops.find((x) => x.title.startsWith(title));
      return `${w?.sponsor} ${w?.day} ${w?.start} ${w?.room}`;
    };
    expect(at("MLH")).toBe("null Friday 22:00 Rm 2230 (50)");
    expect(at("Scotiabank Workshop 1")).toBe("Scotiabank Saturday 10:00 2230 (50)");
    expect(at("Scotiabank Workshop 2")).toBe("Scotiabank Saturday 20:30 Rm 2230 (50)");
    expect(at("Sun Life")).toBe("Sun Life Saturday 14:30 2230 (50)");
    // QNX has no block of its own in this fixture.
    expect(at("QNX")).toBe("QNX null null null");
  });

  test("times already on the Workshops tab win", () => {
    const [w] = attachWorkshopTimes(
      [{
        title: "X", sponsor: "Scotiabank", runners: [], day: "Sunday",
        start: "09:00", room: "Rm 1", description: null,
      }],
      [{ ...items[1]!, sponsors: ["Scotiabank"] }],
    );
    expect(w).toMatchObject({ day: "Sunday", start: "09:00", room: "Rm 1" });
  });
});

describe("parseClockTime", () => {
  test("any minute, 12h or 24h", () => {
    expect(parseClockTime("7:42 PM")).toBe("19:42");
    expect(parseClockTime("12:05am")).toBe("00:05");
    expect(parseClockTime("19:42")).toBe("19:42");
    expect(parseClockTime("13:00 PM")).toBeNull();
    expect(parseClockTime("soon")).toBeNull();
  });
});
