import { createHash } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { taskRemindersCopy } from "~/content/task-reminders";
import { env } from "~/env";
import {
  compareRunOfShow,
  formatClock,
  type RunOfShowDay,
  type RunOfShowItem,
  type RunOfShowTask,
} from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { parseTaskOwner } from "~/lib/task-owner";
import {
  buildPingLog,
  mentionLabel,
  PING_LOG_PAGE,
  selectUpNext,
  UP_NEXT_COUNT,
  type PingLogEntry,
  type UpNextPing,
} from "~/lib/task-pings";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
  taskOwnerContacts,
  taskReminders,
  taskReminderSync,
} from "~/server/db/schema";
import { escapeSlackText } from "~/server/slack/client";
import { lookupSlackUser } from "~/server/slack/dm";
import {
  cancelScheduledMessage,
  MIN_SCHEDULE_AHEAD_MS,
  scheduleSlackMessage,
} from "~/server/slack/scheduled-messages";
import {
  getSlackDirectory,
  matchSlackUser,
  type SlackDirectoryUser,
} from "~/server/slack/directory";

/**
 * Slack reminders for run-of-show tasks (T49). At each task's start time its
 * owner gets a DM. The owner is matched to a Slack user by name through the
 * workspace directory (users.list), no setup needed. A task with no clear
 * owner ("All", several people, a per-company list) or a name that matches
 * nobody (or several people) on Slack is posted to the sponsor team channel
 * (SPONSOR_HELP_SLACK_CHANNEL) with @here so someone can grab it. Slack holds the message (chat.scheduleMessage)
 * and delivers it on time, so no cron is needed; this module keeps Slack's
 * scheduled messages in step with the sheet: new tasks are scheduled,
 * changed or removed ones are deleted. docs/decisions.md 2026-11-16 and
 * 2026-11-17.
 */

/** Reminders post at the task's start time (Jazz, 2026-11-16). */
export const REMINDER_LEAD_MS = 0;
export { MIN_SCHEDULE_AHEAD_MS };
export { lookupSlackUser, type SlackLookup } from "~/server/slack/dm";
/** The automatic sync runs at most this often (per instance and in the DB). */
export const AUTO_SYNC_THROTTLE_MS = 3 * 60_000;
/** Unchanged tasks are still re-synced after this long (owner emails change). */
export const AUTO_SYNC_STALE_MS = 10 * 60_000;
/** The request that triggered an automatic sync stops waiting after this. */
export const AUTO_SYNC_TIMEOUT_MS = 25_000;

const SYNC_ROW_ID = "run-of-show";
const LOCK_KEY = "task-reminders-sync";

type SheetTasks = { tasks: RunOfShowTask[]; items: RunOfShowItem[] };

export type TaskRef = {
  day: RunOfShowDay;
  start: string;
  task: string;
  owner: string | null;
};

// ---------------------------------------------------------------------------
// Pure planning
// ---------------------------------------------------------------------------

