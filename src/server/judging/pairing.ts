/**
 * Manual judge pairing: physical tables, seating, and the per-judge list of
 * stops organizers build by hand. Pairings are live as soon as they're made.
 *
 * Runs alongside the auto-queue in `routers/judging.ts` for now; the queue
 * is removed in a follow-up once the judge and control-room screens move
 * over to assignments.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, inArray, isNull, max, ne } from "drizzle-orm";

import { type Transaction, db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingTables,
  teamMarks,
  teams,
  users,
} from "~/server/db/schema";
import {
  type AddAssignmentInput,
  type UpsertTableInput,
} from "~/schemas/judging-plan";

type Tx = Transaction | typeof db;
type AssignmentStatus = (typeof judgingAssignments.$inferSelect)["status"];

/** Statuses a stop can still move out of. */
const OPEN: AssignmentStatus[] = ["assigned", "in_progress"];
const ELIGIBLE_SUBMISSIONS = ["submitted", "late"] as const;
/** Positions are parked above this while a judge's list is renumbered. */
const REORDER_OFFSET = 100_000;

/** What a judge sees of a team: never the join code. */
const JUDGE_TEAM_COLUMNS = {
  id: true,
  name: true,
  tracks: true,
  devpostUrl: true,
  githubUrl: true,
} as const;

// ---------------------------------------------------------------------------
// Tables and seating
// ---------------------------------------------------------------------------

async function assertTableEmpty(tableId: number, tx: Tx = db) {
  const seated = await tx.query.teams.findFirst({
    where: eq(teams.judgingTableId, tableId),
    columns: { id: true, name: true },
  });
  if (seated) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Team "${seated.name}" is seated at this table. Move them first.`,
    });
  }
}

/** Create a table, or update the zone/active flag of the one with that number. */
export async function upsertTable(input: UpsertTableInput) {
  return db.transaction(async (tx) => {
    if (input.isActive === false) {
      const existing = await tx.query.judgingTables.findFirst({
        where: eq(judgingTables.number, input.number),
        columns: { id: true },
      });
      if (existing) await assertTableEmpty(existing.id, tx);
    }
    const [row] = await tx
      .insert(judgingTables)
      .values(input)
      .onConflictDoUpdate({
        target: judgingTables.number,
        set: {
          zone: input.zone,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      })
      .returning();
    return row!;
  });
}

export async function setTableActive(tableId: number, isActive: boolean) {
  return db.transaction(async (tx) => {
    if (!isActive) await assertTableEmpty(tableId, tx);
    const [row] = await tx
      .update(judgingTables)
      .set({ isActive })
      .where(eq(judgingTables.id, tableId))
      .returning();
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
    }
    return row;
  });
}

export async function deleteTable(tableId: number) {
  return db.transaction(async (tx) => {
    await assertTableEmpty(tableId, tx);
    const [row] = await tx
      .delete(judgingTables)
      .where(eq(judgingTables.id, tableId))
      .returning({ id: judgingTables.id });
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
    }
  });
}

/** Seat a team at an active, empty table (moving it if already seated). */
export async function seatTeam(teamId: string, tableId: number) {
  return db.transaction(async (tx) => {
    const table = await tx.query.judgingTables.findFirst({
      where: eq(judgingTables.id, tableId),
    });
    if (!table) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
    }
    if (!table.isActive) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Table ${table.number} is switched off.`,
      });
    }
    const occupant = await tx.query.teams.findFirst({
      where: eq(teams.judgingTableId, tableId),
      columns: { id: true, name: true },
    });
    if (occupant && occupant.id !== teamId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Table ${table.number} already has team "${occupant.name}".`,
      });
    }
    const [team] = await tx
      .update(teams)
      .set({ judgingTableId: tableId })
      .where(eq(teams.id, teamId))
      .returning({ id: teams.id });
    if (!team) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
    }
    return { teamId, tableId, number: table.number, zone: table.zone };
  });
}

export async function unseatTeam(teamId: string) {
  const [team] = await db
    .update(teams)
    .set({ judgingTableId: null })
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id });
  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

/**
 * Move a stop to a new status, but only from one of `from`. The status check
 * is in the UPDATE itself, so two racing requests can't both win. When
 * `judgeId` is given the stop must also belong to that judge.
 */
async function transition(
  tx: Tx,
  assignmentId: number,
  from: AssignmentStatus[],
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
  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Stop not found." });
  }
  throw new TRPCError({
    code: "CONFLICT",
    message: `This stop is already ${current.status.replace("_", " ")}.`,
  });
}

/** Add a stop to a judge's list. The team must be seated. */
export async function addAssignment(
  input: AddAssignmentInput,
  assignedBy: string,
) {
  return db.transaction(async (tx) => {
    const judge = await tx.query.judges.findFirst({
      where: eq(judges.id, input.judgeId),
      columns: { id: true },
    });
    if (!judge) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Judge not found." });
    }
    const team = await tx.query.teams.findFirst({
      where: eq(teams.id, input.teamId),
      columns: { id: true, name: true, judgingTableId: true },
    });
    if (!team) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
    }
    if (team.judgingTableId === null) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Seat "${team.name}" at a table before pairing judges with it.`,
      });
    }

    const active = and(
      eq(judgingAssignments.judgeId, input.judgeId),
      ne(judgingAssignments.status, "cancelled"),
    );
    const duplicate = await tx.query.judgingAssignments.findFirst({
      where: and(active, eq(judgingAssignments.teamId, input.teamId)),
      columns: { id: true },
    });
    if (duplicate) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `This judge is already paired with "${team.name}".`,
      });
    }
    const scored = await tx.query.teamMarks.findFirst({
      where: and(
        eq(teamMarks.judgeId, input.judgeId),
        eq(teamMarks.teamId, input.teamId),
      ),
      columns: { id: true },
    });
    if (scored) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `This judge has already scored "${team.name}".`,
      });
    }

    let position = input.position;
    if (position === undefined) {
      const [last] = await tx
        .select({ value: max(judgingAssignments.position) })
        .from(judgingAssignments)
        .where(active);
      position = (last?.value ?? 0) + 1;
    } else {
      const taken = await tx.query.judgingAssignments.findFirst({
        where: and(active, eq(judgingAssignments.position, position)),
        columns: { id: true },
      });
      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Position ${position} is already on this judge's list.`,
        });
      }
    }

    const [row] = await tx
      .insert(judgingAssignments)
      .values({
        judgeId: input.judgeId,
        teamId: input.teamId,
        position,
        assignedBy,
      })
      .returning();
    return row!;
  });
}

