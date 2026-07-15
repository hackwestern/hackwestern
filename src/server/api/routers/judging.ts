import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { teams, teamMarks } from "~/server/db/schema";
import { computeNormalizedTeamScores, type RawMark } from "~/lib/scoring";

const roundTypeSchema = z.enum(["regular", "sponsored"]);
const trackSchema = z.enum([
  "Best Use of Cohere",
  "Best Use of AntiGravity",
  "Best Domain",
  "General",
]);

export const judgingRouter = createTRPCRouter({
  /**
   * Ranked judging leaderboard.
   *
   * Scores are normalized per judge (z-score) and mapped back onto the global
   * distribution so that a lenient/harsh judge, or a judge who happens to draw
   * strong/weak teams, no longer skews the teams they scored. See
   * `~/lib/scoring.ts` for the algorithm and rationale.
   *
   * Normalization is computed within a single round type (regular vs sponsored
   * are separate scales/judge pools). An optional track filter is applied
   * *after* normalization so the global distribution stays intact.
   */
  getLeaderboard: protectedOrganizerProcedure
    .input(
      z
        .object({
          roundType: roundTypeSchema.default("regular"),
          track: trackSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        const roundType = input?.roundType ?? "regular";

        // Pull every raw mark for this round; normalization needs the full set
        // to compute the global and per-judge distributions.
        const marks = await db
          .select({
            teamId: teamMarks.teamId,
            judgeId: teamMarks.judgeId,
            score: teamMarks.score,
          })
          .from(teamMarks)
          .where(eq(teamMarks.roundType, roundType));

        const scores = computeNormalizedTeamScores(marks as RawMark[]);
        const trackFilter = input?.track;

        // Attach team metadata (name, tracks) for display.
        const teamRows = await db
          .select({
            id: teams.id,
            name: teams.name,
            tracks: teams.tracks,
          })
          .from(teams);
        const teamById = new Map(teamRows.map((t) => [t.id, t]));

        const leaderboard = scores
          .map((s) => {
            const team = teamById.get(s.teamId);
            return {
              teamId: s.teamId,
              teamName: team?.name ?? null,
              tracks: team?.tracks ?? null,
              normalizedScore: s.normalizedScore,
              rawScore: s.rawScore,
              markCount: s.markCount,
            };
          })
          // Apply the optional track filter after normalization.
          .filter((row) =>
            trackFilter ? (row.tracks?.includes(trackFilter) ?? false) : true,
          );

        // Add 1-based ranks over the (already sorted) filtered list.
        return leaderboard.map((row, index) => ({
          rank: index + 1,
          ...row,
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute leaderboard: " + JSON.stringify(error),
        });
      }
    }),
});
