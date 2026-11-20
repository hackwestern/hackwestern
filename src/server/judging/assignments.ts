/**
 * Judge sections and the stop lifecycle: auto-assign, day-of fixes, and the
 * judge's start / submit / absent actions. See docs/judging-engine.md.
 *
 * Every write follows the lock order in shared.ts (settings row, then stops by
 * id, then team rows, then table rows by id).
 */
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";

import { markColumnsFromBreakdown } from "~/lib/judging-criteria";
import { type ScoreBreakdown } from "~/schemas/judging";
import { db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingTables,
  teamMarks,
  teams,
} from "~/server/db/schema";
import { LayoutError, buildSections } from "~/server/judging/layout";
import {
  OPEN_STATUSES,
  type StopStatus,
  type Tx,
  assertGeneralJudge,
  assertNotStarted,
  conflictOnUniqueViolation,
  getSettings,
  isUniqueViolation,
  lockPlanExclusive,
  lockPlanShared,
  lockTables,
  notFound,
} from "~/server/judging/shared";

const INSERT_BATCH = 500;

/**
 * Give every organizer-type judge a section of the snake so each active table
 * gets `judgesPerTable` different judges (see `buildSections`). Judges are
 * taken in the order they were added. Sponsor judges are left out: they judge
 * in their sponsor rooms, and the ranking ignores their marks. Replaces the
 * whole plan, so it's only allowed before judging starts.
 */
export async function autoAssign(assignedBy: string) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    await assertNotStarted("re-run auto-assign", tx);
    const settings = await getSettings(tx);

    const tables = await tx
      .select({ id: judgingTables.id, number: judgingTables.number })
      .from(judgingTables)
      .where(eq(judgingTables.isActive, true))
      .orderBy(asc(judgingTables.number), asc(judgingTables.seat));
    const judgeRows = await tx
      .select({ id: judges.id })
      .from(judges)
      .where(eq(judges.type, "organizer"))
      .orderBy(asc(judges.createdAt), asc(judges.id));

    let sections;
    try {
      sections = buildSections(tables, judgeRows, settings.judgesPerTable);
    } catch (error) {
      if (error instanceof LayoutError) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error.message,
        });
      }
      throw error;
    }

    await tx.delete(judgingAssignments).where(sql`true`);
    const rows = sections.flatMap(({ judge, tables: section }) =>
      section.map((table, i) => ({
        judgeId: judge.id,
        judgingTableId: table.id,
        position: i + 1,
        assignedBy,
      })),
    );
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      await tx
        .insert(judgingAssignments)
        .values(rows.slice(i, i + INSERT_BATCH));
    }

    const sizes = sections.map((s) => s.tables.length);
    return {
      tables: new Set(tables.map((t) => t.number)).size,
      seats: tables.length,
      judges: judgeRows.length,
      judgesPerTable: settings.judgesPerTable,
      stops: rows.length,
      seatsPerJudge: { min: Math.min(...sizes), max: Math.max(...sizes) },
      floaters: sizes.filter((n) => n === 0).length,
    };
  });
}

/** The next free position at the end of a judge's live list. */
async function nextPosition(tx: Tx, judgeId: string) {
  const [last] = await tx
    .select({ value: max(judgingAssignments.position) })
    .from(judgingAssignments)
    .where(
      and(
        eq(judgingAssignments.judgeId, judgeId),
        ne(judgingAssignments.status, "cancelled"),
      ),
    );
  return (last?.value ?? 0) + 1;
}

async function requireJudge(tx: Tx, judgeId: string) {
  const judge = await tx.query.judges.findFirst({
    where: eq(judges.id, judgeId),
    columns: { id: true, type: true },
  });
  if (!judge) throw notFound("Judge");
  return judge;
}

/**
 * A judge who leaves hands every unfinished stop (assigned or in progress) to
 * another organizer-type judge, appended to the end of that judge's list in
 * the same order. Stops the leaving judge finishes concurrently stay theirs.
 */