export async function cancelAssignment(assignmentId: number) {
  return transition(db, assignmentId, OPEN, { status: "cancelled" });
}

/** Nobody was at the table. Pass `judgeId` to restrict to that judge's stops. */
export async function markAbsent(assignmentId: number, judgeId?: string) {
  return transition(
    db,
    assignmentId,
    OPEN,
    { status: "team_absent", completedAt: new Date() },
    judgeId,
  );
}

/** Renumber a judge's list. `assignmentIds` must be every non-cancelled stop. */
export async function reorderAssignments(
  judgeId: string,
  assignmentIds: number[],
) {
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ id: judgingAssignments.id })
      .from(judgingAssignments)
      .where(
        and(
          eq(judgingAssignments.judgeId, judgeId),
          ne(judgingAssignments.status, "cancelled"),
        ),
      );
    const expected = new Set(current.map((r) => r.id));
    const given = new Set(assignmentIds);
    if (
      given.size !== assignmentIds.length ||
      given.size !== expected.size ||
      assignmentIds.some((id) => !expected.has(id))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Send every one of the judge's current stops, each once.",
      });
    }
    // Two passes so no intermediate state collides on (judge, position).
    for (const [i, id] of assignmentIds.entries()) {
      await tx
        .update(judgingAssignments)
        .set({ position: REORDER_OFFSET + i + 1 })
        .where(eq(judgingAssignments.id, id));
    }
    for (const [i, id] of assignmentIds.entries()) {
      await tx
        .update(judgingAssignments)
        .set({ position: i + 1 })
        .where(eq(judgingAssignments.id, id));
    }
  });
}

/** The judge is at the table. Only one stop can be in progress at a time. */
export async function startAssignment(judgeId: string, assignmentId: number) {
  return db.transaction(async (tx) => {
    const busy = await tx.query.judgingAssignments.findFirst({
      where: and(
        eq(judgingAssignments.judgeId, judgeId),
        eq(judgingAssignments.status, "in_progress"),
        ne(judgingAssignments.id, assignmentId),
      ),
      columns: { id: true },
    });
    if (busy) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Finish or report your current stop first.",
      });
    }
    return transition(
      tx,
      assignmentId,
      ["assigned"],
      { status: "in_progress", startedAt: new Date() },
      judgeId,
    );
  });
}

/**
 * Score a stop: inserts the `team_mark` and marks the stop done in one
 * transaction. The round type follows the judge type, as in the queue flow,
 * so normalization (`judging.admin.getLatestRanking`) reads it unchanged.
 */
