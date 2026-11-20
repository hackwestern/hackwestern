import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { type Transaction, db } from "~/server/db";
import {
  judgingAssignments,
  judgingSettings,
  judgingSeats,
} from "~/server/db/schema";
import {
  DEFAULT_SETTINGS,
  type LayoutSettings,
  tablesPerRow,
} from "~/server/judging/layout";

export type Tx = Transaction | typeof db;
export type StopStatus = (typeof judgingAssignments.$inferSelect)["status"];

/** Statuses a stop can still move out of. */
export const OPEN_STATUSES: StopStatus[] = ["assigned", "in_progress"];
/** Once any stop is in one of these, judging has started. */
export const STARTED_STATUSES: StopStatus[] = [
  "in_progress",
  "done",
  "team_absent",
];
export const ELIGIBLE_SUBMISSIONS = ["submitted", "late"] as const;

/** What a judge sees of a team: never the join code. */
export const JUDGE_TEAM_COLUMNS = {
  id: true,
  name: true,
  tracks: true,
  devpostUrl: true,
  githubUrl: true,
} as const;

/** The room layout, falling back to the defaults until organizers set it. */
export async function getSettings(
  tx: Tx = db,
): Promise<LayoutSettings & { perRow: number }> {
  const row = await tx.query.judgingSettings.findFirst({
    where: eq(judgingSettings.id, 1),
  });
  const settings = {
    tableCount: row?.tableCount ?? DEFAULT_SETTINGS.tableCount,
    rows: row?.rows ?? DEFAULT_SETTINGS.rows,
    judgesPerSeat: row?.judgesPerSeat ?? DEFAULT_SETTINGS.judgesPerSeat,
  };
  return { ...settings, perRow: tablesPerRow(settings) };
}

/** Judging has started once any stop is in progress or finished. */
export async function isJudgingStarted(tx: Tx = db): Promise<boolean> {
  const started = await tx.query.judgingAssignments.findFirst({
    where: inArray(judgingAssignments.status, STARTED_STATUSES),
    columns: { id: true },
  });
  return !!started;
}

export async function assertNotStarted(action: string, tx: Tx = db) {
  if (await isJudgingStarted(tx)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Judging has started, so you can't ${action} any more. Use the day-of fixes instead.`,
    });
  }
}

/** True if any stop at one of these seats is in progress or finished. */
export async function seatsHaveStarted(
  seatIds: number[],
  tx: Tx = db,
): Promise<boolean> {
  if (seatIds.length === 0) return false;
  const row = await tx.query.judgingAssignments.findFirst({
    where: and(
      inArray(judgingAssignments.judgingSeatId, seatIds),
      inArray(judgingAssignments.status, STARTED_STATUSES),
    ),
    columns: { id: true },
  });
  return !!row;
}

/*
 * Lock order, used by every judging write so concurrent requests wait for each
 * other instead of deadlocking:
 *
 *   1. the judging_settings row (exclusive for plan changes, shared otherwise)
 *   2. judging_assignment rows, by id
 *   3. team rows, by id
 *   4. judging_seat rows, by id (the status trigger also locks these)
 */

/**
 * Plan changes (table setup, seating, auto-assign, switching seats on/off)
 * hold the settings row exclusively, so no judge action or day-of fix can run
 * between their "has judging started?" check and their writes.
 */
export async function lockPlanExclusive(tx: Tx) {
  await tx
    .insert(judgingSettings)
    .values({ id: 1 })
    .onConflictDoNothing({ target: judgingSettings.id });
  await tx
    .select({ id: judgingSettings.id })
    .from(judgingSettings)
    .where(eq(judgingSettings.id, 1))
    .for("update");
}

/**
 * Judge actions and day-of fixes hold the settings row shared: they don't
 * block each other, only plan changes. No row yet means no seats, so no plan.
 */
export async function lockPlanShared(tx: Tx) {
  await tx
    .select({ id: judgingSettings.id })
    .from(judgingSettings)
    .where(eq(judgingSettings.id, 1))
    .for("share");
}

/** Lock judging_seat rows in id order (step 4 of the lock order). */
export async function lockSeats(tx: Tx, seatIds: number[]) {
  if (seatIds.length === 0) return;
  await tx
    .select({ id: judgingSeats.id })
    .from(judgingSeats)
    .where(inArray(judgingSeats.id, [...new Set(seatIds)]))
    .orderBy(asc(judgingSeats.id))
    .for("update");
}

/** Turn a unique-index race into a clear CONFLICT instead of a 500. */
export async function conflictOnUniqueViolation<T>(
  fn: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new TRPCError({ code: "CONFLICT", message });
    }
    throw error;
  }
}

/** Only organizer-type judges judge the general room; sponsored judges judge
 * in their sponsor rooms (and their marks don't count toward the ranking). */
export function assertGeneralJudge(
  judge: { type: string },
  who = "That judge",
) {
  if (judge.type !== "organizer") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${who} is a sponsor judge. Sponsor judges judge in their sponsor rooms, not at tables.`,
    });
  }
}

export const notFound = (what: string) =>
  new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });

/** Postgres unique_violation (23505), whether raw or wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code === "23505") return true;
  const cause = (error as { cause?: unknown }).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: unknown }).code === "23505"
  );
}
