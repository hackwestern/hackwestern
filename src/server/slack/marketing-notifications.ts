import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { marketingNotificationReminders as reminders } from "../db/schema";
import { SlackApiError, slackApi, type SlackResponse } from "./client";
import type { MarketingReminder } from "./marketing-schedule";

export async function openMarketingDm(
  token: string,
  user: string,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await slackApi<
    SlackResponse & { channel?: { id?: string } }
  >(token, "conversations.open", { users: user }, fetchImpl, 10_000);
  if (!response.channel?.id) throw new Error("Slack returned no DM channel");
  return response.channel.id;
}

export const marketingMessageOptions = {
  unfurl_links: false,
  unfurl_media: false,
  parse: "none",
};

type RoutedReminder = MarketingReminder & {
  slackUserId: string;
  routeKey: string;
};

export async function syncMarketingReminders(
  db: Pick<PostgresJsDatabase, "select" | "insert" | "update">,
  token: string,
  desired: RoutedReminder[],
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  const stored = await db
    .select()
    .from(reminders)
    .where(eq(reminders.status, "scheduled"));
  const upcoming = new Map(
    desired
      .filter((row) => +row.postAt > now())
      .map((row) => [row.reminderKey, row]),
  );
  const channels = new Map<string, string>();
  const issues: string[] = [];
  const blocked = new Set<string>();
  let kept = 0;
  let cancelled = 0;
  let scheduled = 0;

  for (const old of stored) {
    const next = upcoming.get(old.reminderKey);
    const update = (values: Partial<typeof reminders.$inferInsert>) =>
      db
        .update(reminders)
        .set({ ...values, updatedAt: new Date(now()) })
        .where(eq(reminders.id, old.id));
    if (+old.postAt <= now()) {
      await update({ status: "sent-window-passed" });
      continue;
    }
    if (
      next?.routeKey === old.routeKey &&
      next.text === old.text &&
      JSON.stringify(next.taskIds) === JSON.stringify(old.taskIds)
    ) {
      upcoming.delete(old.reminderKey);
      kept++;
      continue;
    }
    try {
      if (!old.slackChannel || !old.scheduledMessageId)
        throw new Error("Missing Slack scheduling receipt");
      await slackApi(
        token,
        "chat.deleteScheduledMessage",
        {
          channel: old.slackChannel,
          scheduled_message_id: old.scheduledMessageId,
        },
        fetchImpl,
        10_000,
      );
    } catch (error) {
      const gone =
        error instanceof SlackApiError &&
        error.code === "invalid_scheduled_message_id" &&
        +old.postAt - now() > 60_000;
      if (!gone) {
        old.taskIds.forEach((id) => blocked.add(id));
        upcoming.delete(old.reminderKey);
        issues.push(`Could not cancel ${old.reminderKey}: ${String(error)}`);
        continue;
      }
    }
    await update({ status: "cancelled", error: null });
    cancelled++;
  }

  for (const row of upcoming.values()) {
    if (row.taskIds.some((id) => blocked.has(id))) {
      issues.push(`Deferred ${row.reminderKey} until its old DM is cancelled`);
      continue;
    }
    if (+row.postAt <= now()) {
      issues.push(`Missed the scheduling window for ${row.reminderKey}`);
      continue;
    }
    let channel: string;
    let receipt: string;
    try {
      channel =
        channels.get(row.slackUserId) ??
        (await openMarketingDm(token, row.slackUserId, fetchImpl));
      channels.set(row.slackUserId, channel);
      const response = await slackApi<
        SlackResponse & { scheduled_message_id?: string }
      >(
        token,
        "chat.scheduleMessage",
        {
          channel,
          post_at: +row.postAt / 1000,
          text: row.text,
          ...marketingMessageOptions,
        },
        fetchImpl,
        10_000,
      );
      if (!response.scheduled_message_id)
        throw new Error("Missing Slack scheduling receipt");
      receipt = response.scheduled_message_id;
    } catch (error) {
      issues.push(`Could not schedule ${row.reminderKey}: ${String(error)}`);
      if (error instanceof SlackApiError && error.code === "http_429") break;
      continue;
    }
    const values = {
      ...row,
      slackChannel: channel,
      scheduledMessageId: receipt,
      status: "scheduled" as const,
      error: null,
      updatedAt: new Date(now()),
    };
    try {
      await db.insert(reminders).values(values).onConflictDoUpdate({
        target: reminders.reminderKey,
        set: values,
      });
    } catch (error) {
      // Avoid leaving an untracked DM when the database rejects the write.
      await slackApi(
        token,
        "chat.deleteScheduledMessage",
        {
          channel,
          scheduled_message_id: receipt,
        },
        fetchImpl,
        10_000,
      ).catch((cancelError: unknown) => {
        console.error(
          `Could not roll back Slack receipt ${receipt} in ${channel}`,
          cancelError,
        );
      });
      throw error;
    }
    scheduled++;
    console.log(
      `Queued ${row.recipientName} for ${row.postAt.toISOString()} (tasks ${row.taskIds.join(", ")})`,
    );
  }
  return { kept, cancelled, scheduled, issues };
}
