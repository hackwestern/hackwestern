import { describe, expect, test } from "vitest";
import {
  fromEasternInput,
  hackingPhase,
  leaderName,
  nowAndNext,
  parseScheduleGrid,
  rankLeaders,
  toEasternInput,
} from "~/lib/broadcast";

// Same shape as the Events schedule sheet: a title row, the header, then day
// rows ("Friday") followed by 30-minute time rows. Column A is the time,
// B–J are tracks. A blank row marks the overnight gap.
const rows = [
  ["", "Hack Western 2026 Schedule"],
  ["Time (EST)", "Big Event", "Sponsor Workshop"],
  ["", "Friday"],
  ["5:00 PM", "Registration\n\nLocation: Grand Hall (Rm 1110)"],
  ["5:30 PM", "", "Location: 2230"],
  ["6:00 PM"],
  ["9:00 PM", "Hacking Begins", "MLH Workshop\nLocation: Rm 2230"],
  ["9:30 PM"],
  ["", "Saturday"],
  ["12:00 AM", "", "Krillion + Puffer Party\nLocation: 2230"],
  ["12:30 AM"],
  [],
  ["7:30 AM", "", "Breakfast\nLocation: Rm 1230"],
];
const merges = [
  // Registration spans 5:00–6:30 PM
  { startRowIndex: 3, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 2 },
  // A party merged through the overnight gap row still ends at 1:00 AM
  { startRowIndex: 9, endRowIndex: 12, startColumnIndex: 2, endColumnIndex: 3 },
];

describe("parseScheduleGrid", () => {
  const activities = parseScheduleGrid(rows, merges);

  test("reads titles, locations and Eastern times", () => {
    expect(activities[0]).toEqual({
      id: "3-1",
      title: "Registration",
      location: "Grand Hall (Rm 1110)",
      start: new Date("2026-11-20T17:00:00-05:00"),
      end: new Date("2026-11-20T18:30:00-05:00"),
    });
  });

  test("an unmerged cell is one 30-minute slot", () => {
    const mlh = activities.find((a) => a.title === "MLH Workshop");
    expect(mlh?.start).toEqual(new Date("2026-11-20T21:00:00-05:00"));
    expect(mlh?.end).toEqual(new Date("2026-11-20T21:30:00-05:00"));
  });

  test("rows after a day row belong to that day", () => {
    const party = activities.find((a) => a.title === "Krillion + Puffer Party");
    expect(party?.start).toEqual(new Date("2026-11-21T00:00:00-05:00"));
    expect(party?.end).toEqual(new Date("2026-11-21T01:00:00-05:00"));
  });

  test("skips cells with no title and the hacking start/end markers", () => {
    const titles = activities.map((a) => a.title);
    expect(titles).not.toContain("Location: 2230");
    expect(titles).not.toContain("Hacking Begins");
    expect(titles).toEqual([
      "Registration",
      "MLH Workshop",
      "Krillion + Puffer Party",
      "Breakfast",
    ]);
  });
});

describe("nowAndNext", () => {
  const at = (t: string) => new Date(`2026-11-20T${t}:00-05:00`);
  const activities = [
    {
      id: "a",
      title: "Dinner",
      location: "",
      start: at("17:30"),
      end: at("19:00"),
    },
    {
      id: "b",
      title: "Registration",
      location: "",
      start: at("17:00"),
      end: at("18:30"),
    },
    {
      id: "c",
      title: "Workshop B",
      location: "",
      start: at("21:00"),
      end: at("21:30"),
    },
    {
      id: "d",
      title: "Workshop A",
      location: "",
      start: at("21:00"),
      end: at("22:00"),
    },
    {
      id: "e",
      title: "Late",
      location: "",
      start: at("22:00"),
      end: at("22:30"),
    },
  ];

  test("now holds every activity running, next every one at the earliest upcoming start", () => {
    const { now, next, done } = nowAndNext(activities, at("18:00").getTime());
    expect(now.map((a) => a.title)).toEqual(["Registration", "Dinner"]);
    expect(next.map((a) => a.title)).toEqual(["Workshop A", "Workshop B"]);
    expect(done).toBe(false);
  });

  test("an activity stops being now at its end time", () => {
    const { now } = nowAndNext(activities, at("19:00").getTime());
    expect(now).toEqual([]);
  });

  test("done after the last activity ends", () => {
    expect(nowAndNext(activities, at("23:00").getTime()).done).toBe(true);
  });
});

describe("rankLeaders", () => {
  test("tied points share a rank and the next rank is skipped", () => {
    const ranked = rankLeaders([
      { id: "1", name: "Bea", points: 40 },
      { id: "2", name: "Al", points: 40 },
      { id: "3", name: "Cy", points: 55 },
      { id: "4", name: "Di", points: 10 },
    ]);
    expect(ranked.map((l) => [l.rank, l.name])).toEqual([
      [1, "Cy"],
      [2, "Al"],
      [2, "Bea"],
      [4, "Di"],
    ]);
  });
});

describe("leaderName", () => {
  test("prefers the application name, then the account name", () => {
    expect(leaderName("Google Name", "Ada", "Lovelace")).toBe("Ada Lovelace");
    expect(leaderName("Google Name", null, null)).toBe("Google Name");
    expect(leaderName(null, " ", null)).toBe("Hacker");
  });
});

describe("hackingPhase", () => {
  const start = new Date("2026-11-20T21:00:00-05:00");
  const end = new Date("2026-11-22T09:00:00-05:00");

  test("unset until both times are saved", () => {
    expect(hackingPhase(null, end, start.getTime())).toEqual({
      phase: "unset",
    });
  });

  test("counts down to the start, then to the deadline, then ends", () => {
    expect(hackingPhase(start, end, start.getTime() - 90_000)).toEqual({
      phase: "before",
      secondsLeft: 90,
    });
    expect(hackingPhase(start, end, start.getTime())).toEqual({
      phase: "during",
      secondsLeft: 36 * 3600,
    });
    expect(hackingPhase(start, end, end.getTime())).toEqual({ phase: "after" });
  });
});

describe("Eastern datetime inputs", () => {
  test("round-trip an event-weekend time through the input format", () => {
    const deadline = new Date("2026-11-22T09:00:00-05:00");
    expect(toEasternInput(deadline)).toBe("2026-11-22T09:00");
    expect(fromEasternInput("2026-11-22T09:00")).toEqual(deadline);
    expect(toEasternInput(null)).toBe("");
    expect(fromEasternInput("")).toBeNull();
  });
});
