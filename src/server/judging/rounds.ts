/**
 * Timed judging rounds. Round N is every judge's Nth stop (`position`). An
 * organizer starts each round; judges can only start and score that round's
 * stop while the timer runs. At 0 the round closes (no more scores) and an
 * organizer starts the next one. A paused timer stops counting but scoring
 * still works. See docs/judging-engine.md.
 *
 * A running round whose `ends_at` has passed is treated as closed when read,
 * so nothing has to tick on the server and a missed tick can't leave a round
 * open.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingRound,
  teams,
} from "~/server/db/schema";
import {
  type Tx,
  isJudgingStarted,
  rehearsalRestartAllowed,
  lockPlanExclusive,
  lockPlanShared,
} from "~/server/judging/shared";

export type RoundStatus = "idle" | "running" | "paused" | "closed";

export const MIN_ROUND_SECONDS = 30;
export const MAX_ROUND_SECONDS = 60 * 60;
export const DEFAULT_ROUND_SECONDS = 600;

export interface RoundState {
  /** False: rounds are off and judges may go in any order. */
  enabled: boolean;
  /** The round in progress or last run (1-based); 0 before round 1. */
  round: number;
  /** Rounds the plan needs: the most stops any judge has at a table with a team. */
  totalRounds: number;
  status: RoundStatus;
  roundSeconds: number;
  /** When the running timer reaches 0. Null unless running. */
  endsAt: Date | null;
  /** Time left, in ms: counting while running, frozen while paused. */
  remainingMs: number | null;
  /** The server's clock, so screens can correct for a wrong device clock. */
  serverNow: Date;
}

type Row = typeof judgingRound.$inferSelect;

/** Make sure the single row exists, so it can be locked and updated. */
async function ensureRow(tx: Tx) {
  await tx.insert(judgingRound).values({ id: 1 }).onConflictDoNothing();
}

async function readRow(tx: Tx, lock?: "share" | "update"): Promise<Row> {
  await ensureRow(tx);
  const query = tx.select().from(judgingRound).where(eq(judgingRound.id, 1));
  const [row] = await (lock ? query.for(lock) : query);
  return row!;
}

/**
 * Rounds the plan needs: the most stops any judge has at a table with a team.
 * A stop at an empty table isn't shown to the judge, so it isn't a round.
 */
async function totalRounds(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({
      n: sql<number>`coalesce(max(${judgingAssignments.position}), 0)`,
    })
    .from(judgingAssignments)
    .innerJoin(
      teams,
      eq(teams.judgingTableId, judgingAssignments.judgingTableId),
    )
    .where(ne(judgingAssignments.status, "cancelled"));
  return Number(row?.n ?? 0);
}

/** Pure: what a stored row means right now. */
export function resolveRound(
  row: Row,
  total: number,
  now: Date = new Date(),
): RoundState {
  let status: RoundStatus = row.status;
  let remainingMs: number | null = null;
  if (status === "running" && row.endsAt) {
    remainingMs = Math.max(0, row.endsAt.getTime() - now.getTime());
    if (remainingMs === 0) status = "closed";
  } else if (status === "paused") {
    remainingMs = row.remainingMs ?? 0;
  } else if (status === "closed") {
    remainingMs = 0;
  }
  return {
    enabled: row.roundsEnabled,
    round: row.currentRound,
    totalRounds: total,
    status,
    roundSeconds: row.roundSeconds,
    endsAt: status === "running" ? row.endsAt : null,
    remainingMs,
    serverNow: now,
  };
}

/** A hacker can report their judge missing once the round has run this long. */
export const REPORT_MISSING_AFTER_MS = 60_000;

/** How long the current round has run, paused time left out. */
export function roundElapsedMs(state: RoundState, now = Date.now()): number {
  const total = state.roundSeconds * 1000;
  const left =
    state.status === "running" && state.endsAt
      ? Math.max(0, state.endsAt.getTime() - now)
      : (state.remainingMs ?? 0);
  return Math.max(0, total - left);
}

export async function getRoundState(tx: Tx = db): Promise<RoundState> {
  const [row, total] = await Promise.all([readRow(tx), totalRounds(tx)]);
  return resolveRound(row, total);
}

