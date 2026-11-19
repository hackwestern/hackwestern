// Scoring rules shared by the judge app, the results page and the ranking.
// Pure, so both the client and the server can import it.

/** The Adventurous track criterion. Every team is in the track. */
export const ADVENTUROUS_ID = "adventurous";

/** Adventurous track score = 35% general average + 65% Adventurous rating. */
export const ADVENTUROUS_GENERAL_WEIGHT = 0.35;
export const ADVENTUROUS_RATING_WEIGHT = 0.65;

/**
 * A mark's Adventurous track score. `overall` is the mark's stored score (the
 * average of the general criteria). Null when the mark has no Adventurous
 * rating, so it's left out of the track instead of counting as a 0.
 */
export function adventurousTrackScore(
  overall: number,
  ratings: Record<string, number | undefined>,
): number | null {
  const adventurous = ratings[ADVENTUROUS_ID];
  if (adventurous === undefined) return null;
  return (
    ADVENTUROUS_GENERAL_WEIGHT * overall +
    ADVENTUROUS_RATING_WEIGHT * adventurous
  );
}
