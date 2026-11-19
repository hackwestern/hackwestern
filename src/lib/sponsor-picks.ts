import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";

/**
 * Pick limits for the organizer Run-of-show "Sponsor track judging" panel.
 * Picks are the sponsor's saved ranked top list (sponsor_final_pick; the
 * old "Judging" tab was deleted on 2026-11-19), so a sponsor is ready once
 * they've saved their top SPONSOR_FINAL_TOP. MAX is the panel's upper
 * bound only. Dependency-free (sponsor-scoring is too).
 */
export const MIN_SPONSOR_PICKS = SPONSOR_FINAL_TOP;
export const MAX_SPONSOR_PICKS = 20;