export async function handOffJudge(fromJudgeId: string, toJudgeId: string) {
  return conflictOnUniqueViolation(
    () =>
      db.transaction(async (tx) => {
        await lockPlanShared(tx);
        await requireJudge(tx, fromJudgeId);
        assertGeneralJudge(await requireJudge(tx, toJudgeId));

        // Lock the leaving judge's open stops in id order (lock order step 2),
        // then read them in walking order.
        const lockedIds = await tx
          .select({ id: judgingAssignments.id })
          .from(judgingAssignments)
          .where(
            and(
              eq(judgingAssignments.judgeId, fromJudgeId),
              inArray(judgingAssignments.status, OPEN_STATUSES),
            ),
          )
          .orderBy(asc(judgingAssignments.id))
          .for("update");
        if (lockedIds.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "That judge has no unfinished tables to hand off.",
          });
        }
        const open = await tx
          .select({
            id: judgingAssignments.id,
            tableId: judgingAssignments.judgingTableId,
            tableNumber: judgingTables.number,
          })
          .from(judgingAssignments)
          .innerJoin(
            judgingTables,
            eq(judgingTables.id, judgingAssignments.judgingTableId),
          )
          .where(
            inArray(
              judgingAssignments.id,
              lockedIds.map((r) => r.id),
            ),
          )
          .orderBy(asc(judgingAssignments.position));
        const tableIds = open.map((s) => s.tableId);

        const clash = await tx
          .select({ number: judgingTables.number })
          .from(judgingAssignments)
          .innerJoin(
            judgingTables,
            eq(judgingTables.id, judgingAssignments.judgingTableId),
          )
          .where(
            and(
              eq(judgingAssignments.judgeId, toJudgeId),
              ne(judgingAssignments.status, "cancelled"),
              inArray(judgingAssignments.judgingTableId, tableIds),
            ),
          );
        if (clash.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `That judge already has table${clash.length === 1 ? "" : "s"} ${clash
              .map((c) => c.number)
              .sort((x, y) => x - y)
              .join(", ")}. Pick someone else, like a floater.`,
          });
        }

        // The new judge mustn't have scored any team seated at these tables.
        const scored = await tx
          .select({ name: teams.name })
          .from(teamMarks)
          .innerJoin(teams, eq(teams.id, teamMarks.teamId))
          .where(
            and(
              eq(teamMarks.judgeId, toJudgeId),
              inArray(teams.judgingTableId, tableIds),
            ),
          );
        if (scored.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `That judge has already scored ${scored
              .map((t) => `"${t.name}"`)
              .join(", ")}. Pick someone else.`,
          });
        }

        // Lock order step 4: take the tables in id order before the status
        // trigger does, so two hand-offs can't lock them in opposite orders.
        await lockTables(tx, tableIds);

        let position = await nextPosition(tx, toJudgeId);
        const moved: number[] = [];
        for (const stop of open) {
          // Re-check ownership and status in the UPDATE itself, so a stop
          // that changed after the read is never pulled back to `assigned`.
          const [row] = await tx
            .update(judgingAssignments)
            .set({
              judgeId: toJudgeId,
              position,
              status: "assigned",
              startedAt: null,
            })
            .where(
              and(
                eq(judgingAssignments.id, stop.id),
                eq(judgingAssignments.judgeId, fromJudgeId),
                inArray(judgingAssignments.status, OPEN_STATUSES),
              ),
            )
            .returning({ id: judgingAssignments.id });
          if (row) {
            moved.push(stop.tableNumber);
            position++;
          }
        }
        return { moved: moved.length, tables: moved };
      }),
    "Those tables just changed. Refresh and try again.",
  );
}

/** Organizer top-up: add one table to the end of an organizer judge's list. */
export async function addJudgeToTable(
  judgeId: string,
  tableId: number,
  assignedBy: string,
) {
  return conflictOnUniqueViolation(
    () =>
      db.transaction(async (tx) => {
        await lockPlanShared(tx);
        assertGeneralJudge(await requireJudge(tx, judgeId));
        // Take the table lock up front (the insert's status trigger needs it
        // anyway), so two top-ups at one table, or a top-up racing a hand-off,
        // queue up instead of deadlocking.
        await lockTables(tx, [tableId]);
        const table = await tx.query.judgingTables.findFirst({
          where: eq(judgingTables.id, tableId),
        });
        if (!table) throw notFound("Table");
        if (!table.isActive) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Table ${table.number} is switched off.`,
          });
        }
        const absent = await tx.query.judgingAssignments.findFirst({
          where: and(
            eq(judgingAssignments.judgingTableId, tableId),
            eq(judgingAssignments.status, "team_absent"),
          ),
          columns: { id: true },
        });
        if (absent) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The team at table ${table.number} was reported absent, so it can't be judged.`,
          });
        }
        const existing = await tx.query.judgingAssignments.findFirst({
          where: and(
            eq(judgingAssignments.judgeId, judgeId),
            eq(judgingAssignments.judgingTableId, tableId),
            ne(judgingAssignments.status, "cancelled"),
          ),
          columns: { id: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `That judge already has table ${table.number}.`,
          });
        }
        const seated = await tx.query.teams.findFirst({
          where: eq(teams.judgingTableId, tableId),
          columns: { id: true, name: true },
        });
        if (seated) {
          const scored = await tx.query.teamMarks.findFirst({
            where: and(
              eq(teamMarks.judgeId, judgeId),
              eq(teamMarks.teamId, seated.id),
            ),
            columns: { id: true },
          });
          if (scored) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `That judge has already scored "${seated.name}".`,
            });
          }
        }

        const [row] = await tx
          .insert(judgingAssignments)
          .values({
            judgeId,
            judgingTableId: tableId,
            position: await nextPosition(tx, judgeId),
            assignedBy,
          })
          .returning();
        return { ...row!, tableNumber: table.number };
      }),
    "That judge's list just changed. Refresh and try again.",
  );
}

