/**
 * Hack Western tracks, shared by the sponsor-info sheet dropdown ("Sponsor
 * Track" column), the sponsor-judging track filter, and the picks page.
 * Dependency-free (no server imports) so client pages and server utils can
 * both use it. Must stay in step with the `track` pgEnum in
 * ~/server/db/schema (guarded by a unit test).
 */
export const TRACK_VALUES = [
  "Best Use of Cohere",
  "Best Use of AntiGravity",
  "Best Domain",
  "General",
] as const;

export type TrackValue = (typeof TRACK_VALUES)[number];

/** Sheet cell -> valid track, or null when empty/unrecognized. */
export function normalizeSponsorTrack(
  val: string | undefined,
): TrackValue | null {
  const clean = String(val ?? "")
    .replace(/\p{Cf}/gu, "")
    .trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  return TRACK_VALUES.find((track) => track.toLowerCase() === lower) ?? null;
}
