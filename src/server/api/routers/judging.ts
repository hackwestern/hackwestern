import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db, extractRows } from "~/server/db";
import { judgingAssignments, judges, users } from "~/server/db/schema";
import { maybeTriggerSweepOnJudgingComplete } from "~/server/api/utils/cheat-check-sweep";
import {
  type AddJudgeInput,
  addJudgeByEmailSchema,
  addJudgeToSeatSchema,
  addJudgesSchema,
  assignmentIdSchema,
  deleteTeamMarkSchema,
  editTeamMarkSchema,
  handOffJudgeSchema,
  moveTeamSchema,
  reportAbsentSchema,
  seatTeamsSchema,
  setSeatActiveSchema,
  setupTablesSchema,
  startStopSchema,
  submitStopSchema,
  swapTeamsSchema,
} from "~/schemas/judging";
import {
  addJudgeToSeat,
  autoAssign,
  cancelStop,
  deleteMark,
  editMark,
  handOffJudge,
  markAbsent,
  startStop,
  submitStop,
} from "~/server/judging/assignments";
import {
  getAllJudges,
  getMyStops,
  getProgress,
  getSubmittedMarks,
  getTeamJudging,
} from "~/server/judging/reads";
import { loadTeamResults } from "~/server/api/utils/team-results-data";
import { getDevpostPreview } from "~/server/judging/devpost-preview";
import {
  moveTeam,
  seatTeams,
  setSeatActive,
  setupTables,
  swapTeams,
} from "~/server/judging/room";

/**
 * Wrap a procedure body so any unexpected error becomes a clean
 * INTERNAL_SERVER_ERROR, while business-rule `TRPCError`s thrown by the
 * engine (CONFLICT, NOT_FOUND, ...) pass through with their original code.
 * Mirrors the helper in `scavenger-hunt.ts`.
 */
const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${errorMessage}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    });
  }
};

/**
 * Normalized ranking (regular round only, sponsored judges excluded). For
 * each team: the average z-score of its marks — each mark recentered by its
 * judge's mean and divided by that judge's standard deviation, so a harsh
 * judge and a generous judge contribute on the same scale. Read-only.
 */
async function getRanking() {
  const result = await db.execute<{
    team_id: string;
    team_name: string;
    normalized_score: number;
    num_marks: number;
  }>(sql`
    WITH absent_teams AS (
      -- Absence is final: a team whose seat has a team_absent stop is out,
      -- and its marks don't shift its judges' averages either.
      SELECT t.id
      FROM team t
      JOIN judging_assignment a ON a.judging_seat_id = t.judging_seat_id
      WHERE a.status = 'team_absent'
    ),
    judge_stats AS (
      SELECT
        m.judge_id,
        AVG(m.score) AS mu,
        STDDEV_POP(m.score) AS sigma
      FROM team_mark m
      JOIN "judge" j ON j.id = m.judge_id
      WHERE m.round_type = 'regular' AND j.type = 'organizer'
        AND m.team_id NOT IN (SELECT id FROM absent_teams)
      GROUP BY m.judge_id
    )
    SELECT
      m.team_id,
      t.name AS team_name,
      AVG((m.score - js.mu) / NULLIF(js.sigma, 0)) AS normalized_score,
      COUNT(*) AS num_marks
    FROM team_mark m
    JOIN judge_stats js ON js.judge_id = m.judge_id
    JOIN team t ON t.id = m.team_id
    WHERE m.round_type = 'regular'
      AND m.team_id NOT IN (SELECT id FROM absent_teams)
    GROUP BY m.team_id, t.name
    ORDER BY normalized_score DESC NULLS LAST
  `);
  return extractRows<{
    team_id: string;
    team_name: string;
    normalized_score: number;
    num_marks: number;
  }>(result);
}

/**
 * === TRANSACTION ===
 * Promote one or more existing users to judges (or update their type/tracks
 * if they already are). The PK is the user id, so this upserts on conflict.
 * Sponsored judges carry the tracks they cover; organizer judges have none.
 * Plain accounts (`hacker`) also become `judge` users; organizers and sponsors
 * keep their type.
 * All-or-nothing: if any user id is unknown, nothing is written.
 */
