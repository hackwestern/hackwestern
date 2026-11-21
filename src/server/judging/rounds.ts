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
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { judgingAssignments, judgingRound } from "~/server/db/schema";
import { type Tx } from "~/server/judging/shared";

export type RoundStatus = "idle" | "running" | "paused" | "closed";

export const MIN_ROUND_SECONDS = 30;
export const MAX_ROUND_SECONDS = 60 * 60;
export const DEFAULT_ROUND_SECONDS = 600;

export interface RoundState {
  /** False: rounds are off and judges may go in any order. */
  enabled: boolean;
  /** The round in progress or last run (1-based); 0 before round 1. */
  round: number;
  /** Rounds the plan needs: the most stops any judge has. */
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

async function totalRounds(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({
      n: sql<number>`coalesce(max(${judgingAssignments.position}), 0)`,
    })
    .from(judgingAssignments)
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

export async function getRoundState(tx: Tx = db): Promise<RoundState> {
  const [row, total] = await Promise.all([readRow(tx), totalRounds(tx)]);
  return resolveRound(row, total);
}

const precondition = (message: string) =>
  new TRPCError({ code: "PRECONDITION_FAILED", message });

/**
 * Judge side: may a stop at `position` be started or scored right now? Takes a
 * share lock on the round row, so an organizer ending the round either waits
 * for this to finish or makes it refuse.
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
  if (position < state.round) {
    throw precondition(
      `That table was for round ${position}, which has ended. Ask an organizer.`,
    );
  }
  if (state.status === "closed") {
    throw precondition(
      `Time's up for round ${state.round}. Wait for the next round to start.`,
    );
  }
}

/* ---------------------------- organizer actions ---------------------------- */

/** Open the next round and start its timer. */
export async function startRound(): Promise<RoundState> {
  return db.transaction(async (tx) => {
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
    const row = await readRow(tx, "update");
    const total = await totalRounds(tx);
    const state = resolveRound(row, total);
    if (state.status !== "running" && state.status !== "paused") {
      throw precondition("No round is open.");
    }
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

/** The round state plus how far the room is through the current round. */
export async function getRoundOverview() {
  const state = await getRoundState();
  const stops =
    state.round === 0
      ? []
      : await db
          .select({ status: judgingAssignments.status })
          .from(judgingAssignments)
          .where(
            and(
              eq(judgingAssignments.position, state.round),
              ne(judgingAssignments.status, "cancelled"),
            ),
          );
  return {
    ...state,
    stops: {
      total: stops.length,
      done: stops.filter(
        (s) => s.status === "done" || s.status === "team_absent",
      ).length,
      inProgress: stops.filter((s) => s.status === "in_progress").length,
    },
  };
}
