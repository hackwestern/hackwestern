import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import {
  assignJudgeForTeamSchema,
  deleteTeamMarkSchema,
  editTeamMarkSchema,
  loadQueueSchema,
  submitTeamMarkSchema,
} from "~/schemas/judging";
import {
  deleteMark,
  editMark,
  forceAssign,
  getAllJudges,
  getCurrentHold,
  getRanking,
  getSubmittedMarks,
  loadQueue,
  pickNextTeam,
  purgeQueue,
  skipCurrent,
  submitMark,
} from "~/server/judging/queue";

export const judgingRouter = createTRPCRouter({
  me: createTRPCRouter({
    /** Assign (or re-return) the next team for this judge. */
    getNextTeam: protectedJudgeProcedure.mutation(async ({ ctx }) => {
      const team = await pickNextTeam(
        ctx.session.user.id,
        ctx.judge.type === "sponsored",
        ctx.judge.track,
      );
      return { team: team ?? null };
    }),

    /** This judge's current hold, if any (snapshot read). */
    getCurrentAssignment: protectedJudgeProcedure.query(async ({ ctx }) => {
      const hold = await getCurrentHold(ctx.session.user.id);
      return { currentTeamId: hold?.teamId ?? null };
    }),

    submitTeamMark: protectedJudgeProcedure
      .input(submitTeamMarkSchema)
      .mutation(async ({ ctx, input }) => {
        // Organizer judges score the regular round; sponsored judges score
        // the sponsored round (excluded from regular-round ranking).
        const roundType =
          ctx.judge.type === "sponsored" ? "sponsored" : "regular";
        try {
          await submitMark(
            ctx.session.user.id,
            input.teamId,
            input.score,
            roundType,
          );
        } catch (error) {
          throw new TRPCError({
            code: "CONFLICT",
            message: (error as Error).message,
          });
        }
      }),

    editTeamMark: protectedJudgeProcedure
      .input(editTeamMarkSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          await editMark(ctx.session.user.id, input.teamMarkId, input.score);
        } catch (error) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: (error as Error).message,
          });
        }
      }),

    getSubmittedTeamMarks: protectedJudgeProcedure.query(async ({ ctx }) => {
      return getSubmittedMarks(ctx.session.user.id);
    }),

    skipAssignment: protectedJudgeProcedure.mutation(async ({ ctx }) => {
      try {
        await skipCurrent(ctx.session.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "CONFLICT",
          message: (error as Error).message,
        });
      }
    }),
  }),

  admin: createTRPCRouter({
    loadQueue: protectedOrganizerProcedure
      .input(loadQueueSchema)
      .mutation(async ({ input }) => {
        const added = await loadQueue(input.roundsPerTeam);
        return { added };
      }),

    purgeQueue: protectedOrganizerProcedure.mutation(async () => {
      await purgeQueue();
    }),

    assignJudgeForTeam: protectedOrganizerProcedure
      .input(assignJudgeForTeamSchema)
      .mutation(async ({ input }) => {
        try {
          await forceAssign(input.judgeId, input.teamId);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: (error as Error).message,
          });
        }
      }),

    getLatestRanking: protectedOrganizerProcedure.query(async () => {
      return getRanking();
    }),

    getAllJudges: protectedOrganizerProcedure.query(async () => {
      return getAllJudges();
    }),

    deleteTeamMark: protectedOrganizerProcedure
      .input(deleteTeamMarkSchema)
      .mutation(async ({ input }) => {
        try {
          await deleteMark(input.teamMarkId);
        } catch (error) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: (error as Error).message,
          });
        }
      }),
  }),
});