async function addJudges(
  inputs: AddJudgeInput[],
): Promise<(typeof judges.$inferSelect)[]> {
  return db.transaction(async (tx) => {
    const ids = inputs.map((i) => i.id);
    const found = await tx.query.users.findMany({
      where: inArray(users.id, ids),
      columns: { id: true },
    });
    const existing = new Set(found.map((u) => u.id));
    const missing = [...new Set(ids.filter((id) => !existing.has(id)))];
    if (missing.length > 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `User(s) not found: ${missing.join(", ")}`,
      });
    }

    // A judge with stops keeps judging the general room; switching them to
    // sponsored would quietly drop their scores from the ranking. Hand their
    // stops off first.
    const toSponsored = inputs
      .filter((i) => i.type === "sponsored")
      .map((i) => i.id);
    if (toSponsored.length > 0) {
      const busy = await tx
        .selectDistinct({ id: judgingAssignments.judgeId, name: users.name })
        .from(judgingAssignments)
        .innerJoin(users, eq(users.id, judgingAssignments.judgeId))
        .innerJoin(judges, eq(judges.id, judgingAssignments.judgeId))
        .where(
          and(
            inArray(judgingAssignments.judgeId, toSponsored),
            eq(judges.type, "organizer"),
            ne(judgingAssignments.status, "cancelled"),
          ),
        );
      if (busy.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${busy
            .map((b) => b.name ?? "This judge")
            .join(
              ", ",
            )} still ${busy.length === 1 ? "has" : "have"} judging stops. Hand them off before making them a sponsor judge.`,
        });
      }
    }

    const rows: (typeof judges.$inferSelect)[] = [];
    for (const input of inputs) {
      const track = input.track ?? null;
      const [row] = await tx
        .insert(judges)
        .values({ id: input.id, type: input.type, track })
        .onConflictDoUpdate({
          target: judges.id,
          set: { type: input.type, track },
        })
        .returning();
      rows.push(row!);
    }

    // Judges are their own account type. Only plain accounts are switched:
    // an organizer or sponsor who judges keeps their type (and their pages).
    await tx
      .update(users)
      .set({ type: "judge" })
      .where(
        and(
          inArray(users.id, ids),
          or(eq(users.type, "hacker"), isNull(users.type)),
        ),
      );
    return rows;
  });
}

export const judgingRouter = createTRPCRouter({
  me: createTRPCRouter({
    /**
     * My stops in walking order, with each seat (table number, grid position) and
     * seated team, my score if given, and which stop is next. Also who I am
     * as a judge and whether my account can open the control room.
     */
    getMyStops: protectedJudgeProcedure.query(async ({ ctx }) => {
      return withErrorHandling(async () => {
        const [stops, account] = await Promise.all([
          getMyStops(ctx.session.user.id),
          db.query.users.findFirst({
            where: eq(users.id, ctx.session.user.id),
            columns: { type: true },
          }),
        ]);
        return {
          ...stops,
          judge: { type: ctx.judge.type, track: ctx.judge.track },
          // An organizer-type judge isn't necessarily an organizer account;
          // only accounts can open the control room.
          canManage: account?.type === "organizer",
        };
      }, "Failed to get your stops");
    }),

    startStop: protectedJudgeProcedure
      .input(startStopSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(
          () =>
            startStop(ctx.session.user.id, input.assignmentId, input.teamId),
          "Failed to start this stop",
        );
      }),

    submitStop: protectedJudgeProcedure
      .input(submitStopSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(async () => {
          const result = await submitStop(
            ctx.judge,
            input.assignmentId,
            input.teamId,
            input.score,
            input.breakdown,
          );
          // Awaited on purpose: Vercel freezes the instance once the response
          // flushes. It never throws, so it can't fail the mark.
          await maybeTriggerSweepOnJudgingComplete();
          return result;
        }, "Failed to submit score");
      }),

    reportAbsent: protectedJudgeProcedure
      .input(reportAbsentSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(async () => {
          const row = await markAbsent(
            input.assignmentId,
            ctx.session.user.id,
            input.teamId,
          );
          await maybeTriggerSweepOnJudgingComplete();
          return row;
        }, "Failed to report the team absent");
      }),

    editTeamMark: protectedJudgeProcedure
      .input(editTeamMarkSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(
          () =>
            editMark(
              ctx.session.user.id,
              input.teamMarkId,
              input.score,
              input.breakdown,
            ),
          "Failed to edit team mark",
        );
      }),

    getSubmittedTeamMarks: protectedJudgeProcedure.query(async ({ ctx }) => {
      return withErrorHandling(
        () => getSubmittedMarks(ctx.session.user.id),
        "Failed to get submitted team marks",
      );
    }),
  }),

  team: createTRPCRouter({
    /** My team's seat and how many of its judges have scored us. */
    getMyJudging: protectedProcedure.query(async ({ ctx }) => {
      return withErrorHandling(
        () => getTeamJudging(ctx.session.user.id),
        "Failed to get judging status",
      );
    }),
  }),

  admin: createTRPCRouter({
    /** Layout, every seat (team, status, judges) and every judge's section. */
    getProgress: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(() => getProgress(), "Failed to get progress");
    }),

    setupTables: protectedOrganizerProcedure
      .input(setupTablesSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => setupTables(input),
          "Failed to set up tables",
        );
      }),

    setSeatActive: protectedOrganizerProcedure
      .input(setSeatActiveSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => setSeatActive(input.seatId, input.isActive),
          "Failed to update seat",
        );
      }),

    seatTeams: protectedOrganizerProcedure
      .input(seatTeamsSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => seatTeams(input),
          "Failed to seat teams",
        );
      }),

    autoAssign: protectedOrganizerProcedure.mutation(async ({ ctx }) => {
      return withErrorHandling(
        () => autoAssign(ctx.session.user.id),
        "Failed to assign judges",
      );
    }),

    swapTeams: protectedOrganizerProcedure
      .input(swapTeamsSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => swapTeams(input.teamAId, input.teamBId),
          "Failed to swap teams",
        );
      }),

    moveTeam: protectedOrganizerProcedure
      .input(moveTeamSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => moveTeam(input.teamId, input.seatId),
          "Failed to move team",
        );
      }),

    handOffJudge: protectedOrganizerProcedure
      .input(handOffJudgeSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => handOffJudge(input.fromJudgeId, input.toJudgeId),
          "Failed to hand off stops",
        );
      }),

    addJudgeToSeat: protectedOrganizerProcedure
      .input(addJudgeToSeatSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(
          () =>
            addJudgeToSeat(input.judgeId, input.seatId, ctx.session.user.id),
          "Failed to add judge to seat",
        );
      }),

    cancelStop: protectedOrganizerProcedure
      .input(assignmentIdSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          const row = await cancelStop(input.assignmentId);
          await maybeTriggerSweepOnJudgingComplete();
          return row;
        }, "Failed to cancel stop");
      }),

    markAbsent: protectedOrganizerProcedure
      .input(assignmentIdSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          const row = await markAbsent(input.assignmentId);
          await maybeTriggerSweepOnJudgingComplete();
          return row;
        }, "Failed to mark team absent");
      }),

    getLatestRanking: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(() => getRanking(), "Failed to get ranking");
    }),

    /** Every team with its marks, oldest first, for the per-round view. */
    getTeamResults: protectedOrganizerProcedure.query(() =>
      withErrorHandling(() => loadTeamResults(), "Failed to load results"),
    ),

    getDevpostPreview: protectedOrganizerProcedure
      .input(z.object({ teamId: z.string() }))
      .query(({ input }) => getDevpostPreview(input.teamId)),

    getAllJudges: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(() => getAllJudges(), "Failed to get judges");
    }),

    addJudges: protectedOrganizerProcedure
      .input(addJudgesSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => addJudges(input),
          "Failed to add judges",
        );
      }),

    /** Control-room form: promote (or update) one judge by account email. */
    addJudgeByEmail: protectedOrganizerProcedure
      .input(addJudgeByEmailSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          const user = await db.query.users.findFirst({
            where: sql`lower(${users.email}) = ${input.email}`,
            columns: { id: true, name: true },
          });
          if (!user) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No Hack Western account with that email.",
            });
          }
          const [judge] = await addJudges([
            { id: user.id, type: input.type, track: input.track },
          ]);
          return { ...judge!, name: user.name };
        }, "Failed to add judge");
      }),

    /** Remove a mark; the judge's stop at that seat reopens for a re-score. */
    deleteTeamMark: protectedOrganizerProcedure
      .input(deleteTeamMarkSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => deleteMark(input.teamMarkId),
          "Failed to delete team mark",
        );
      }),
  }),
});
