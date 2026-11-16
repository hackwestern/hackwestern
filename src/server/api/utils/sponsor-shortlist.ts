import { and, asc, eq, inArray } from "drizzle-orm";

import { admittedStatuses } from "~/lib/admission";
import { COFFEE_CHAT_SHORTLIST_SIZE } from "~/lib/coffee-chat-requests";
import { db } from "~/server/db";
import {
  applications,
  sponsorInterests,
  teams,
  users,
} from "~/server/db/schema";

/**
 * The hackers a sponsor sees on their "Interested hackers" page (T10): those
 * who ranked the sponsor on /live, best rank first, capped at
 * COFFEE_CHAT_SHORTLIST_SIZE.
 *
 * Privacy: only admitted hackers who agreed to share their profile with
 * sponsors (applications.agreeShareWithSponsors) are ever returned, and only
 * for the sponsor they ranked. The internal user id is never returned.
 */
export type ShortlistedHacker = {
  /** Public, human-readable id printed on the badge (may be unset). */
  hackerId: string | null;
  name: string;
  team: string | null;
  /** Where this sponsor sits in the hacker's own ranking, 1 = top pick. */
  rank: number;
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
};

/** A link a hacker typed, made safe to put in an href: http(s) only. */
export function safeProfileUrl(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Name from the application; the account name if the application has none. */
function displayName(
  first: string | null,
  last: string | null,
  account: string | null,
) {
  const fromApplication = [first, last]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fromApplication) return fromApplication;
  return account?.trim() ?? "";
}

export async function sponsorShortlist(
  sponsorId: string,
  { now = Date.now(), limit = COFFEE_CHAT_SHORTLIST_SIZE } = {},
): Promise<ShortlistedHacker[]> {
  const rows = await db
    .select({
      hackerId: users.hackerId,
      firstName: applications.firstName,
      lastName: applications.lastName,
      accountName: users.name,
      team: teams.name,
      rank: sponsorInterests.rank,
      resume: applications.resumeLink,
      github: applications.githubLink,
      linkedIn: applications.linkedInLink,
      devpost: applications.devpostLink,
    })
    .from(sponsorInterests)
    .innerJoin(users, eq(sponsorInterests.userId, users.id))
    .innerJoin(applications, eq(applications.userId, users.id))
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(
      and(
        eq(sponsorInterests.sponsorId, sponsorId),
        eq(applications.agreeShareWithSponsors, true),
        inArray(applications.status, [...admittedStatuses(now)]),
      ),
    )
    .orderBy(
      asc(sponsorInterests.rank),
      asc(sponsorInterests.updatedAt),
      asc(users.id),
    )
    .limit(limit);

  return rows.map((r) => ({
    hackerId: r.hackerId,
    name: displayName(r.firstName, r.lastName, r.accountName),
    team: r.team,
    rank: r.rank,
    resume: safeProfileUrl(r.resume),
    github: safeProfileUrl(r.github),
    linkedIn: safeProfileUrl(r.linkedIn),
    devpost: safeProfileUrl(r.devpost),
  }));
}
