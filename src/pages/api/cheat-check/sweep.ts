/**
 * The cheat-check sweep worker.
 *
 * One invocation claims batches of teams off `cheat_check_sweep_item`, runs
 * their checks, and — if work remains when its time budget runs out — re-invokes
 * itself. Vercel Hobby caps functions at 60s and cron at daily granularity, so
 * chaining is how a sweep of a few hundred teams gets finished at all; the
 * organizer-facing `cheatCheck.resumeSweep` is the safety net if a link in the
 * chain dies.
 *
 * Unlike every other route here this authenticates with a shared secret rather
 * than a session: the chained self-invocation has no user behind it.
 */
import { timingSafeEqual } from "node:crypto";
import { type NextApiRequest, type NextApiResponse } from "next";
import { env } from "~/env";
import { GithubRateLimitError } from "~/utils/github";
import {
  SWEEP_CONCURRENCY,
  SWEEP_TIME_BUDGET_MS,
  bumpHeartbeat,
  claimBatch,
  countItemsWithStatus,
  failSweep,
  finishSweep,
  getRunningSweep,
  getSweepMemberIds,
  kickWorker,
  markHackerChecksDone,
  markItemAttemptFailed,
  markItemDone,
  releaseItem,
  setRateLimited,
} from "~/server/api/utils/cheat-check-sweep";
import {
  SYSTEM_USER_ID,
  ensureSystemUser,
  runAllTeamChecks,
  runHackerChecksBulk,
} from "~/server/api/utils/cheat-check-runners";

export const config = { maxDuration: 60 };

function isAuthorized(req: NextApiRequest): boolean {
  const secret = env.CHEAT_SWEEP_SECRET;
  if (!secret) return false;

  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Run `task` over `items` with at most `limit` in flight. A shared cursor plus
 * `limit` workers — enough for what we need, and it keeps the dependency list
 * where it is.
 */
async function withConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!;
        await task(item);
      }
    })(),
  );
  await Promise.all(workers);
}

function findRateLimit(failures: unknown[]): GithubRateLimitError | undefined {
  return failures.find(
    (f): f is GithubRateLimitError => f instanceof GithubRateLimitError,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!env.CHEAT_SWEEP_SECRET) {
    return res
      .status(503)
      .json({ message: "Cheat check sweeps are not configured" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const startedAt = Date.now();
  const sweep = await getRunningSweep();
  if (!sweep) {
    return res.status(200).json({ message: "No sweep is running" });
  }

  if (sweep.rateLimitedUntil && sweep.rateLimitedUntil > new Date()) {
    return res.status(200).json({
      message: "Rate limited",
      until: sweep.rateLimitedUntil.toISOString(),
    });
  }

  try {
    // Every result this worker writes is attributed to the system user, and
    // `checked_by_user_id` is a NOT NULL foreign key — so make sure the actor
    // exists rather than trusting whoever created the sweep to have done it.
    await ensureSystemUser();

    // The hacker checks are pure DB reads over every member of a swept team, so
    // they run once for the whole sweep instead of per team.
    if (!sweep.hackerChecksDone) {
      const memberIds = await getSweepMemberIds(sweep.id);
      await runHackerChecksBulk(memberIds, SYSTEM_USER_ID, {
        forceRerun: sweep.forceRerun,
      });
      await markHackerChecksDone(sweep.id);
    }

    let processed = 0;
    let rateLimit: GithubRateLimitError | undefined;
    // Teams this invocation already attempted. Excluding them from later claims
    // means a failed item waits for the next chain link instead of burning its
    // whole retry budget in seconds against the same transient error.
    const attempted: string[] = [];

    while (Date.now() - startedAt < SWEEP_TIME_BUDGET_MS && !rateLimit) {
      const teamIds = await claimBatch(sweep.id, SWEEP_CONCURRENCY, attempted);
      if (teamIds.length === 0) break;
      attempted.push(...teamIds);

      await withConcurrency(teamIds, SWEEP_CONCURRENCY, async (teamId) => {
        try {
          const { failures } = await runAllTeamChecks(teamId, SYSTEM_USER_ID, {
            forceRerun: sweep.forceRerun,
          });

          const limited = findRateLimit(failures);
          if (limited) {
            // Not this team's fault — hand it back without charging an attempt.
            rateLimit ??= limited;
            await releaseItem(sweep.id, teamId);
            return;
          }

          if (failures.length > 0) {
            await markItemAttemptFailed(
              sweep.id,
              teamId,
              failures
                .map((f) => (f instanceof Error ? f.message : String(f)))
                .join("; "),
            );
            return;
          }

          await markItemDone(sweep.id, teamId);
          processed++;
        } catch (error) {
          if (error instanceof GithubRateLimitError) {
            rateLimit ??= error;
            await releaseItem(sweep.id, teamId);
            return;
          }
          await markItemAttemptFailed(
            sweep.id,
            teamId,
            error instanceof Error ? error.message : String(error),
          );
        }
      });

      await bumpHeartbeat(sweep.id);
    }

    if (rateLimit) {
      await setRateLimited(sweep.id, rateLimit.resetAt);
      return res.status(200).json({
        message: "Rate limited; sweep paused",
        processed,
        until: rateLimit.resetAt.toISOString(),
      });
    }

    // Chain only on strictly-pending work. Items in `running` belong to another
    // worker (an overlapped chain link, or a resume racing a live worker) —
    // counting them here would make a worker that claimed nothing re-kick
    // instantly, forever: a hot HTTP self-invocation loop.
    const pending = await countItemsWithStatus(sweep.id, ["pending"]);
    if (pending > 0) {
      await kickWorker();
      return res
        .status(200)
        .json({ message: "Batch done; chained", processed, pending });
    }

    const inFlight = await countItemsWithStatus(sweep.id, ["running"]);
    if (inFlight > 0) {
      // The worker holding those items finishes or chains; if it died instead,
      // the heartbeat goes stale and `resumeSweep` recovers them.
      return res
        .status(200)
        .json({
          message: "Another worker owns the remaining items",
          processed,
        });
    }

    await finishSweep(sweep.id);
    return res.status(200).json({ message: "Sweep complete", processed });
  } catch (error) {
    // Never leave a sweep stuck in `running` because of an unexpected throw.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cheat-check-sweep] worker failed", error);
    await failSweep(sweep.id, message);
    return res.status(500).json({ message: "Sweep failed", error: message });
  }
}
