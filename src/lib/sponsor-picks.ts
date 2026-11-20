import { SHORTLIST_MAX } from "~/lib/sponsor-presentations";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";

/**
 * Pick limits for the organizer Home's "Sponsor track judging" panel.
 * Picks are the sponsor's sent round 1 shortlist (sponsor_shortlist_send,
 * the same count the Judging board shows), so a sponsor is ready once it
 * has sent at least SPONSOR_FINAL_TOP teams (enough for a top 5). MAX is
 * the round 1 shortlist cap (one team per presentation slot).
 * Dependency-free (sponsor-scoring and sponsor-presentations are too).
 */
export const MIN_SPONSOR_PICKS = SPONSOR_FINAL_TOP;
export const MAX_SPONSOR_PICKS = SHORTLIST_MAX;
