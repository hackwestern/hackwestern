import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "~/lib/sponsor-picks";
import {
  SHEET_TAB,
  fetchColumnA,
  findSponsorRows,
  getSheetsClient,
  getSpreadsheetId,
  parseTeamIds,
  resolveSponsorName,
} from "~/server/api/utils/sponsor-sheets";
import {
  fetchSponsorTrack,
  listEligibleTeams,
  writeChosenTeams,
} from "~/server/api/utils/sponsor-judging-teams";

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
        // Shared with sponsorScoring.submit (utils/sponsor-judging-teams).
        await writeChosenTeams(sponsorName, input.teamIds);
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

      // A sheet failure is an error, never "no filter" (see fetchSponsorTrack).
      const sponsorTrack = await fetchSponsorTrack(sponsorName);
      const teams = await listEligibleTeams(sponsorTrack);
      return { sponsorName, sponsorTrack, teams };
    }),
});