/**
 * Move a stop to a new status, but only from one of `from`. The status check
 * is part of the UPDATE, so two racing requests can't both win. With
 * `judgeId`, the stop must also belong to that judge.
 */
async function transition(
  tx: Tx,
  assignmentId: number,
  from: StopStatus[],
  set: Partial<typeof judgingAssignments.$inferInsert>,
  judgeId?: string,
) {
  const owned = and(
    eq(judgingAssignments.id, assignmentId),
    judgeId ? eq(judgingAssignments.judgeId, judgeId) : undefined,
  );
  const [row] = await tx
    .update(judgingAssignments)
    .set(set)
    .where(and(owned, inArray(judgingAssignments.status, from)))
    .returning();
  if (row) return row;

  const current = await tx.query.judgingAssignments.findFirst({
    where: owned,
    columns: { status: true },
  });
  if (!current) throw notFound("Stop");
  throw new TRPCError({
    code: "CONFLICT",
    message: `This stop is already ${current.status.replace("_", " ")}.`,
  });
}

export async function cancelStop(assignmentId: number) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    return transition(tx, assignmentId, OPEN_STATUSES, {
      status: "cancelled",
    });
  });
}

/**
 * Nobody at the table. With `judgeId`, only that judge's own stop. A judge can
 * also pass the team their screen showed (`expectedTeamId`, null for an empty
 * table); if a different team is seated now, it's refused, so a stale screen
 * can't mark the wrong team absent.
 *
 * Absence is final: the team seated there is disqualified (its seat now has a
 * `team_absent` stop), and the seat's other `assigned` stops are cancelled so
 * those judges skip it.
 */
export async function markAbsent(
  assignmentId: number,
  judgeId?: string,
  expectedTeamId?: string | null,
) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const target = await tx.query.judgingAssignments.findFirst({
      where: eq(judgingAssignments.id, assignmentId),
      columns: { judgingTableId: true },
    });
    if (!target) throw notFound("Stop");
    // Lock every live stop at the seat in id order (step 2), so two judges
    // reporting the same seat absent at once wait instead of deadlocking.
    await tx
      .select({ id: judgingAssignments.id })
      .from(judgingAssignments)
      .where(
        and(
          eq(judgingAssignments.judgingTableId, target.judgingTableId),
          ne(judgingAssignments.status, "cancelled"),
        ),
      )
      .orderBy(asc(judgingAssignments.id))
      .for("update");
    if (judgeId && expectedTeamId !== undefined) {
      const stop = await lockStop(tx, assignmentId, judgeId);
      const [seated] = await tx
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(eq(teams.judgingTableId, stop.judgingTableId))
        .for("share");
      if ((seated?.id ?? null) !== expectedTeamId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: seated
            ? `The team at this table changed (it's now "${seated.name}"). Refresh first.`
            : "The team at this table moved away. Refresh first.",
        });
      }
    }
    const row = await transition(
      tx,
      assignmentId,
      OPEN_STATUSES,
      { status: "team_absent", completedAt: new Date() },
      judgeId,
    );
    await tx
      .update(judgingAssignments)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(judgingAssignments.judgingTableId, row.judgingTableId),
          eq(judgingAssignments.status, "assigned"),
        ),
      );
    return row;
  });
}

/** Lock one of a judge's stops for the rest of the transaction (step 2). */
async function lockStop(tx: Tx, assignmentId: number, judgeId: string) {
  const [stop] = await tx
    .select({
      id: judgingAssignments.id,
      judgingTableId: judgingAssignments.judgingTableId,
    })
    .from(judgingAssignments)
    .where(
      and(
        eq(judgingAssignments.id, assignmentId),
        eq(judgingAssignments.judgeId, judgeId),
      ),
    )
    .for("update");
  if (!stop) throw notFound("Stop");
  return stop;
}

/**
 * The team seated at a stop's table, which must be the team the judge's
 * screen showed (`expectedTeamId`). Holds a share lock on the team row (step
 * 3) so a swap or move can't reseat it until this transaction finishes.
 */
async function seatedTeamAt(tx: Tx, tableId: number, expectedTeamId: string) {
  const [team] = await tx
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.judgingTableId, tableId))
    .for("share");
  if (!team) {
    const table = await tx.query.judgingTables.findFirst({
      where: eq(judgingTables.id, tableId),
      columns: { number: true },
    });
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `No team is seated at table ${table?.number ?? "?"}. Report it as absent instead.`,
    });
  }
  if (team.id !== expectedTeamId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `The team at this table changed (it's now "${team.name}"). Refresh before scoring.`,
    });
  }
  return team;
}

