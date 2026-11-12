// src/server/api/utils/judge-calibration.ts
//
// Pure maths for the organizer calibration view. No database access, so it can
// be tested on its own. judge-data.ts loads the rows and calls this.

/** One organizer's mark on one team, as read from team_mark. */
export interface CalibrationRow {
  teamId: string;
  judgeId: string;
  score: number;
  /** team_mark.score_breakdown, which is { ratings: { [criterionId]: 0-100 }, notes? }. */
  breakdown: unknown;
}

export interface CalibrationTeam {
  teamId: string;
  teamName: string;
  /** The viewer's overall score and ratings. */
  mine: { score: number; ratings: Record<string, number> };
  /**
   * The average across the OTHER organizers who marked this team (the viewer is
   * left out). Null when nobody else has marked it yet.
   */
  others: { score: number; ratings: Record<string, number> } | null;
  /** How many other organizers marked this team. */
  otherCount: number;
}

export interface CalibrationData {
  /** Other organizers (not the viewer) with at least one mark. */
  otherOrganizerCount: number;
  /** Only the teams the viewer has marked, in the order they were marked. */
  teams: CalibrationTeam[];
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
 * Compares the viewer's marks with the average of the other organizers' marks.
 *
 * `rows` must hold regular-round marks from organizers only, oldest first (the
 * viewer's team order follows it). Averages are per criterion and only count
 * marks that rated that criterion.
 */
export function buildCalibration(
  rows: CalibrationRow[],
  viewerId: string,
  teamNames: Record<string, string>,
): CalibrationData {
  const othersByTeam = new Map<string, CalibrationRow[]>();
  for (const r of rows) {
    if (r.judgeId === viewerId) continue;
    const list = othersByTeam.get(r.teamId);
    if (list) list.push(r);
    else othersByTeam.set(r.teamId, [r]);
  }

  const teams: CalibrationTeam[] = [];
  for (const row of rows) {
    if (row.judgeId !== viewerId) continue;
    const others = othersByTeam.get(row.teamId) ?? [];

    let average: CalibrationTeam["others"] = null;
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
    otherOrganizerCount: new Set(
      rows.filter((r) => r.judgeId !== viewerId).map((r) => r.judgeId),
    ).size,
    teams,
  };
}
