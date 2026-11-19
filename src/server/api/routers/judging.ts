import { TRPCError } from "@trpc/server";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  ADVENTUROUS_GENERAL_WEIGHT,
  ADVENTUROUS_ID,
  ADVENTUROUS_RATING_WEIGHT,
} from "~/lib/judging-score";
import { db, extractRows } from "~/server/db";
import { judgingAssignments, judges, users } from "~/server/db/schema";
import { maybeTriggerSweepOnJudgingComplete } from "~/server/api/utils/cheat-check-sweep";
import {
  type AddJudgeInput,
  addJudgeByEmailSchema,
  addJudgeToTableSchema,
  addJudgesSchema,
  assignmentIdSchema,
  deleteTeamMarkSchema,
  editTeamMarkSchema,
  handOffJudgeSchema,
  moveTeamSchema,
  reportAbsentSchema,
  seatTeamsSchema,
  setTableActiveSchema,
  setupTablesSchema,
  startStopSchema,
  submitStopSchema,
  swapTeamsSchema,
} from "~/schemas/judging";
import {
  addJudgeToTable,
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
import {
  moveTeam,
  seatTeams,
  setTableActive,
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
    WITH judge_stats AS (
      SELECT
        m.judge_id,
        AVG(m.score) AS mu,
        STDDEV_POP(m.score) AS sigma
      FROM team_mark m
      JOIN "judge" j ON j.id = m.judge_id
      WHERE m.round_type = 'regular' AND j.type = 'organizer'
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

type AdventurousRow = {
  team_id: string;
  team_name: string;
  normalized_score: number;
  num_marks: number;
};

/**
 * The Adventurous track ranking, normalized the same way as the general one.
 * Each mark's track score is 35% its overall score (the general criteria
 * average) + 65% its Adventurous rating; marks without an Adventurous rating
 * are left out. Regular-round marks from organizer judges only.
 */
async function getAdventurousRanking() {
  const result = await db.execute<AdventurousRow>(sql`
    WITH track AS (
      SELECT
        m.team_id,
        m.judge_id,
        ${ADVENTUROUS_GENERAL_WEIGHT}::double precision * m.score
          + ${ADVENTUROUS_RATING_WEIGHT}::double precision
            * (m.score_breakdown -> 'ratings' ->> ${ADVENTUROUS_ID})::double precision
          AS score
      FROM team_mark m
      JOIN "judge" j ON j.id = m.judge_id
      WHERE m.round_type = 'regular'
        AND j.type = 'organizer'
        AND jsonb_typeof(m.score_breakdown -> 'ratings' -> ${ADVENTUROUS_ID}) = 'number'
    ),
    judge_stats AS (
      SELECT judge_id, AVG(score) AS mu, STDDEV_POP(score) AS sigma
      FROM track
      GROUP BY judge_id
    )
    SELECT
      tr.team_id,
      t.name AS team_name,
      AVG((tr.score - js.mu) / NULLIF(js.sigma, 0)) AS normalized_score,
      COUNT(*) AS num_marks
    FROM track tr
    JOIN judge_stats js ON js.judge_id = tr.judge_id
    JOIN team t ON t.id = tr.team_id
    GROUP BY tr.team_id, t.name
    ORDER BY normalized_score DESC NULLS LAST
  `);
  return extractRows<AdventurousRow>(result);
}

/**
 * === TRANSACTION ===
 * Promote one or more existing users to judges (or update their type/tracks
 * if they already are). The PK is the user id, so this upserts on conflict.
 * Sponsored judges carry the tracks they cover; organizer judges have none.
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

    // A judge with tables keeps judging the general room; switching them to
    // sponsored would quietly drop their scores from the ranking. Hand their
    // tables off first.
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
            )} still ${busy.length === 1 ? "has" : "have"} judging tables. Hand them off before making them a sponsor judge.`,
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
    return rows;
  });
}

export const judgingRouter = createTRPCRouter({
  me: createTRPCRouter({
    /**
     * My stops in walking order, with each table's number, grid position and
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
      }, "Failed to get your tables");
    }),

    startStop: protectedJudgeProcedure
      .input(startStopSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(
          () =>
            startStop(ctx.session.user.id, input.assignmentId, input.teamId),
          "Failed to start this table",
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
    /** My team's table and how many of its judges have scored us. */
    getMyJudging: protectedProcedure.query(async ({ ctx }) => {
      return withErrorHandling(
        () => getTeamJudging(ctx.session.user.id),
        "Failed to get judging status",
      );
    }),
  }),

  admin: createTRPCRouter({
    /** Layout, every table (team, status, judges) and every judge's section. */
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

    setTableActive: protectedOrganizerProcedure
      .input(setTableActiveSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => setTableActive(input.tableId, input.isActive),
          "Failed to update table",
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
          () => moveTeam(input.teamId, input.tableId),
          "Failed to move team",
        );
      }),

    handOffJudge: protectedOrganizerProcedure
      .input(handOffJudgeSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(
          () => handOffJudge(input.fromJudgeId, input.toJudgeId),
          "Failed to hand off tables",
        );
      }),

    addJudgeToTable: protectedOrganizerProcedure
      .input(addJudgeToTableSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(
          () =>
            addJudgeToTable(input.judgeId, input.tableId, ctx.session.user.id),
          "Failed to add judge to table",
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

    getAdventurousRanking: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(
        () => getAdventurousRanking(),
        "Failed to get the Adventurous ranking",
      );
    }),

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

    /** Remove a mark; the judge's stop at that table reopens for a re-score. */
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
