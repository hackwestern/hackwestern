import { isAdmittedStatus } from "~/lib/admission";

/** Explains to a hacker who isn't confirmed why they can't open /live. */
export const LIVE_ACCESS_PAGE = "/live-access";

/**
 * Who can open the live site: organizers and admitted hackers. Returns where
 * to send everyone else, or null when they're allowed in.
 */
export function liveAccessRedirect(
  user: { type: string | null; status: string | null | undefined } | null,
  now: number = Date.now(),
): string | null {
  if (!user) return "/login?callbackUrl=/live";
  if (user.type === "organizer") return null;
  if (user.type !== "hacker") return "/";
  return isAdmittedStatus(user.status, now) ? null : LIVE_ACCESS_PAGE;
}
