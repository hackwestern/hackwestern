import { TRPCClientError } from "@trpc/client";

// Shared look for the judge screens. Everything here is a design-system token
// (dashboard-*), never a raw hex value. Buttons come from DashboardButton.

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2";

export const card =
  "rounded-dashboard-2xl border border-dashboard-border-subtle bg-dashboard-bg-surface shadow-dashboard-card";

/** Text inputs and the notes box. */
export const field = `min-h-11 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-4 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder ${focusRing}`;

/** Status messages. */
export const infoBanner =
  "m-0 rounded-dashboard-lg bg-dashboard-bg-highlight px-3.5 py-2.5 text-sm font-semibold text-dashboard-text-active";
export const warningBanner =
  "m-0 rounded-dashboard-lg bg-dashboard-status-iconBadge px-3.5 py-2.5 text-sm font-semibold text-dashboard-text-warning";

/**
 * DashboardButton switches to auto width from the md breakpoint up. The judge
 * screens stay a phone-sized column on wide screens, so add this to keep a
 * primary button full width and the same height.
 */
export const fullWidth = "md:h-11 md:w-full";

/** Keeps a 44px touch target on the smaller DashboardButton variants. */
export const touch = "min-h-11";

/**
 * @deprecated Use <DashboardButton /> instead. Kept, restyled with tokens, only
 * so older imports keep compiling. Delete once nothing imports them.
 */
export const primaryButton = `min-h-14 w-full rounded-dashboard-lg bg-dashboard-action-primary px-4 text-lg font-semibold text-dashboard-text-inverse hover:bg-dashboard-text-active disabled:cursor-not-allowed disabled:opacity-dashboard-disabled ${focusRing}`;

/** @deprecated Use <DashboardButton variant="outline" /> instead. */
export const secondaryButton = `min-h-12 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base font-semibold text-dashboard-text-heavy hover:bg-dashboard-bg-highlight disabled:cursor-not-allowed disabled:opacity-dashboard-disabled ${focusRing}`;

/** tRPC error code (CONFLICT, FORBIDDEN, ...), or undefined for network/other failures. */
export function errorCode(error: unknown): string | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  return (error.data as { code?: string } | undefined)?.code;
}

/** Plain-language message for a failed judge action; never the raw server text. */
export function friendlyError(
  error: unknown,
  conflict = "That didn't go through. Try again.",
): string {
  switch (errorCode(error)) {
    case "CONFLICT":
      return conflict;
    case "UNAUTHORIZED":
      return "You've been signed out. Sign in again to keep judging.";
    case "FORBIDDEN":
      return "You're not set up as a judge anymore. Ask an organizer.";
    case "NOT_FOUND":
      return "That mark couldn't be found. Refresh the page and try again.";
    case undefined:
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong on our side. Try again.";
  }
}