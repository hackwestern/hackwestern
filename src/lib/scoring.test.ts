import { describe, expect, test } from "vitest";
import { mean, populationStdDev } from "~/lib/stats";
import { computeNormalizedTeamScores, type RawMark } from "~/lib/scoring";

describe("stats helpers", () => {
  test("mean", () => {
    expect(mean([])).toBe(0);
    expect(mean([5])).toBe(5);
    expect(mean([40, 60, 80, 100])).toBe(70);
  });

  test("populationStdDev", () => {
    expect(populationStdDev([])).toBe(0);
    expect(populationStdDev([5])).toBe(0);
    // values [40,60,80,100]: mean 70, variance 500, std sqrt(500)
    expect(populationStdDev([40, 60, 80, 100])).toBeCloseTo(Math.sqrt(500), 6);
  });
});

describe("computeNormalizedTeamScores", () => {
  test("returns empty for no marks", () => {
    expect(computeNormalizedTeamScores([])).toEqual([]);
  });

  test("removes a judge's leniency/harshness offset", () => {
    // Judge A is harsh (mean 50), Judge B is lenient (mean 90), but both agree
    // T2 is one std dev above their average and T1 one std dev below.
    const marks: RawMark[] = [
      { teamId: "T1", judgeId: "A", score: 40 },
      { teamId: "T2", judgeId: "A", score: 60 },
      { teamId: "T1", judgeId: "B", score: 80 },
      { teamId: "T2", judgeId: "B", score: 100 },
    ];

    // Global: mean 70, std sqrt(500) ≈ 22.36.
    const results = computeNormalizedTeamScores(marks);
    const byTeam = new Map(results.map((r) => [r.teamId, r]));

    // Each team's two normalized marks agree despite the judges' different
    // scales, so the leniency offset is gone.
    expect(byTeam.get("T1")!.normalizedScore).toBeCloseTo(70 - Math.sqrt(500), 4);
    expect(byTeam.get("T2")!.normalizedScore).toBeCloseTo(70 + Math.sqrt(500), 4);

    // Raw averages still carry the offset (kept for reference only).
    expect(byTeam.get("T1")!.rawScore).toBe(60);
    expect(byTeam.get("T2")!.rawScore).toBe(80);
  });

  test("a team is not penalized for drawing a judge with strong teams", () => {
    // Judge A only sees strong teams (his mean is high). Under naive averaging
    // his teams get dragged toward his high mean, unfairly. After z-score
    // normalization, a team at Judge A's mean lands at the global mean, and a
    // team above his mean lands above global — not penalized for the company.
    const marks: RawMark[] = [
      // Judge A: strong pool, mean 90.
      { teamId: "S1", judgeId: "A", score: 85 },
      { teamId: "S2", judgeId: "A", score: 90 },
      { teamId: "S3", judgeId: "A", score: 95 },
      // Judge B: weak pool, mean 50.
      { teamId: "W1", judgeId: "B", score: 45 },
      { teamId: "W2", judgeId: "B", score: 50 },
      { teamId: "W3", judgeId: "B", score: 55 },
    ];

    const results = computeNormalizedTeamScores(marks);
    const byTeam = new Map(results.map((r) => [r.teamId, r]));

    const globalMean = mean(marks.map((m) => m.score)); // 70

    // The team exactly at each judge's own mean maps to the global mean,
    // regardless of whether that judge's pool was strong or weak.
    expect(byTeam.get("S2")!.normalizedScore).toBeCloseTo(globalMean, 6);
    expect(byTeam.get("W2")!.normalizedScore).toBeCloseTo(globalMean, 6);

    // The top team in the strong pool and the top team in the weak pool are
    // scored identically, because both were +1 std dev within their judge.
    expect(byTeam.get("S3")!.normalizedScore).toBeCloseTo(
      byTeam.get("W3")!.normalizedScore,
      6,
    );
  });

  test("judge with a single mark contributes the global mean (neutral)", () => {
    const marks: RawMark[] = [
      { teamId: "T1", judgeId: "A", score: 10 },
      { teamId: "T2", judgeId: "A", score: 30 },
      { teamId: "T3", judgeId: "B", score: 100 }, // B's only mark → σ_B = 0
    ];
    const globalMean = mean(marks.map((m) => m.score));
    const results = computeNormalizedTeamScores(marks);
    const t3 = results.find((r) => r.teamId === "T3")!;
    expect(t3.normalizedScore).toBeCloseTo(globalMean, 6);
  });

  test("results are sorted by normalized score, descending", () => {
    const marks: RawMark[] = [
      { teamId: "low", judgeId: "A", score: 10 },
      { teamId: "mid", judgeId: "A", score: 50 },
      { teamId: "high", judgeId: "A", score: 90 },
    ];
    const results = computeNormalizedTeamScores(marks);
    expect(results.map((r) => r.teamId)).toEqual(["high", "mid", "low"]);
    expect(results.every((r) => r.markCount === 1)).toBe(true);
  });
});
