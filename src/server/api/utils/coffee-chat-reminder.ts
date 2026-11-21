import { createHash } from "node:crypto";

import { waitUntil } from "@vercel/functions";
import { and, eq, gt, or } from "drizzle-orm";

import {
  coffeeChatInvitesCopy,
  coffeeChatName,
} from "~/content/coffee-chat-invites";
import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { iveyWalkCopy } from "~/content/ivey-walk";
import { env } from "~/env";
import {
  coffeeChatStartsAt,
  effectiveCoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import { slackLookupEmails } from "~/lib/slack-email";
import { buildingOfRoomLabel } from "~/server/api/utils/coffee-chat-invite-text";
import {
  errorMessage,
  loadCoffeeChatNotice,
  type CoffeeChatNotice,
} from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import { coffeeChatReminders, coffeeChats } from "~/server/db/schema";
import {
  SlackApiError,
  escapeSlackText,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";
import { openDmByEmails } from "~/server/slack/dm";

/**
 * The Slack DM a hacker gets 15 minutes (30 at Ivey) before each accepted coffee chat:
 * sponsor, start and length, group or 1-on-1, room. Slack holds it
 * (chat.scheduleMessage), so nothing has to run at send time. One
 * coffee_chat_reminder row per chat keeps the scheduled message id, so a
 * cancel, a decline after accepting, a re-ask, or a time or room change
 * deletes it and (if the chat still happens) schedules a new one.
 *
 * syncCoffeeChatReminder(chatId) makes Slack match the chat right now and
 * is safe to run any number of times. It runs after every chat change
 * (notifyCoffeeChat, deliverInviteNotices) and for every chat in the sweep
 * (syncAllCoffeeChatReminders: backfill and safety net). Never throws into
 * the action that triggered it. docs/decisions.md 2026-11-20.
 */

/** The reminder goes out this long before the chat starts. */
export const REMINDER_LEAD_MS = 15 * 60_000;
/** Ivey is a 15-minute walk: its chats are reminded 30 minutes ahead. */
export const IVEY_REMINDER_LEAD_MS = 30 * 60_000;
/**
 * Slack refuses a post_at in the past and can't delete a message due within
 * 60 s; closer than this, the reminder is sent at once instead.
 */
export const MIN_SCHEDULE_AHEAD_MS = 2 * 60_000;

/**
 * The switch: COFFEE_CHAT_REMINDERS "1" forces on, "0" forces off. Unset =
 * on only on the Vercel production deploy, so never from a preview, a local
 * server, or a test (tests set it themselves).
 */
export function remindersLive(): boolean {
  const flag = process.env.COFFEE_CHAT_REMINDERS;
  if (flag === "1") return true;
  if (flag === "0") return false;
  if (process.env.VITEST) return false;
  return (process.env.VERCEL_ENV ?? env.VERCEL_ENV) === "production";
}

// ---------------------------------------------------------------------------
// Pure planning
// ---------------------------------------------------------------------------

/** What the reminder says, minus the minutes left. */
export type ReminderContent = {
  sponsorName: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  /** True = group chat, false = 1-on-1, null = unknown ("coffee chat"). */
  group: boolean | null;
};

/** True when the chat is in the Ivey building (a 15-minute walk). */
export const isIvey = (c: Pick<ReminderContent, "room">) =>
  buildingOfRoomLabel(c.room) === "ivey";

/** How long before the start the reminder goes out (30 min at Ivey). */
export const reminderLeadMs = (c: Pick<ReminderContent, "room">) =>
  isIvey(c) ? IVEY_REMINDER_LEAD_MS : REMINDER_LEAD_MS;

/**
 * The DM text. `minutesLeft` is the usual lead for a scheduled one (15, or
 * 30 at Ivey), the real minutes when sent late. Ivey adds the walk warning.
 */
export function reminderText(c: ReminderContent, minutesLeft: number): string {
  const copy = coffeeChatNotifyCopy.reminder;
  const ivey = isIvey(c);
  const where = coffeeChatInvitesCopy.where(
    c.room,
    buildingOfRoomLabel(c.room),
  );
  const name = coffeeChatName(c.group);
  const sponsor = escapeSlackText(c.sponsorName);
  return [
    ivey
      ? copy.leadIvey(name, sponsor, minutesLeft)
      : copy.lead(name, sponsor, minutesLeft),
    copy.when(formatCoffeeChatTime(c.slotTime), c.durationMinutes),
    copy.where(escapeSlackText(where)),
    // Ivey only: the walk warning with a map link (no map link otherwise).
    ...(ivey
      ? [
          iveyWalkCopy.slackLine(
            iveyWalkCopy.reminder,
            iveyWalkCopy.hackerMapUrl,
          ),
        ]
      : []),
  ].join("\n");
}

/** Hash of what the reminder says: any change reschedules it. */
export function contentKey(c: ReminderContent): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        c.sponsorName,
        c.slotTime,
        c.durationMinutes,
        c.room,
        c.group,
        // Ivey reminders moved to 30 minutes: a new key reschedules ones
        // made before. Other keys are unchanged (nothing rescheduled).
        ...(isIvey(c) ? ["ivey-30"] : []),
      ]),
    )
    .digest("hex");
}

