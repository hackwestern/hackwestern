import { describe, expect, it } from "vitest";
import {
  boardTodos,
  judgingDayMinutes,
  leadOf,
  round2ScheduleWarnings,
  smsHref,
  sponsorCountByTeam,
  sponsorLine,
  teamStatus,
  type BoardSponsor,
} from "./judging-board";

it("warns about missing rooms, missing shortlists and conflicting times", () => {
  expect(
    round2ScheduleWarnings({
      sponsors: [
        {
          sponsorId: "a",
          name: "Alpha",
          mode: "room",
          room: null,
          shortlistSentAt: new Date(),
          teams: 2,
        },
        {
          sponsorId: "b",
          name: "Beta",
          mode: "room",
          room: "Rm 2235",
          shortlistSentAt: new Date(),
          teams: 1,
        },
        {
          sponsorId: "c",
          name: "Gamma",
          mode: "remote",
          room: null,
          shortlistSentAt: null,
          teams: 0,
        },
      ],
      slots: [
        {
          sponsorId: "a",
          teamId: "t",
          teamName: "Team T",
          room: "",
          start: 600,
        },
        {
          sponsorId: "b",
          teamId: "t",
          teamName: "Team T",
          room: "Rm 2235",
          start: 606,
        },
      ],
    }),
  ).toEqual([
    "Alpha: missing a judging room.",
    "Alpha: 1 shortlisted team has no presentation time.",
    "Gamma: no submitted shortlist.",
    "Team T: presentation times are too close together.",
  ]);
});

const at = (h: number, m = 0) => h * 60 + m;

const sponsor = (over: Partial<BoardSponsor>): BoardSponsor => ({
  sponsorId: over.name ?? "s",
  name: "S",
  mode: "room",
  room: "Rm 2110",
  shortlistSent: true,
  teams: 9,
  repsJudging: 3,
  scored: 0,
  topIn: false,
  firstStart: at(10),
  ...over,
});

// The mock's day: Scotiabank, Canada Life, QNX in rooms, Sun Life late
// with no room, and a remote sponsor (none are remote right now, but the
// mode stays).
const day = [
  sponsor({ sponsorId: "sb", name: "Scotiabank" }),
  sponsor({ sponsorId: "cl", name: "Canada Life", room: "Rm 2230" }),
  sponsor({
    sponsorId: "sl",
    name: "Sun Life",
    room: null,
    shortlistSent: false,
    teams: 0,
    firstStart: null,
  }),
  sponsor({
    sponsorId: "tf",
    name: "Remote Co",
    mode: "remote",
    room: "Remote (judges online)",
    firstStart: null,
  }),
];

describe("teamStatus", () => {
  it("has only three states, and one confirm accepts", () => {
    expect(teamStatus({ told: false, confirmed: false })).toBe("not-sent");
    expect(teamStatus({ told: true, confirmed: false })).toBe("waiting");
    expect(teamStatus({ told: true, confirmed: true })).toBe("accepted");
  });
});