/**
 * A judge whose round closes mid-score is no longer "in progress": the stop
 * goes back to `assigned` (never scored, and not doable again once the round
 * has passed). Otherwise the blue "being judged" state and the hold timer
 * would run forever, and the judge couldn't start next round's table (a judge
 * has at most one stop in progress).
 *
 * Lock order matches judge actions (plan, then stops, then the round row), so
 * these never deadlock with a judge scoring at the same moment.
 */
async function lockHeldStops(tx: Tx): Promise<number[]> {
  await lockPlanShared(tx);
  const held = await tx
    .select({ id: judgingAssignments.id })
    .from(judgingAssignments)
    .where(eq(judgingAssignments.status, "in_progress"))
    .orderBy(asc(judgingAssignments.id))
    .for("update");
  return held.map((h) => h.id);
}

// startedAt is kept: a judge who started a team has seen it, so that table
// isn't "missed" (see missedStops) and stays theirs to score late.
async function releaseStops(tx: Tx, ids: number[]) {
  if (ids.length === 0) return;
  await tx
    .update(judgingAssignments)
    .set({ status: "assigned" })
    .where(inArray(judgingAssignments.id, ids));
}

/**
 * Make a closed round real: if the timer ran out, record it as closed, and
 * release any stop still in progress. Called when screens read the round, so
 * nothing has to tick on the server. Cheap when there is nothing to do.
 */
export async function settleRound(): Promise<void> {
  const row = await readRow(db);
  if (!row.roundsEnabled) return;
  const expired =
    row.status === "running" && !!row.endsAt && row.endsAt <= new Date();
  if (!expired && row.status !== "closed") return;
  if (!expired) {
    const [stale] = await db
      .select({ id: judgingAssignments.id })
      .from(judgingAssignments)
      .where(eq(judgingAssignments.status, "in_progress"))
      .limit(1);
    if (!stale) return;
  }
  await db.transaction(async (tx) => {
    const held = await lockHeldStops(tx);
    const locked = await readRow(tx, "update");
    const state = resolveRound(locked, 0);
    if (state.status !== "closed") return;
    if (locked.status === "running") {
      await tx
        .update(judgingRound)
        .set({
          status: "closed",
          endsAt: null,
          remainingMs: null,
          updatedAt: new Date(),
        })
        .where(eq(judgingRound.id, 1));
    }
    await releaseStops(tx, held);
  });
}

const precondition = (message: string) =>
  new TRPCError({ code: "PRECONDITION_FAILED", message });

/**
 * Judge side: may a stop at `position` be started or scored right now? Any
 * stop whose round has started can be: a judge who runs out of time (or missed
 * a round) can still finish that team late. Takes a share lock on the round
 * row, so it can't race an organizer starting the next round.
 */
export async function assertStopOpen(tx: Tx, position: number) {
  const row = await readRow(tx, "share");
  if (!row.roundsEnabled) return;
  const state = resolveRound(row, 0);
  if (state.status === "idle") {
    throw precondition(
      "Judging hasn't started. Wait for the organizers to start round 1.",
    );
  }
  if (position > state.round) {
    throw precondition(
      `That table is for round ${position}. Wait for it to start.`,
    );
  }
}

/**
 * The lowest stop position a judge can still be asked to do. Stops from rounds
 * that have ended were missed, so they must not block the judge's current
 * stop. 0 when rounds are off.
 */
export async function openPositionFloor(tx: Tx) {
  const row = await readRow(tx, "share");
  if (!row.roundsEnabled) return 0;
  return resolveRound(row, 0).round;
}

/* ---------------------------- organizer actions ---------------------------- */

/** Open the next round and start its timer. */
export async function startRound(): Promise<RoundState> {
  return db.transaction(async (tx) => {
    const held = await lockHeldStops(tx);
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    const state = resolveRound(row, total);
    if (state.status === "running" || state.status === "paused") {
      throw precondition(
        `Round ${state.round} is still open. End it before starting the next.`,
      );
    }
    const next = state.round + 1;
    if (total === 0) {
      throw precondition("There are no stops yet. Auto-assign judges first.");
    }
    if (next > total) {
      throw precondition(`That was the last round (${total}).`);
    }
    // Anyone still mid-score from the round that just closed is released.
    await releaseStops(tx, held);
    const now = new Date();
    await tx
      .update(judgingRound)
      .set({
        currentRound: next,
        status: "running",
        endsAt: new Date(now.getTime() + row.roundSeconds * 1000),
        remainingMs: null,
        updatedAt: now,
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), total);
  });
}

