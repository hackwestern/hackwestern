/**
 * Room setup and seating: the physical table layout, which seats are in use,
 * and which team sits at which seat. See docs/judging-engine.md.
 */
import { randomInt } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  judgingAssignments,
  judgingSettings,
  judgingSeats,
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
  lockSeats,
  notFound,
  seatsHaveStarted,
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
    const judgesPerSeat = input.judgesPerSeat ?? current.judgesPerSeat;

    await tx
      .insert(judgingSettings)
      .values({
        id: 1,
        tableCount: input.tableCount,
        rows: input.rows,
        judgesPerSeat,
      })
      .onConflictDoUpdate({
        target: judgingSettings.id,
        set: {
          tableCount: input.tableCount,
          rows: input.rows,
          judgesPerSeat,
          updatedAt: new Date(),
        },
      });

    // Teams at tables being removed lose their seat via the FK. Lock them
    // (team rows, by id) before clearPlan's status trigger locks tables, so a
    // hacker deleting their team at the same moment can't deadlock with this.
    await tx
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(judgingSeats, eq(judgingSeats.id, teams.judgingSeatId))
      .where(gt(judgingSeats.tableNumber, input.tableCount))
      .orderBy(asc(teams.id))
      .for("update", { of: teams });

    const planCleared = await clearPlan(tx);

    const removed = await tx
      .delete(judgingSeats)
      .where(gt(judgingSeats.tableNumber, input.tableCount))
      .returning({ id: judgingSeats.id });

    const existing = await tx
      .select({ tableNumber: judgingSeats.tableNumber })
      .from(judgingSeats);
    const have = new Set(existing.map((t) => t.tableNumber));
    const missing: { tableNumber: number; zone: string }[] = [];
    for (let n = 1; n <= input.tableCount; n++) {
      if (!have.has(n))
        missing.push({ tableNumber: n, zone: input.zone ?? DEFAULT_ZONE });
    }
    if (missing.length > 0) {
      await tx.insert(judgingSeats).values(missing);
    }
    if (input.zone) {
      await tx
        .update(judgingSeats)
        .set({ zone: input.zone })
        .where(sql`true`);
    }

    return {
      tableCount: input.tableCount,
      rows: input.rows,
      perRow: tablesPerRow(input),
      judgesPerSeat,
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
export async function setSeatActive(seatId: number, isActive: boolean) {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    const seatRow = await tx.query.judgingSeats.findFirst({
      where: eq(judgingSeats.id, seatId),
    });
    if (!seatRow) throw notFound("Seat");
    if (seatRow.isActive === isActive) return { ...seatRow, planCleared: 0 };

    if (!isActive) {
      const seated = await tx.query.teams.findFirst({
        where: eq(teams.judgingSeatId, seatId),
        columns: { name: true },
      });
      if (seated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${seated.name}" is seated at table ${seatName(seatRow)}. Move them first.`,
        });
      }
    }

    let planCleared = 0;
    if (await isJudgingStarted(tx)) {
      if (!isActive) {
        const live = await tx.query.judgingAssignments.findFirst({
          where: and(
            eq(judgingAssignments.judgingSeatId, seatId),
            sql`${judgingAssignments.status} <> 'cancelled'`,
          ),
          columns: { id: true },
        });
        if (live) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Table ${seatName(seatRow)} still has judges assigned. Cancel those stops first.`,
          });
        }
      }
    } else {
      planCleared = await clearPlan(tx);
    }

    const [row] = await tx
      .update(judgingSeats)
      .set({ isActive })
      .where(eq(judgingSeats.id, seatId))
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
        id: judgingSeats.id,
        tableNumber: judgingSeats.tableNumber,
        zone: judgingSeats.zone,
      })
      .from(judgingSeats)
      .where(and(eq(judgingSeats.isActive, true), eq(judgingSeats.seat, 1)))
      .orderBy(asc(judgingSeats.tableNumber));

    const seconds = await tx
      .select({
        id: judgingSeats.id,
        tableNumber: judgingSeats.tableNumber,
        isActive: judgingSeats.isActive,
      })
      .from(judgingSeats)
      .where(eq(judgingSeats.seat, 2));
    const secondOff = new Set(
      seconds.filter((s) => !s.isActive).map((s) => s.tableNumber),
    );
    const splittable = physical.filter((t) => !secondOff.has(t.tableNumber));
    const splits = Math.max(0, submitted.length - physical.length);
    const split = tablesToSplit(splittable, splittable.length + splits);
    if (!split) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${submitted.length} teams submitted but only ${physical.length + splittable.length} seats can be used. Switch on more tables or seats.`,
      });
    }

    const wanted = new Set(split.map((t) => t.tableNumber));
    // A switched-off seat 2 stays, so the table keeps being skipped.
    const stale = seconds.filter(
      (s) => s.isActive && !wanted.has(s.tableNumber),
    );
    const have = new Set(seconds.map((s) => s.tableNumber));
    const missing = split.filter((t) => !have.has(t.tableNumber));

    if (stale.length > 0 || missing.length > 0) {
      // Same order as setupTables: lock the seated team rows before
      // clearPlan's status trigger locks tables.
      await tx
        .select({ id: teams.id })
        .from(teams)
        .where(isNotNull(teams.judgingSeatId))
        .orderBy(asc(teams.id))
        .for("update");
      await clearPlan(tx);
    }

    const order = random ? shuffle(submitted) : submitted;

    await tx
      .update(teams)
      .set({ judgingSeatId: null })
      .where(isNotNull(teams.judgingSeatId));
    if (stale.length > 0) {
      await tx.delete(judgingSeats).where(
        inArray(
          judgingSeats.id,
          stale.map((s) => s.id),
        ),
      );
    }
    if (missing.length > 0) {
      await tx
        .insert(judgingSeats)
        .values(
          missing.map((t) => ({
            tableNumber: t.tableNumber,
            seat: 2,
            zone: t.zone,
          })),
        );
    }
    const seats = await tx
      .select({
        id: judgingSeats.id,
        tableNumber: judgingSeats.tableNumber,
        seat: judgingSeats.seat,
      })
      .from(judgingSeats)
      .where(eq(judgingSeats.isActive, true))
      .orderBy(asc(judgingSeats.tableNumber), asc(judgingSeats.seat));
    const seating: {
      teamId: string;
      teamName: string;
      seatId: number;
      tableNumber: number;
      seat: number;
    }[] = [];
    for (const [i, team] of order.entries()) {
      const seat = seats[i]!;
      await tx
        .update(teams)
        .set({ judgingSeatId: seat.id })
        .where(eq(teams.id, team.id));
      seating.push({
        teamId: team.id,
        teamName: team.name,
        seatId: seat.id,
        tableNumber: seat.tableNumber,
        seat: seat.seat,
      });
    }

    return {
      random,
      seated: seating.length,
      emptySeats: seats.length - seating.length,
      seating,
    };
  });
}

