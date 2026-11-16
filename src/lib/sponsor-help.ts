// Rules for sponsor help requests ("Need help" on the sponsor portal).
// A request pings the sponsor team in Slack; the first reaction or thread
// reply claims it. See docs/runbooks/slack-sponsor-help.md and the
// 2026-11-15 entry in docs/decisions.md.

export const SPONSOR_HELP_REASONS = [
  "swag",
  "tech",
  "food",
  "hacker",
  "other",
] as const;
export type SponsorHelpReason = (typeof SPONSOR_HELP_REASONS)[number];

export const SPONSOR_HELP_STATUSES = [
  "open",
  "claimed",
  "resolved",
  "cancelled",
] as const;
export type SponsorHelpStatus = (typeof SPONSOR_HELP_STATUSES)[number];

/** Longest optional note a sponsor can add. */
export const SPONSOR_HELP_NOTE_MAX = 280;

/**
 * Minutes after the request when an unclaimed request is re-pinged in the
 * Slack thread. Step 1 (3 min) re-mentions the group; step 2 (6 min) adds
 * @here. No more after that.
 */
export const SPONSOR_HELP_REPING_MINUTES = [3, 6] as const;

/** How long a resolved request stays on the sponsor's page. */
export const SPONSOR_HELP_RESOLVED_VISIBLE_MINUTES = 10;

/** How often the sponsor page polls while a request is open or claimed. */
export const SPONSOR_HELP_POLL_MS = 15_000;

/** Open and claimed requests are live: one per sponsor at a time. */
export function isActiveHelpStatus(status: SponsorHelpStatus): boolean {
  return status === "open" || status === "claimed";
}

/** First claim wins: only an open request can be claimed. */
export function canClaimHelp(status: SponsorHelpStatus): boolean {
  return status === "open";
}

/** Sponsors cancel and organizers resolve only live requests. */
export function canCloseHelp(status: SponsorHelpStatus): boolean {
  return isActiveHelpStatus(status);
}

/**
 * The re-ping step (1 or 2) that is due now, or null. `pingCount` is how many
 * re-pings were already sent. Only open requests are re-pinged.
 */
export function dueHelpReping(
  request: { status: SponsorHelpStatus; pingCount: number; createdAt: Date },
  now: Date,
): 1 | 2 | null {
  if (request.status !== "open") return null;
  const minutes = SPONSOR_HELP_REPING_MINUTES[request.pingCount];
  if (minutes === undefined) return null;
  const elapsed = now.getTime() - request.createdAt.getTime();
  if (elapsed < minutes * 60_000) return null;
  return (request.pingCount + 1) as 1 | 2;
}

/**
 * Whether the sponsor's page still shows this request: live ones always,
 * resolved ones for a few minutes, cancelled ones never.
 */
export function isHelpVisibleToSponsor(
  request: { status: SponsorHelpStatus; resolvedAt: Date | null },
  now: Date,
): boolean {
  if (isActiveHelpStatus(request.status)) return true;
  if (request.status !== "resolved" || !request.resolvedAt) return false;
  return (
    now.getTime() - request.resolvedAt.getTime() <
    SPONSOR_HELP_RESOLVED_VISIBLE_MINUTES * 60_000
  );
}

/** Trimmed note, or null when blank. */
export function normalizeHelpNote(note: string | null | undefined) {
  const trimmed = (note ?? "").trim();
  return trimmed === "" ? null : trimmed;
}
