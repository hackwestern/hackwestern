/**
 * Sponsor check-in statuses shared by the organizer dashboard and the
 * sponsor-info sheet tab. Single source of truth — the sheet dropdown
 * validation, the tRPC input schema, and the dashboard UI all derive from
 * this list. Dependency-free (no server imports) so client pages can use it.
 */
export const SPONSOR_STATUS_VALUES = [
  "Not arrived",
  "Checked in",
  "Booth set up",
  "Workshop live",
  "Left",
] as const;

export type SponsorStatus = (typeof SPONSOR_STATUS_VALUES)[number];
