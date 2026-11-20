/**
 * What the organizer Task pings tab lists: the next task pings waiting in
 * Slack, and a log of pings already out (task reminders whose time passed,
 * plus sponsor help posts), newest first. Pure, so it's tested without a DB.
 *
 * Slack holds a scheduled message and sends it itself; we never hear back
 * whether it went out. So a task ping whose time passed is "scheduled"
 * (handed to Slack for that time), not "sent". Only Slack refusing to take
 * it is stored, as "failed".
 */

import { parseTaskOwner } from "~/lib/task-owner";

/**
 * Task pings are switched off for the event (decisions 2026-11-19, "Turn off
 * task pings for now"): no automatic Slack sync after a sheet read and no
 * Task pings tab. The code stays so it can come back; flip this to turn the
 * automatic sync on again (and re-add "pings" to ORGANIZER_TABS for the tab).
 */
export const TASK_PINGS_ENABLED = false;

export const UP_NEXT_COUNT = 3;
export const PING_LOG_PAGE = 20;
export const PING_LOG_MAX = 200;

/** A task_reminder row, as much as the tab needs. */
export type ReminderRow = {
  id: string;
  task: string;
  owner: string;
  slackUserId: string | null;
  postAt: Date;
  status: "scheduled" | "cancelled" | "failed" | "sent-window-passed";
  error: string | null;
};

/** A sponsor_help_request row, as much as the log needs. */
export type HelpPingRow = {
  id: string;
  sponsorName: string;
  reason: string;
  createdAt: Date;
  /** The bot's channel post exists (slack_ts set). */
  postedToSlack: boolean;
  /** Re-pings sent in the Slack thread. */
  pingCount: number;
};

export type PingTarget = { kind: "dm"; name: string } | { kind: "channel" };

/** Where a task ping goes: the owner's DM (by name) or the team channel. */
export function reminderTarget(
  row: Pick<ReminderRow, "owner" | "slackUserId">,
): PingTarget {
  if (!row.slackUserId) return { kind: "channel" };
  const owner = parseTaskOwner(row.owner);
  return {
    kind: "dm",
    name: owner.kind === "person" ? owner.name : row.owner.trim(),
  };
}

export type UpNextPing = {
  id: string;
  at: Date;
  task: string;
  target: PingTarget;
};

/** The next few task pings waiting in Slack, soonest first. */
export function selectUpNext(
  rows: ReminderRow[],
  now: Date,
  count: number = UP_NEXT_COUNT,
): UpNextPing[] {
  return rows
    .filter((r) => r.status === "scheduled" && r.postAt > now)
    .sort((a, b) => a.postAt.getTime() - b.postAt.getTime())
    .slice(0, count)
    .map((r) => ({
      id: r.id,
      at: r.postAt,
      task: r.task,
      target: reminderTarget(r),
    }));
}

export type PingLogEntry =
  | {
      kind: "task";
      id: string;
      at: Date;
      task: string;
      target: PingTarget;
      /** "scheduled": Slack took it for this time; "failed": Slack refused. */
      status: "scheduled" | "failed";
      error: string | null;
    }
  | {
      kind: "help";
      id: string;
      at: Date;
      sponsorName: string;
      reason: string;
      target: { kind: "channel" };
      /** "not-posted": Slack was off or the post failed. */
      status: "posted" | "not-posted";
      pingCount: number;
    };

/**
 * Pings already out, newest first, capped at `limit`. Task reminders count
 * once their time has passed; cancelled ones (the task changed) never went
 * out and are left out. Help requests count from when they were made.
 */
export function buildPingLog(
  reminders: ReminderRow[],
  help: HelpPingRow[],
  now: Date,
  limit: number = PING_LOG_PAGE,
): { entries: PingLogEntry[]; hasMore: boolean } {
  const tasks: PingLogEntry[] = reminders
    .filter((r) => r.status !== "cancelled" && r.postAt <= now)
    .map((r) => ({
      kind: "task",
      id: r.id,
      at: r.postAt,
      task: r.task,
      target: reminderTarget(r),
      status: r.status === "failed" ? "failed" : "scheduled",
      error: r.status === "failed" ? r.error : null,
    }));
  const helps: PingLogEntry[] = help
    .filter((h) => h.createdAt <= now)
    .map((h) => ({
      kind: "help",
      id: h.id,
      at: h.createdAt,
      sponsorName: h.sponsorName,
      reason: h.reason,
      target: { kind: "channel" },
      status: h.postedToSlack ? "posted" : "not-posted",
      pingCount: h.pingCount,
    }));
  const all = [...tasks, ...helps].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id),
  );
  return { entries: all.slice(0, limit), hasMore: all.length > limit };
}

/**
 * A Slack mention as people read it: "<!here>" -> "@here",
 * "<!subteam^S1|@spon-team>" -> "@spon-team". Null when there's none or it
 * can't be shown (a user group with no handle).
 */
export function mentionLabel(
  mention: string | null | undefined,
): string | null {
  const m = mention?.trim();
  if (!m) return null;
  const special = /^<!(here|channel|everyone)(?:\|[^>]*)?>$/.exec(m);
  if (special) return `@${special[1]}`;
  const named = /^<!subteam\^[^|>]+\|@?([^>]+)>$/.exec(m);
  if (named) return `@${named[1]}`;
  return m.startsWith("<") ? null : m;
}