/**
 * Before reseating anyone at these seats: lock every stop at them, then make
 * sure judging hasn't started at either. Locking the stops first means a judge
 * starting or submitting there finishes before this check runs (and the move
 * is refused), or waits until the move is done and scores whoever sits there
 * then. Same lock order as assignments.ts: stops first, then team rows.
 */
async function lockSeatsForReseat(tableIds: number[], tx: Tx) {
  if (tableIds.length > 0) {
    await tx
      .select({ id: judgingAssignments.id })
      .from(judgingAssignments)
      .where(inArray(judgingAssignments.judgingSeatId, tableIds))
      .orderBy(asc(judgingAssignments.id))
      .for("update");
  }
  await refuseIfStarted(tableIds, tx);
}

async function refuseIfStarted(tableIds: number[], tx: Tx) {
  if (await seatsHaveStarted(tableIds, tx)) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Judging has already started at one of these seats, so the team can't move.",
    });
  }
}

/**
 * Swap two teams' seats, which moves each team into the other's judges'
 * sections. Locked once either seat has a stop in progress or finished.
 */
export async function swapTeams(teamAId: string, teamBId: string) {
  return conflictOnUniqueViolation(
    () => swapTeamsTx(teamAId, teamBId),
    "One of these seats just changed. Refresh and try again.",
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
          seatId: teams.judgingSeatId,
        })
        .from(teams)
        .where(inArray(teams.id, [teamAId, teamBId]))
        .orderBy(asc(teams.id));
      const pair = lock ? await query.for("update") : await query;
      const a = pair.find((t) => t.id === teamAId);
      const b = pair.find((t) => t.id === teamBId);
      if (!a || !b) throw notFound("Team");
      if (a.seatId === null || b.seatId === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Both teams need to be seated before they can swap seats.",
        });
      }
      return {
        a: { ...a, seatId: a.seatId },
        b: { ...b, seatId: b.seatId },
      };
    };

    // Stops first, then the team rows (see lockSeatsForReseat).
    const seen = await readPair(false);
    await lockSeatsForReseat([seen.a.seatId, seen.b.seatId], tx);
    const { a, b } = await readPair(true);
    if (a.seatId !== seen.a.seatId || b.seatId !== seen.b.seatId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "One of these teams just moved. Refresh and try again.",
      });
    }

    // Lock order step 4: both seats, in id order, before the status trigger.
    // Every stop insert or status change takes these seat locks too, so a
    // re-check now also catches a stop that appeared after the first check.
    await lockSeats(tx, [a.seatId, b.seatId]);
    await refuseIfStarted([a.seatId, b.seatId], tx);

    // Clear one seat first so the one-team-per-seat rule holds throughout.
    await tx
      .update(teams)
      .set({ judgingSeatId: null })
      .where(eq(teams.id, a.id));
    await tx
      .update(teams)
      .set({ judgingSeatId: a.seatId })
      .where(eq(teams.id, b.id));
    await tx
      .update(teams)
      .set({ judgingSeatId: b.seatId })
      .where(eq(teams.id, a.id));

    const seats = await tx
      .select({
        seatId: judgingSeats.id,
        tableNumber: judgingSeats.tableNumber,
        seat: judgingSeats.seat,
      })
      .from(judgingSeats)
      .where(inArray(judgingSeats.id, [a.seatId, b.seatId]));
    const seatOf = (id: number) => seats.find((t) => t.seatId === id)!;
    return {
      teamA: { id: a.id, name: a.name, ...seatOf(b.seatId) },
      teamB: { id: b.id, name: b.name, ...seatOf(a.seatId) },
    };
  });
}

