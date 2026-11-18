/**
 * Sponsor judging opens on the portal at the start of round 1, Sunday 9:00
 * AM Eastern (docs/flows/sponsor-judging.md). Before then the portal's
 * Judging tile is shown locked, so sponsors know it's coming
 * (Jazz, 2026-11-18).
 */
export const JUDGING_UNLOCKS_AT = new Date("2026-11-22T09:00:00-05:00");

export function judgingUnlocked(
  now: Date,
  unlocksAt: Date = JUDGING_UNLOCKS_AT,
): boolean {
  return now.getTime() >= unlocksAt.getTime();
}
