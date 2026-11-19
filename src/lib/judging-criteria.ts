// src/lib/judging-criteria.ts
//
// The rubric criteria that have their own column on team_mark, and the
// mapping between the API's `{ [criterionId]: rating }` shape and those
// columns. Pure, so both the server and the judge app can use it.

/** Every criterion with a `<id>_rating` column on team_mark. */
export const CRITERION_IDS = [
  "impact",
  "creativity",
  "design",
  "adventurous",
] as const;

export type CriterionId = (typeof CRITERION_IDS)[number];

/** team_mark's rating columns, as Drizzle names them. Null = not rated. */
export interface RatingColumns {
  impactRating: number | null;
  creativityRating: number | null;
  designRating: number | null;
  adventurousRating: number | null;
}

/** Which column holds each criterion's rating. */
export const RATING_COLUMN = {
  impact: "impactRating",
  creativity: "creativityRating",
  design: "designRating",
  adventurous: "adventurousRating",
} as const satisfies Record<CriterionId, keyof RatingColumns>;

/** Columns to `{ impact: 7.5, ... }`, leaving out criteria that weren't rated. */
export function ratingsFromColumns(row: RatingColumns): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of CRITERION_IDS) {
    const value = row[RATING_COLUMN[id]];
    if (value !== null) out[id] = value;
  }
  return out;
}

/** `{ impact: 7.5, ... }` to columns; a missing criterion becomes null. */
export function columnsFromRatings(
  ratings: Partial<Record<CriterionId, number>>,
): RatingColumns {
  return {
    impactRating: ratings.impact ?? null,
    creativityRating: ratings.creativity ?? null,
    designRating: ratings.design ?? null,
    adventurousRating: ratings.adventurous ?? null,
  };
}
