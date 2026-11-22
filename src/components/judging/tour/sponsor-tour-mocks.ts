// Sample data for the sponsor judging tour (/judging-tour/sponsors). Shaped
// exactly like `sponsorScoring.get`, so the real sponsor portal components
// render it as they would on the day. Nothing here reaches the server.

import { type JudgingData } from "~/components/sponsors/judging/use-sponsor-judging";
import {
  SPONSOR_FINAL_TOP,
  aggregateScores,
  type JudgeScore,
  type TeamReview,
} from "~/lib/sponsor-scoring";

/** The sample sponsor's reps, as on "Who's judging?". */
export const SPONSOR_TOUR_REPS = ["Alex", "Sam"];
export const SPONSOR_TOUR_ME = "Alex";

const TEAMS = [
  ["Pantry Pal", ["Ava Chen", "Omar Haddad", "Priya Nair"]],
  ["BusBuddy", ["Liam Tremblay", "Sofia Rossi"]],
  ["Plant Doctor", ["Noah Kim", "Zara Ali", "Ben Okafor", "Mia Lopez"]],
  ["Echo Notes", ["Hana Sato", "Ethan Brooks"]],
  ["StudySync", ["Lucas Martin", "Chloe Wong", "Arjun Mehta"]],
  ["Trailhead AR", ["Grace Liu", "Mateo Silva"]],
  ["LedgerLite", ["Owen Park", "Isla Grant"]],
  ["CareQueue", ["Nadia Rahman", "Leo Dubois", "Kai Turner"]],
  ["RouteRun", ["Emma Stone", "Ravi Patel"]],
  ["Sightline", ["Yara Haddad", "Jonah Reid", "Amir Khan"]],
] as const;

const teams: JudgingData["teams"] = TEAMS.map(([name, members], i) => ({
  id: `s${i + 1}`,
  name,
  devpostUrl: `https://devpost.com/software/${name.toLowerCase().replace(/\s+/g, "-")}`,
  githubUrl: null,
  tracks: ["Sample sponsor track"],
  members: [...members],
}));

const SCORES = [8.5, 7, 9, 6, 7.5, 5.5, 8, 6.5, 7, 9.5];

const scores: JudgeScore[] = teams.flatMap((t, i) => [
  { teamId: t.id, judge: "Alex", score: SCORES[i] ?? 5 },
  { teamId: t.id, judge: "Sam", score: Math.max(1, (SCORES[i] ?? 5) - 0.5) },
]);

const reviews: TeamReview[] = teams.map((t, i) => ({
  teamId: t.id,
  score: SCORES[i] ?? null,
  shortlisted: true,
  note: i === 0 ? "Great live demo, ask about scaling." : null,
}));

/** 10:00 AM, in minutes after midnight, like the presentation schedule. */
const TEN_AM = 10 * 60;
/** Each slot: 3 min pitch, 2 min Q&A, 1 min to switch teams. */
const SLOT_MINUTES = 6;

export const sponsorTourData: JudgingData = {
  sponsorName: "Sample Sponsor",
  sponsorTrack: "Sample sponsor track",
  finalTop: SPONSOR_FINAL_TOP,
  open: true,
  teams,
  reviews,
  scores,
  reps: SPONSOR_TOUR_REPS,
  round: {
    shortlistSent: { sentAt: new Date(0), teamIds: teams.map((t) => t.id) },
    scheduledAt: new Date(0),
    slots: teams.map((t, i) => ({
      teamId: t.id,
      room: "Rm 2110",
      start: TEN_AM + i * SLOT_MINUTES,
    })),
    round2Open: true,
    remote: false,
  },
  top5Draft: null,
  final: null,
};

export const sponsorTourScores = aggregateScores(scores);
export const sponsorTourReviews = new Map(reviews.map((r) => [r.teamId, r]));

/** A first project, not yet scored or shortlisted, for the browsing step. */
export const sponsorTourFirst = teams[0]!;
