import { SHORTLIST_MAX } from "~/lib/sponsor-presentations";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";

/**
 * Pick limits for the organizer Run-of-show "Sponsor track judging" panel.
 * Picks are the sponsor's saved ranked top list (sponsor_final_pick; the
 * old "Judging" tab was deleted on 2026-11-19), so a sponsor is ready once
 * they've saved their top SPONSOR_FINAL_TOP. MAX is the panel's upper
 * bound only: the round 1 shortlist cap (one team per presentation slot).
 * Dependency-free (sponsor-scoring and sponsor-presentations are too).
 */
export const MIN_SPONSOR_PICKS = SPONSOR_FINAL_TOP;
export const MAX_SPONSOR_PICKS = SHORTLIST_MAX;
