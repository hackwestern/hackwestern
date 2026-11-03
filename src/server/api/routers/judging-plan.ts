import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { withErrorHandling } from "~/server/api/routers/judging";
import {
  addAssignment,
  cancelAssignment,
  deleteTable,
  getMyAssignments,
  getProgress,
  getSetup,
  getTeamJudging,
  markAbsent,
  reorderAssignments,
  seatTeam,
  setTableActive,
  startAssignment,
  submitAssignmentMark,
  unseatTeam,
  upsertTable,
} from "~/server/judging/pairing";
import {
  addAssignmentSchema,
  assignmentIdSchema,
  deleteTableSchema,
  reorderAssignmentsSchema,
  seatTeamSchema,
  setTableActiveSchema,
  submitAssignmentMarkSchema,
  unseatTeamSchema,
  upsertTableSchema,
} from "~/schemas/judging-plan";

/**
 * Manual judging: physical tables, seating, and organizer-built judge lists.
 * Logic lives in `~/server/judging/pairing`.
 */
export const judgingPlanRouter = createTRPCRouter({
  admin: createTRPCRouter({
    upsertTable: protectedOrganizerProcedure
      .input(upsertTableSchema)
      .mutation(({ input }) =>
        withErrorHandling(() => upsertTable(input), "Failed to save table"),
      ),

    setTableActive: protectedOrganizerProcedure
      .input(setTableActiveSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => setTableActive(input.tableId, input.isActive),
          "Failed to update table",
        ),
      ),

    deleteTable: protectedOrganizerProcedure
      .input(deleteTableSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => deleteTable(input.tableId),
          "Failed to delete table",
        ),
      ),

    seatTeam: protectedOrganizerProcedure
      .input(seatTeamSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => seatTeam(input.teamId, input.tableId),
          "Failed to seat team",
        ),
      ),

    unseatTeam: protectedOrganizerProcedure
      .input(unseatTeamSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => unseatTeam(input.teamId),
          "Failed to unseat team",
        ),
      ),

    addAssignment: protectedOrganizerProcedure
      .input(addAssignmentSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () => addAssignment(input, ctx.session.user.id),
          "Failed to pair judge",
        ),
      ),

    cancelAssignment: protectedOrganizerProcedure
      .input(assignmentIdSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => cancelAssignment(input.assignmentId),
          "Failed to cancel stop",
        ),
      ),

    reorderAssignments: protectedOrganizerProcedure
      .input(reorderAssignmentsSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => reorderAssignments(input.judgeId, input.assignmentIds),
          "Failed to reorder stops",
        ),
      ),

    markAbsent: protectedOrganizerProcedure
      .input(assignmentIdSchema)
      .mutation(({ input }) =>
        withErrorHandling(
          () => markAbsent(input.assignmentId),
          "Failed to mark team absent",
        ),
      ),

    getSetup: protectedOrganizerProcedure.query(() =>
      withErrorHandling(() => getSetup(), "Failed to get table setup"),
    ),

    getProgress: protectedOrganizerProcedure.query(() =>
      withErrorHandling(() => getProgress(), "Failed to get progress"),
    ),
  }),

  me: createTRPCRouter({
    getMyAssignments: protectedJudgeProcedure.query(({ ctx }) =>
      withErrorHandling(
        () => getMyAssignments(ctx.session.user.id),
        "Failed to get your stops",
      ),
    ),

    startAssignment: protectedJudgeProcedure
      .input(assignmentIdSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () => startAssignment(ctx.session.user.id, input.assignmentId),
          "Failed to start stop",
        ),
      ),

    submitMark: protectedJudgeProcedure
      .input(submitAssignmentMarkSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () =>
            submitAssignmentMark(ctx.judge, input.assignmentId, input.score),
          "Failed to submit score",
        ),
      ),

    reportAbsent: protectedJudgeProcedure
      .input(assignmentIdSchema)
      .mutation(({ input, ctx }) =>
        withErrorHandling(
          () => markAbsent(input.assignmentId, ctx.session.user.id),
          "Failed to report team absent",
        ),
      ),
  }),

  team: createTRPCRouter({
    getMyJudging: protectedProcedure.query(({ ctx }) =>
      withErrorHandling(
        () => getTeamJudging(ctx.session.user.id),
        "Failed to get judging status",
      ),
    ),
  }),
});