/** Move a team to an empty active seat. Same lock as swapping. */
export async function moveTeam(teamId: string, seatId: number) {
  return conflictOnUniqueViolation(
    () => moveTeamTx(teamId, seatId),
    "That seat was just taken. Refresh and try again.",
  );
}

async function moveTeamTx(teamId: string, seatId: number) {
  return db.transaction(async (tx) => {
    await lockPlanShared(tx);
    const team = await tx.query.teams.findFirst({
      where: eq(teams.id, teamId),
      columns: { id: true, name: true, judgingSeatId: true },
    });
    if (!team) throw notFound("Team");
    const seatRow = await tx.query.judgingSeats.findFirst({
      where: eq(judgingSeats.id, seatId),
    });
    if (!seatRow) throw notFound("Seat");
    const moved = {
      teamId,
      seatId,
      tableNumber: seatRow.tableNumber,
      seat: seatRow.seat,
    };
    if (team.judgingSeatId === seatId) return moved;
    if (!seatRow.isActive) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Table ${seatName(seatRow)} is switched off.`,
      });
    }
    const occupant = await tx.query.teams.findFirst({
      where: eq(teams.judgingSeatId, seatId),
      columns: { name: true },
    });
    if (occupant) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Table ${seatName(seatRow)} already has "${occupant.name}". Swap them instead.`,
      });
    }
    // Stops first, then the team row (see lockSeatsForReseat).
    await lockSeatsForReseat(
      team.judgingSeatId === null ? [seatId] : [team.judgingSeatId, seatId],
      tx,
    );
    const [locked] = await tx
      .select({ seatId: teams.judgingSeatId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update");
    if (locked?.seatId !== team.judgingSeatId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This team just moved. Refresh and try again.",
      });
    }
    const touched =
      team.judgingSeatId === null ? [seatId] : [team.judgingSeatId, seatId];
    await lockSeats(tx, touched);
    await refuseIfStarted(touched, tx);
    await tx
      .update(teams)
      .set({ judgingSeatId: seatId })
      .where(eq(teams.id, teamId));
    return moved;
  });
}