export type DesiredReminder = {
  /** "schedule" at postAt, or "now" (closer than the lead: 15, or 30 at Ivey). */
  mode: "schedule" | "now";
  postAt: Date;
  text: string;
  contentKey: string;
};

/**
 * The reminder this chat should have now, or null: only accepted chats
 * that haven't started. Under MIN_SCHEDULE_AHEAD_MS before the usual post
 * time it is sent at once, saying the real minutes left.
 */
export function desiredReminder(
  chat: ReminderContent & {
    status: CoffeeChatNotice["status"];
    expiresAt: Date | null;
  },
  now: Date,
): DesiredReminder | null {
  if (effectiveCoffeeChatStatus(chat, now) !== "accepted") return null;
  const start = coffeeChatStartsAt(chat.slotTime).getTime();
  if (now.getTime() >= start) return null;
  const lead = reminderLeadMs(chat);
  const postAt = start - lead;
  const key = contentKey(chat);
  if (postAt - now.getTime() >= MIN_SCHEDULE_AHEAD_MS) {
    return {
      mode: "schedule",
      postAt: new Date(postAt),
      text: reminderText(chat, lead / 60_000),
      contentKey: key,
    };
  }
  const minutesLeft = Math.max(1, Math.ceil((start - now.getTime()) / 60_000));
  return {
    mode: "now",
    postAt: now,
    text: reminderText(chat, minutesLeft),
    contentKey: key,
  };
}

export type StoredReminder = typeof coffeeChatReminders.$inferSelect;
/** The fields planReminder reads (a sponsor lead ping row has them too). */
export type ReminderRow = Pick<
  StoredReminder,
  "kind" | "messageId" | "postAt" | "contentKey" | "createdAt"
>;

/** A send-now claim older than this without a message id was never sent. */
export const STALE_CLAIM_MS = 60_000;
/**
 * Closer than this to its post time, a scheduled reminder may already be
 * going out: a failed delete there means it can't be recalled.
 */
export const RECALL_MARGIN_MS = 90_000;

/** A send-now claim (no message id yet) left over from a cut-off sync. */
export function isStaleClaim(stored: ReminderRow, now: Date): boolean {
  return (
    stored.kind === "sent" &&
    stored.messageId === "" &&
    now.getTime() - stored.createdAt.getTime() > STALE_CLAIM_MS
  );
}

export type ReminderPlan<S extends ReminderRow = StoredReminder> =
  | { action: "keep" }
  | { action: "none" }
  | {
      action: "change";
      cancel: S | null;
      create: DesiredReminder | null;
    };

/**
 * Compare the stored reminder with the wanted one. Pure; the sync applies
 * it. A reminder Slack already posted is never re-sent: it is replaced only
 * by a new one scheduled for later (the chat moved to a later time). A
 * room move inside the last 15 minutes is told by the room-move DM.
 */
