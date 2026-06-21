import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedJudgeProcedure,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  judges,
  judgingQueue,
  judgingSkips,
  teamMarks,
  teams,
  users,
} from "~/server/db/schema";
import {
  assignJudgeForTeamSchema,
  deleteTeamMarkSchema,
  editTeamMarkSchema,
  loadQueueSchema,
  submitTeamMarkSchema,
} from "~/schemas/judging";

const STALE_ASSIGNMENT_MINUTES = 15;

type QueueRow = typeof judgingQueue.$inferSelect;

/**
 * Wrap a procedure body so any unexpected error becomes a clean
 * INTERNAL_SERVER_ERROR, while business-rule `TRPCError`s thrown by the
 * helpers (CONFLICT, NOT_FOUND, ...) pass through with their original code.
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

function extractRows<T>(result: unknown): T[] {
  return Array.isArray(result)
    ? (result as T[])
    : ((result as { rows?: T[] }).rows ?? []);
}

async function getCurrentHold(judgeId: string): Promise<QueueRow | undefined> {
  return db.query.judgingQueue.findFirst({
    where: eq(judgingQueue.currentJudgeId, judgeId),
  });
}

/**
 * === TRANSACTION ===
 * Assign the next eligible team to a judge. The whole pick-and-claim runs
 * in one transaction with `FOR UPDATE SKIP LOCKED` on the queue row, so two
 * judges requesting simultaneously can never be handed the same team.
 *
 * Idempotent: if the judge already holds a team, returns it unchanged.
 * Returns the claimed team row, or null if nothing is eligible.
 */
async function pickNextTeam(
  judgeId: string,
  isSponsored: boolean,
  judgeTracks: string[] | null,
): Promise<typeof teams.$inferSelect | null> {
  // A sponsored judge with no tracks can't be matched to anything.
  if (isSponsored && (!judgeTracks || judgeTracks.length === 0)) {
    return null;
  }

  return db.transaction(async (tx) => {
    // Idempotency: already holding a team? Return it.
    const held = await tx.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, judgeId),
    });
    if (held) {
      return (await tx.query.teams.findFirst({
        where: eq(teams.id, held.teamId),
      }))!;
    }

    const trackFilter =
      isSponsored && judgeTracks && judgeTracks.length > 0
        ? sql`AND t.tracks && ARRAY[${sql.join(
            judgeTracks.map((t) => sql`${t}`),
            sql`, `,
          )}]::track[]`
        : sql``;

    // Eligible: still needs judges; either waiting, or assigned-but-stale
    // (abandoned); not already marked or skipped by this judge; track-matched
    // for sponsored judges. Priority: most rounds remaining, then longest
    // waiting.
    const picked = await tx.execute<{ team_id: string }>(sql`
      SELECT q.team_id
      FROM judging_queue q
      JOIN team t ON t.id = q.team_id
      WHERE q.rounds_remaining > 0
        AND (
          q.status = 'waiting'
          OR (q.status = 'assigned' AND q.assigned_at < NOW() - (${STALE_ASSIGNMENT_MINUTES} * INTERVAL '1 minute'))
        )
        AND NOT EXISTS (
          SELECT 1 FROM team_mark m WHERE m.team_id = q.team_id AND m.judge_id = ${judgeId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM judging_skip s WHERE s.team_id = q.team_id AND s.judge_id = ${judgeId}
        )
        ${trackFilter}
      ORDER BY q.rounds_remaining DESC, q.enqueued_at ASC
      LIMIT 1
      FOR UPDATE OF q SKIP LOCKED
    `);

    const rows = extractRows<{ team_id: string }>(picked);
    const teamId = rows[0]?.team_id;
    if (!teamId) return null;

    await tx
      .update(judgingQueue)
      .set({
        currentJudgeId: judgeId,
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(judgingQueue.teamId, String(teamId)));

    return (await tx.query.teams.findFirst({
      where: eq(teams.id, String(teamId)),
    }))!;
  });
}

/**
 * === TRANSACTION ===
 * Record a judge's score for the team they're holding. Verifies the hold,
 * then inserts the mark — the `trg_team_mark_autoqueue` and
 * `trg_team_mark_stats` triggers do the queue accounting and stat updates.
 * `roundType` is derived from the judge type by the caller.
 */
