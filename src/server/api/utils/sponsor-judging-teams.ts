import { TRPCError } from "@trpc/server";
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";

import { type TrackValue } from "~/lib/sponsor-track";
import { db } from "~/server/db";
import { applications, teams, users } from "~/server/db/schema";
import {
  SHEET_TAB,
  fetchAllSponsorInfo,
  fetchColumnA,
  findSponsorRows,
  getJudgingSheetId,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";

// Which teams a sponsor may judge, and the write of their picks to the
// judging sheet. Shared by Lucas's sponsorJudging router (listAllTeams,
// setChosenTeams) and the sponsorScoring router, so both apply the same
// privacy rule and the sheet stays the one place his rotation reads.

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

const TRACK_TTL_MS = 60_000;
const trackCache = new Map<
  string,
  { track: TrackValue | null; expires: number }
>();

/**
 * The sponsor's prize track from the "Sponsor Track" column on the sponsor
 * info tab, or null (no track: every submitted team). Cached for a minute
 * per sponsor, since scoring autosaves check it on every write. A sheet
 * failure is an error, never "no filter", so a sponsor never sees teams
 * outside their track.
 */
export async function fetchSponsorTrack(
  sponsorName: string,
): Promise<TrackValue | null> {
  const key = sponsorName.toLowerCase();
  const hit = trackCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.track;
  try {
    const sheets = await getSheetsClient();
    const info = await fetchAllSponsorInfo(sheets, getSpreadsheetId());
    const track = info.get(key)?.track ?? null;
    trackCache.set(key, { track, expires: Date.now() + TRACK_TTL_MS });
    return track;
  } catch (error) {
    console.error("Could not resolve sponsor track:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't load your prize track. Try again in a minute.",
    });
  }
}

/** Test hook: forget cached tracks. */
export function clearSponsorTrackCache() {
  trackCache.clear();
}

/** Submitted (or late) teams, narrowed to the track when there is one. */
function eligibleWhere(track: TrackValue | null) {
  return and(
    inArray(teams.submissionStatus, ["submitted", "late"]),
    ...(track ? [arrayOverlaps(teams.tracks, [track])] : []),
  );
}

/**
 * Every team the sponsor can judge, by name, with member names. Only
 * submitted teams ("submitted" or "late"; drafts have nothing to judge),
 * and only the sponsor's track when they have one.
 */
export async function listEligibleTeams(
  track: TrackValue | null,
): Promise<EligibleTeam[]> {
  const submittedTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      devpostUrl: teams.devpostUrl,
      githubUrl: teams.githubUrl,
      tracks: teams.tracks,
    })
    .from(teams)
    .where(eligibleWhere(track))
    .orderBy(teams.name);

  if (submittedTeams.length === 0) return [];

  const members = await db
    .select({
      teamId: users.teamId,
      userName: users.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
    })
    .from(users)
    .leftJoin(applications, eq(applications.userId, users.id))
    .where(
      inArray(
        users.teamId,
        submittedTeams.map((team) => team.id),
      ),
    );

  const membersByTeam = new Map<string, string[]>();
  for (const member of members) {
    if (!member.teamId) continue;
    // The application's first/last name is what the hacker typed; fall
    // back to the auth display name when the application name is blank.
    const applicationName = [member.firstName, member.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .map((part) => part.trim())
      .join(" ");
    const fullName =
      applicationName.length > 0
        ? applicationName
        : (member.userName?.trim() ?? "");
    if (!fullName) continue;
    const names = membersByTeam.get(member.teamId) ?? [];
    names.push(fullName);
    membersByTeam.set(member.teamId, names);
  }

  return submittedTeams.map((team) => ({
    id: team.id,
    name: team.name,
    devpostUrl: normalizeSubmissionUrl(team.devpostUrl),
    githubUrl: normalizeSubmissionUrl(team.githubUrl),
    tracks: team.tracks ?? [],
    members: (membersByTeam.get(team.id) ?? []).sort((a, b) =>
      a.localeCompare(b),
    ),
  }));
}

/** Which of `ids` the sponsor can judge (same rule as listEligibleTeams). */
export async function eligibleTeamIds(
  track: TrackValue | null,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eligibleWhere(track), inArray(teams.id, [...ids])));
  return new Set(rows.map((r) => r.id));
}

/**
 * Write a sponsor's picks to column B of the judging sheet (Lucas's
 * setChosenTeams). Overwrites the sponsor's row, or appends one if they
 * aren't in the sheet yet. An empty list clears the picks.
 */
export async function writeChosenTeams(
  sponsorName: string,
  teamIds: readonly string[],
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const columnA = await fetchColumnA(sheets, spreadsheetId);
  const [existingRow] = findSponsorRows(columnA, sponsorName);

  const cellValue = teamIds.join(", ");

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_TAB}!B${existingRow}`,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [[cellValue]],
      },
    });
    return;
  }

  // No row yet. The append below races with any other first write for
  // the same sponsor: both can see "no row" and both append, leaving a
  // duplicate row that would silently shadow picks. Re-read column A
  // afterwards and collapse any extra rows onto the first one.
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB}!A:B`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      majorDimension: "ROWS",
      values: [[sponsorName, cellValue]],
    },
  });

  const rowsAfterAppend = findSponsorRows(
    await fetchColumnA(sheets, spreadsheetId),
    sponsorName,
  );
  const [canonicalRow, ...duplicates] = rowsAfterAppend;
  if (canonicalRow && duplicates.length > 0) {
    const sheetId = await getJudgingSheetId(sheets, spreadsheetId);
    // Delete highest row numbers first so earlier indices stay valid.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [...duplicates]
          .sort((a, b) => b - a)
          .map((rowNumber) => ({
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          })),
      },
    });
    // The surviving row may hold the other writer's picks; assert ours.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_TAB}!B${canonicalRow}`,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [[cellValue]],
      },
    });
  }
}