export function planReminder<S extends ReminderRow = StoredReminder>(
  stored: S | null,
  desired: DesiredReminder | null,
  now: Date,
): ReminderPlan<S> {
  if (!stored) {
    return desired
      ? { action: "change", cancel: null, create: desired }
      : { action: "none" };
  }
  // A send-now claim nobody finished (the function was cut off before the
  // post): nothing went out, so drop the claim and try again.
  if (isStaleClaim(stored, now)) {
    return { action: "change", cancel: stored, create: desired };
  }
  const delivered = stored.kind === "sent" || stored.postAt <= now;
  if (delivered) {
    if (
      desired?.mode === "schedule" &&
      desired.contentKey !== stored.contentKey
    ) {
      return { action: "change", cancel: stored, create: desired };
    }
    return { action: "keep" };
  }
  if (desired && desired.contentKey === stored.contentKey) {
    return { action: "keep" };
  }
  return { action: "change", cancel: stored, create: desired };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type ReminderOutcome =
  | "off"
  | "kept"
  | "none"
  | "scheduled"
  | "sent"
  | "cancelled"
  | "not-found"
  | "failed";

export type ReminderDeps = {
  token?: string;
  fetch?: typeof fetch;
  now?: Date;
};

type ScheduleResponse = SlackResponse & { scheduled_message_id?: string };
type PostResponse = SlackResponse & { ts?: string };

/** What the chat should have; null also when there's nobody to DM. */
async function wanted(
  chatId: string,
  now: Date,
): Promise<{ notice: CoffeeChatNotice; desired: DesiredReminder } | null> {
  const notice = await loadCoffeeChatNotice(chatId);
  if (!notice?.admitted || !notice.hackerEmail) return null;
  const desired = desiredReminder(
    { ...notice, group: notice.group ?? null },
    now,
  );
  return desired ? { notice, desired } : null;
}

/** Delete a scheduled reminder in Slack, then its row. */
async function cancelReminder(
  token: string,
  stored: StoredReminder,
  now: Date,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (stored.kind === "scheduled" && stored.postAt > now) {
    try {
      await slackApi(
        token,
        "chat.deleteScheduledMessage",
        {
          channel: stored.slackChannel,
          scheduled_message_id: stored.messageId,
        },
        fetchImpl,
      );
    } catch (error) {
      // Already posted or already deleted: nothing left in Slack. Any other
      // failure this close to the post time: it can't be recalled now, so
      // let it go and drop our row (never left on a cancelled chat).
      const gone =
        error instanceof SlackApiError &&
        error.code === "invalid_scheduled_message_id";
      const tooLate =
        stored.postAt.getTime() - now.getTime() < RECALL_MARGIN_MS;
      if (!gone && !tooLate) throw error;
      if (!gone) {
        console.warn(
          "coffee chat reminder: too close to recall, letting it post:",
          errorMessage(error),
        );
      }
    }
  }
  await db
    .delete(coffeeChatReminders)
    .where(
      and(
        eq(coffeeChatReminders.chatId, stored.chatId),
        eq(coffeeChatReminders.messageId, stored.messageId),
      ),
    );
}

/** Schedule (or send now) and store the reminder; never twice. */
async function createReminder(
  token: string,
  chatId: string,
  notice: CoffeeChatNotice,
  desired: DesiredReminder,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<"scheduled" | "sent" | "not-found" | "kept"> {
  const channel = await openDmByEmails(
    token,
    slackLookupEmails({
      slackEmail: notice.hackerSlackEmail,
      email: notice.hackerEmail,
    }),
    fetchImpl,
  );
  if (!channel) {
    // No email fallback for a reminder (counts only in logs).
    console.info("coffee chat reminder: hacker not found on Slack");
    return "not-found";
  }
  const row = {
    chatId,
    slackChannel: channel,
    postAt: desired.postAt,
    contentKey: desired.contentKey,
    // The claim's age tells a cut-off send-now apart (isStaleClaim).
    createdAt: now,
  };

  if (desired.mode === "now") {
    // Claim first: a message posted at once can't be taken back.
    const claimed = await db
      .insert(coffeeChatReminders)
      .values({ ...row, kind: "sent", messageId: "" })
      .onConflictDoNothing()
      .returning({ chatId: coffeeChatReminders.chatId });
    if (!claimed.length) return "kept";
    let posted: PostResponse;
    try {
      posted = await slackApi<PostResponse>(
        token,
        "chat.postMessage",
        { channel, text: desired.text },
        fetchImpl,
      );
    } catch (error) {
      // Nothing went out: unclaim, so the next sync retries.
      await db
        .delete(coffeeChatReminders)
        .where(
          and(
            eq(coffeeChatReminders.chatId, chatId),
            eq(coffeeChatReminders.messageId, ""),
          ),
        );
      throw error;
    }
    // It went out: keep the claim whatever happens to this write, so it is
    // never sent twice. Tried twice; if both fail the claim still reads as
    // sent until it is a minute old (STALE_CLAIM_MS), logged here.
    const messageId = posted.ts ?? "sent";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await db
          .update(coffeeChatReminders)
          .set({ messageId })
          .where(eq(coffeeChatReminders.chatId, chatId));
        break;
      } catch (error) {
        console.error(
          `coffee chat reminder: sent, but saving it failed (try ${attempt}):`,
          errorMessage(error),
        );
      }
    }
    return "sent";
  }

  const scheduled = await slackApi<ScheduleResponse>(
    token,
    "chat.scheduleMessage",
    {
      channel,
      post_at: Math.floor(desired.postAt.getTime() / 1000),
      text: desired.text,
    },
    fetchImpl,
  );
  const messageId = scheduled.scheduled_message_id;
  if (!messageId) {
    throw new SlackApiError("chat.scheduleMessage", "no_scheduled_message_id");
  }
  const stored = await db
    .insert(coffeeChatReminders)
    .values({ ...row, kind: "scheduled", messageId })
    .onConflictDoNothing()
    .returning({ chatId: coffeeChatReminders.chatId });
  if (!stored.length) {
    // Another sync stored one first: take ours back (it's 2+ min away).
    await slackApi(
      token,
      "chat.deleteScheduledMessage",
      { channel, scheduled_message_id: messageId },
      fetchImpl,
    );
    return "kept";
  }
  return "scheduled";
}