async function submitMark(
  judgeId: string,
  teamId: string,
  score: number,
  roundType: "regular" | "sponsored",
): Promise<void> {
  return db.transaction(async (tx) => {
    const row = await tx.query.judgingQueue.findFirst({
      where: eq(judgingQueue.teamId, teamId),
    });
    if (!row || row.currentJudgeId !== judgeId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You are not currently assigned to this team.",
      });
    }
    await tx.insert(teamMarks).values({ teamId, judgeId, score, roundType });
  });
}

async function editMark(
  judgeId: string,
  teamMarkId: number,
  score: number,
): Promise<void> {
  const updated = await db
    .update(teamMarks)
    .set({ score })
    .where(and(eq(teamMarks.id, teamMarkId), eq(teamMarks.judgeId, judgeId)))
    .returning({ id: teamMarks.id });
  if (updated.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Mark not found or not yours to edit.",
    });
  }
}

// Does NOT re-add the team to the queue.
async function deleteMark(teamMarkId: number): Promise<void> {
  const deleted = await db
    .delete(teamMarks)
    .where(eq(teamMarks.id, teamMarkId))
    .returning({ id: teamMarks.id });
  if (deleted.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mark not found." });
  }
}

/**
 * === TRANSACTION ===
 * Skip the team the judge is holding (bias/conflict). Records a judging_skip
 * so they're never reassigned it, releases the hold, and returns the team to
 * `waiting` WITHOUT counting it as judged (no round consumed).
 */
async function skipCurrent(judgeId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const held = await tx.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, judgeId),
    });
    if (!held) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You have no team assigned to skip.",
      });
    }
    await tx
      .insert(judgingSkips)
      .values({ teamId: held.teamId, judgeId })
      .onConflictDoNothing();
    await tx
      .update(judgingQueue)
      .set({ currentJudgeId: null, status: "waiting" })
      .where(eq(judgingQueue.teamId, held.teamId));
    return held.teamId;
  });
}

/**
 * === TRANSACTION ===
 * Organizer override: pin a specific team to a specific judge. Releases the
 * judge's previous hold (if any), then claims the target team for them.
 * Requires the team to already be in the queue.
 */
async function forceAssign(judgeId: string, teamId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const judge = await tx.query.judges.findFirst({
      where: eq(judges.id, judgeId),
    });
    if (!judge) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Judge ${judgeId} not found.`,
      });
    }

    // Lock the target queue row; refuse if the team isn't queued.
    const lock = await tx.execute(
      sql`SELECT team_id FROM judging_queue WHERE team_id = ${teamId} FOR UPDATE`,
    );
    if (extractRows(lock).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Team ${teamId} is not in the judging queue — load it first.`,
      });
    }

    // Release this judge's previous hold, if any.
    await tx
      .update(judgingQueue)
      .set({ currentJudgeId: null, status: "waiting" })
      .where(eq(judgingQueue.currentJudgeId, judgeId));

    // Claim the target team for this judge (overrides any other holder).
    await tx
      .update(judgingQueue)
      .set({
        currentJudgeId: judgeId,
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(judgingQueue.teamId, teamId));
  });
}

/**
 * Load every submitted team into the queue with `roundsPerTeam` required
 * rounds. Skips teams already queued (ON CONFLICT DO NOTHING). Returns the
 * number of teams actually added.
 */
async function loadQueue(roundsPerTeam: number): Promise<number> {
  const eligible = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.submissionStatus, ["submitted", "late"]));
  if (eligible.length === 0) return 0;

  // `seenJudges`, `enqueuedAt`, `status`, `currentJudgeId` and `assignedAt`
  // all fall back to their column defaults. Already-queued teams are skipped
  // by ON CONFLICT, and `.returning()` yields only the rows actually inserted.
  const inserted = await db
    .insert(judgingQueue)
    .values(
      eligible.map((t) => ({
        teamId: t.id,
        roundsRemaining: roundsPerTeam,
      })),
    )
    .onConflictDoNothing()
    .returning({ teamId: judgingQueue.teamId });
  return inserted.length;
}

/** Clear the entire queue (in-progress holds included). Leaves team_mark
 *  data untouched. Single statement. */
async function purgeQueue(): Promise<void> {
  await db.delete(judgingQueue).where(sql`true`);
}

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

