import { and, eq, inArray } from "drizzle-orm";

import { prizeTrackOf, sponsorNameKey } from "~/lib/sponsor-prize-tracks";
import { db } from "~/server/db";
import { applications, teams, users } from "~/server/db/schema";

// Which teams a sponsor may judge. Shared by Lucas's sponsorJudging router
// (listAllTeams) and the sponsorScoring router, so both apply the same
// privacy rule. Picks are stored in the database and mirrored to the
// Sponsor Judging tab (sponsor-judging-sheet-mirror.ts); the old "Judging"
// tab and its writer are gone (deleted 2026-11-19).

export type EligibleTeam = {
  id: string;
  name: string;
  devpostUrl: string | null;
  githubUrl: string | null;
  tracks: string[];
  members: string[];
};

/** Submission link trimmed, or null when blank. */
function normalizeSubmissionUrl(url: string | null): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

/** The sponsor name is the track tag. Use the canonical name for known aliases. */
export function sponsorTrackName(sponsorName: string): string {
  return prizeTrackOf(sponsorName) ?? sponsorName;
}

const JUDGEABLE_STATUSES = ["submitted", "late"] as const;

/** Shared by the organizer overview and the sponsor's judging actions. */
export function isEligibleTeam(
  team: { submissionStatus: string | null; tracks: string[] | null },
  track: string,
) {
  const key = sponsorNameKey(track);
  return (
    key.length > 0 &&
    (JUDGEABLE_STATUSES as readonly (string | null)[]).includes(
      team.submissionStatus,
    ) &&
    (team.tracks ?? []).some((tag) => sponsorNameKey(tag) === key)
  );
}

export type TeamMember = {
  userId: string;
  /** Application first + last name, else the account name; may be "". */
  name: string;
  /** The application's GitHub link, for the avatar. */
  github: string | null;
};

/**
 * Every member of `teamIds`, by team, sorted by name. The application's
 * first/last name is what the hacker typed; it falls back to the auth
 * display name when the application name is blank.
 */
export async function membersByTeam(
  teamIds: readonly string[],
): Promise<Map<string, TeamMember[]>> {
  const byTeam = new Map<string, TeamMember[]>();
  if (teamIds.length === 0) return byTeam;
  const rows = await db
    .select({
      userId: users.id,
      teamId: users.teamId,
      userName: users.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
      github: applications.githubLink,
    })
    .from(users)
    .leftJoin(applications, eq(applications.userId, users.id))
    .where(inArray(users.teamId, [...teamIds]));
  for (const row of rows) {
    if (!row.teamId) continue;
    const applicationName = [row.firstName, row.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .map((part) => part.trim())
      .join(" ");
    const list = byTeam.get(row.teamId) ?? [];
    list.push({
      userId: row.userId,
      name: applicationName || (row.userName?.trim() ?? ""),
      github: row.github?.trim() ? row.github.trim() : null,
    });
    byTeam.set(row.teamId, list);
  }
  for (const list of byTeam.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byTeam;
}

/**
 * Every team the sponsor can judge, by name, with member names. Only
 * submitted teams ("submitted" or "late"; drafts have nothing to judge),
 * and only the sponsor's track.
 */
export async function listEligibleTeams(
  track: string,
): Promise<EligibleTeam[]> {
  const submittedTeams = (
    await db
      .select({
        id: teams.id,
        name: teams.name,
        devpostUrl: teams.devpostUrl,
        githubUrl: teams.githubUrl,
        tracks: teams.tracks,
        submissionStatus: teams.submissionStatus,
      })
      .from(teams)
      .where(inArray(teams.submissionStatus, [...JUDGEABLE_STATUSES]))
      .orderBy(teams.name)
  ).filter((team) => isEligibleTeam(team, track));

  if (submittedTeams.length === 0) return [];

  const members = await membersByTeam(submittedTeams.map((team) => team.id));
  return submittedTeams.map((team) => ({
    id: team.id,
    name: team.name,
    devpostUrl: normalizeSubmissionUrl(team.devpostUrl),
    githubUrl: normalizeSubmissionUrl(team.githubUrl),
    tracks: team.tracks ?? [],
    members: (members.get(team.id) ?? [])
      .map((m) => m.name)
      .filter((name) => name.length > 0),
  }));
}

/** Which of `ids` the sponsor can judge (same rule as listEligibleTeams). */
export async function eligibleTeamIds(
  track: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({
      id: teams.id,
      tracks: teams.tracks,
      submissionStatus: teams.submissionStatus,
    })
    .from(teams)
    .where(
      and(
        inArray(teams.submissionStatus, [...JUDGEABLE_STATUSES]),
        inArray(teams.id, [...ids]),
      ),
    );
  return new Set(
    rows.filter((team) => isEligibleTeam(team, track)).map((team) => team.id),
  );
}
