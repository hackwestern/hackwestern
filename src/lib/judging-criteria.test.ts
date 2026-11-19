import { describe, expect, test } from "vitest";

import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import {
  CRITERION_IDS,
  columnsFromRatings,
  ratingsFromColumns,
} from "~/lib/judging-criteria";

describe("judging criteria columns", () => {
  test("every criterion on the judge screen has a team_mark column", () => {
    // A criterion without a column would be rejected by the API, and a column
    // without a criterion would never be filled.
    expect(DEFAULT_RUBRIC.criteria.map((c) => c.id).sort()).toEqual(
      [...CRITERION_IDS].sort(),
    );
  });

  test("round-trips ratings through the columns", () => {
    const ratings = { impact: 8.5, creativity: 7, design: 0, adventurous: 10 };
    expect(ratingsFromColumns(columnsFromRatings(ratings))).toEqual(ratings);
  });

  test("unrated criteria are null in columns and left out of ratings", () => {
    const cols = columnsFromRatings({ impact: 6 });
    expect(cols).toEqual({
      impactRating: 6,
      creativityRating: null,
      designRating: null,
      adventurousRating: null,
    });
    expect(ratingsFromColumns(cols)).toEqual({ impact: 6 });
  });
});
