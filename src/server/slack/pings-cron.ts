import type { StateStore } from "./bot-state";

/**
 * The Vercel cron for both Slack ping bots (src/pages/api/cron/pings.ts):
 * once a minute, sync organizer run-of-show DMs and Auto-Ping (mentor,
 * volunteer, judge) DMs with their sheets, the same --sync a laptop runs.
 *
 * PINGS_CRON: "off" (default) does nothing, "dry-run" reads everything and
 * changes nothing, "live" syncs. Both bots treat "disabled" as "cancel
 * everything queued", so live refuses to run unless both are enabled: a
 * missing Vercel setting must never wipe the queue.
 */

export const PINGS_CRON_MODES = ["off", "dry-run", "live"] as const;
export type PingsCronMode = (typeof PINGS_CRON_MODES)[number];

/** The bots' own on-switches; live needs both set to "1". */
export const ENABLE_FLAGS = [
  "ORGANIZER_NOTIFICATIONS_ENABLED",
  "AUTO_PING_ENABLED",
] as const;

/** Auto-Ping's final thank you: from Sun Nov 22 6:00 PM ET, until it goes once. */
export const FINAL_AT = Date.parse("2026-11-22T18:00:00-05:00");
export const FINAL_SENT_KEY = "auto-ping:final-sent";

type Env = Record<string, string | undefined>;

export type CronDecision =
  | { run: false; reason: string; failed: boolean }
  | { run: true; dryRun: boolean };

export function decide(env: Env): CronDecision {
  const raw = env.PINGS_CRON?.trim();
  const mode = (raw ? raw : "off") as PingsCronMode;
  if (!PINGS_CRON_MODES.includes(mode))
    return {
      run: false,
      failed: true,
      reason: `PINGS_CRON is "${mode}"; use off, dry-run or live`,
    };
  if (mode === "off")
    return { run: false, failed: false, reason: "PINGS_CRON is off" };
  if (mode === "live") {
    const off = ENABLE_FLAGS.filter((k) => env[k]?.trim() !== "1");
    if (off.length)
      return {
        run: false,
        failed: true,
        reason: `Refusing to sync live with ${off.join(" and ")} not "1": a disabled bot cancels its whole queue`,
      };
  }
  return { run: true, dryRun: mode === "dry-run" };
}

export type CronDeps = {
  env: Env;
  store: StateStore;
  now?: () => number;
  organizer: (dryRun: boolean) => Promise<string | undefined>;
  autoPingSync: (dryRun: boolean) => Promise<string | undefined>;
  autoPingFinal: (dryRun: boolean) => Promise<string | undefined>;
};

export type CronResult = {
  mode: "dry-run" | "live";
  organizer: string;
  autoPing: string;
  final?: string;
  /** True when either sync threw (the final thank you waiting isn't a failure). */
  failed: boolean;
};

const message = (error: unknown) =>
  `error: ${error instanceof Error ? error.message : String(error)}`;

/** One cron pass. Each bot runs even if the other fails. */
export async function runPings(
  deps: CronDeps,
  dryRun: boolean,
): Promise<CronResult> {
  const now = deps.now ?? Date.now;
  let failed = false;
  const attempt = async (fn: () => Promise<string | undefined>) => {
    try {
      return (await fn()) ?? "done";
    } catch (error) {
      failed = true;
      return message(error);
    }
  };
  const result: CronResult = {
    mode: dryRun ? "dry-run" : "live",
    organizer: await attempt(() => deps.organizer(dryRun)),
    autoPing: await attempt(() => deps.autoPingSync(dryRun)),
    failed: false,
  };
  if (now() >= FINAL_AT && !(await deps.store.get(FINAL_SENT_KEY))) {
    try {
      // Refuses while {hackers} or {projects} is blank and skips anyone
      // already thanked, so trying every minute is safe (as on the laptop).
      result.final = (await deps.autoPingFinal(dryRun)) ?? "done";
      if (!dryRun)
        await deps.store.set(FINAL_SENT_KEY, new Date(now()).toISOString());
    } catch (error) {
      result.final = message(error);
    }
  }
  result.failed = failed;
  return result;
}
