import { mean, populationStdDev } from "~/lib/stats";

/**
 * Judging score normalization.
 *
 * Problem: judges see different sets of teams and score on different personal
 * scales. A judge who happens to draw strong teams has a high personal average,
 * which used to *penalize* those very teams once scores were pooled — and a
 * lenient/harsh judge shifts every team they touch. Normalizing each judge's
 * marks "in isolation" (e.g. min-max within one judge) doesn't fix this because
 * the normalized values no longer live on a common scale.
 *
 * Fix: per-judge z-score, mapped back onto the *global* distribution.
 *
 *   normalized_ij = μ + σ * ((x_ij − μ_j) / σ_j)
 *
 * where
 *   x_ij = raw score judge j gave team i
 *   μ_j, σ_j = judge j's own mean and (population) std dev over all their marks
 *   μ, σ = global mean and std dev across *all* marks
 *
 * Intuition: "how many standard deviations above/below this judge's own average
 * was this team", re-expressed on the shared global scale. A team's final score
 * is the average of its normalized marks. This removes each judge's personal
 * bias/leniency while keeping the numbers on a familiar, comparable scale.
 */

export interface RawMark {
  teamId: string;
  judgeId: string;
  score: number;
}

export interface TeamScore {
  teamId: string;
  /** Normalized aggregate score (average of per-mark normalized values). */
  normalizedScore: number;
  /** Average of the team's raw marks, for reference / debugging. */
  rawScore: number;
  /** Number of judge marks that fed this score. */
  markCount: number;
}

/**
 * Compute normalized, comparable scores for every team that has at least one
 * mark, using per-judge z-score normalization mapped onto the global
 * distribution. Results are sorted highest-score first.
 *
 * Edge cases:
 * - A judge with no spread (σ_j = 0 — a single mark, or all-identical marks)
 *   contributes a z-score of 0, i.e. the global mean μ. This is the neutral,
 *   information-free contribution: such a mark can't say a team was above or
 *   below that judge's bar, so it neither helps nor hurts.
 * - If the global spread is 0 (every mark identical), every team lands on μ.
 */
export function computeNormalizedTeamScores(marks: RawMark[]): TeamScore[] {
  if (marks.length === 0) return [];

  // Global distribution across every mark.
  const globalMean = mean(marks.map((m) => m.score));
  const globalStdDev = populationStdDev(
    marks.map((m) => m.score),
    globalMean,
  );

  // Per-judge mean and std dev.
  const scoresByJudge = new Map<string, number[]>();
  for (const m of marks) {
    const arr = scoresByJudge.get(m.judgeId);
    if (arr) arr.push(m.score);
    else scoresByJudge.set(m.judgeId, [m.score]);
  }
  const judgeStats = new Map<string, { mean: number; stdDev: number }>();
  for (const [judgeId, scores] of scoresByJudge) {
    const judgeMean = mean(scores);
    judgeStats.set(judgeId, {
      mean: judgeMean,
      stdDev: populationStdDev(scores, judgeMean),
    });
  }

  // Normalize each mark, accumulate per team.
  const byTeam = new Map<string, { normalized: number[]; raw: number[] }>();
  for (const m of marks) {
    const stats = judgeStats.get(m.judgeId)!;
    const z = stats.stdDev === 0 ? 0 : (m.score - stats.mean) / stats.stdDev;
    const normalized = globalMean + globalStdDev * z;

    const entry = byTeam.get(m.teamId);
    if (entry) {
      entry.normalized.push(normalized);
      entry.raw.push(m.score);
    } else {
      byTeam.set(m.teamId, { normalized: [normalized], raw: [m.score] });
    }
  }

  const results: TeamScore[] = [];
  for (const [teamId, { normalized, raw }] of byTeam) {
    results.push({
      teamId,
      normalizedScore: mean(normalized),
      rawScore: mean(raw),
      markCount: normalized.length,
    });
  }

  results.sort((a, b) => b.normalizedScore - a.normalizedScore);
  return results;
}
