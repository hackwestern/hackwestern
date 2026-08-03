/**
 * Orchestration for the automated cheat-check sweep.
 *
 * A sweep runs every team check across every eligible team. It is kicked off
 * when the judging queue drains — at that point every team has been judged,
 * submissions are final, and the GitHub/DevPost scrapes aren't competing with
 * judging for rate limit. Organizers can also start one by hand.
 *
 * The work itself is done by `/api/cheat-check/sweep`, which claims batches out
 * of `cheat_check_sweep_item` and re-invokes itself until the list is empty.
 * This module owns everything around that: deciding when to start, building the
 * work list, handing batches out, and reporting progress.
 */
import { and, count, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { extractRows } from "~/server/db/rows";
import {
  cheatCheckSweepItems,
  cheatCheckSweeps,
  judgingQueue,
  teams,
  users,
} from "~/server/db/schema";
import { env } from "~/env";
import { ensureSystemUser } from "~/server/api/utils/cheat-checks";

/**
 * How long after a sweep finishes before a drain may start another. Deleting a
 * mark re-queues its team (see `deleteMark` in the judging router), so without a
 * cooldown a single correction would re-drain and re-sweep.
 */
export const SWEEP_COOLDOWN_MINUTES = 30;

/**
 * How long one worker invocation may spend claiming and processing batches.
 * Deliberately under the 60s Vercel function ceiling so there is room to write
 * the heartbeat and chain the next invocation.
 */
export const SWEEP_TIME_BUDGET_MS = 45_000;

/**
 * Teams processed in parallel inside one invocation. Each team costs roughly
 * three GitHub requests, so six in flight sits at ~18 concurrent requests —
 * comfortably under GitHub's 100-concurrent secondary limit and ~180 points/min
 * against its 900/min ceiling.
 */
export const SWEEP_CONCURRENCY = 6;

/** How many times a single team may be retried before it is marked failed. */
export const MAX_ATTEMPTS = 3;

/** A running sweep whose heartbeat is older than this is considered stalled. */
export const STALLED_HEARTBEAT_MINUTES = 2;

export type SweepRow = typeof cheatCheckSweeps.$inferSelect;

// ---------------------------------------------------------------------------
// Starting a sweep
// ---------------------------------------------------------------------------

/**
 * Teams a sweep will check.
 *
 * Note this is deliberately stricter than `loadQueue`'s predicate in the judging
 * router, which filters on submission status alone. The team checks scrape both
 * GitHub and DevPost, and `requireSubmission` throws without those URLs, so a
 * team missing either would only ever produce failed items.
 */
function eligibleTeamsFilter() {
  return and(
    inArray(teams.submissionStatus, ["submitted", "late"]),
    isNotNull(teams.githubUrl),
    isNotNull(teams.devpostUrl),
  );
}

/** The sweep currently `running`, if there is one. */
export async function getRunningSweep(): Promise<SweepRow | undefined> {
  return db.query.cheatCheckSweeps.findFirst({
    where: eq(cheatCheckSweeps.status, "running"),
  });
}

/**
 * Create a sweep and its work list.
 *
 * Returns null when another sweep is already running — either because we saw it
 * here, or because the `cheat_check_sweep_active_idx` partial unique index
 * rejected the insert (two judges submitting their final marks at the same
 * instant). Either way the caller has nothing to do.
 */
export async function createSweep(
  triggeredBy: "queue_drain" | "manual",
  opts: { forceRerun?: boolean } = {},
): Promise<SweepRow | null> {
  await ensureSystemUser();

  const eligible = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eligibleTeamsFilter());

  let sweep: SweepRow | undefined;
  try {
    [sweep] = await db
      .insert(cheatCheckSweeps)
      .values({
        triggeredBy,
        forceRerun: opts.forceRerun ?? false,
        totalTeams: eligible.length,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }

  if (!sweep) return null;

  if (eligible.length > 0) {
    await db
      .insert(cheatCheckSweepItems)
      .values(eligible.map((t) => ({ sweepId: sweep.id, teamId: t.id })));
  } else {
    // Nothing to do — don't leave an empty sweep sitting in `running` forever.
    await finishSweep(sweep.id);
    return { ...sweep, status: "completed" as const };
  }

  return sweep;
}

/**
 * Start a sweep if the judging queue has just drained.
 *
 * Called fire-and-forget from `judging.me.submitTeamMark`, so it must never
 * throw: a cheat-check problem is not a reason to fail a judge's mark.
 */
export async function maybeTriggerSweepOnDrain(): Promise<void> {
  try {
    const [queued] = await db.select({ value: count() }).from(judgingQueue);
    if ((queued?.value ?? 0) > 0) return;

    if (await getRunningSweep()) return;

    const cooldownStart = new Date(
      Date.now() - SWEEP_COOLDOWN_MINUTES * 60_000,
    );
    const recent = await db.query.cheatCheckSweeps.findFirst({
      where: gt(cheatCheckSweeps.finishedAt, cooldownStart),
    });
    if (recent) return;

    const sweep = await createSweep("queue_drain");
    if (sweep && sweep.status === "running") await kickWorker();
  } catch (error) {
    console.error("[cheat-check-sweep] failed to trigger on drain", error);
  }
}

// ---------------------------------------------------------------------------
// Working the queue
// ---------------------------------------------------------------------------

/**
 * Claim up to `limit` pending teams for this worker, marking them `running` and
 * consuming one attempt each.
 *
 * `FOR UPDATE SKIP LOCKED` is the same pattern `pickNextTeam` uses in the
 * judging router: a second worker (a chained invocation that overlapped, or an
 * organizer-triggered resume) skips past the locked rows instead of blocking or
 * double-processing them.
 */
export async function claimBatch(
  sweepId: number,
  limit: number,
): Promise<string[]> {
  const claimed = await db.execute<{ team_id: string }>(sql`
    UPDATE cheat_check_sweep_item
    SET status = 'running', attempts = attempts + 1, updated_at = NOW()
    WHERE (sweep_id, team_id) IN (
      SELECT sweep_id, team_id
      FROM cheat_check_sweep_item
      WHERE sweep_id = ${sweepId} AND status = 'pending'
      ORDER BY team_id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING team_id
  `);

  return extractRows<{ team_id: string }>(claimed).map((r) => r.team_id);
}

export async function markItemDone(
  sweepId: number,
  teamId: string,
): Promise<void> {
  await db
    .update(cheatCheckSweepItems)
    .set({ status: "done", error: null, updatedAt: new Date() })
    .where(itemKey(sweepId, teamId));
}

/**
 * Record a failed attempt. The item goes back to `pending` for another worker to
 * pick up, unless it has already burned its attempt budget — then it is `failed`
 * with the reason kept for the organizer to look at.
 */
export async function markItemAttemptFailed(
  sweepId: number,
  teamId: string,
  error: string,
): Promise<void> {
  await db
    .update(cheatCheckSweepItems)
    .set({
      // The cast is required: a bare CASE yields `text`, which Postgres won't
      // assign to an enum column.
      status: sql`(CASE WHEN ${cheatCheckSweepItems.attempts} >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END)::cheat_sweep_item_status`,
      error,
      updatedAt: new Date(),
    })
    .where(itemKey(sweepId, teamId));
}

/**
 * Put an item back without charging it an attempt. Used when the sweep was
 * turned away for rate-limiting rather than for anything wrong with the team.
 */
export async function releaseItem(
  sweepId: number,
  teamId: string,
): Promise<void> {
  await db
    .update(cheatCheckSweepItems)
    .set({
      status: "pending",
      attempts: sql`GREATEST(${cheatCheckSweepItems.attempts} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(itemKey(sweepId, teamId));
}

/** Reset items abandoned mid-flight by a worker that died. */
export async function releaseOrphanedItems(sweepId: number): Promise<number> {
  const reset = await db
    .update(cheatCheckSweepItems)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(cheatCheckSweepItems.sweepId, sweepId),
        eq(cheatCheckSweepItems.status, "running"),
      ),
    )
    .returning({ teamId: cheatCheckSweepItems.teamId });

  return reset.length;
}

export async function countPendingItems(sweepId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(cheatCheckSweepItems)
    .where(
      and(
        eq(cheatCheckSweepItems.sweepId, sweepId),
        inArray(cheatCheckSweepItems.status, ["pending", "running"]),
      ),
    );

  return row?.value ?? 0;
}

/** The user ids of every member of a team in this sweep. */
export async function getSweepMemberIds(sweepId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(
      cheatCheckSweepItems,
      eq(cheatCheckSweepItems.teamId, users.teamId),
    )
    .where(eq(cheatCheckSweepItems.sweepId, sweepId));

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Sweep lifecycle
// ---------------------------------------------------------------------------

export async function bumpHeartbeat(sweepId: number): Promise<void> {
  await db
    .update(cheatCheckSweeps)
    .set({ lastHeartbeatAt: new Date() })
    .where(eq(cheatCheckSweeps.id, sweepId));
}

export async function markHackerChecksDone(sweepId: number): Promise<void> {
  await db
    .update(cheatCheckSweeps)
    .set({ hackerChecksDone: true, lastHeartbeatAt: new Date() })
    .where(eq(cheatCheckSweeps.id, sweepId));
}

export async function setRateLimited(
  sweepId: number,
  until: Date,
): Promise<void> {
  await db
    .update(cheatCheckSweeps)
    .set({ rateLimitedUntil: until, lastHeartbeatAt: new Date() })
    .where(eq(cheatCheckSweeps.id, sweepId));
}

export async function finishSweep(sweepId: number): Promise<void> {
  await db
    .update(cheatCheckSweeps)
    .set({
      status: "completed",
      finishedAt: new Date(),
      lastHeartbeatAt: new Date(),
    })
    .where(eq(cheatCheckSweeps.id, sweepId));
}

export async function failSweep(sweepId: number, error: string): Promise<void> {
  await db
    .update(cheatCheckSweeps)
    .set({
      status: "failed",
      error,
      finishedAt: new Date(),
      lastHeartbeatAt: new Date(),
    })
    .where(eq(cheatCheckSweeps.id, sweepId));
}

// ---------------------------------------------------------------------------
// Operator surface
// ---------------------------------------------------------------------------

export interface SweepStatus {
  sweep: SweepRow;
  items: Record<"pending" | "running" | "done" | "failed", number>;
  /** True when the sweep says it's running but its worker has gone quiet. */
  stalled: boolean;
}

/** The running sweep, or the most recent one, with its item counts. */
export async function getSweepStatus(): Promise<SweepStatus | null> {
  const sweep =
    (await getRunningSweep()) ??
    (await db.query.cheatCheckSweeps.findFirst({
      orderBy: [desc(cheatCheckSweeps.startedAt)],
    }));

  if (!sweep) return null;

  const grouped = await db
    .select({ status: cheatCheckSweepItems.status, value: count() })
    .from(cheatCheckSweepItems)
    .where(eq(cheatCheckSweepItems.sweepId, sweep.id))
    .groupBy(cheatCheckSweepItems.status);

  const items = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const row of grouped) items[row.status] = row.value;

  const stalled =
    sweep.status === "running" &&
    sweep.lastHeartbeatAt.getTime() <
      Date.now() - STALLED_HEARTBEAT_MINUTES * 60_000;

  return { sweep, items, stalled };
}

/**
 * Re-kick a stalled or rate-limited sweep. Vercel Hobby cron only runs daily, so
 * recovery is organizer-driven rather than automatic.
 */
export async function resumeSweep(): Promise<{
  resumed: boolean;
  released: number;
}> {
  const sweep = await getRunningSweep();
  if (!sweep) return { resumed: false, released: 0 };

  await db
    .update(cheatCheckSweeps)
    .set({ rateLimitedUntil: null, lastHeartbeatAt: new Date() })
    .where(eq(cheatCheckSweeps.id, sweep.id));

  const released = await releaseOrphanedItems(sweep.id);
  await kickWorker();

  return { resumed: true, released };
}

// ---------------------------------------------------------------------------
// Worker invocation
// ---------------------------------------------------------------------------

function baseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL;
  return "http://localhost:3000";
}

export function sweepWorkerUrl(): string {
  return `${baseUrl().replace(/\/$/, "")}/api/cheat-check/sweep`;
}

/**
 * Poke the worker route without waiting for it to finish.
 *
 * The short abort is deliberate: awaiting briefly guarantees the request is
 * actually flushed before a serverless process freezes, while not blocking on
 * the child's whole run. The resulting `AbortError` is the success path.
 *
 * No-ops when `CHEAT_SWEEP_SECRET` is unset — the route would reject the call
 * anyway, and this is also what keeps tests from firing real HTTP at localhost.
 */
export async function kickWorker(): Promise<void> {
  if (!env.CHEAT_SWEEP_SECRET) {
    console.warn(
      "[cheat-check-sweep] CHEAT_SWEEP_SECRET is unset; not starting the worker",
    );
    return;
  }

  try {
    await fetch(sweepWorkerUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CHEAT_SWEEP_SECRET}` },
      signal: AbortSignal.timeout(1500),
    });
  } catch (error) {
    // An abort means the request went out and we stopped waiting — expected.
    if (error instanceof Error && error.name === "AbortError") return;
    if (error instanceof Error && error.name === "TimeoutError") return;
    console.error("[cheat-check-sweep] failed to kick the worker", error);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function itemKey(sweepId: number, teamId: string) {
  return and(
    eq(cheatCheckSweepItems.sweepId, sweepId),
    eq(cheatCheckSweepItems.teamId, teamId),
  );
}

/** Postgres `unique_violation`, however the driver chose to surface it. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505") return true;
  const cause = (error as { cause?: unknown }).cause;
  if (cause && (cause as { code?: unknown }).code === "23505") return true;
  return (
    error instanceof Error &&
    error.message.includes("cheat_check_sweep_active_idx")
  );
}
