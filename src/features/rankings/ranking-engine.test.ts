import { describe, expect, test } from "vitest";
import { applyAdjustments, calculateWeightedScore } from "./ranking-engine";
import type { RankingApplicant, RankingScenario } from "./types";

function makeApplicant(
  overrides: Partial<RankingApplicant> = {},
): RankingApplicant {
  return {
    userId: "u1",
    name: "Test Applicant",
    email: "test@example.com",
    school: null,
    yearOfStudy: null,
    major: null,
    gender: null,
    resumeLink: null,
    githubLink: null,
    linkedInLink: null,
    otherLink: null,
    status: "pending",
    createdAt: new Date(0),
    totalReviews: 1,
    avgOriginality: 10,
    avgTechnicality: 20,
    avgPassion: 30,
    totalScore: 60,
    avgScore: 60,
    avgScorePerReview: 60,
    ...overrides,
  };
}

function makeScenario(
  overrides: Partial<RankingScenario> = {},
): RankingScenario {
  return {
    name: "test",
    targetAcceptanceCount: 1,
    weights: { originality: 1, technicality: 1, passion: 1 },
    adjustments: [],
    schoolQuotas: {},
    exportCount: 1,
    ...overrides,
  };
}

describe("applyAdjustments", () => {
  test("returns 1 when there are no adjustments", () => {
    expect(applyAdjustments(makeApplicant(), [])).toBe(1);
  });

  test("applies the configured multiplier when a field value matches", () => {
    const multiplier = applyAdjustments(makeApplicant({ gender: "Male" }), [
      { field: "gender", multipliers: { Male: 0.5 } },
    ]);
    expect(multiplier).toBe(0.5);
  });

  test("returns 1 when the field value is not listed (including null)", () => {
    const rule = { field: "gender", multipliers: { Male: 0.5 } };
    expect(applyAdjustments(makeApplicant({ gender: "Female" }), [rule])).toBe(
      1,
    );
    expect(applyAdjustments(makeApplicant({ gender: null }), [rule])).toBe(1);
  });

  test("multiplies multiple matching adjustments together", () => {
    const multiplier = applyAdjustments(
      makeApplicant({ gender: "Male", school: "Waterloo" }),
      [
        { field: "gender", multipliers: { Male: 0.5 } },
        { field: "school", multipliers: { Waterloo: 0.4 } },
      ],
    );
    expect(multiplier).toBeCloseTo(0.2);
  });
});

describe("calculateWeightedScore", () => {
  test("weights the base dimensions when there are no adjustments", () => {
    const score = calculateWeightedScore(
      makeApplicant({ avgOriginality: 10, avgTechnicality: 20, avgPassion: 30 }),
      makeScenario({ weights: { originality: 1, technicality: 2, passion: 1 } }),
    );
    // 10*1 + 20*2 + 30*1 = 80
    expect(score).toBe(80);
  });

  test("scales the base score by the configured adjustment", () => {
    const score = calculateWeightedScore(
      makeApplicant({ gender: "Male" }),
      makeScenario({
        adjustments: [{ field: "gender", multipliers: { Male: 0.5 } }],
      }),
    );
    // base 60 * 0.5 = 30
    expect(score).toBe(30);
  });
});
