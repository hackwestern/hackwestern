/**
 * Room setup and seating: the table layout, which tables are in use, and
 * which team sits at which table. See docs/judging-engine.md.
 */
import { randomInt } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  judgingAssignments,
  judgingSettings,
  judgingTables,
  teams,
} from "~/server/db/schema";
import { type SetupTablesInput } from "~/schemas/judging";
import { seatName, tablesPerRow, tablesToSplit } from "~/server/judging/layout";
import {
  ELIGIBLE_SUBMISSIONS,
  type Tx,
  assertNotStarted,
  conflictOnUniqueViolation,
  getSettings,
  isJudgingStarted,
  lockPlanExclusive,
  lockPlanShared,
  lockTables,
  notFound,
  tablesHaveStarted,
} from "~/server/judging/shared";

const DEFAULT_ZONE = "Main room";

/** Drop every stop. Only called before judging starts, when the plan is stale. */
async function clearPlan(tx: Tx): Promise<number> {
  const removed = await tx
    .delete(judgingAssignments)
    .where(sql`true`)
    .returning({ id: judgingAssignments.id });
  return removed.length;
}

/**
 * Set the room layout and make tables 1..tableCount exist. Tables numbered
 * above the new count are removed (their teams lose their seat). Any plan
 * that hasn't started is cleared, since sections depend on the layout.
 */
export async function setupTables(input: SetupTablesInput) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    await assertNotStarted("change the table setup", tx);
    const current = await getSettings(tx);
    const judgesPerTable = input.judgesPerTable ?? current.judgesPerTable;

    await tx
      .insert(judgingSettings)
      .values({
        id: 1,
        tableCount: input.tableCount,
        rows: input.rows,
        judgesPerTable,
      })
      .onConflictDoUpdate({
        target: judgingSettings.id,
        set: {
          tableCount: input.tableCount,
          rows: input.rows,
          judgesPerTable,
          updatedAt: new Date(),
        },
      });

    // Teams at tables being removed lose their seat via the FK. Lock them
    // (team rows, by id) before clearPlan's status trigger locks tables, so a
    // hacker deleting their team at the same moment can't deadlock with this.
    await tx
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(judgingTables, eq(judgingTables.id, teams.judgingTableId))
      .where(gt(judgingTables.number, input.tableCount))
      .orderBy(asc(teams.id))
      .for("update", { of: teams });

    const planCleared = await clearPlan(tx);

    const removed = await tx
      .delete(judgingTables)
      .where(gt(judgingTables.number, input.tableCount))
      .returning({ id: judgingTables.id });

    const existing = await tx
      .select({ number: judgingTables.number })
      .from(judgingTables);
    const have = new Set(existing.map((t) => t.number));
    const missing: { number: number; zone: string }[] = [];
    for (let n = 1; n <= input.tableCount; n++) {
      if (!have.has(n))
        missing.push({ number: n, zone: input.zone ?? DEFAULT_ZONE });
    }
    if (missing.length > 0) {
      await tx.insert(judgingTables).values(missing);
    }
    if (input.zone) {
      await tx
        .update(judgingTables)
        .set({ zone: input.zone })
        .where(sql`true`);
    }

    return {
      tableCount: input.tableCount,
      rows: input.rows,
      perRow: tablesPerRow(input),
      judgesPerTable,
      tablesCreated: missing.length,
      tablesRemoved: removed.length,
      planCleared,
    };
  });
}

/**
 * Switch one seat on or off. A seat with a team seated can't be switched off.
 * Seating skips switched-off seats: with seat 1 off the table isn't used, and
 * with seat 2 off the table is never split. Before judging starts this clears
 * the plan (sections change); after, the seat must have no live stops.
 */
