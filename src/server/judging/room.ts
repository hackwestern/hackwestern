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
import { tablesPerRow } from "~/server/judging/layout";
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
 * Switch a table on or off. A table with a team seated can't be switched off.
 * Before judging starts this clears the plan (sections change); after, the
 * table must have no live stops.
 */
export async function setTableActive(tableId: number, isActive: boolean) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    const table = await tx.query.judgingTables.findFirst({
      where: eq(judgingTables.id, tableId),
    });
    if (!table) throw notFound("Table");
    if (table.isActive === isActive) return { ...table, planCleared: 0 };

    if (!isActive) {
      const seated = await tx.query.teams.findFirst({
        where: eq(teams.judgingTableId, tableId),
        columns: { name: true },
      });
      if (seated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${seated.name}" is seated at table ${table.number}. Move them first.`,
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
            message: `Table ${table.number} still has judges assigned. Cancel those stops first.`,
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
      .returning();
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
 * Seat one team per active table, in table order.
 * Replaces previous seating and clears the judge plan. Locked once judging starts.
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
    const tables = await tx
      .select({ id: judgingTables.id, number: judgingTables.number })
      .from(judgingTables)
      .where(eq(judgingTables.isActive, true))
      .orderBy(asc(judgingTables.number));

    if (submitted.length > tables.length) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${submitted.length} teams submitted but only ${tables.length} tables are active. Add or switch on more tables.`,
      });
    }

    // One team per table, in table order along the snake.
    const spots = tables;
    const order = random ? shuffle(submitted) : submitted;

    await tx
      .update(teams)
      .set({ judgingTableId: null })
      .where(isNotNull(teams.judgingTableId));
    const seating: { teamId: string; teamName: string; tableNumber: number }[] =
      [];
    for (const [i, team] of order.entries()) {
      const table = spots[i]!;
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

    const planCleared = await clearPlan(tx);
    return {
      random,
      seated: seating.length,
      emptyTables: tables.length - seating.length,
      planCleared,
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
        message: `Table ${table.number} is switched off.`,
      });
    }
    const occupant = await tx.query.teams.findFirst({
      where: eq(teams.judgingTableId, tableId),
      columns: { name: true },
    });
    if (occupant) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Table ${table.number} already has "${occupant.name}". Swap them instead.`,
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
    if (team.judgingTableId !== null) {
      const pendingAtSource = and(
        eq(judgingAssignments.judgingTableId, team.judgingTableId),
        eq(judgingAssignments.status, "assigned"),
      );
      const pendingAtDestination = await tx.query.judgingAssignments.findFirst({
        where: and(
          eq(judgingAssignments.judgingTableId, tableId),
          eq(judgingAssignments.status, "assigned"),
        ),
        columns: { id: true },
      });
      // Existing plans can already have stops at an empty destination.
      // Otherwise carry the team's pending stops to its new spot.
      if (pendingAtDestination) {
        await tx.delete(judgingAssignments).where(pendingAtSource);
      } else {
        await tx
          .update(judgingAssignments)
          .set({ judgingTableId: tableId })
          .where(pendingAtSource);
      }
    }
    return { teamId, tableNumber: table.number };
  });
}