/** "  Jazz   Gu " -> "jazz gu". Owner names match on this. */
export function normalizeOwner(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Stable id of a task: any change to day, time, text or owner is a new key. */
export function taskKey(task: TaskRef): string {
  return sha256(
    JSON.stringify([
      task.day,
      task.start,
      task.task.trim(),
      normalizeOwner(task.owner ?? ""),
    ]),
  );
}

/** Hash of the whole task list, to tell whether the sheet changed. */
export function tasksHash(tasks: TaskRef[]): string {
  return sha256(JSON.stringify(tasks.map(taskKey).sort()));
}

/**
 * Where the task happens, when that's obvious: the one location of the
 * schedule items running at the task's start (main events first). Null when
 * none or several.
 */
export function taskLocation(
  task: Pick<TaskRef, "day" | "start">,
  items: RunOfShowItem[],
): string | null {
  const active = items.filter(
    (i) =>
      i.day === task.day &&
      i.location &&
      i.start <= task.start &&
      task.start < i.end,
  );
  const main = active.filter((i) => i.column === "big-event");
  const pool = main.length > 0 ? main : active;
  const locations = new Set(pool.map((i) => i.location!.trim()));
  return locations.size === 1 ? [...locations][0]! : null;
}

/** Mention at the top of channel posts; SPONSOR_HELP_SLACK_MENTION, default @here. */
export const DEFAULT_CHANNEL_MENTION = "<!here>";

/** DM text for an owner, or the channel text when no one person owns it. */
export function reminderText(
  task: TaskRef,
  items: RunOfShowItem[],
  target: "dm" | "channel" = "dm",
  mention: string = DEFAULT_CHANNEL_MENTION,
): string {
  const time = formatClock(task.start);
  const text = escapeSlackText(task.task.replace(/\s+/g, " ").trim());
  const location = taskLocation(task, items);
  const where = location ? escapeSlackText(location) : null;
  if (target === "channel") {
    const owner = task.owner?.replace(/\s+/g, " ").trim();
    return taskRemindersCopy.slack.channelText({
      mention,
      time,
      task: text,
      location: where,
      owner: owner ? escapeSlackText(owner) : null,
    });
  }
  return taskRemindersCopy.slack.text(time, text, where);
}

/** A saved email override (task_owner_contact), keyed by normalizeOwner. */
export type OwnerContact = {
  ownerKey: string;
  slackUserId: string | null;
};

/** How owners are matched to Slack users. */
export type OwnerLookup = {
  /** The workspace directory (users.list); null when it wasn't needed. */
  directory?: SlackDirectoryUser[] | null;
  /** Saved email matches; these win over the directory. */
  contacts?: OwnerContact[];
};

export type OwnerRoute =
  | { target: "dm"; slackUserId: string; name: string }
  | {
      target: "channel";
      reason:
        | "empty"
        | "everyone"
        | "several"
        | "per-company"
        | "no-match"
        | "ambiguous";
    };

/** Where one task's ping goes: a DM to its one owner, or the team channel. */
export function routeOwner(
  owner: string | null,
  lookup: OwnerLookup,
): OwnerRoute {
  const raw = owner?.trim() ?? "";
  const override = raw
    ? lookup.contacts?.find((c) => c.ownerKey === normalizeOwner(raw))
    : undefined;
  if (override?.slackUserId) {
    return { target: "dm", slackUserId: override.slackUserId, name: raw };
  }
  const parsed = parseTaskOwner(raw);
  if (parsed.kind === "none") return { target: "channel", reason: parsed.reason };
  const match = matchSlackUser(parsed.name, lookup.directory ?? []);
  if (match.status === "one") {
    return { target: "dm", slackUserId: match.userId, name: parsed.name };
  }
  return {
    target: "channel",
    reason: match.status === "many" ? "ambiguous" : "no-match",
  };
}

/** Whether any upcoming task needs the Slack directory to route. */
export function needsDirectory(tasks: TaskRef[], lookup: OwnerLookup): boolean {
  return tasks.some((t) => {
    const raw = t.owner?.trim() ?? "";
    if (parseTaskOwner(raw).kind !== "person") return false;
    const key = normalizeOwner(raw);
    return !lookup.contacts?.some((c) => c.ownerKey === key && c.slackUserId);
  });
}

export type DesiredReminder = {
  taskKey: string;
  /** Owner as in the sheet; "" when the task has none. */
  owner: string;
  task: string;
  /** "dm" to the one owner, "channel" to the sponsor team channel. */
  target: "dm" | "channel";
  /** The owner's Slack user (dm); null for channel posts. */
  slackUserId: string | null;
  /** The team channel for channel posts; null for DMs. */
  channel: string | null;
  postAt: Date;
  text: string;
  /** postAt is under MIN_SCHEDULE_AHEAD_MS away: Slack can't take it. */
  tooSoon: boolean;
  /** Hash of where and what: a change reschedules a kept reminder. */
  routeKey: string;
};

/** Hash of a reminder's destination and full text (mention included). */
export function routeKey(
  d: Pick<DesiredReminder, "target" | "slackUserId" | "channel" | "text">,
): string {
  return sha256(JSON.stringify([d.target, d.slackUserId, d.channel, d.text]));
}

export type ReminderPlan = {
  /** Upcoming tasks: DMs to matched owners, channel posts for the rest. */
  desired: DesiredReminder[];
  /** Tasks that need the channel while no channel is configured: skipped. */
  noChannelTasks: TaskRef[];
};

/**
 * What reminders should exist right now. Only tasks whose reminder time is
 * still ahead count; past ones are left alone. `channel` is the sponsor team
 * channel for tasks with no clear owner on Slack (null = not configured:
 * skip them).
 */
export function planTaskReminders(
  tasks: TaskRef[],
  items: RunOfShowItem[],
  lookup: OwnerLookup,
  now: Date,
  channel: string | null = null,
  mention: string = DEFAULT_CHANNEL_MENTION,
): ReminderPlan {
  const desired = new Map<string, DesiredReminder>();
  const noChannelTasks: TaskRef[] = [];

  for (const task of [...tasks].sort(compareRunOfShow)) {
    const postAt = new Date(
      runOfShowInstant(task.day, task.start).getTime() - REMINDER_LEAD_MS,
    );
    if (postAt <= now) continue;
    const route = routeOwner(task.owner, lookup);
    if (route.target === "channel" && !channel) {
      noChannelTasks.push(task);
      continue;
    }
    const key = taskKey(task);
    if (desired.has(key)) continue; // the same task twice in the sheet
    const where = {
      target: route.target,
      slackUserId: route.target === "dm" ? route.slackUserId : null,
      channel: route.target === "channel" ? channel : null,
      text: reminderText(task, items, route.target, mention),
    };
    desired.set(key, {
      taskKey: key,
      owner: task.owner?.trim() ?? "",
      task: task.task,
      ...where,
      postAt,
      tooSoon: postAt.getTime() < now.getTime() + MIN_SCHEDULE_AHEAD_MS,
      routeKey: routeKey(where),
    });
  }
  return { desired: [...desired.values()], noChannelTasks };
}

export type StoredReminder = {
  id: string;
  taskKey: string;
  slackUserId: string | null;
  postAt: Date;
  status: "scheduled" | "failed";
  slackChannel: string | null;
  scheduledMessageId: string | null;
  /** Null on rows from before 0047: treated as changed. */
  routeKey: string | null;
};

/** What the diff needs from a planned message (sponsor or ops pings). */
export type DiffDesired = Pick<
  DesiredReminder,
  "taskKey" | "routeKey" | "postAt" | "tooSoon"
>;

/** What the diff needs from a stored message. */
export type DiffStored = Omit<StoredReminder, "slackUserId">;

export type ReminderDiff<
  D extends DiffDesired = DesiredReminder,
  S extends DiffStored = StoredReminder,
> = {
  /** Scheduled and still right: leave alone. */
  keep: string[];
  /** Scheduled, post time passed: Slack has sent it. */
  passed: string[];
  /** Scheduled but no longer wanted: delete in Slack, then cancel. */
  cancel: S[];
  /** Failed and no longer wanted: mark cancelled (nothing in Slack). */
  drop: string[];
  /** To schedule; retryId reuses a failed row for the same task. */
  create: (D & { retryId?: string })[];
  /** Wanted but too close to schedule, and not already scheduled. */
  tooSoon: D[];
};

/** Compare stored reminders with the plan. Pure; the sync applies it. */
export function diffReminders<
  D extends DiffDesired = DesiredReminder,
  S extends DiffStored = StoredReminder,
>(stored: S[], desired: D[], now: Date): ReminderDiff<D, S> {
  const want = new Map(desired.map((d) => [d.taskKey, d]));
  const kept = new Set<string>();
  const diff: ReminderDiff<D, S> = {
    keep: [],
    passed: [],
    cancel: [],
    drop: [],
    create: [],
    tooSoon: [],
  };

  for (const row of stored.filter((r) => r.status === "scheduled")) {
    if (row.postAt <= now) {
      diff.passed.push(row.id);
      continue;
    }
    const d = want.get(row.taskKey);
    if (
      d &&
      !kept.has(row.taskKey) &&
      d.routeKey === row.routeKey &&
      d.postAt.getTime() === row.postAt.getTime()
    ) {
      kept.add(row.taskKey);
      diff.keep.push(row.id);
    } else {
      diff.cancel.push(row);
    }
  }

  const retry = new Map<string, string>();
  for (const row of stored.filter((r) => r.status === "failed")) {
    if (
      want.has(row.taskKey) &&
      !kept.has(row.taskKey) &&
      !retry.has(row.taskKey)
    ) {
      retry.set(row.taskKey, row.id);
    } else {
      diff.drop.push(row.id);
    }
  }

  for (const d of desired) {
    if (kept.has(d.taskKey)) continue;
    if (d.tooSoon) {
      diff.tooSoon.push(d);
      // A failed row for a task we can no longer schedule is closed out.
      const retryId = retry.get(d.taskKey);
      if (retryId) diff.drop.push(retryId);
      continue;
    }
    diff.create.push({ ...d, retryId: retry.get(d.taskKey) });
  }
  return diff;
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

type SlackDeps = {
  token?: string;
  fetch?: typeof fetch;
  /** Sponsor team channel; defaults to SPONSOR_HELP_SLACK_CHANNEL. */
  channel?: string | null;
  /** Channel-post mention; defaults to SPONSOR_HELP_SLACK_MENTION or @here. */
  mention?: string;
};

function slackToken(deps: SlackDeps): string | undefined {
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  return token?.length ? token : undefined;
}

function teamChannel(deps: SlackDeps): string | null {
  const channel =
    "channel" in deps ? deps.channel : env.SPONSOR_HELP_SLACK_CHANNEL;
  const trimmed = channel?.trim();
  return trimmed?.length ? trimmed : null;
}

function channelMention(deps: SlackDeps): string {
  if ("mention" in deps && deps.mention !== undefined) return deps.mention;
  return env.SPONSOR_HELP_SLACK_MENTION ?? DEFAULT_CHANNEL_MENTION;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncDeps = SlackDeps & {
  /** Defaults to the cached sheet (getRunOfShow). */
  readSheet?: () => Promise<SheetTasks>;
};

export type SyncResult =
  | {
      ok: true;
      /** Reminders waiting in Slack after the sync. */
      scheduled: number;
      created: number;
      cancelled: number;
      failed: number;
      tooSoon: number;
      /** New reminders held back because the old one couldn't be deleted. */
      deferred: number;
      /** Planned pings that go to the team channel (no clear owner). */
      toChannel: number;
      /** Unowned tasks skipped because no team channel is configured. */
      noChannelTasks: number;
    }
  | { ok: false; reason: "no-token" | "sheet-error" | "error" };

/**
 * Make Slack's scheduled messages match the sheet. Idempotent; concurrent
 * runs queue on a Postgres advisory lock. Never throws: Slack errors are
 * stored on the reminder, anything else comes back as { ok: false }.
 */
export async function syncTaskReminders(
  now: Date = new Date(),
  deps: SyncDeps = {},
): Promise<SyncResult> {
  const token = slackToken(deps);
  if (!token) return { ok: false, reason: "no-token" };
  const fetchImpl = deps.fetch ?? fetch;

  let sheet: SheetTasks;
  try {
    sheet = await (deps.readSheet ?? getRunOfShow)();
  } catch (error) {
    console.error("task reminders: sheet read failed", error);
    return { ok: false, reason: "sheet-error" };
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`,
      );

      // Owners: look each saved email up once and cache the Slack user id.
      const ownerKeys = new Set(
        sheet.tasks.flatMap((t) => (t.owner ? [normalizeOwner(t.owner)] : [])),
      );
      const contacts = await tx.select().from(taskOwnerContacts);
      for (const c of contacts) {
        if (!ownerKeys.has(c.ownerKey) || !c.slackEmail) continue;
        if (c.slackUserId !== null || c.lookedUpAt !== null) continue;
        const found = await lookupSlackUser(token, c.slackEmail, fetchImpl);
        if (found.status === "error") {
          console.error("task reminders: Slack lookup failed:", found.code);
          continue; // try again next sync
        }
        c.slackUserId = found.status === "found" ? found.userId : null;
        c.lookedUpAt = now;
        await tx
          .update(taskOwnerContacts)
          .set({ slackUserId: c.slackUserId, lookedUpAt: now })
          .where(eq(taskOwnerContacts.ownerKey, c.ownerKey));
      }

      const lookup: OwnerLookup = { contacts };
      if (needsDirectory(sheet.tasks, lookup)) {
        // Throws when Slack refuses: the sync stops and existing reminders
        // stay put rather than all falling back to the channel.
        lookup.directory = await getSlackDirectory(token, fetchImpl);
      }
      const plan = planTaskReminders(
        sheet.tasks,
        sheet.items,
        lookup,
        now,
        teamChannel(deps),
        channelMention(deps),
      );
      const stored = (await tx
        .select({
          id: taskReminders.id,
          taskKey: taskReminders.taskKey,
          slackUserId: taskReminders.slackUserId,
          postAt: taskReminders.postAt,
          status: taskReminders.status,
          slackChannel: taskReminders.slackChannel,
          scheduledMessageId: taskReminders.scheduledMessageId,
          routeKey: taskReminders.routeKey,
        })
        .from(taskReminders)
        .where(
          inArray(taskReminders.status, ["scheduled", "failed"]),
        )) as StoredReminder[];
      const diff = diffReminders(stored, plan.desired, now);

      if (diff.passed.length > 0) {
        await tx
          .update(taskReminders)
          .set({ status: "sent-window-passed" })
          .where(inArray(taskReminders.id, diff.passed));
      }
      if (diff.drop.length > 0) {
        await tx
          .update(taskReminders)
          .set({ status: "cancelled" })
          .where(inArray(taskReminders.id, diff.drop));
      }

      let cancelled = diff.drop.length;
      // Tasks whose old message couldn't be deleted: scheduling the new one
      // too would send two, so they wait for the next sync.
      const stuck = new Set<string>();
      for (const row of diff.cancel) {
        const outcome = await cancelScheduledMessage(token, row, fetchImpl);
        await tx
          .update(taskReminders)
          .set(
            outcome.status === "cancelled"
              ? { status: "cancelled", error: null }
              : outcome.status === "gone"
                ? { status: "cancelled", error: outcome.code }
                : // Still in Slack: stays "scheduled" so the next sync retries.
                  { error: `cancel: ${outcome.code}`.slice(0, 255) },
          )
          .where(eq(taskReminders.id, row.id));
        if (outcome.status === "stuck") stuck.add(row.taskKey);
        else cancelled++;
      }

      const dmChannels = new Map<string, string>();
      let created = 0;
      let failed = 0;
      let deferred = 0;
      for (const d of diff.create) {
        if (stuck.has(d.taskKey)) {
          deferred++;
          continue;
        }
        const userId = d.slackUserId;
        const res = await scheduleSlackMessage(
          token,
          { slackUserId: userId, channel: d.channel },
          d.postAt,
          d.text,
          dmChannels,
          fetchImpl,
        );
        const values: Pick<
          typeof taskReminders.$inferInsert,
          "status" | "slackChannel" | "scheduledMessageId" | "error"
        > = res.ok
          ? {
              status: "scheduled",
              slackChannel: res.slackChannel,
              scheduledMessageId: res.scheduledMessageId,
              error: null,
            }
          : {
              status: "failed",
              slackChannel: res.slackChannel,
              scheduledMessageId: null,
              error: res.code,
            };
        if (res.ok) created++;
        else failed++;
        const row = {
          taskKey: d.taskKey,
          owner: d.owner.slice(0, 255),
          task: d.task,
          slackUserId: userId,
          routeKey: d.routeKey,
          postAt: d.postAt,
          ...values,
        };
        if (d.retryId) {
          await tx
            .update(taskReminders)
            .set(row)
            .where(eq(taskReminders.id, d.retryId));
        } else {
          await tx.insert(taskReminders).values(row);
        }
      }

      const hash = tasksHash(sheet.tasks);
      await tx
        .insert(taskReminderSync)
        .values({ id: SYNC_ROW_ID, tasksHash: hash, lastSyncedAt: now })
        .onConflictDoUpdate({
          target: taskReminderSync.id,
          set: { tasksHash: hash, lastSyncedAt: now },
        });

      const [counted] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(taskReminders)
        .where(
          and(
            eq(taskReminders.status, "scheduled"),
            gt(taskReminders.postAt, now),
          ),
        );

      return {
        ok: true as const,
        scheduled: counted?.count ?? 0,
        created,
        cancelled,
        failed,
        tooSoon: diff.tooSoon.length,
        deferred,
        toChannel: plan.desired.filter((d) => d.target === "channel").length,
        noChannelTasks: plan.noChannelTasks.length,
      };
    });
  } catch (error) {
    console.error("task reminders: sync failed", error);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Automatic sync after a sheet read
// ---------------------------------------------------------------------------

let lastKickoff = 0;

/** Tests only: forget this instance's last automatic sync. */
export function resetAutoSyncThrottle(): void {
  lastKickoff = 0;
}

export type AutoSyncOutcome = {
  status: "started" | "throttled" | "unchanged" | "no-token" | "error";
  /** The sync, bounded by AUTO_SYNC_TIMEOUT_MS ("timeout" after that). */
  run?: Promise<SyncResult | "timeout">;
};

/**
 * Called after each fresh read of the sheet. Syncs when the tasks changed
 * since the last sync, or that sync is over 10 minutes old; at most once
 * every 3 minutes (in memory, and across instances via the sync row).
 * Never throws; callers don't wait for the sync.
 */
export async function maybeAutoSyncTaskReminders(
  sheet: SheetTasks,
  options: SlackDeps & { now?: Date } = {},
): Promise<AutoSyncOutcome> {
  const token = slackToken(options);
  if (!token) return { status: "no-token" };
  const now = options.now ?? new Date();
  if (now.getTime() - lastKickoff < AUTO_SYNC_THROTTLE_MS) {
    return { status: "throttled" };
  }
  try {
    const hash = tasksHash(sheet.tasks);
    const [state] = await db
      .select()
      .from(taskReminderSync)
      .where(eq(taskReminderSync.id, SYNC_ROW_ID));
    if (
      state?.tasksHash === hash &&
      state.lastSyncedAt &&
      now.getTime() - state.lastSyncedAt.getTime() < AUTO_SYNC_STALE_MS
    ) {
      return { status: "unchanged" };
    }
    // Claim the slot: only one instance per 3 minutes gets a row back.
    const cutoff = new Date(now.getTime() - AUTO_SYNC_THROTTLE_MS);
    const claimed = await db
      .insert(taskReminderSync)
      .values({ id: SYNC_ROW_ID, lastAttemptAt: now })
      .onConflictDoUpdate({
        target: taskReminderSync.id,
        set: { lastAttemptAt: now },
        setWhere: or(
          isNull(taskReminderSync.lastAttemptAt),
          lt(taskReminderSync.lastAttemptAt, cutoff),
        ),
      })
      .returning({ id: taskReminderSync.id });
    if (claimed.length === 0) return { status: "throttled" };
    lastKickoff = now.getTime();

    const sync = syncTaskReminders(now, {
      ...options,
      token,
      readSheet: async () => sheet,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), AUTO_SYNC_TIMEOUT_MS);
    });
    const run = Promise.race([sync, timeout]).finally(() =>
      clearTimeout(timer),
    );
    return { status: "started", run };
  } catch (error) {
    console.error("task reminders: automatic sync failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Organizer views
// ---------------------------------------------------------------------------

export type TaskReminderStatus = {
  slackConnected: boolean;
  /** The sponsor team channel is set (pings with no clear owner go there). */
  channelConfigured: boolean;
  /** The channel posts' mention as people read it ("@here"), or null. */
  channelMention: string | null;
  /** Sponsor help posts' mention (no @here default there), or null. */
  helpMention: string | null;
  /** When the next scheduled ping goes out; null when none is waiting. */
  nextPingAt: Date | null;
  /** Upcoming pings Slack refused to schedule (retried on the next sync). */
  failed: number;
};

/** The small status line on the Task pings panel. Reads the DB only. */
export async function getTaskReminderStatus(
  now: Date = new Date(),
  deps: Pick<SlackDeps, "token" | "channel" | "mention"> = {},
): Promise<TaskReminderStatus> {
  const upcoming = await db
    .select({ status: taskReminders.status, postAt: taskReminders.postAt })
    .from(taskReminders)
    .where(
      and(
        inArray(taskReminders.status, ["scheduled", "failed"]),
        gt(taskReminders.postAt, now),
      ),
    )
    .orderBy(taskReminders.postAt);
  return {
    slackConnected: Boolean(slackToken(deps)),
    channelConfigured: teamChannel(deps) !== null,
    channelMention: mentionLabel(channelMention(deps)),
    helpMention: mentionLabel(
      "mention" in deps ? deps.mention : env.SPONSOR_HELP_SLACK_MENTION,
    ),
    nextPingAt: upcoming.find((r) => r.status === "scheduled")?.postAt ?? null,
    failed: upcoming.filter((r) => r.status === "failed").length,
  };
}

// ---------------------------------------------------------------------------
// Task pings tab: up next, recently resolved help, ping log
// ---------------------------------------------------------------------------

export type ResolvedHelp = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  reason: string;
  claimedByName: string | null;
  resolvedAt: Date;
};

export type TaskPingActivity = {
  upNext: UpNextPing[];
  log: PingLogEntry[];
  hasMore: boolean;
  /** The last few resolved help requests, newest first. */
  recentlyResolved: ResolvedHelp[];
};

const RECENTLY_RESOLVED = 5;

const reminderColumns = {
  id: taskReminders.id,
  task: taskReminders.task,
  owner: taskReminders.owner,
  slackUserId: taskReminders.slackUserId,
  postAt: taskReminders.postAt,
  status: taskReminders.status,
  error: taskReminders.error,
};

/** Organizer-only data for the Task pings tab. Reads the DB only. */
export async function getTaskPingActivity(
  now: Date = new Date(),
  limit: number = PING_LOG_PAGE,
): Promise<TaskPingActivity> {
  // One more than asked from each source tells whether there's more.
  const [upcoming, past, help, resolved] = await Promise.all([
    db
      .select(reminderColumns)
      .from(taskReminders)
      .where(
        and(eq(taskReminders.status, "scheduled"), gt(taskReminders.postAt, now)),
      )
      .orderBy(asc(taskReminders.postAt))
      .limit(UP_NEXT_COUNT),
    db
      .select(reminderColumns)
      .from(taskReminders)
      .where(
        and(
          inArray(taskReminders.status, [
            "scheduled",
            "sent-window-passed",
            "failed",
          ]),
          lte(taskReminders.postAt, now),
        ),
      )
      .orderBy(desc(taskReminders.postAt))
      .limit(limit + 1),
    db
      .select({
        id: sponsorHelpRequests.id,
        sponsorName: sponsorJudgingSponsors.name,
        reason: sponsorHelpRequests.reason,
        createdAt: sponsorHelpRequests.createdAt,
        postedToSlack: sql<boolean>`${sponsorHelpRequests.slackTs} is not null`,
        pingCount: sponsorHelpRequests.pingCount,
      })
      .from(sponsorHelpRequests)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorHelpRequests.sponsorId),
      )
      .where(lte(sponsorHelpRequests.createdAt, now))
      .orderBy(desc(sponsorHelpRequests.createdAt))
      .limit(limit + 1),
    db
      .select({
        id: sponsorHelpRequests.id,
        sponsorId: sponsorHelpRequests.sponsorId,
        sponsorName: sponsorJudgingSponsors.name,
        reason: sponsorHelpRequests.reason,
        claimedByName: sponsorHelpRequests.claimedByName,
        resolvedAt: sponsorHelpRequests.resolvedAt,
      })
      .from(sponsorHelpRequests)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorHelpRequests.sponsorId),
      )
      .where(
        and(
          eq(sponsorHelpRequests.status, "resolved"),
          isNotNull(sponsorHelpRequests.resolvedAt),
        ),
      )
      .orderBy(desc(sponsorHelpRequests.resolvedAt))
      .limit(RECENTLY_RESOLVED),
  ]);
  const { entries, hasMore } = buildPingLog(past, help, now, limit);
  return {
    upNext: selectUpNext(upcoming, now),
    log: entries,
    hasMore,
    recentlyResolved: resolved.map((r) => ({ ...r, resolvedAt: r.resolvedAt! })),
  };
}