export async function setTableActive(tableId: number, isActive: boolean) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    const found = await tx.query.judgingTables.findFirst({
      where: eq(judgingTables.id, tableId),
    });
    if (!found) throw notFound("Table");
    const { seat, ...table } = found;
    if (table.isActive === isActive) return { ...table, planCleared: 0 };

    if (!isActive) {
      const seated = await tx.query.teams.findFirst({
        where: eq(teams.judgingTableId, tableId),
        columns: { name: true },
      });
      if (seated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${seated.name}" is seated at table ${seatName({ ...table, seat })}. Move them first.`,
        });
      }
    }

    let planCleared = 0;
    if (await isJudgingStarted(tx)) {
      if (!isActive) {
        const live = await tx.query.judgingAssignments.findFirst({
          where: and(
            eq(judgingAssignments.judgingTableId, tableId),
            sql`${judgingAssignments.status} <> 'cancelled'`,
          ),
          columns: { id: true },
        });
        if (live) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Table ${seatName({ ...table, seat })} still has judges assigned. Cancel those stops first.`,
          });
        }
      }
    } else {
      planCleared = await clearPlan(tx);
    }

    const [row] = await tx
      .update(judgingTables)
      .set({ isActive })
      .where(eq(judgingTables.id, tableId))
      .returning({
        id: judgingTables.id,
        number: judgingTables.number,
        zone: judgingTables.zone,
        isActive: judgingTables.isActive,
        status: judgingTables.status,
        statusUpdatedAt: judgingTables.statusUpdatedAt,
      });
    return { ...row!, planCleared };
  });
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Seat every submitted team at an active seat, one per seat, in snake order.
 * Each table has one seat; once there are more teams than active tables,
 * some tables get a second seat (spread evenly, see `tablesToSplit`), up to 2
 * teams per table. Tables whose seat 2 is switched off are never split.
 * Random by default; `random: false` seats in submission order. Replaces any
 * previous seating, and clears the plan if the seats changed. Locked once
 * judging starts.
 */
export async function seatTeams({ random }: { random: boolean }) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    await assertNotStarted("re-seat teams", tx);

    const submitted = await tx
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.submissionStatus, [...ELIGIBLE_SUBMISSIONS]))
      .orderBy(sql`${teams.submittedAt} asc nulls last`, asc(teams.id));
    const physical = await tx
      .select({
        id: judgingTables.id,
        number: judgingTables.number,
        zone: judgingTables.zone,
      })
      .from(judgingTables)
      .where(and(eq(judgingTables.isActive, true), eq(judgingTables.seat, 1)))
      .orderBy(asc(judgingTables.number));

    const seconds = await tx
      .select({
        id: judgingTables.id,
        number: judgingTables.number,
        isActive: judgingTables.isActive,
      })
      .from(judgingTables)
      .where(eq(judgingTables.seat, 2));
    const secondOff = new Set(
      seconds.filter((s) => !s.isActive).map((s) => s.number),
    );
    const splittable = physical.filter((t) => !secondOff.has(t.number));
    const splits = Math.max(0, submitted.length - physical.length);
    const split = tablesToSplit(splittable, splittable.length + splits);
    if (!split) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${submitted.length} teams submitted but only ${physical.length + splittable.length} seats can be used. Switch on more tables or seats.`,
      });
    }

    const wanted = new Set(split.map((t) => t.number));
    // A switched-off seat 2 stays, so the table keeps being skipped.
    const stale = seconds.filter((s) => s.isActive && !wanted.has(s.number));
    const have = new Set(seconds.map((s) => s.number));
    const missing = split.filter((t) => !have.has(t.number));

    if (stale.length > 0 || missing.length > 0) {
      // Same order as setupTables: lock the seated team rows before
      // clearPlan's status trigger locks tables.
      await tx
        .select({ id: teams.id })
        .from(teams)
        .where(isNotNull(teams.judgingTableId))
        .orderBy(asc(teams.id))
        .for("update");
      await clearPlan(tx);
    }

    const order = random ? shuffle(submitted) : submitted;

    await tx
      .update(teams)
      .set({ judgingTableId: null })
      .where(isNotNull(teams.judgingTableId));
    if (stale.length > 0) {
      await tx.delete(judgingTables).where(
        inArray(
          judgingTables.id,
          stale.map((s) => s.id),
        ),
      );
    }
    if (missing.length > 0) {
      await tx
        .insert(judgingTables)
        .values(
          missing.map((t) => ({ number: t.number, seat: 2, zone: t.zone })),
        );
    }
    const tables = await tx
      .select({ id: judgingTables.id, number: judgingTables.number })
      .from(judgingTables)
      .where(eq(judgingTables.isActive, true))
      .orderBy(asc(judgingTables.number), asc(judgingTables.seat));
    const seating: { teamId: string; teamName: string; tableNumber: number }[] =
      [];
    for (const [i, team] of order.entries()) {
      const table = tables[i]!;
      await tx
        .update(teams)
        .set({ judgingTableId: table.id })
        .where(eq(teams.id, team.id));
      seating.push({
        teamId: team.id,
        teamName: team.name,
        tableNumber: table.number,
      });
    }

    return {
      random,
      seated: seating.length,
      emptySeats: tables.length - seating.length,
      seating,
    };
  });
}

/**
 * Before reseating anyone at these tables: lock every stop at them, then make
 * sure judging hasn't started at either. Locking the stops first means a judge
 * starting or submitting there finishes before this check runs (and the move
 * is refused), or waits until the move is done and scores whoever sits there
 * then. Same lock order as assignments.ts: stops first, then team rows.
 */
async function lockTablesForReseat(tableIds: number[], tx: Tx) {
  if (tableIds.length > 0) {
    await tx
      .select({ id: judgingAssignments.id })
      .from(judgingAssignments)
      .where(inArray(judgingAssignments.judgingTableId, tableIds))
      .orderBy(asc(judgingAssignments.id))
      .for("update");
  }
  await refuseIfStarted(tableIds, tx);
}

