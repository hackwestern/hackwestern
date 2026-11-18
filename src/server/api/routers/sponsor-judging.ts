import { TRPCError } from "@trpc/server";
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { applications, teams, users } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "~/lib/sponsor-picks";
import { type TrackValue } from "~/lib/sponsor-track";
import {
  SHEET_TAB,
  fetchAllSponsorInfo,
  fetchColumnA,
  findSponsorRows,
  getJudgingSheetId,
  getSheetsClient,
  getSpreadsheetId,
  parseTeamIds,
  resolveSponsorName,
} from "~/server/api/utils/sponsor-sheets";

/** Submission link trimmed, or null when blank. */
function normalizeSubmissionUrl(url: string | null): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

export const sponsorJudgingRouter = createTRPCRouter({
  /**
   * Get the team ids a sponsor has selected. Public, keyed by the sponsor's
   * private UUID. The resolved name is matched against column A of the
   * sheet; returns the parsed team id list from column B (empty list if the
   * sponsor has no row or no picks yet).
   */
  getChosenTeams: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [rowNumber] = findSponsorRows(columnA, sponsorName);
        if (!rowNumber) {
          return { sponsorName, teamIds: [] as string[] };
        }

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SHEET_TAB}!B${rowNumber}`,
        });
        const pickedCell = (res.data.values?.[0]?.[0] ?? "") as string;

        return { sponsorName, teamIds: parseTeamIds(pickedCell) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch sponsor's chosen teams",
        });
      }
    }),

  /**
   * Replace a sponsor's chosen teams. Public. Takes only the sponsor UUID
   * (the private URL identifier); the resolved name is what gets written to
   * the sheet. Overwrites column B on the sponsor's existing row, or appends
   * a new row (name + team ids) if the sponsor isn't in the sheet yet. An
   * empty teamIds list clears the sponsor's picks.
   */
  setChosenTeams: publicProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        // Empty list clears the picks; otherwise 5-10 teams, matching the
        // picks page (constants shared via ~/lib/sponsor-picks).
        teamIds: z
          .array(z.string().min(1))
          .max(MAX_SPONSOR_PICKS)
          .refine(
            (teamIds) =>
              teamIds.length === 0 || teamIds.length >= MIN_SPONSOR_PICKS,
            {
              message: `Pick between ${MIN_SPONSOR_PICKS} and ${MAX_SPONSOR_PICKS} teams, or none to clear your picks`,
            },
          ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsorId);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [existingRow] = findSponsorRows(columnA, sponsorName);

        const cellValue = input.teamIds.join(", ");

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
          return { sponsorName, teamIds: input.teamIds };
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

        return { sponsorName, teamIds: input.teamIds };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor's chosen teams",
        });
      }
    }),

  /**
   * List the teams a sponsor can shortlist. Public but gated: the caller
   * must present a registered sponsor UUID (the private link), so the team
   * roster isn't enumerable by anyone. Used by the sponsor picks page.
   *
   * Only submitted teams are returned ("submitted" or "late"; drafts have no
   * devpost/github and aren't judgeable). Each team carries its id, name,
   * submission links, tracks, and member names.
   *
   * Track filtering: the sponsor's track comes from the "Sponsor Track"
   * column on the sponsor info tab. A sponsor with a track set only sees
   * teams in that track (overlap on the teams.tracks array, same filter the
   * judging engine uses); no track set falls back to every submitted team.
   * Sheets being unconfigured also falls back to no filter, matching the
   * pre-track behavior, with a console warning.
   */
  listAllTeams: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      const sponsorName = await resolveSponsorName(input.sponsor);

      let sponsorTrack: TrackValue | null = null;
      try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        const sponsorInfoMap = await fetchAllSponsorInfo(sheets, spreadsheetId);
        sponsorTrack =
          sponsorInfoMap.get(sponsorName.toLowerCase())?.track ?? null;
      } catch (error) {
        console.error("Could not resolve sponsor track:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't load your prize track. Try again in a minute.",
        });
      }

      const submittedTeams = await db
        .select({
          id: teams.id,
          name: teams.name,
          devpostUrl: teams.devpostUrl,
          githubUrl: teams.githubUrl,
          tracks: teams.tracks,
        })
        .from(teams)
        .where(
          and(
            inArray(teams.submissionStatus, ["submitted", "late"]),
            ...(sponsorTrack
              ? [arrayOverlaps(teams.tracks, [sponsorTrack])]
              : []),
          ),
        )
        .orderBy(teams.name);

      if (submittedTeams.length === 0) {
        return { sponsorName, sponsorTrack, teams: [] };
      }

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

      return {
        sponsorName,
        sponsorTrack,
        teams: submittedTeams.map((team) => ({
          id: team.id,
          name: team.name,
          devpostUrl: normalizeSubmissionUrl(team.devpostUrl),
          githubUrl: normalizeSubmissionUrl(team.githubUrl),
          tracks: team.tracks ?? [],
          members: (membersByTeam.get(team.id) ?? []).sort((a, b) =>
            a.localeCompare(b),
          ),
        })),
      };
    }),
});
