import type { NameCandidate } from "~/lib/ops-owners";
import {
  fetchSlackMembers,
  isActivePerson,
  type SlackMember,
} from "~/server/slack/directory";

/**
 * The organizers on Slack: every organizer's Slack name carries the tag
 * "[ORGANIZER]" ("[ORGANIZER] Jessica Xing"), so the bot can tell them from
 * the hundreds of hackers in the workspace. Read from users.list (users:read),
 * cached for 5 minutes. A hacker who shares an organizer's name has no tag
 * and is never in this list. docs/decisions.md 2026-11-18 (ops pings).
 */

export const ORGANIZER_TAG = /\[\s*organi[sz]ers?\s*\]/i;
export const ORGANIZERS_TTL_MS = 5 * 60_000;

export type SlackOrganizer = NameCandidate & { id: string };

/** "[ORGANIZER] Jessica Xing" -> "Jessica Xing"; null without the tag. */
export function stripOrganizerTag(name: string | undefined): string | null {
  if (!name || !ORGANIZER_TAG.test(name)) return null;
  const stripped = name
    .replace(new RegExp(ORGANIZER_TAG.source, "gi"), " ")
    .replace(/^[\s\-|:·–—]+|[\s\-|:·–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

/** A tagged, active member as a match candidate; null for everyone else. */
export function organizerEntry(m: SlackMember): SlackOrganizer | null {
  if (!isActivePerson(m)) return null;
  const real = m.profile?.real_name ?? m.real_name;
  const display = m.profile?.display_name;
  const fromReal = stripOrganizerTag(real);
  const fromDisplay = stripOrganizerTag(display);
  const name = fromReal ?? fromDisplay;
  if (!name) return null;
  // The untagged name, when the tag is only on the other one.
  const plain = [real, display]
    .map((n) => n?.trim())
    .filter((n): n is string => Boolean(n) && !ORGANIZER_TAG.test(n!));
  const otherNames = [
    ...new Set([fromDisplay, ...plain].filter((n): n is string => !!n && n !== name)),
  ];
  return otherNames.length > 0
    ? { id: m.id, name, otherNames }
    : { id: m.id, name };
}

export async function fetchSlackOrganizers(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackOrganizer[]> {
  const members = await fetchSlackMembers(token, fetchImpl);
  return members.flatMap((m) => {
    const entry = organizerEntry(m);
    return entry ? [entry] : [];
  });
}

let cache: { token: string; at: number; users: SlackOrganizer[] } | null =
  null;

/** Tests only. */
export function resetSlackOrganizersCache(): void {
  cache = null;
}

/** The tagged organizers, from the 5-minute cache when fresh. */
export async function getSlackOrganizers(
  token: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
  options: { fresh?: boolean } = {},
): Promise<SlackOrganizer[]> {
  const cached = cache?.token === token ? cache : null;
  if (!options.fresh && cached && now - cached.at < ORGANIZERS_TTL_MS) {
    return cached.users;
  }
  const users = await fetchSlackOrganizers(token, fetchImpl);
  cache = { token, at: now, users };
  return users;
}
