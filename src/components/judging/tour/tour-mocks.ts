// Sample data for the judging tour (/judging-tour). Shaped exactly like what
// the judging API returns, so the real judge and hacker components render it
// as they would on the day. Nothing here reaches the server.

import { type TeamJudging } from "~/components/judging/board/round-board";
import { type QueueLineup } from "~/components/judging/judge-app/judge-queue-list";
import {
  type JudgeRound,
  type RoundView,
} from "~/components/judging/judge-app/judge-round";
import {
  type JudgedTeam,
  type UpcomingTeam,
} from "~/components/judging/judge-app/judge-teams";

/** Rounds on the day; this sample judge has 6 tables in them. */
export const TOUR_ROUNDS = 9;
/** 3 min demo + 2 min Q&A. Judges get about 1:30 to move between rounds. */
const ROUND_SECONDS = 300;

/** The sample judge's route, in walking order. */
export const TOUR_TEAMS = [
  {
    id: "t1",
    name: "Pantry Pal",
    table: 14,
    members: ["Ava Chen", "Omar Haddad", "Priya Nair"],
  },
  {
    id: "t2",
    name: "BusBuddy",
    table: 15,
    members: ["Liam Tremblay", "Sofia Rossi"],
  },
  {
    id: "t3",
    name: "Plant Doctor",
    table: 16,
    members: ["Noah Kim", "Zara Ali", "Ben Okafor", "Mia Lopez"],
  },
  {
    id: "t4",
    name: "Echo Notes",
    table: 17,
    members: ["Hana Sato", "Ethan Brooks"],
  },
  {
    id: "t5",
    name: "StudySync",
    table: 18,
    members: ["Lucas Martin", "Chloe Wong", "Arjun Mehta"],
  },
  {
    id: "t6",
    name: "Trailhead AR",
    table: 19,
    members: ["Grace Liu", "Mateo Silva"],
  },
] as const;

export const TOUR_TABLES = TOUR_TEAMS.map((t) => t.table);
export const TOUR_TEAM = TOUR_TEAMS[0];
export const TABLE_BY_TEAM: Record<string, number> = Object.fromEntries(
  TOUR_TEAMS.map((t) => [t.id, t.table]),
);

export const tourQueue: QueueLineup = {
  teams: TOUR_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    members: [...t.members],
  })),
  hydrated: true,
  requestNewQueue: () => undefined,
  notice: null,
};

/**
 * A round as the judge's phone would get it. A running round ends `leftMs`
 * from now, so the real timer counts down on screen.
 */
export function tourRound(
  status: JudgeRound["status"],
  round: number,
  leftMs = 0,
  totalRounds = TOUR_ROUNDS,
): RoundView {
  const now = Date.now();
  const state: JudgeRound = {
    enabled: true,
    round,
    totalRounds,
    status,
    roundSeconds: ROUND_SECONDS,
    endsAt: status === "running" ? new Date(now + leftMs) : null,
    remainingMs: status === "running" || status === "paused" ? leftMs : null,
    serverNow: new Date(now),
  };
  return { state, fetchedAt: now };
}

/** Scores the sample judge sent, one per team. */
const SAMPLE_SCORES = [7.5, 6, 8, 5, 6.5, 4.5];

export const tourResults: JudgedTeam[] = TOUR_TEAMS.map((t, i) => ({
  markId: i + 1,
  teamId: t.id,
  table: t.table,
  teamName: t.name,
  ratings: {},
  score: SAMPLE_SCORES[i] ?? 5,
  notes: "",
  superLike: i === 2,
}));

/** The route with every table scored. */
export const tourRouteDone: UpcomingTeam[] = TOUR_TEAMS.map((t, i) => ({
  stopId: i + 1,
  table: t.table,
  teamName: t.name,
  members: [...t.members],
  round: i + 1,
  absent: false,
  late: false,
  missed: false,
  done: true,
  current: false,
}));

/** A hacker's team at table 14, in whatever state the stop needs. */
export function tourHacker(
  overrides: Partial<NonNullable<TeamJudging>> = {},
): NonNullable<TeamJudging> {
  return {
    table: { number: TOUR_TEAM.table, zone: "", row: 1, col: 13 },
    absent: false,
    judges: { done: 0, total: 3 },
    round: null,
    thisRound: null,
    judgeStarted: false,
    reportedMissing: false,
    reportOpensInMs: null,
    judgedAll: false,
    ...overrides,
  };
}