async function refuseIfStarted(tableIds: number[], tx: Tx) {
  if (await tablesHaveStarted(tableIds, tx)) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Judging has already started at one of these tables, so the team can't move.",
    });
  }
}

/**
 * Swap two teams' tables, which moves each team into the other's judges'
 * sections. Locked once either table has a stop in progress or finished.
 */
export async function swapTeams(teamAId: string, teamBId: string) {
  return conflictOnUniqueViolation(
    () => swapTeamsTx(teamAId, teamBId),
    "One of these tables just changed. Refresh and try again.",
  );
}

async function swapTeamsTx(teamAId: string, teamBId: string) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const readPair = async (lock: boolean) => {
      const query = tx
        .select({
          id: teams.id,
          name: teams.name,
          tableId: teams.judgingTableId,
        })
        .from(teams)
        .where(inArray(teams.id, [teamAId, teamBId]))
        .orderBy(asc(teams.id));
      const pair = lock ? await query.for("update") : await query;
      const a = pair.find((t) => t.id === teamAId);
      const b = pair.find((t) => t.id === teamBId);
      if (!a || !b) throw notFound("Team");
      if (a.tableId === null || b.tableId === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Both teams need to be seated before they can swap tables.",
        });
      }
      return {
        a: { ...a, tableId: a.tableId },
        b: { ...b, tableId: b.tableId },
      };
    };

    // Stops first, then the team rows (see lockTablesForReseat).
    const seen = await readPair(false);
    await lockTablesForReseat([seen.a.tableId, seen.b.tableId], tx);
    const { a, b } = await readPair(true);
    if (a.tableId !== seen.a.tableId || b.tableId !== seen.b.tableId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "One of these teams just moved. Refresh and try again.",
      });
    }

    // Lock order step 4: both tables, in id order, before the status trigger.
    // Every stop insert or status change takes these table locks too, so a
    // re-check now also catches a stop that appeared after the first check.
    await lockTables(tx, [a.tableId, b.tableId]);
    await refuseIfStarted([a.tableId, b.tableId], tx);

    // Clear one seat first so the one-team-per-table rule holds throughout.
    await tx
      .update(teams)
      .set({ judgingTableId: null })
      .where(eq(teams.id, a.id));
    await tx
      .update(teams)
      .set({ judgingTableId: a.tableId })
      .where(eq(teams.id, b.id));
    await tx
      .update(teams)
      .set({ judgingTableId: b.tableId })
      .where(eq(teams.id, a.id));

    const numbers = await tx
      .select({ id: judgingTables.id, number: judgingTables.number })
      .from(judgingTables)
      .where(inArray(judgingTables.id, [a.tableId, b.tableId]));
    const numberOf = (id: number) => numbers.find((t) => t.id === id)?.number;
    return {
      teamA: { id: a.id, name: a.name, tableNumber: numberOf(b.tableId)! },
      teamB: { id: b.id, name: b.name, tableNumber: numberOf(a.tableId)! },
    };
  });
}

/** Move a team to an empty active table. Same lock as swapping. */
export async function moveTeam(teamId: string, tableId: number) {
  return conflictOnUniqueViolation(
    () => moveTeamTx(teamId, tableId),
    "That table was just taken. Refresh and try again.",
  );
}

async function moveTeamTx(teamId: string, tableId: number) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const team = await tx.query.teams.findFirst({
      where: eq(teams.id, teamId),
      columns: { id: true, name: true, judgingTableId: true },
    });
    if (!team) throw notFound("Team");
    const table = await tx.query.judgingTables.findFirst({
      where: eq(judgingTables.id, tableId),
    });
    if (!table) throw notFound("Table");
    if (team.judgingTableId === tableId) {
      return { teamId, tableNumber: table.number };
    }
    if (!table.isActive) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Table ${seatName(table)} is switched off.`,
      });
    }
    const occupant = await tx.query.teams.findFirst({
      where: eq(teams.judgingTableId, tableId),
      columns: { name: true },
    });
    if (occupant) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Table ${seatName(table)} already has "${occupant.name}". Swap them instead.`,
      });
    }
    // Stops first, then the team row (see lockTablesForReseat).
    await lockTablesForReseat(
      team.judgingTableId === null ? [tableId] : [team.judgingTableId, tableId],
      tx,
    );
    const [locked] = await tx
      .select({ tableId: teams.judgingTableId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update");
    if (locked?.tableId !== team.judgingTableId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This team just moved. Refresh and try again.",
      });
    }
    const touched =
      team.judgingTableId === null ? [tableId] : [team.judgingTableId, tableId];
    await lockTables(tx, touched);
    await refuseIfStarted(touched, tx);
    await tx
      .update(teams)
      .set({ judgingTableId: tableId })
      .where(eq(teams.id, teamId));
    return { teamId, tableNumber: table.number };
  });
}
