import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { hasPrizeTrack } from "~/lib/sponsor-prize-tracks";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { resolveSponsorName } from "~/server/api/utils/sponsor-sheets";
import {
  fetchSponsorTrack,
  listEligibleTeams,
} from "~/server/api/utils/sponsor-judging-teams";
import { db } from "~/server/db";
import { sponsorFinalPicks } from "~/server/db/schema";

// Picks live in the database (sponsor_final_pick), written only by
// sponsorScoring.submit / submitDigital, which validate them first and then
// mirror them to the Sponsor Judging tab (behind sheetWritesEnabled). The
// old "Judging" tab was deleted on 2026-11-19; nothing here touches a sheet
// except the track read in listAllTeams.
export const sponsorJudgingRouter = createTRPCRouter({
  /**
   * The team ids a sponsor has submitted (their ranked top 3, best first),
   * from the database. Public, keyed by the sponsor's private UUID. Empty
   * when they haven't submitted yet.
   */
  getChosenTeams: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      const sponsorName = await resolveSponsorName(input.sponsor);
      // Only prize track sponsors judge (same gate as listAllTeams).
      if (!hasPrizeTrack(sponsorName)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: sponsorJudgingCopy.errors.noPrizeTrack,
        });
      }
      const final = await db.query.sponsorFinalPicks.findFirst({
        where: eq(sponsorFinalPicks.sponsorId, input.sponsor.toLowerCase()),
        columns: { teamIds: true },
      });
      return { sponsorName, teamIds: final?.teamIds ?? [] };
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
   * Sponsors without a prize track are refused (FORBIDDEN).
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
      // Only prize track sponsors judge (src/content/sponsor-prize-tracks.ts).
      if (!hasPrizeTrack(sponsorName)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: sponsorJudgingCopy.errors.noPrizeTrack,
        });
      }

      // A sheet failure is an error, never "no filter" (see fetchSponsorTrack).
      const sponsorTrack = await fetchSponsorTrack(sponsorName);
      const teams = await listEligibleTeams(sponsorTrack);
      return { sponsorName, sponsorTrack, teams };
    }),
});
