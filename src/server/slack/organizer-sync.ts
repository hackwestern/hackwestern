import { SlackApiError, slackApi, type SlackResponse } from "./client";

/**
 * Keeps Slack's scheduled organizer DMs in step with the plan, with Slack as
 * the only record (no database), so it can run from a fresh GitHub Actions
 * job. Our DMs are told apart by their first line ("⏰ In 15 min (...)");
 * marketing's ("⏰ Post in 5 min") never match. Slack stores text with emoji
 * as :codes: and &, <, > escaped, so texts are compared after normalizing.
 */

export const DM_OPTIONS = {
  unfurl_links: false,
  unfurl_media: false,
  parse: "none",
};
/** Leave DMs this close to sending alone: Slack can't cancel the last minute. */
export const FREEZE_MS = 2 * 60_000;

/** A scheduled message: to a person's DM (slackUserId) or a channel id. */
export type DesiredDm = (
  | { slackUserId: string; channel?: undefined }
  | { channel: string; slackUserId?: undefined }
) & { postAt: Date; text: string };
type Scheduled = {
  id: string;
  channel_id: string;
  post_at: number;
  text: string;
};

/** Text as Slack stores it and as we send it, made comparable. */
export function normalizeDm(text: string): string {
  return text
    .replace(/:[a-z0-9_+'-]+:/g, "")
    .replace(
      /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{2600}-\u{27BF}]/gu,
      "",
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/** True for an organizer reminder (live or test-labelled). */
export function isOrganizerDm(text: string): boolean {
  return /^(\[TEST for [^\]]*\]\n)?In \d+ min \(/.test(normalizeDm(text));
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A Slack call that waits out a rate limit (up to 3 times) instead of failing. */
async function call<T extends SlackResponse>(
  token: string,
  method: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await slackApi<T>(token, method, args, fetchImpl, 10_000);
    } catch (error) {
      const after =
        error instanceof SlackApiError && error.code === "http_429"
          ? (error.retryAfter ?? 5)
          : null;
      if (after === null || attempt >= 3) throw error;
      await sleep(after * 1000);
    }
  }
}

export async function syncOrganizerDms(
  token: string,
  desired: DesiredDm[],
  options: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? wait;

  // Every organizer DM Slack is holding for this bot.
  const existing: Scheduled[] = [];
  let cursor: string | undefined;
  do {
    const page = await call<
      SlackResponse & {
        scheduled_messages?: Scheduled[];
        response_metadata?: { next_cursor?: string };
      }
    >(
      token,
      "chat.scheduledMessages.list",
      { limit: "1000", cursor },
      fetchImpl,
      sleep,
    );
    existing.push(
      ...(page.scheduled_messages ?? []).filter((m) => isOrganizerDm(m.text)),
    );
    const next = page.response_metadata?.next_cursor;
    cursor = next ? next : undefined;
  } while (cursor);

  const channels = new Map<string, string>();
  const channelFor = async (user: string) => {
    const known = channels.get(user);
    if (known) return known;
    const res = await call<SlackResponse & { channel?: { id?: string } }>(
      token,
      "conversations.open",
      { users: user },
      fetchImpl,
      sleep,
    );
    if (!res.channel?.id) throw new Error("Slack returned no DM channel");
    channels.set(user, res.channel.id);
    return res.channel.id;
  };

  const cutoff = now() + FREEZE_MS;
  const key = (channel: string, postAt: number, text: string) =>
    `${channel}|${postAt}|${normalizeDm(text)}`;
  const wanted = new Map<
    string,
    { postAt: Date; text: string; channel: string }
  >();
  for (const dm of desired) {
    if (+dm.postAt <= cutoff) continue;
    const channel = dm.channel ?? (await channelFor(dm.slackUserId));
    const postAt = Math.floor(+dm.postAt / 1000);
    wanted.set(key(channel, postAt, dm.text), {
      postAt: dm.postAt,
      text: dm.text,
      channel,
    });
  }

  let kept = 0;
  let cancelled = 0;
  let scheduled = 0;
  const issues: string[] = [];
  for (const msg of existing) {
    if (msg.post_at * 1000 <= cutoff) continue; // about to send: leave it
    const k = key(msg.channel_id, msg.post_at, msg.text);
    if (wanted.delete(k)) {
      kept++;
      continue;
    }
    try {
      await call(
        token,
        "chat.deleteScheduledMessage",
        { channel: msg.channel_id, scheduled_message_id: msg.id },
        fetchImpl,
        sleep,
      );
      cancelled++;
    } catch (error) {
      issues.push(`Could not cancel a scheduled DM: ${String(error)}`);
    }
  }
  for (const dm of wanted.values()) {
    try {
      await call(
        token,
        "chat.scheduleMessage",
        {
          channel: dm.channel,
          post_at: String(Math.floor(+dm.postAt / 1000)),
          text: dm.text,
          ...DM_OPTIONS,
        },
        fetchImpl,
        sleep,
      );
      scheduled++;
    } catch (error) {
      issues.push(`Could not schedule a DM: ${String(error)}`);
    }
  }
  return { kept, cancelled, scheduled, issues };
}
