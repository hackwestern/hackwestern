import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

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
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  taskOwnerContacts,
  taskReminders,
  taskReminderSync,
} from "~/server/db/schema";
import {
  SlackApiError,
  escapeSlackText,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

/**
 * Slack reminders for run-of-show tasks (T49). At each task's start time its
 * owner gets a DM; a task with no owner, or an owner not matched to a Slack
 * user, is posted to the sponsor team channel (SPONSOR_HELP_SLACK_CHANNEL)
 * so someone can grab it. Slack holds the message (chat.scheduleMessage)
 * and delivers it on time, so no cron is needed; this module keeps Slack's
 * scheduled messages in step with the sheet: new tasks are scheduled,
 * changed or removed ones are deleted. docs/decisions.md 2026-11-16.
 */

/** Reminders post at the task's start time (Jazz, 2026-11-16). */
export const REMINDER_LEAD_MS = 0;
/** Slack refuses a post_at in the past; keep a margin for clock skew. */
export const MIN_SCHEDULE_AHEAD_MS = 90_000;
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

/** DM text for an owner, or the channel text when nobody owns it on Slack. */
export function reminderText(
  task: TaskRef,
  items: RunOfShowItem[],
  target: "dm" | "channel" = "dm",
): string {
  const time = formatClock(task.start);
  const text = escapeSlackText(task.task.replace(/\s+/g, " ").trim());
  if (target === "channel") {
    return taskRemindersCopy.slack.channelText(time, text);
  }
  const location = taskLocation(task, items);
  return taskRemindersCopy.slack.text(
    time,
    text,
    location ? escapeSlackText(location) : null,
  );
}

export type OwnerContact = {
  ownerKey: string;
  slackUserId: string | null;
};

export type DesiredReminder = {
  taskKey: string;
  /** Owner as in the sheet; "" when the task has none. */
  owner: string;
  task: string;
  /** "dm" to the matched owner, "channel" to the sponsor team channel. */
  target: "dm" | "channel";
  /** The owner's Slack user (dm); null for channel posts. */
  slackUserId: string | null;
  /** The team channel for channel posts; null for DMs. */
  channel: string | null;
  postAt: Date;
  text: string;
  /** postAt is under MIN_SCHEDULE_AHEAD_MS away: Slack can't take it. */
  tooSoon: boolean;
};

export type ReminderPlan = {
  /** Upcoming tasks: DMs to matched owners, channel posts for the rest. */
  desired: DesiredReminder[];
  /** Owner names (as in the sheet) with no Slack user yet. */
  unmatchedOwners: string[];
  /** Upcoming tasks with an empty Owner cell. */
  noOwnerTasks: TaskRef[];
  /** Tasks that need the channel while no channel is configured: skipped. */
  noChannelTasks: TaskRef[];
};

/**
 * What reminders should exist right now. Only tasks whose reminder time is
 * still ahead count; past ones are left alone. `channel` is the sponsor team
 * channel for tasks nobody owns on Slack (null = not configured: skip them).
 */
export function planTaskReminders(
  tasks: TaskRef[],
  items: RunOfShowItem[],
  contacts: OwnerContact[],
  now: Date,
  channel: string | null = null,
): ReminderPlan {
  const userByOwner = new Map(
    contacts.map((c) => [c.ownerKey, c.slackUserId] as const),
  );
  const desired = new Map<string, DesiredReminder>();
  const unmatched = new Map<string, string>();
  const noOwnerTasks: TaskRef[] = [];
  const noChannelTasks: TaskRef[] = [];

  const add = (
    task: TaskRef,
    postAt: Date,
    owner: string,
    slackUserId: string | null,
  ) => {
    const target = slackUserId ? "dm" : "channel";
    if (target === "channel" && !channel) {
      noChannelTasks.push(task);
      return;
    }
    const key = taskKey(task);
    if (desired.has(key)) return; // the same task twice in the sheet
    desired.set(key, {
      taskKey: key,
      owner,
      task: task.task,
      target,
      slackUserId,
      channel: target === "channel" ? channel : null,
      postAt,
      text: reminderText(task, items, target),
      tooSoon: postAt.getTime() < now.getTime() + MIN_SCHEDULE_AHEAD_MS,
    });
  };

  for (const task of [...tasks].sort(compareRunOfShow)) {
    const postAt = new Date(
      runOfShowInstant(task.day, task.start).getTime() - REMINDER_LEAD_MS,
    );
    if (postAt <= now) continue;
    const owner = task.owner?.trim();
    if (!owner) {
      noOwnerTasks.push(task);
      add(task, postAt, "", null);
      continue;
    }
    const ownerKey = normalizeOwner(owner);
    const slackUserId = userByOwner.get(ownerKey) ?? null;
    if (!slackUserId && !unmatched.has(ownerKey)) {
      unmatched.set(ownerKey, owner);
    }
    add(task, postAt, owner, slackUserId);
  }
  return {
    desired: [...desired.values()],
    unmatchedOwners: [...unmatched.values()].sort((a, b) =>
      a.localeCompare(b),
    ),
    noOwnerTasks,
    noChannelTasks,
  };
}

export type StoredReminder = {
  id: string;
  taskKey: string;
  slackUserId: string | null;
  postAt: Date;
  status: "scheduled" | "failed";
  slackChannel: string | null;
  scheduledMessageId: string | null;
};

export type ReminderDiff = {
  /** Scheduled and still right: leave alone. */
  keep: string[];
  /** Scheduled, post time passed: Slack has sent it. */
  passed: string[];
  /** Scheduled but no longer wanted: delete in Slack, then cancel. */
  cancel: StoredReminder[];
  /** Failed and no longer wanted: mark cancelled (nothing in Slack). */
  drop: string[];
  /** To schedule; retryId reuses a failed row for the same task. */
  create: (DesiredReminder & { retryId?: string })[];
  /** Wanted but too close to schedule, and not already scheduled. */
  tooSoon: DesiredReminder[];
};

/** Compare stored reminders with the plan. Pure; the sync applies it. */
export function diffReminders(
  stored: StoredReminder[],
  desired: DesiredReminder[],
  now: Date,
): ReminderDiff {
  const want = new Map(desired.map((d) => [d.taskKey, d]));
  const kept = new Set<string>();
  const diff: ReminderDiff = {
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
      d.slackUserId === row.slackUserId &&
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

function errorCode(error: unknown): string {
  if (error instanceof SlackApiError) return error.code;
  const name = (error as { name?: unknown })?.name;
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  return "error";
}

export type SlackLookup =
  | { status: "found"; userId: string }
  | { status: "not-found" }
  | { status: "error"; code: string };

export async function lookupSlackUser(
  token: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackLookup> {
  try {
    const res = await slackApi<SlackResponse & { user?: { id?: string } }>(
      token,
      "users.lookupByEmail",
      { email },
      fetchImpl,
    );
    const userId = res.user?.id;
    return userId ? { status: "found", userId } : { status: "not-found" };
  } catch (error) {
    const code = errorCode(error);
    return code === "users_not_found"
      ? { status: "not-found" }
      : { status: "error", code };
  }
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
      unmatchedOwners: number;
      noOwnerTasks: number;
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

      const plan = planTaskReminders(
        sheet.tasks,
        sheet.items,
        contacts,
        now,
        teamChannel(deps),
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
      for (const row of diff.cancel) {
        try {
          if (row.slackChannel && row.scheduledMessageId) {
            await slackApi(
              token,
              "chat.deleteScheduledMessage",
              {
                channel: row.slackChannel,
                scheduled_message_id: row.scheduledMessageId,
              },
              fetchImpl,
            );
          }
          await tx
            .update(taskReminders)
            .set({ status: "cancelled", error: null })
            .where(eq(taskReminders.id, row.id));
          cancelled++;
        } catch (error) {
          const code = errorCode(error);
          // Already sent or already deleted: nothing left to cancel.
          const gone = code === "invalid_scheduled_message_id";
          await tx
            .update(taskReminders)
            .set(
              gone
                ? { status: "cancelled", error: code }
                : // Still in Slack: stays "scheduled" so the next sync retries.
                  { error: `cancel: ${code}`.slice(0, 255) },
            )
            .where(eq(taskReminders.id, row.id));
          if (gone) cancelled++;
        }
      }

      const dmChannels = new Map<string, string>();
      let created = 0;
      let failed = 0;
      for (const d of diff.create) {
        const userId = d.slackUserId;
        let values: Pick<
          typeof taskReminders.$inferInsert,
          "status" | "slackChannel" | "scheduledMessageId" | "error"
        >;
        try {
          let channel = userId ? dmChannels.get(userId) : d.channel;
          if (!channel && userId) {
            const opened = await slackApi<
              SlackResponse & { channel?: { id?: string } }
            >(token, "conversations.open", { users: userId }, fetchImpl);
            channel = opened.channel?.id;
            if (!channel) {
              throw new SlackApiError("conversations.open", "no_channel");
            }
            dmChannels.set(userId, channel);
          }
          if (!channel) {
            throw new SlackApiError("chat.scheduleMessage", "no_channel");
          }
          const res = await slackApi<
            SlackResponse & { scheduled_message_id?: string; channel?: string }
          >(
            token,
            "chat.scheduleMessage",
            {
              channel,
              post_at: String(Math.floor(d.postAt.getTime() / 1000)),
              text: d.text,
            },
            fetchImpl,
          );
          values = {
            status: "scheduled",
            // Slack answers with the channel id, needed to delete it later.
            slackChannel: res.channel ?? channel,
            scheduledMessageId: res.scheduled_message_id ?? null,
            error: null,
          };
          created++;
        } catch (error) {
          values = {
            status: "failed",
            slackChannel: userId
              ? (dmChannels.get(userId) ?? null)
              : d.channel,
            scheduledMessageId: null,
            error: errorCode(error).slice(0, 255),
          };
          failed++;
        }
        const row = {
          taskKey: d.taskKey,
          owner: d.owner.slice(0, 255),
          task: d.task,
          slackUserId: userId,
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
        unmatchedOwners: plan.unmatchedOwners.length,
        noOwnerTasks: plan.noOwnerTasks.length,
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

export type TaskReminderFailure = {
  owner: string;
  task: string;
  postAt: Date;
  error: string;
};

export type TaskReminderStatus = {
  slackConnected: boolean;
  /** The sponsor team channel is set (unowned tasks are posted there). */
  channelConfigured: boolean;
  sheetError: boolean;
  lastSyncedAt: Date | null;
  /** All reminders waiting in Slack (DMs and channel posts). */
  scheduled: number;
  /** Of those, posts to the team channel for tasks nobody owns on Slack. */
  toChannel: number;
  tooSoon: number;
  /** Unowned tasks skipped because no team channel is configured. */
  noChannelTasks: number;
  unmatchedOwners: string[];
  noOwnerTasks: TaskRef[];
  failures: TaskReminderFailure[];
};

async function safeReadSheet(
  readSheet: () => Promise<SheetTasks>,
): Promise<SheetTasks | null> {
  try {
    return await readSheet();
  } catch (error) {
    console.error("task reminders: sheet read failed", error);
    return null;
  }
}

export async function getTaskReminderStatus(
  now: Date = new Date(),
  deps: Pick<SyncDeps, "readSheet" | "token" | "channel"> = {},
): Promise<TaskReminderStatus> {
  const [state] = await db
    .select()
    .from(taskReminderSync)
    .where(eq(taskReminderSync.id, SYNC_ROW_ID));
  const upcoming = await db
    .select()
    .from(taskReminders)
    .where(
      and(
        inArray(taskReminders.status, ["scheduled", "failed"]),
        gt(taskReminders.postAt, now),
      ),
    )
    .orderBy(taskReminders.postAt);
  const scheduled = upcoming.filter((r) => r.status === "scheduled");
  const failures = upcoming
    .filter((r) => r.status === "failed" || r.error)
    .map((r) => ({
      owner: r.owner,
      task: r.task,
      postAt: r.postAt,
      error: r.error ?? "error",
    }));

  const channel = teamChannel(deps);
  const sheet = await safeReadSheet(deps.readSheet ?? getRunOfShow);
  let tooSoon = 0;
  let noChannelTasks = 0;
  let unmatchedOwners: string[] = [];
  let noOwnerTasks: TaskRef[] = [];
  if (sheet) {
    const contacts = await db
      .select({
        ownerKey: taskOwnerContacts.ownerKey,
        slackUserId: taskOwnerContacts.slackUserId,
      })
      .from(taskOwnerContacts);
    const plan = planTaskReminders(
      sheet.tasks,
      sheet.items,
      contacts,
      now,
      channel,
    );
    const scheduledKeys = new Set(scheduled.map((r) => r.taskKey));
    tooSoon = plan.desired.filter(
      (d) => d.tooSoon && !scheduledKeys.has(d.taskKey),
    ).length;
    noChannelTasks = plan.noChannelTasks.length;
    unmatchedOwners = plan.unmatchedOwners;
    noOwnerTasks = plan.noOwnerTasks.map(({ day, start, task, owner }) => ({
      day,
      start,
      task,
      owner,
    }));
  }

  return {
    slackConnected: Boolean(slackToken(deps)),
    channelConfigured: channel !== null,
    sheetError: sheet === null,
    lastSyncedAt: state?.lastSyncedAt ?? null,
    scheduled: scheduled.length,
    toChannel: scheduled.filter((r) => r.slackUserId === null).length,
    tooSoon,
    noChannelTasks,
    unmatchedOwners,
    noOwnerTasks,
    failures,
  };
}

export type OwnerMatch = "matched" | "not-found" | "not-checked" | "no-email";

export type TaskOwnerRow = {
  ownerName: string;
  slackEmail: string | null;
  match: OwnerMatch;
  /** Tasks in the sheet with this owner (0 = saved but no longer used). */
  taskCount: number;
};

function matchOf(c: {
  slackEmail: string | null;
  slackUserId: string | null;
  lookedUpAt: Date | null;
}): OwnerMatch {
  if (!c.slackEmail) return "no-email";
  if (c.slackUserId) return "matched";
  return c.lookedUpAt ? "not-found" : "not-checked";
}

/** Owner names from the sheet plus saved emails, sheet names first. */
export async function listTaskOwners(
  deps: Pick<SyncDeps, "readSheet"> = {},
): Promise<{ owners: TaskOwnerRow[]; sheetError: boolean }> {
  const sheet = await safeReadSheet(deps.readSheet ?? getRunOfShow);
  const fromSheet = new Map<string, { name: string; count: number }>();
  for (const t of sheet?.tasks ?? []) {
    const name = t.owner?.trim();
    if (!name) continue;
    const key = normalizeOwner(name);
    const entry = fromSheet.get(key) ?? { name, count: 0 };
    entry.count++;
    fromSheet.set(key, entry);
  }
  const contacts = await db.select().from(taskOwnerContacts);
  const byKey = new Map(contacts.map((c) => [c.ownerKey, c]));
  const keys = new Set([...fromSheet.keys(), ...byKey.keys()]);
  const owners = [...keys].map((key): TaskOwnerRow => {
    const c = byKey.get(key);
    const s = fromSheet.get(key);
    return {
      ownerName: s?.name ?? c!.ownerName,
      slackEmail: c?.slackEmail ?? null,
      match: c ? matchOf(c) : "no-email",
      taskCount: s?.count ?? 0,
    };
  });
  owners.sort(
    (a, b) =>
      Number(b.taskCount > 0) - Number(a.taskCount > 0) ||
      a.ownerName.localeCompare(b.ownerName),
  );
  return { owners, sheetError: sheet === null };
}

/**
 * Save (or clear) an owner's Slack email and look the user up straight away
 * when Slack is connected. Reminders follow on the next sync.
 */
export async function setTaskOwnerEmail(
  ownerName: string,
  slackEmail: string | null,
  deps: SlackDeps & { now?: Date } = {},
): Promise<{ match: OwnerMatch }> {
  const now = deps.now ?? new Date();
  const name = ownerName.trim().replace(/\s+/g, " ");
  const email = slackEmail?.trim().toLowerCase() ?? null;
  const update = {
    ownerName: name,
    slackEmail: email?.length ? email : null,
    slackUserId: null as string | null,
    lookedUpAt: null as Date | null,
    updatedAt: now,
  };
  const token = slackToken(deps);
  if (update.slackEmail && token) {
    const found = await lookupSlackUser(
      token,
      update.slackEmail,
      deps.fetch ?? fetch,
    );
    if (found.status === "error") {
      console.error("task reminders: Slack lookup failed:", found.code);
    } else {
      update.slackUserId = found.status === "found" ? found.userId : null;
      update.lookedUpAt = now;
    }
  }
  await db
    .insert(taskOwnerContacts)
    .values({ ownerKey: normalizeOwner(name), ...update })
    .onConflictDoUpdate({ target: taskOwnerContacts.ownerKey, set: update });
  return { match: matchOf(update) };
}
