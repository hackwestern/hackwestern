// src/server/api/utils/team-results.ts
//
// Pure maths for the organizer results page: every team with the averages of
// all the marks it got. No database access, so it can be tested on its own.
import { ratingsOf } from "~/server/api/utils/judge-comparison";

export interface TeamInfo {
  id: string;
  name: string;
  /** null when the team isn't seated at a table. */
  table: number | null;
  github: string | null;
  devpost: string | null;
}

/** One judge's mark on one team, as read from team_mark. */
export interface MarkRow {
  teamId: string;
  judgeId: string;
  judgeName: string;
  /** judge.type: organizer means a general judge. */
  judgeType: "organizer" | "sponsored";
  roundType: "regular" | "sponsored";
  score: number;
  /** team_mark.score_breakdown, { ratings: { [criterionId]: 0-100 }, notes? }. */
  breakdown: unknown;
  notes: string;
}

export interface ResultMark {
  judgeId: string;
  judgeName: string;
  judgeType: "organizer" | "sponsored";
  score: number;
  ratings: Record<string, number>;
  notes: string;
}

export interface RoundSummary {
  /** How many judges marked the team in this round. */
  count: number;
  /** Average overall score, or null with no marks. */
  average: number | null;
  /** Average per criterion, over the marks that rated it. */
  criteria: Record<string, number>;
  marks: ResultMark[];
}

export interface TeamResult {
  team: TeamInfo;
  /** The general judging round, which decides the ranking. */
  regular: RoundSummary;
  /** Sponsor judges' marks, ranked apart. */
  sponsored: RoundSummary;
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

function summarize(marks: ResultMark[]): RoundSummary {
  const perCriterion = new Map<string, number[]>();
  for (const m of marks) {
    for (const [id, value] of Object.entries(m.ratings)) {
      const list = perCriterion.get(id);
      if (list) list.push(value);
      else perCriterion.set(id, [value]);
    }
  }
  const criteria: Record<string, number> = {};
  for (const [id, values] of perCriterion) criteria[id] = mean(values);

  return {
    count: marks.length,
    average: marks.length > 0 ? mean(marks.map((m) => m.score)) : null,
    criteria,
    marks,
  };
}

/**
 * One result per team, in table order (teams without a table last, then by
 * name). Every team is included, even with no marks yet.
 */
export function buildTeamResults(
  teams: TeamInfo[],
  rows: MarkRow[],
): TeamResult[] {
  const byTeam = new Map<string, MarkRow[]>();
  for (const r of rows) {
    const list = byTeam.get(r.teamId);
    if (list) list.push(r);
    else byTeam.set(r.teamId, [r]);
  }

  const toMark = (r: MarkRow): ResultMark => ({
    judgeId: r.judgeId,
    judgeName: r.judgeName,
    judgeType: r.judgeType,
    score: r.score,
    ratings: ratingsOf(r.breakdown),
    notes: r.notes,
  });

  return [...teams]
    .sort((a, b) => {
      if (a.table !== b.table) {
        if (a.table === null) return 1;
        if (b.table === null) return -1;
        return a.table - b.table;
      }
      return a.name.localeCompare(b.name);
    })
    .map((team) => {
      const marks = byTeam.get(team.id) ?? [];
      return {
        team,
        regular: summarize(
          marks.filter((m) => m.roundType === "regular").map(toMark),
        ),
        sponsored: summarize(
          marks.filter((m) => m.roundType === "sponsored").map(toMark),
        ),
      };
    });
}