/** All judges with their user info and the team they're currently holding. */
async function getAllJudges() {
  const [judgeRows, holds] = await Promise.all([
    db
      .select({
        id: judges.id,
        type: judges.type,
        track: judges.track,
        marksCount: judges.marksCount,
        marksSum: judges.marksSum,
        name: users.name,
        email: users.email,
      })
      .from(judges)
      .innerJoin(users, eq(users.id, judges.id)),
    db
      .select({
        teamId: judgingQueue.teamId,
        currentJudgeId: judgingQueue.currentJudgeId,
      })
      .from(judgingQueue),
  ]);

  const holdByJudge = new Map<string, string>();
  for (const h of holds) {
    if (h.currentJudgeId) holdByJudge.set(h.currentJudgeId, h.teamId);
  }
  return judgeRows.map((j) => ({
    ...j,
    currentTeamId: holdByJudge.get(j.id) ?? null,
  }));
}

/** A judge's own submitted marks, most recent first. Read-only. */
async function getSubmittedMarks(judgeId: string) {
  return db.query.teamMarks.findMany({
    where: eq(teamMarks.judgeId, judgeId),
    with: { team: true },
    orderBy: [desc(teamMarks.createdAt)],
  });
}

export const judgingRouter = createTRPCRouter({
  me: createTRPCRouter({
    /** Assign (or re-return) the next team for this judge. */
    getNextTeam: protectedJudgeProcedure.mutation(async ({ ctx }) => {
      return withErrorHandling(async () => {
        const team = await pickNextTeam(
          ctx.session.user.id,
          ctx.judge.type === "sponsored",
          ctx.judge.track,
        );
        if (!team) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "No teams are currently available to judge.",
          });
        }
        return { team };
      }, "Failed to get next team");
    }),

    /** This judge's current hold, if any (snapshot read). */
    getCurrentAssignment: protectedJudgeProcedure.query(async ({ ctx }) => {
      return withErrorHandling(async () => {
        const hold = await getCurrentHold(ctx.session.user.id);
        return { currentTeamId: hold?.teamId ?? null };
      }, "Failed to get current assignment");
    }),

    submitTeamMark: protectedJudgeProcedure
      .input(submitTeamMarkSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(async () => {
          // Organizer judges score the regular round; sponsored judges score
          // the sponsored round (excluded from regular-round ranking).
          const roundType =
            ctx.judge.type === "sponsored" ? "sponsored" : "regular";
          await submitMark(
            ctx.session.user.id,
            input.teamId,
            input.score,
            roundType,
          );
        }, "Failed to submit team mark");
      }),

    editTeamMark: protectedJudgeProcedure
      .input(editTeamMarkSchema)
      .mutation(async ({ ctx, input }) => {
        return withErrorHandling(async () => {
          await editMark(ctx.session.user.id, input.teamMarkId, input.score);
        }, "Failed to edit team mark");
      }),

    getSubmittedTeamMarks: protectedJudgeProcedure.query(async ({ ctx }) => {
      return withErrorHandling(
        () => getSubmittedMarks(ctx.session.user.id),
        "Failed to get submitted team marks",
      );
    }),

    skipAssignment: protectedJudgeProcedure.mutation(async ({ ctx }) => {
      return withErrorHandling(async () => {
        await skipCurrent(ctx.session.user.id);
      }, "Failed to skip assignment");
    }),
  }),

  admin: createTRPCRouter({
    loadQueue: protectedOrganizerProcedure
      .input(loadQueueSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          const added = await loadQueue(input.roundsPerTeam);
          return { added };
        }, "Failed to load queue");
      }),

    purgeQueue: protectedOrganizerProcedure.mutation(async () => {
      return withErrorHandling(async () => {
        await purgeQueue();
      }, "Failed to purge queue");
    }),

    assignJudgeForTeam: protectedOrganizerProcedure
      .input(assignJudgeForTeamSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          await forceAssign(input.judgeId, input.teamId);
        }, "Failed to assign judge for team");
      }),

    getLatestRanking: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(() => getRanking(), "Failed to get ranking");
    }),

    getAllJudges: protectedOrganizerProcedure.query(async () => {
      return withErrorHandling(() => getAllJudges(), "Failed to get judges");
    }),

    deleteTeamMark: protectedOrganizerProcedure
      .input(deleteTeamMarkSchema)
      .mutation(async ({ input }) => {
        return withErrorHandling(async () => {
          await deleteMark(input.teamMarkId);
        }, "Failed to delete team mark");
      }),
  }),
});
