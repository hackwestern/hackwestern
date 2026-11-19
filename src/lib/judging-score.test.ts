import { describe, expect, test } from "vitest";

import {
  DEFAULT_RUBRIC,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";
import { ADVENTUROUS_ID, adventurousTrackScore } from "~/lib/judging-score";
import { buildTeamResults } from "~/server/api/utils/team-results";

describe("adventurousTrackScore", () => {
  test("is 35% overall + 65% Adventurous", () => {
    expect(adventurousTrackScore(7, { adventurous: 9 })).toBeCloseTo(8.3);
    expect(adventurousTrackScore(6, { adventurous: 10 })).toBeCloseTo(8.6);
  });

  test("is null without an Adventurous rating, not a 0", () => {
    expect(adventurousTrackScore(7, { innovation: 9 })).toBeNull();
  });
});

describe("DEFAULT_RUBRIC", () => {
  test("Adventurous is the only track criterion", () => {
    expect(
      DEFAULT_RUBRIC.criteria.filter((c) => c.track).map((c) => c.id),
    ).toEqual([ADVENTUROUS_ID]);
  });

  test("the score averages the general criteria and ignores Adventurous", () => {
    const general = { innovation: 8, creativity: 7, technical: 9, design: 6 };
    const low = scoreRubric(DEFAULT_RUBRIC, { ...general, adventurous: 0 });
    const high = scoreRubric(DEFAULT_RUBRIC, { ...general, adventurous: 10 });
    expect(low.score).toBe(7.5);
    expect(high.score).toBe(7.5);
    // Adventurous still has to be rated before a judge can submit.
    expect(high.rated).toBe(DEFAULT_RUBRIC.criteria.length);
    expect(scoreRubric(DEFAULT_RUBRIC, general).rated).toBe(4);
  });
});

describe("buildTeamResults", () => {
  const team = { id: "T1", name: "T", table: 1, github: null, devpost: null };
  const mark = (
    judgeId: string,
    roundType: "regular" | "sponsored",
    score: number,
    ratings: Record<string, number>,
    superLike: boolean,
  ) => ({
    teamId: "T1",
    judgeId,
    judgeName: judgeId,
    judgeType:
      roundType === "regular" ? ("organizer" as const) : ("sponsored" as const),
    roundType,
    score,
    breakdown: { ratings },
    notes: "",
    superLike,
  });

  test("averages the Adventurous track and counts super likes", () => {
    const [result] = buildTeamResults(
      [team],
      [
        mark("a", "regular", 7, { adventurous: 9 }, true), // 8.3
        mark("b", "regular", 6, { adventurous: 10 }, false), // 8.6
        mark("c", "regular", 5, {}, true), // no Adventurous rating
        mark("s", "sponsored", 9, { adventurous: 9 }, true),
      ],
    );
    expect(result?.regular.adventurous).toBeCloseTo(8.45);
    expect(result?.regular.superLikes).toBe(2);
    // The track is general judging only.
    expect(result?.sponsored.adventurous).toBeNull();
    expect(result?.sponsored.superLikes).toBe(1);
  });
});
