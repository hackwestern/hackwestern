import { organizerRemindersCopy } from "~/content/organizer-reminders";
import { slackApi, type SlackResponse } from "./client";
import { ORGANIZER_HEARTBEAT_AFTER_MS } from "./organizer-load";
import { planTeamPosts, type OrganizerTask } from "./organizer-schedule";
import { isOrganizerDm, normalizeDm } from "./organizer-sync";

/**
 * What the organizer reminder bot has sent and has queued, worked out from
 * the run of show (the plan) and Slack's own queue, so it works from Vercel
 * even when the PC running the bot is off. Slack can't list messages it
 * already sent, so a ping whose time has passed counts as sent.
 */

export type ScheduledMessage = {
  id: string;
  channel_id: string;
  post_at: number;
  text: string;
};

export type PingStatus = "sent" | "queued" | "notQueued";

export type PingRow = {
  /** Who it goes to: a run-of-show name, or "#Events" for a team channel. */
  to: string;
  postAt: Date;
  /** The DM's first line without the emoji ("Coming up: Doors open"). */
  title: string;
  text: string;
  status: PingStatus;
};

export type BotHealth = {
  /** When the bot last finished a healthy pass; null when no check-in is queued. */
  lastCheckIn: Date | null;
  healthy: boolean;
};

/** The bot syncs every ~35 s; this long without a check-in means it stopped. */
export const BOT_STALE_MS = 3 * 60_000;

const HEARTBEAT_PREFIX = normalizeDm(
  organizerRemindersCopy.slack.heartbeat("").split(" since ")[0]!,
);

export function isHeartbeatDm(text: string): boolean {
  return normalizeDm(text).startsWith(HEARTBEAT_PREFIX);
}

/** The queued "bot stopped" DM is due 10 min after the bot's last pass. */
export function botHealth(queue: ScheduledMessage[], now: number): BotHealth {
  const latest = Math.max(
    0,
    ...queue.filter((m) => isHeartbeatDm(m.text)).map((m) => m.post_at * 1000),
  );
  if (!latest) return { lastCheckIn: null, healthy: false };
  const lastCheckIn = new Date(latest - ORGANIZER_HEARTBEAT_AFTER_MS);
  return { lastCheckIn, healthy: now - +lastCheckIn < BOT_STALE_MS };
}

const keyOf = (postAtSeconds: number, text: string) =>
  `${postAtSeconds}|${normalizeDm(text)}`;

/**
 * Each planned ping with its status. Slack's queue is matched by send time
 * and text (not by recipient: reading DM channels needs a scope the bot
 * doesn't have), counting duplicates, so two people with the same reminder
 * both match.
 */
export function pingRows(
  planned: { to: string; postAt: Date; text: string }[],
  queue: ScheduledMessage[],
  now: number,
): PingRow[] {
  const waiting = new Map<string, number>();
  for (const m of queue) {
    if (!isOrganizerDm(m.text)) continue;
    const key = keyOf(m.post_at, m.text);
    waiting.set(key, (waiting.get(key) ?? 0) + 1);
  }
  return [...planned]
    .sort((a, b) => +a.postAt - +b.postAt || a.to.localeCompare(b.to))
    .map((p) => {
      let status: PingStatus = "sent";
      if (+p.postAt > now) {
        const key = keyOf(Math.floor(+p.postAt / 1000), p.text);
        const left = waiting.get(key) ?? 0;
        status = left > 0 ? "queued" : "notQueued";
        if (left > 0) waiting.set(key, left - 1);
      }
      const first = normalizeDm(p.text).split("\n")[0] ?? "";
      return {
        to: p.to,
        postAt: p.postAt,
        title: first.replace(/\*/g, ""),
        text: p.text,
        status,
      };
    });
}

/** Every DM and team-channel post the bot plans, as page rows. */
export function plannedPings(
  plan: { recipientName: string; postAt: Date; text: string }[],
  tasks: OrganizerTask[],
) {
  return [
    ...plan.map((r) => ({
      to: r.recipientName,
      postAt: r.postAt,
      text: r.text,
    })),
    ...planTeamPosts(tasks).map((p) => ({
      to: `#${p.team}`,
      postAt: p.postAt,
      text: p.text,
    })),
  ];
}

/** Everything Slack is holding for this bot. */
export async function slackQueue(token: string): Promise<ScheduledMessage[]> {
  const all: ScheduledMessage[] = [];
  let cursor: string | undefined;
  do {
    const page = await slackApi<
      SlackResponse & {
        scheduled_messages?: ScheduledMessage[];
        response_metadata?: { next_cursor?: string };
      }
    >(
      token,
      "chat.scheduledMessages.list",
      { limit: "1000", cursor },
      fetch,
      10_000,
    );
    all.push(...(page.scheduled_messages ?? []));
    // Slack sends an empty cursor on the last page.
    const next = page.response_metadata?.next_cursor;
    cursor = next ? next : undefined;
  } while (cursor);
  return all;
}