/** The judge is at the table. A judge has at most one stop in progress. */
export async function startStop(
  judgeId: string,
  assignmentId: number,
  teamId: string,
) {
  const busyError = () =>
    new TRPCError({
      code: "CONFLICT",
      message: "Finish or report your current table first.",
    });
  try {
    return await db.transaction(async (tx) => {
      await lockPlanShared(tx);
      const stop = await lockStop(tx, assignmentId, judgeId);
      const busy = await tx.query.judgingAssignments.findFirst({
        where: and(
          eq(judgingAssignments.judgeId, judgeId),
          eq(judgingAssignments.status, "in_progress"),
          ne(judgingAssignments.id, assignmentId),
        ),
        columns: { id: true },
      });
      if (busy) throw busyError();
      await seatedTeamAt(tx, stop.judgingTableId, teamId);
      return transition(
        tx,
        assignmentId,
        ["assigned"],
        { status: "in_progress", startedAt: new Date() },
        judgeId,
      );
    });
  } catch (error) {
    // Two starts racing on different stops: the one-in-progress index
    // (judging_assignment_one_in_progress_idx) rejects the second.
    if (isUniqueViolation(error)) throw busyError();
    throw error;
  }
}

/**
 * Score a stop: writes the `team_mark` for the team seated at the table (which
 * must be the team the judge saw) and marks the stop done, in one
 * transaction. Submitting straight from `assigned` is allowed. The round type
 * follows the judge type, so normalization reads the mark unchanged.
 */
export async function submitStop(
  judge: { id: string; type: "organizer" | "sponsored" },
  assignmentId: number,
  teamId: string,
  score: number,
  breakdown?: ScoreBreakdown,
) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const stop = await lockStop(tx, assignmentId, judge.id);
    const team = await seatedTeamAt(tx, stop.judgingTableId, teamId);

    await transition(
      tx,
      assignmentId,
      OPEN_STATUSES,
      { status: "done", completedAt: new Date() },
      judge.id,
    );
    const existing = await tx.query.teamMarks.findFirst({
      where: and(
        eq(teamMarks.judgeId, judge.id),
        eq(teamMarks.teamId, team.id),
      ),
      columns: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `You've already scored "${team.name}". Edit that score instead.`,
      });
    }
    const [mark] = await tx
      .insert(teamMarks)
      .values({
        teamId: team.id,
        judgeId: judge.id,
        score,
        ...(breakdown ? markColumnsFromBreakdown(breakdown) : {}),
        roundType: judge.type === "sponsored" ? "sponsored" : "regular",
      })
      .returning({ id: teamMarks.id });
    return { assignmentId, teamId: team.id, teamMarkId: mark!.id };
  });
}

/**
 * A judge re-scores one of their own marks. Updates the row in place, so the
 * stats trigger swaps the old score for the new one. The rubric columns are
 * only rewritten (all of them) when a breakdown is sent.
 */
export async function editMark(
  judgeId: string,
  teamMarkId: number,
  score: number,
  breakdown?: ScoreBreakdown,
) {
  const [row] = await db
    .update(teamMarks)
    .set({
      score,
      ...(breakdown ? markColumnsFromBreakdown(breakdown) : {}),
    })
    .where(and(eq(teamMarks.id, teamMarkId), eq(teamMarks.judgeId, judgeId)))
    .returning({ id: teamMarks.id });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Mark not found or not yours to edit.",
    });
  }
}

/**
 * Organizer removes a mark. The judge's stop at the team's table goes back to
 * `assigned`, so they can score it again. The stats trigger reverses the
 * judge's aggregates.
 */
export async function deleteMark(teamMarkId: number) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const [deleted] = await tx
      .delete(teamMarks)
      .where(eq(teamMarks.id, teamMarkId))
      .returning({ teamId: teamMarks.teamId, judgeId: teamMarks.judgeId });
    if (!deleted) throw notFound("Mark");

    const team = await tx.query.teams.findFirst({
      where: eq(teams.id, deleted.teamId),
      columns: { judgingTableId: true },
    });
    if (team?.judgingTableId == null) return { reopened: false };

    const reopened = await tx
      .update(judgingAssignments)
      .set({ status: "assigned", startedAt: null, completedAt: null })
      .where(
        and(
          eq(judgingAssignments.judgeId, deleted.judgeId),
          eq(judgingAssignments.judgingTableId, team.judgingTableId),
          eq(judgingAssignments.status, "done"),
        ),
      )
      .returning({ id: judgingAssignments.id });
    return { reopened: reopened.length > 0 };
  });
}
