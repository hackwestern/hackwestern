import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  generateVisits,
  getJudgeVisits,
  getProgress,
  getSetup,
  getTeamJudging,
  publishPlan,
  reassignVisit,
  saveLayout,
  saveRoundSettings,
  seatTeams,
  setAssignmentAbsent,
  setTableActive,
  submitVisitMark,
} from "~/server/judging/plan";
import {
  getSponsorSchedule,
  schedulePitches,
  sendRoomMessages,
  setShortlist,
  upsertSponsorRoom,
} from "~/server/judging/sponsor";
import {
  reassignVisitSchema,
  saveLayoutSchema,
  saveRoundSettingsSchema,
  schedulePitchesSchema,
  setAssignmentAbsentSchema,
  setShortlistSchema,
  setTableActiveSchema,
  submitVisitMarkSchema,
  upsertSponsorRoomSchema,
} from "~/schemas/judging-plan";
import { requireCallerTeamId } from "./judging";

/** Mirrors the helper in `judging.ts`: business-rule errors pass through. */
const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${errorMessage}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    });
  }
};

/**
 * The judging plan: venue, seating, judge visits and sponsor pitches.
 * `admin` is what the organizer portal calls; `me` and `team` are the judge's
 * and the hacker's read views of the published plan.
 */
export const judgingPlanRouter = createTRPCRouter({
  admin: createTRPCRouter({
    getSetup: protectedOrganizerProcedure.query(() => getSetup()),

    saveLayout: protectedOrganizerProcedure
      .input(saveLayoutSchema)
      .mutation(({ input }) =>
        withErrorHandling(() => saveLayout(input), "Failed to save layout"),
      ),

    setTableActive: protectedOrganizerProcedure
      .input(setTableActiveSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => setTableActive(input.tableId, input.isActive),
          "Failed to update table",
        ),
      ),

    saveRoundSettings: protectedOrganizerProcedure
      .input(saveRoundSettingsSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => saveRoundSettings(input),
          "Failed to save round settings",
        ),
      ),

    seatTeams: protectedOrganizerProcedure.mutation(() =>
      withErrorHandling(() => seatTeams(), "Failed to seat teams"),
    ),

    generate: protectedOrganizerProcedure.mutation(() =>
      withErrorHandling(() => generateVisits(), "Failed to generate visits"),
    ),

    reshuffle: protectedOrganizerProcedure.mutation(() =>
      withErrorHandling(
        () => generateVisits({ reshuffle: true }),
        "Failed to reshuffle visits",
      ),
    ),

    publish: protectedOrganizerProcedure.mutation(() =>
      withErrorHandling(() => publishPlan(), "Failed to publish"),
    ),

    setAbsent: protectedOrganizerProcedure
      .input(setAssignmentAbsentSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => setAssignmentAbsent(input.assignmentId, input.absent),
          "Failed to update visit",
        ),
      ),

    reassign: protectedOrganizerProcedure
      .input(reassignVisitSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => reassignVisit(input.assignmentId, input.judgeId),
          "Failed to reassign visit",
        ),
      ),

    getProgress: protectedOrganizerProcedure.query(() => getProgress()),

    upsertSponsorRoom: protectedOrganizerProcedure
      .input(upsertSponsorRoomSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => upsertSponsorRoom(input),
          "Failed to save sponsor room",
        ),
      ),

    setShortlist: protectedOrganizerProcedure
      .input(setShortlistSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () => setShortlist(input, ctx.session.user.id),
          "Failed to save shortlist",
        ),
      ),

    schedulePitches: protectedOrganizerProcedure
      .input(schedulePitchesSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => schedulePitches(input.startsAt),
          "Failed to schedule pitches",
        ),
      ),

    getSponsorSchedule: protectedOrganizerProcedure.query(() =>
      getSponsorSchedule(),
    ),

    sendRoomMessages: protectedOrganizerProcedure.mutation(() =>
      withErrorHandling(
        () => sendRoomMessages(),
        "Failed to send room messages",
      ),
    ),
  }),

  me: createTRPCRouter({
    getMyVisits: protectedJudgeProcedure.query(({ ctx }) =>
      getJudgeVisits(ctx.judge.id),
    ),

    submitVisitMark: protectedJudgeProcedure
      .input(submitVisitMarkSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () => submitVisitMark(ctx.judge.id, input.assignmentId, input.score),
          "Failed to submit mark",
        ),
      ),
  }),

  team: createTRPCRouter({
    getMyJudging: protectedProcedure.query(async ({ ctx }) =>
      withErrorHandling(async () => {
        const teamId = await requireCallerTeamId(ctx.session.user.id);
        return getTeamJudging(teamId);
      }, "Failed to get judging status"),
    ),
  }),
});
