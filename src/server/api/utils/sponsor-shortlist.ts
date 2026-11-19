import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { admittedStatuses } from "~/lib/admission";
import { COFFEE_CHAT_SHORTLIST_SIZE } from "~/lib/coffee-chat-requests";
import {
  fetchRankedInterestRows,
  INTERESTED_HACKER_LIMIT,
  type RankedInterestRow,
} from "~/server/api/utils/hacker-interest";
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
 * for the sponsor they ranked. The user id is returned so the sponsor can
 * shortlist them (T45); it is the same id the /live QR code shows any
 * sponsor who scans it. No email or other contact detail is returned.
 */
export type ShortlistedHacker = {
  /** Internal user id, used to add or remove the hacker from the shortlist. */
  userId: string;
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
  {
    now = Date.now(),
    limit = COFFEE_CHAT_SHORTLIST_SIZE,
    userIds,
  }: {
    now?: number;
    /** null for no cap. */
    limit?: number | null;
    /** Only these hackers (still subject to every rule above). */
    userIds?: readonly string[];
  } = {},
): Promise<ShortlistedHacker[]> {
  if (userIds?.length === 0) return [];
  const query = db
    .select({
      userId: users.id,
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
        userIds ? inArray(users.id, [...userIds]) : undefined,
      ),
    )
    .orderBy(
      asc(sponsorInterests.rank),
      asc(sponsorInterests.updatedAt),
      asc(users.id),
    );
  const rows = await (limit === null ? query : query.limit(limit));

  return rows.map((r) => ({
    userId: r.userId,
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

/**
 * A hacker on the sponsor's candidate list (the hackers they can shortlist
 * for coffee chats). Full name, team and profile links only when the hacker
 * agreed to share with sponsors; otherwise the first name alone. The
 * interest form's resume and extra link show either way: hackers submitted
 * those on a form meant for sponsors. Never an email or phone number.
 */
export type SponsorCandidate = {
  /** Internal user id, used to shortlist the hacker and offer a chat. */
  userId: string;
  /** Public badge id; only when shared. */
  hackerId: string | null;
  /** Place on the sponsor's list, 1 = best. */
  rank: number;
  /** Where the hacker put this sponsor in their own ranking, if known. */
  pick: number | null;
  name: string;
  shared: boolean;
  team: string | null;
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
  extraLink: string | null;
  /** From the application, only when shared (null otherwise). */
  school?: string | null;
  program?: string | null;
  /** "1st" … "5th+" year of study. */
  year?: string | null;
};

export const NO_STUDY = { school: null, program: null, year: null };

/** School, program and year from an application row (blank answers dropped). */
export function studyFields(r: {
  school: string | null;
  schoolOther: string | null;
  major: string | null;
  yearOfStudy: string | null;
}): { school: string | null; program: string | null; year: string | null } {
  const school = r.school?.trim() === "Other" ? r.schoolOther?.trim() : r.school?.trim();
  const year = r.yearOfStudy && /^\d/.test(r.yearOfStudy) ? r.yearOfStudy : null;
  return { school: school ? school : null, program: r.major ?? null, year };
}

/** Study fields for hackers who agreed to share with sponsors. */
async function studyByUser(userIds: readonly string[]) {
  if (userIds.length === 0) return new Map<string, ReturnType<typeof studyFields>>();
  const rows = await db
    .select({
      userId: applications.userId,
      school: applications.school,
      schoolOther: applications.schoolOther,
      major: applications.major,
      yearOfStudy: applications.yearOfStudy,
    })
    .from(applications)
    .where(
      and(
        inArray(applications.userId, [...userIds]),
        eq(applications.agreeShareWithSponsors, true),
      ),
    );
  return new Map(rows.map((r) => [r.userId, studyFields(r)]));
}

/** Adds school, program and year to shared candidates. */
async function withStudy(hackers: SponsorCandidate[]): Promise<SponsorCandidate[]> {
  const study = await studyByUser(hackers.filter((h) => h.shared).map((h) => h.userId));
  return hackers.map((h) => ({ ...h, ...(h.shared ? (study.get(h.userId) ?? NO_STUDY) : NO_STUDY) }));
}

/**
 * Where the candidate list came from: the interest form ranking, or the
 * in-app ranking on /live when the form isn't set up or can't be read.
 */
export type CandidateSource = "interestForm" | "inAppRanking";

/** What we know about a form respondent's account, keyed by email. */
export type CandidateProfile = {
  userId: string;
  /** Lowercased and trimmed. */
  email: string;
  hackerId: string | null;
  firstName: string | null;
  lastName: string | null;
  accountName: string | null;
  share: boolean | null;
  team: string | null;
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
};

function firstNameOf(profile: CandidateProfile, formName: string) {
  return (
    [profile.firstName, formName, profile.accountName]
      .map((name) => name?.trim().split(/\s+/)[0] ?? "")
      .find((name) => name.length > 0) ?? ""
  );
}

/**
 * Turn the (uncapped) interest form ranking into candidates: match each
 * row's email to an admitted hacker's profile (anyone else is dropped),
 * keep the ranking's order, number them 1..n, then cap at `limit`. Each
 * profile is trimmed to what the hacker agreed to share. Pure, so the
 * privacy rules are easy to test. `profiles` must hold admitted hackers
 * only (profilesByEmail).
 */
export function candidatesFromInterestForm(
  ranked: readonly RankedInterestRow[],
  profiles: readonly CandidateProfile[],
  limit = INTERESTED_HACKER_LIMIT,
): SponsorCandidate[] {
  const byEmail = new Map<string, CandidateProfile>();
  for (const profile of profiles) {
    const email = profile.email.trim().toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, profile);
  }

  const matched = ranked.flatMap((row) => {
    const profile = byEmail.get(row.email.trim().toLowerCase());
    return profile ? [{ row, profile }] : [];
  });
  return matched.slice(0, limit).map(({ row, profile }, index) => {
    const formResume = safeProfileUrl(row.resumeUrl);
    const extraLink = safeProfileUrl(row.extraLink);
    const base = { userId: profile.userId, rank: index + 1, pick: row.pick };
    if (profile.share !== true) {
      return {
        ...base,
        hackerId: null,
        name: firstNameOf(profile, row.name),
        shared: false,
        team: null,
        resume: formResume,
        github: null,
        linkedIn: null,
        devpost: null,
        extraLink,
      };
    }
    return {
      ...base,
      hackerId: profile.hackerId,
      name:
        displayName(profile.firstName, profile.lastName, null) ||
        row.name.trim() ||
        (profile.accountName?.trim() ?? ""),
      shared: true,
      team: profile.team,
      resume: formResume ?? safeProfileUrl(profile.resume),
      github: safeProfileUrl(profile.github),
      linkedIn: safeProfileUrl(profile.linkedIn),
      devpost: safeProfileUrl(profile.devpost),
      extraLink,
    };
  });
}

/**
 * Admitted hackers' accounts (and application profile) for these lowercased
 * emails. Anyone not admitted is left out.
 */
async function profilesByEmail(
  emails: readonly string[],
  now: number,
): Promise<CandidateProfile[]> {
  if (emails.length === 0) return [];
  const email = sql<string>`lower(trim(${users.email}))`;
  return db
    .select({
      userId: users.id,
      email,
      hackerId: users.hackerId,
      firstName: applications.firstName,
      lastName: applications.lastName,
      accountName: users.name,
      share: applications.agreeShareWithSponsors,
      team: teams.name,
      resume: applications.resumeLink,
      github: applications.githubLink,
      linkedIn: applications.linkedInLink,
      devpost: applications.devpostLink,
    })
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(
      and(
        inArray(email, [...emails]),
        inArray(applications.status, [...admittedStatuses(now)]),
      ),
    )
    .orderBy(asc(users.id));
}

// The form ranking reads a Google Sheet and every completed review, so keep
// it for a minute per sponsor: the page polls, and each shortlist add checks
// the list. Profiles (and consent) are always read fresh.
const RANKING_TTL_MS = 60_000;
const rankingCache = new Map<
  string,
  { at: number; rows: Promise<RankedInterestRow[]> }
>();

function cachedRanking(sponsorName: string) {
  const now = Date.now();
  const hit = rankingCache.get(sponsorName);
  if (hit && now - hit.at < RANKING_TTL_MS) return hit.rows;
  // Uncapped: the 40 are cut after matching admitted accounts.
  const rows = fetchRankedInterestRows(sponsorName, { limit: null });
  rankingCache.set(sponsorName, { at: now, rows });
  // Don't keep a failure around: the next call tries again.
  rows.catch(() => {
    if (rankingCache.get(sponsorName)?.rows === rows) {
      rankingCache.delete(sponsorName);
    }
  });
  return rows;
}

/**
 * The sponsor's candidates, best first, at most INTERESTED_HACKER_LIMIT:
 * the interest form ranking when it's set up and readable, otherwise the
 * in-app ranking (sponsorShortlist above).
 */
export async function sponsorCandidates(
  sponsor: { id: string; name: string },
  { now = Date.now() }: { now?: number } = {},
): Promise<{ source: CandidateSource; hackers: SponsorCandidate[] }> {
  let ranked: RankedInterestRow[] | null = null;
  try {
    ranked = await cachedRanking(sponsor.name);
  } catch (error) {
    console.warn(
      `Interest form unavailable for ${sponsor.name}; using in-app ranking:`,
      error instanceof Error ? error.message : error,
    );
  }

  if (ranked) {
    const profiles = await profilesByEmail(
      ranked.map((row) => row.email.trim().toLowerCase()),
      now,
    );
    return {
      source: "interestForm",
      hackers: await withStudy(candidatesFromInterestForm(ranked, profiles)),
    };
  }

  const fallback = await sponsorShortlist(sponsor.id, {
    now,
    limit: INTERESTED_HACKER_LIMIT,
  });
  return {
    source: "inAppRanking",
    hackers: await withStudy(fallback.map((h, index) => ({
      userId: h.userId,
      hackerId: h.hackerId,
      rank: index + 1,
      pick: h.rank,
      name: h.name,
      shared: true,
      team: h.team,
      resume: h.resume,
      github: h.github,
      linkedIn: h.linkedIn,
      devpost: h.devpost,
      extraLink: null,
    }))),
  };
}