describe("boardTodos", () => {
  it("opens at 9:20 on the shortlist, the room, then notify", () => {
    const todos = boardTodos({
      sponsors: day,
      teamsNotTold: 28,
      digital: [{ name: "PCBWay", topIn: false }],
      minutes: at(9, 20),
    });
    expect(todos).toEqual([
      { kind: "textLead", sponsorId: "sl", problem: "shortlist" },
      { kind: "room", sponsorId: "sl" },
      { kind: "notify", teams: 28 },
    ]);
  });

  it("flags a sponsor with no scores two slots after its first talk", () => {
    const todos = boardTodos({
      sponsors: [
        sponsor({ sponsorId: "cl", scored: 0 }),
        sponsor({ sponsorId: "sb", scored: 4 }),
      ],
      teamsNotTold: 0,
      digital: [],
      minutes: at(10, 30),
    });
    expect(todos).toEqual([
      { kind: "textLead", sponsorId: "cl", problem: "noScores" },
    ]);
    // Not yet at 10:10 (only one slot in).
    expect(
      boardTodos({
        sponsors: [sponsor({ sponsorId: "cl" })],
        teamsNotTold: 0,
        digital: [],
        minutes: at(10, 10),
      }),
    ).toEqual([]);
  });

  it("asks for late top 5s and the digital top 5 after 12:00", () => {
    const todos = boardTodos({
      sponsors: [
        sponsor({ sponsorId: "cl", scored: 7 }),
        sponsor({ sponsorId: "qnx", scored: 10, topIn: true }),
      ],
      teamsNotTold: 0,
      digital: [{ name: "PCBWay", topIn: false }],
      minutes: at(12, 5),
    });
    expect(todos).toEqual([
      { kind: "textLead", sponsorId: "cl", problem: "top5" },
      { kind: "digitalTop", name: "PCBWay" },
    ]);
  });

  it("drops the shortlist and room to-dos after round 1", () => {
    const todos = boardTodos({
      sponsors: day,
      teamsNotTold: 0,
      digital: [],
      minutes: at(11, 48),
    });
    expect(todos.some((t) => t.kind === "room")).toBe(false);
    expect(
      todos.some((t) => t.kind === "textLead" && t.problem === "shortlist"),
    ).toBe(false);
  });

  it("never asks a remote sponsor for a room", () => {
    const todos = boardTodos({
      sponsors: [sponsor({ sponsorId: "tf", mode: "remote", room: null })],
      teamsNotTold: 0,
      digital: [],
      minutes: at(9),
    });
    expect(todos).toEqual([]);
  });
});

describe("sponsorLine", () => {
  it("says one thing per row", () => {
    expect(sponsorLine(day[0]!, at(9, 20))).toEqual({
      tone: "ok",
      kind: "teams",
      teams: 9,
      reps: 3,
    });
    expect(sponsorLine(day[2]!, at(9, 20))).toEqual({
      tone: "warn",
      kind: "shortlistMissing",
    });
    expect(sponsorLine(day[2]!, at(11, 50))).toEqual({
      tone: "warn",
      kind: "missedRound1",
    });
    expect(sponsorLine(sponsor({ scored: 5 }), at(10, 40))).toEqual({
      tone: "ok",
      kind: "scored",
      scored: 5,
      teams: 9,
    });
    expect(sponsorLine(sponsor({ scored: 0 }), at(10, 30))).toEqual({
      tone: "warn",
      kind: "noScores",
    });
    expect(sponsorLine(sponsor({ topIn: true }), at(12, 5))).toEqual({
      tone: "ok",
      kind: "topIn",
    });
    expect(sponsorLine(sponsor({ scored: 9 }), at(12, 5))).toEqual({
      tone: "warn",
      kind: "topLate",
    });
  });
});

describe("helpers", () => {
  it("reads minutes into Sunday, Eastern", () => {
    expect(judgingDayMinutes(new Date("2026-11-22T09:20:00-05:00"))).toBe(
      at(9, 20),
    );
    expect(judgingDayMinutes(new Date("2026-11-21T23:00:00-05:00"))).toBe(-1);
    expect(judgingDayMinutes(new Date("2026-11-23T08:00:00-05:00"))).toBe(
      24 * 60,
    );
  });

  it("picks the head rep, else the first rep with a phone", () => {
    const a = { name: "A", phone: "555-0100", isPrimary: false };
    const b = { name: "B", phone: "555-0101", isPrimary: true };
    expect(leadOf([a, b])).toBe(b);
    expect(leadOf([a, { ...b, isPrimary: false }])).toBe(a);
    expect(leadOf([{ ...a, phone: " " }])).toBeNull();
  });

  it("drafts a text", () => {
    expect(smsHref("(519) 555-0101", "Hi & bye")).toBe(
      "sms:5195550101?&body=Hi%20%26%20bye",
    );
  });

  it("counts sponsors per team", () => {
    const counts = sponsorCountByTeam([
      { teamId: "t17", sponsorId: "cl" },
      { teamId: "t17", sponsorId: "qnx" },
      { teamId: "t5", sponsorId: "cl" },
    ]);
    expect(counts.get("t17")).toBe(2);
    expect(counts.get("t5")).toBe(1);
  });
});