export async function submitAssignmentMark(
  judge: { id: string; type: "organizer" | "sponsored" },
  assignmentId: number,
  score: number,
) {
  return db.transaction(async (tx) => {
    const stop = await transition(
      tx,
      assignmentId,
      OPEN,
      { status: "done", completedAt: new Date() },
      judge.id,
    );
    const existing = await tx.query.teamMarks.findFirst({
      where: and(
        eq(teamMarks.judgeId, judge.id),
        eq(teamMarks.teamId, stop.teamId),
      ),
      columns: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You have already scored this team.",
      });
    }
    const [mark] = await tx
      .insert(teamMarks)
      .values({
        teamId: stop.teamId,
        judgeId: judge.id,
        score,
        roundType: judge.type === "sponsored" ? "sponsored" : "regular",
      })
      .returning({ id: teamMarks.id });
    return { assignmentId, teamMarkId: mark!.id };
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every table with its seated team, plus submitted teams with no seat. */
export async function getSetup() {
  const [tables, unseated] = await Promise.all([
    db.query.judgingTables.findMany({
      orderBy: asc(judgingTables.number),
      with: { team: { columns: { id: true, name: true } } },
    }),
    db.query.teams.findMany({
      where: and(
        isNull(teams.judgingTableId),
        inArray(teams.submissionStatus, [...ELIGIBLE_SUBMISSIONS]),
      ),
      columns: { id: true, name: true, tracks: true },
      orderBy: asc(teams.name),
    }),
  ]);
  return { tables, unseatedTeams: unseated };
}

/** Every live stop for the control room, grouped by judge in list order. */
export async function getProgress() {
  const rows = await db
    .select({
      id: judgingAssignments.id,
      judgeId: judgingAssignments.judgeId,
      judgeName: users.name,
      teamId: judgingAssignments.teamId,
      teamName: teams.name,
      tableNumber: judgingTables.number,
      zone: judgingTables.zone,
      position: judgingAssignments.position,
      status: judgingAssignments.status,
      assignedAt: judgingAssignments.assignedAt,
      startedAt: judgingAssignments.startedAt,
      completedAt: judgingAssignments.completedAt,
    })
    .from(judgingAssignments)
    .innerJoin(users, eq(users.id, judgingAssignments.judgeId))
    .innerJoin(teams, eq(teams.id, judgingAssignments.teamId))
    .leftJoin(judgingTables, eq(judgingTables.id, teams.judgingTableId))
    .where(ne(judgingAssignments.status, "cancelled"))
    .orderBy(asc(users.name), asc(judgingAssignments.position));

  const totals = { assigned: 0, in_progress: 0, done: 0, team_absent: 0 };
  for (const r of rows) {
    if (r.status !== "cancelled") totals[r.status]++;
  }
  return { assignments: rows, totals };
}

/** A judge's own stops in order, with where to go and their score if any. */
export async function getMyAssignments(judgeId: string) {
  const stops = await db.query.judgingAssignments.findMany({
    where: and(
      eq(judgingAssignments.judgeId, judgeId),
      ne(judgingAssignments.status, "cancelled"),
    ),
    orderBy: asc(judgingAssignments.position),
    columns: { assignedBy: false, judgeId: false },
    with: {
      team: {
        columns: JUDGE_TEAM_COLUMNS,
        with: { judgingTable: { columns: { number: true, zone: true } } },
      },
    },
  });
  const teamIds = stops.map((s) => s.teamId);
  const marks =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teamMarks.id,
            teamId: teamMarks.teamId,
            score: teamMarks.score,
          })
          .from(teamMarks)
          .where(
            and(
              eq(teamMarks.judgeId, judgeId),
              inArray(teamMarks.teamId, teamIds),
            ),
          );
  const markByTeam = new Map(marks.map((m) => [m.teamId, m]));

  return stops.map(({ team: { judgingTable, ...team }, ...stop }) => ({
    ...stop,
    team,
    table: judgingTable,
    mark: markByTeam.get(stop.teamId) ?? null,
  }));
}

/**
 * What a hacker sees: their table and how many judges are paired with them
 * and finished. Judge identities stay hidden.
 */
export async function getTeamJudging(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { teamId: true },
  });
  if (!user?.teamId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This user is not part of a team",
    });
  }
  const [team, counts] = await Promise.all([
    db.query.teams.findFirst({
      where: eq(teams.id, user.teamId),
      columns: { id: true },
      with: { judgingTable: { columns: { number: true, zone: true } } },
    }),
    db
      .select({ status: judgingAssignments.status, n: count() })
      .from(judgingAssignments)
      .where(
        and(
          eq(judgingAssignments.teamId, user.teamId),
          ne(judgingAssignments.status, "cancelled"),
        ),
      )
      .groupBy(judgingAssignments.status),
  ]);
  const by = (s: AssignmentStatus) =>
    counts.find((c) => c.status === s)?.n ?? 0;
  return {
    table: team?.judgingTable ?? null,
    judges: {
      paired: counts.reduce((sum, c) => sum + c.n, 0),
      done: by("done"),
      remaining: by("assigned") + by("in_progress"),
    },
  };
}