/** Stop the timer. Judges can keep scoring while it is paused. */
export async function pauseRound(): Promise<RoundState> {
  return db.transaction(async (tx) => {
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    const state = resolveRound(row, total);
    if (state.status !== "running") {
      throw precondition("The round isn't running.");
    }
    await tx
      .update(judgingRound)
      .set({
        status: "paused",
        endsAt: null,
        remainingMs: state.remainingMs,
        updatedAt: new Date(),
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), total);
  });
}

export async function resumeRound(): Promise<RoundState> {
  return db.transaction(async (tx) => {
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    if (row.status !== "paused") {
      throw precondition("The round isn't paused.");
    }
    const now = new Date();
    await tx
      .update(judgingRound)
      .set({
        status: "running",
        endsAt: new Date(now.getTime() + (row.remainingMs ?? 0)),
        remainingMs: null,
        updatedAt: now,
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), total);
  });
}

/** Close the round now: no more scores until the next one starts. */
export async function endRound(): Promise<RoundState> {
  return db.transaction(async (tx) => {
    const held = await lockHeldStops(tx);
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    const state = resolveRound(row, total);
    if (state.status !== "running" && state.status !== "paused") {
      throw precondition("No round is open.");
    }
    await releaseStops(tx, held);
    await tx
      .update(judgingRound)
      .set({
        status: "closed",
        endsAt: null,
        remainingMs: null,
        updatedAt: new Date(),
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), total);
  });
}

/** Back to before round 1. Marks already given are kept. */
export async function resetRounds(): Promise<RoundState> {
  return db.transaction(async (tx) => {
    await readRow(tx, "update");
    await tx
      .update(judgingRound)
      .set({
        currentRound: 0,
        status: "idle",
        endsAt: null,
        remainingMs: null,
        updatedAt: new Date(),
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), await totalRounds(tx));
  });
}

