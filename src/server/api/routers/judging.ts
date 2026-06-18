import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";

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
      throw new Error("You are not currently assigned to this team.");
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
    throw new Error("Mark not found or not yours to edit.");
  }
}

// Does NOT re-add the team to the queue.
async function deleteMark(teamMarkId: number): Promise<void> {
  const deleted = await db
    .delete(teamMarks)
    .where(eq(teamMarks.id, teamMarkId))
    .returning({ id: teamMarks.id });
  if (deleted.length === 0) {
    throw new Error("Mark not found.");
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
      throw new Error("You have no team assigned to skip.");
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
    if (!judge) throw new Error(`Judge ${judgeId} not found.`);

    // Lock the target queue row; refuse if the team isn't queued.
    const lock = await tx.execute(
      sql`SELECT team_id FROM judging_queue WHERE team_id = ${teamId} FOR UPDATE`,
    );
    if (extractRows(lock).length === 0) {
      throw new Error(
        `Team ${teamId} is not in the judging queue — load it first.`,
      );
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
 * === TRANSACTION ===
 * Load every submitted team into the queue with `roundsPerTeam` required
 * rounds. Skips teams already queued. Returns the number of teams added.
 */
async function loadQueue(roundsPerTeam: number): Promise<number> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      INSERT INTO judging_queue (team_id, rounds_remaining, status)
      SELECT t.id, ${roundsPerTeam}, 'waiting'
      FROM team t
      WHERE t.submission_status IN ('submitted', 'late')
      ON CONFLICT (team_id) DO NOTHING
    `);
    // postgres-js exposes `.count`; PGlite exposes `.affectedRows`.
    const r = result as { count?: number; affectedRows?: number };
    return r.count ?? r.affectedRows ?? 0;
  });
}

/** Clear the entire queue (in-progress holds included). Leaves team_mark
 *  data untouched. Single statement. */
async function purgeQueue(): Promise<void> {
  await db.delete(judgingQueue).where(sql`true`);
}

/**
 * Normalized ranking (regular round only, sponsored judges excluded). For
 * each team: average of (each judge's score − that judge's own mean). Read-only.
 */
async function getRanking() {
  const result = await db.execute<{
    team_id: string;
    team_name: string;
    normalized_score: number;
    num_marks: number;
  }>(sql`
    WITH judge_means AS (
      SELECT m.judge_id, AVG(m.score) AS mu
      FROM team_mark m
      JOIN "judge" j ON j.id = m.judge_id
      WHERE m.round_type = 'regular' AND j.type = 'organizer'
      GROUP BY m.judge_id
    )
    SELECT
      m.team_id,
      t.name AS team_name,
      AVG(m.score - jm.mu) AS normalized_score,
      COUNT(*) AS num_marks
    FROM team_mark m
    JOIN judge_means jm ON jm.judge_id = m.judge_id
    JOIN team t ON t.id = m.team_id
    WHERE m.round_type = 'regular'
    GROUP BY m.team_id, t.name
    ORDER BY normalized_score DESC
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
