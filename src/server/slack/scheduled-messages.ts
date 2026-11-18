import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

/**
 * Slack scheduled messages (chat.scheduleMessage), shared by the sponsor
 * task pings (task-reminders.ts) and the organizer ops pings (ops-pings.ts).
 * Slack holds each message and delivers it on time, so no cron is needed;
 * callers keep their own table of what they scheduled.
 */

/** Slack refuses a post_at in the past; keep a margin for clock skew. */
export const MIN_SCHEDULE_AHEAD_MS = 90_000;

/** Slack's error code, "timeout", or "error". */
export function slackErrorCode(error: unknown): string {
  if (error instanceof SlackApiError) return error.code;
  const name = (error as { name?: unknown })?.name;
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  return "error";
}

export type CancelOutcome =
  /** Deleted in Slack (or there was nothing to delete). */
  | { status: "cancelled" }
  /** Already sent or already deleted: nothing left to cancel. */
  | { status: "gone"; code: string }
  /** Still in Slack: keep it "scheduled" and retry next sync. */
  | { status: "stuck"; code: string };

/** Delete one scheduled message. Never throws. */
export async function cancelScheduledMessage(
  token: string,
  row: { slackChannel: string | null; scheduledMessageId: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<CancelOutcome> {
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
    return { status: "cancelled" };
  } catch (error) {
    const code = slackErrorCode(error);
    return code === "invalid_scheduled_message_id"
      ? { status: "gone", code }
      : { status: "stuck", code };
  }
}

export type ScheduleOutcome =
  | { ok: true; slackChannel: string; scheduledMessageId: string | null }
  | { ok: false; slackChannel: string | null; code: string };

/**
 * Schedule `text` at `postAt`, as a DM to `slackUserId` (the DM is opened
 * once per user and remembered in `dmChannels`) or in `channel`. Never
 * throws.
 */
export async function scheduleSlackMessage(
  token: string,
  to: { slackUserId: string | null; channel: string | null },
  postAt: Date,
  text: string,
  dmChannels: Map<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<ScheduleOutcome> {
  const userId = to.slackUserId;
  try {
    let channel = userId ? dmChannels.get(userId) : to.channel;
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
        post_at: String(Math.floor(postAt.getTime() / 1000)),
        text,
      },
      fetchImpl,
    );
    return {
      ok: true,
      // Slack answers with the channel id, needed to delete it later.
      slackChannel: res.channel ?? channel,
      scheduledMessageId: res.scheduled_message_id ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      slackChannel: userId ? (dmChannels.get(userId) ?? null) : to.channel,
      code: slackErrorCode(error).slice(0, 255),
    };
  }
}
