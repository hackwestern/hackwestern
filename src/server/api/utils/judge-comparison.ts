// src/server/api/utils/judge-comparison.ts
//
// Pure maths for the comparison view. No database access, so it can
// be tested on its own. judge-data.ts loads the rows and calls this.

/** One organizer's mark on one team, as read from team_mark. */
export interface ComparisonRow {
  teamId: string;
  judgeId: string;
  score: number;
  /** team_mark.score_breakdown, which is { ratings: { [criterionId]: 0-100 }, notes? }. */
  breakdown: unknown;
}

export interface ComparisonTeam {
  teamId: string;
  teamName: string;
  /** The viewer's overall score and ratings. */
  mine: { score: number; ratings: Record<string, number> };
  /**
   * The average across the OTHER organizers who marked this team (the viewer is
   * left out). Null when nobody else has marked it yet.
   */
  others: { score: number; ratings: Record<string, number> } | null;
  /** How many other judges marked this team. */
  otherCount: number;
}

export interface ComparisonData {
  /** Other judges (not the viewer) with at least one mark in the same round. */
  otherJudgeCount: number;
  /** Only the teams the viewer has marked, in the order they were marked. */
  teams: ComparisonTeam[];
}

/** Pulls the 0-100 ratings out of a stored breakdown. Anything else is ignored. */
export function ratingsOf(breakdown: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!breakdown || typeof breakdown !== "object") return out;
  const ratings = (breakdown as { ratings?: unknown }).ratings;
  if (!ratings || typeof ratings !== "object") return out;
  for (const [id, value] of Object.entries(ratings)) {
    if (typeof value === "number" && Number.isFinite(value)) out[id] = value;
  }
  return out;
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Compares the viewer's marks with the average of the other judges' marks.
 *
 * `rows` must hold marks from one round type (regular or sponsored), oldest first (the
 * viewer's team order follows it). Averages are per criterion and only count
 * marks that rated that criterion.
 */
export function buildComparison(
  rows: ComparisonRow[],
  viewerId: string,
  teamNames: Record<string, string>,
): ComparisonData {
  const othersByTeam = new Map<string, ComparisonRow[]>();
  for (const r of rows) {
    if (r.judgeId === viewerId) continue;
    const list = othersByTeam.get(r.teamId);
    if (list) list.push(r);
    else othersByTeam.set(r.teamId, [r]);
  }

  const teams: ComparisonTeam[] = [];
  for (const row of rows) {
    if (row.judgeId !== viewerId) continue;
    const others = othersByTeam.get(row.teamId) ?? [];

    let average: ComparisonTeam["others"] = null;
    if (others.length > 0) {
      const perCriterion = new Map<string, number[]>();
      for (const m of others) {
        for (const [id, value] of Object.entries(ratingsOf(m.breakdown))) {
          const list = perCriterion.get(id);
          if (list) list.push(value);
          else perCriterion.set(id, [value]);
        }
      }
      const ratings: Record<string, number> = {};
      for (const [id, values] of perCriterion) ratings[id] = mean(values);
      average = { score: mean(others.map((m) => m.score)), ratings };
    }

    teams.push({
      teamId: row.teamId,
      teamName: teamNames[row.teamId] ?? "Unknown team",
      mine: { score: row.score, ratings: ratingsOf(row.breakdown) },
      others: average,
      otherCount: new Set(others.map((m) => m.judgeId)).size,
    });
  }

  return {
    otherJudgeCount: new Set(
      rows.filter((r) => r.judgeId !== viewerId).map((r) => r.judgeId),
    ).size,
    teams,
  };
}