/**
 * Make this chat's Slack reminder match the chat now. Idempotent. Never
 * throws: failures are logged (message only) and come back as "failed";
 * the sweep tries again.
 */
export async function syncCoffeeChatReminder(
  chatId: string,
  deps: ReminderDeps = {},
): Promise<ReminderOutcome> {
  if (!("token" in deps) && !remindersLive()) return "off";
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  if (!token) return "off";
  const now = deps.now ?? new Date();
  const fetchImpl = deps.fetch ?? fetch;
  try {
    const want = await wanted(chatId, now);
    const [stored] = await db
      .select()
      .from(coffeeChatReminders)
      .where(eq(coffeeChatReminders.chatId, chatId));
    const plan = planReminder(stored ?? null, want?.desired ?? null, now);
    if (plan.action === "keep") return "kept";
    if (plan.action === "none") return "none";
    if (plan.cancel) await cancelReminder(token, plan.cancel, now, fetchImpl);
    if (!plan.create || !want) return "cancelled";
    return await createReminder(
      token,
      chatId,
      want.notice,
      plan.create,
      fetchImpl,
      now,
    );
  } catch (error) {
    console.error("coffee chat reminder sync failed:", errorMessage(error));
    return "failed";
  }
}

/**
 * Sync these chats' reminders after the response (waitUntil keeps the
 * function alive on Vercel). For callers on a tight budget, like the Slack
 * buttons: the returned promise never rejects and needn't be awaited.
 */
export function syncCoffeeChatRemindersLater(
  chatIds: readonly string[],
): Promise<void> {
  if (chatIds.length === 0 || !remindersLive()) return Promise.resolve();
  const work = (async () => {
    for (const id of new Set(chatIds)) await syncCoffeeChatReminder(id);
  })();
  waitUntil(work);
  return work;
}

export type ReminderSweep = Record<ReminderOutcome, number> & {
  /** Chats left for the next sweep (time budget or Slack rate limit). */
  left: number;
};

/**
 * The backfill and safety net: sync every accepted chat that hasn't
 * started, plus every reminder still waiting in Slack (its chat may be
 * gone). Soonest chats first. Stops starting new chats after `budgetMs`
 * (the rest count as `left`); safe to run again any time. `now` (tests)
 * fixes the clock for every chat.
 */
export async function syncAllCoffeeChatReminders(
  deps: ReminderDeps & { budgetMs?: number } = {},
): Promise<ReminderSweep> {
  const now = deps.now ?? new Date();
  const sweep: ReminderSweep = {
    off: 0,
    kept: 0,
    none: 0,
    scheduled: 0,
    sent: 0,
    cancelled: 0,
    "not-found": 0,
    failed: 0,
    left: 0,
  };
  const accepted = await db
    .select({ id: coffeeChats.id, slotTime: coffeeChats.slotTime })
    .from(coffeeChats)
    .where(eq(coffeeChats.status, "accepted"));
  // Reminders still waiting in Slack, and send-now claims left unfinished.
  const waiting = await db
    .select({ id: coffeeChatReminders.chatId })
    .from(coffeeChatReminders)
    .where(
      or(
        and(
          eq(coffeeChatReminders.kind, "scheduled"),
          gt(coffeeChatReminders.postAt, now),
        ),
        and(
          eq(coffeeChatReminders.kind, "sent"),
          eq(coffeeChatReminders.messageId, ""),
        ),
      ),
    );
  const startOf = (slotTime: string) => {
    try {
      return coffeeChatStartsAt(slotTime).getTime();
    } catch {
      return Number.NaN;
    }
  };
  const ids = [
    ...accepted
      .map((c) => ({ id: c.id, start: startOf(c.slotTime) }))
      .filter((c) => c.start > now.getTime())
      .sort((a, b) => a.start - b.start)
      .map((c) => c.id),
    ...waiting.map((w) => w.id),
  ];
  const unique = [...new Set(ids)];
  const started = Date.now();
  for (const [i, id] of unique.entries()) {
    if (deps.budgetMs !== undefined && Date.now() - started > deps.budgetMs) {
      sweep.left = unique.length - i;
      break;
    }
    // Each chat at its own now: a long sweep must not schedule into the past.
    sweep[await syncCoffeeChatReminder(id, deps)]++;
  }
  return sweep;
}