/** Round length (applies from the next round) and the rounds on/off switch. */
export async function setRoundConfig(input: {
  roundSeconds?: number;
  roundsEnabled?: boolean;
}): Promise<RoundState> {
  return db.transaction(async (tx) => {
    await readRow(tx, "update");
    await tx
      .update(judgingRound)
      .set({
        ...(input.roundSeconds !== undefined
          ? { roundSeconds: input.roundSeconds }
          : {}),
        ...(input.roundsEnabled !== undefined
          ? { roundsEnabled: input.roundsEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(judgingRound.id, 1));
    return resolveRound(await readRow(tx), await totalRounds(tx));
  });
}

/**
 * Tables whose judge never came ("missed"): unscored, never started (the judge
 * didn't press "Judge this team", or an organizer reported the judge missing),
 * in a round that has ended. A started but unscored table isn't missed: the
 * judge saw the team and scores it late. Only tables with a team; absent
 * tables aren't open, so they don't count.
 */
async function missedStops(tx: Tx, state: RoundState) {
  if (!state.enabled || state.round === 0) return [];
  const ended =
    state.status === "closed"
      ? lte(judgingAssignments.position, state.round)
      : lt(judgingAssignments.position, state.round);
  return tx
    .select({
      id: judgingAssignments.id,
      judgeId: judgingAssignments.judgeId,
      tableId: judgingAssignments.judgingTableId,
      position: judgingAssignments.position,
    })
    .from(judgingAssignments)
    .innerJoin(
      teams,
      eq(teams.judgingTableId, judgingAssignments.judgingTableId),
    )
    .where(
      and(
        eq(judgingAssignments.status, "assigned"),
        isNull(judgingAssignments.startedAt),
        ended,
      ),
    )
    .orderBy(asc(judgingAssignments.position), asc(judgingAssignments.id));
}

/**
 * After the last round has ended: move every missed table into catch-up
 * rounds. It goes to a present judge who hasn't seen that team, fewest
 * catch-up tables first; the judge who never came gets it back only when
 * nobody else can take it.
 * One table per judge per round, so extra ones spill into the next catch-up
 * round. The stop is moved (same table, new judge and round), never copied.
 */
export async function planCatchUp() {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    const state = resolveRound(row, total);
    if (!state.enabled) throw precondition("Turn the timed rounds on first.");
    if (state.status !== "closed" || state.round < total) {
      throw precondition(
        "The catch-up round comes after the last round has ended.",
      );
    }
    const missed = await missedStops(tx, state);
    if (missed.length === 0) throw precondition("No team missed a judge.");

    const present = (
      await tx
        .select({ id: judges.id })
        .from(judges)
        .where(and(eq(judges.type, "organizer"), eq(judges.noShow, false)))
        .orderBy(asc(judges.createdAt), asc(judges.id))
    ).map((j) => j.id);
    if (present.length === 0) throw precondition("No judges are present.");

    // What every judge already holds, so no judge gets two tables in a round
    // or the same table twice (the unique indexes would refuse it).
    const live = await tx
      .select({
        judgeId: judgingAssignments.judgeId,
        tableId: judgingAssignments.judgingTableId,
        position: judgingAssignments.position,
      })
      .from(judgingAssignments)
      .where(ne(judgingAssignments.status, "cancelled"));
    const positions = new Map<string, Set<number>>();
    const tables = new Map<string, Set<number>>();
    const add = (map: Map<string, Set<number>>, id: string, value: number) =>
      map.set(id, (map.get(id) ?? new Set()).add(value));
    for (const s of live) {
      add(positions, s.judgeId, s.position);
      add(tables, s.judgeId, s.tableId);
    }

    const load = new Map<string, number>();
    let moved = 0;
    let skipped = 0;
    for (const m of missed) {
      positions.get(m.judgeId)?.delete(m.position);
      tables.get(m.judgeId)?.delete(m.tableId);
      const others = present
        .filter((id) => id !== m.judgeId)
        .sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
      const candidates = [
        ...others,
        ...(present.includes(m.judgeId) ? [m.judgeId] : []),
      ].filter((id) => !tables.get(id)?.has(m.tableId));

      // The candidate free soonest; ties go to the earlier one in the list.
      let best: { judgeId: string; position: number } | null = null;
      for (const judgeId of candidates) {
        let position = state.round + 1;
        while (positions.get(judgeId)?.has(position)) position++;
        if (!best || position < best.position) best = { judgeId, position };
      }
      if (!best) {
        // Every present judge has already seen this team: leave it missed.
        add(positions, m.judgeId, m.position);
        add(tables, m.judgeId, m.tableId);
        skipped++;
        continue;
      }
      await tx
        .update(judgingAssignments)
        .set({
          judgeId: best.judgeId,
          position: best.position,
          status: "assigned",
          startedAt: null,
          completedAt: null,
        })
        .where(eq(judgingAssignments.id, m.id));
      add(positions, best.judgeId, best.position);
      add(tables, best.judgeId, m.tableId);
      load.set(best.judgeId, (load.get(best.judgeId) ?? 0) + 1);
      moved++;
    }
    return { moved, skipped, totalRounds: await totalRounds(tx) };
  });
}

/** The round state plus how far the room is through the current round. */
export async function getRoundOverview() {
  await settleRound();
  const state = await getRoundState();
  const stops =
    state.round === 0
      ? []
      : await db
          .select({ status: judgingAssignments.status })
          .from(judgingAssignments)
          .innerJoin(
            teams,
            eq(teams.judgingTableId, judgingAssignments.judgingTableId),
          )
          .where(
            and(
              eq(judgingAssignments.position, state.round),
              ne(judgingAssignments.status, "cancelled"),
            ),
          );
  return {
    ...state,
    /** Judging has started, so the assignments can't be cleared any more. */
    judgingStarted: await isJudgingStarted(),
    /** This deploy may restart a rehearsal (dev site only). */
    canRestartRehearsal: rehearsalRestartAllowed(),
    /** Tables whose judge never came, from rounds that have ended. */
    missed: (await missedStops(db, state)).length,
    stops: {
      total: stops.length,
      done: stops.filter(
        (s) => s.status === "done" || s.status === "team_absent",
      ).length,
      inProgress: stops.filter((s) => s.status === "in_progress").length,
    },
  };
}

/* ------------------------- hackers' view of the rounds ------------------------- */

/** Whether hackers can see the rounds board. Organizers always can. */
export async function getBoardVisibility(): Promise<{
  shownToHackers: boolean;
}> {
  const row = await readRow(db);
  return { shownToHackers: row.showToHackers };
}

export async function setBoardVisibility(
  shownToHackers: boolean,
): Promise<{ shownToHackers: boolean }> {
  return db.transaction(async (tx) => {
    await readRow(tx, "update");
    await tx
      .update(judgingRound)
      .set({ showToHackers: shownToHackers, updatedAt: new Date() })
      .where(eq(judgingRound.id, 1));
    return { shownToHackers };
  });
}
