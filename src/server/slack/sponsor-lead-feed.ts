import { waitUntil } from "@vercel/functions";
import { inArray } from "drizzle-orm";

import {
  sponsorLeadSlackCopy,
  type FeedGroup,
} from "~/content/sponsor-lead-slack";
import { env } from "~/env";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { clockTime } from "~/lib/sponsor-home";
import { sponsorNameKey } from "~/lib/sponsor-prize-tracks";
import type { HwContact } from "~/server/api/utils/sponsor-hw-contacts";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";
import { escapeSlackText } from "~/server/slack/client";
import { dmByEmails } from "~/server/slack/dm";
import {
  feedMode,
  firstName,
  infoOf,
  leadsFor,
  loadLeadDirectory,
  ownContactRow,
  type LeadDirectory,
  type LeadSlackMode,
  type LeadTarget,
} from "~/server/slack/sponsor-leads";

/**
 * The change feed: a short Slack DM to a sponsor's HW lead whenever someone
 * changes something about that sponsor (organizer dashboard writes, plus
 * hackers answering the sponsor's chat invites). SPONSOR_LEAD_FEED: "1"
 * sends, "dry" logs, unset does nothing.
 *
 * Callers report after their write committed (reportSponsorChange never
 * throws and never waits on Slack). Reports gather for FEED_COALESCE_MS on
 * this server instance, then one message per sponsor and lead goes out, so
 * a burst (one Send, six taps) is one DM. A change the lead made
 * themselves is never sent to them. docs/decisions.md 2026-11-21.
 */

const copy = sponsorLeadSlackCopy.feed;

/** How long reports gather before they go out as one message. */
export const FEED_COALESCE_MS = 4_000;
/** More lines of one kind than this collapse into a count. */
export const FEED_GROUP_MAX = 3;

/** Who made the change. */
export type FeedActor =
  | { kind: "organizer"; email: string | null; name: string | null }
  /** A hacker answering an invite, or the sponsor themselves. */
  | { kind: "other" };

/** One reported change, already worded (src/content/sponsor-lead-slack.ts). */
export type FeedEvent = {
  /** Either is enough; the name wins when both are given. */
  sponsorId?: string | null;
  sponsorName?: string | null;
  group: FeedGroup;
  text: string;
  /** Only the latest of this group counts (a status tapped twice). */
  latestOnly?: boolean;
  actor: FeedActor;
};

export type FeedMessage = {
  lead: LeadTarget;
  sponsorName: string;
  text: string;
};

/** The actor as an organizer from a tRPC session. */
export function organizerActor(user: {
  email?: string | null;
  name?: string | null;
}): FeedActor {
  return {
    kind: "organizer",
    email: user.email ?? null,
    name: user.name ?? null,
  };
}

/** "2:00 PM" for a coffee board session (the window start when cut). */
export function sessionTime(
  sessionId: string,
  window?: { start: number } | null,
): string {
  const start =
    window?.start ?? COFFEE_SESSIONS.find((s) => s.id === sessionId)?.start;
  return start === undefined ? sessionId : clockTime(start);
}

/** "2:00 PM" from a "HH:MM" slot time. */
export function slotClock(slotTime: string): string {
  const [h, m] = slotTime.split(":").map(Number);
  return h === undefined || m === undefined || Number.isNaN(h + m)
    ? slotTime
    : clockTime(h * 60 + m);
}

/** Escape a name or label for Slack mrkdwn. */
export const esc = (text: string) => escapeSlackText(text);

/**
 * The parts of one actor's changes, in order: a group past FEED_GROUP_MAX
 * lines becomes one count; latestOnly groups keep only their last line.
 */
export function feedParts(events: readonly FeedEvent[]): string[] {
  const order: FeedGroup[] = [];
  const byGroup = new Map<FeedGroup, string[]>();
  for (const e of events) {
    let list = byGroup.get(e.group);
    if (!list) {
      list = [];
      byGroup.set(e.group, list);
      order.push(e.group);
    }
    if (e.latestOnly) list.splice(0, list.length, e.text);
    else list.push(e.text);
  }
  return order.flatMap((group) => {
    const lines = byGroup.get(group)!;
    return lines.length > FEED_GROUP_MAX
      ? [copy.many[group](lines.length)]
      : lines;
  });
}

/**
 * Pure: what to DM whom. Events group by sponsor; each of the sponsor's
 * leads gets one message with every change they didn't make themselves
 * (one line per person who made changes). `unmatched` lists sponsors
 * whose HW lead cell names nobody in HW Contacts with a Login email.
 */
export function planFeedMessages(
  events: readonly FeedEvent[],
  dir: Pick<LeadDirectory, "contacts" | "info">,
): { messages: FeedMessage[]; unmatched: { sponsor: string; lead: string }[] } {
  const messages: FeedMessage[] = [];
  const unmatched: { sponsor: string; lead: string }[] = [];
  const bySponsor = new Map<string, { name: string; events: FeedEvent[] }>();
  for (const e of events) {
    const name = e.sponsorName?.trim();
    if (!name) continue;
    const key = sponsorNameKey(name);
    const entry = bySponsor.get(key) ?? { name, events: [] };
    entry.events.push(e);
    bySponsor.set(key, entry);
  }
  for (const { name, events: evs } of bySponsor.values()) {
    const cell = infoOf(dir, name)?.hwContact ?? "";
    const leads = leadsFor(cell, dir.contacts);
    if (leads.length === 0) {
      unmatched.push({ sponsor: name, lead: cell });
      continue;
    }
    const tagged = evs.map((e) => ({ e, ...actorOf(e.actor, dir.contacts) }));
    for (const lead of leads) {
      const theirs = tagged.filter((t) => t.row === null || t.row !== lead.row);
      if (theirs.length === 0) continue;
      // One line per person, in the order they first appear.
      const byActor = new Map<
        string,
        { by: string | null; events: FeedEvent[] }
      >();
      for (const t of theirs) {
        const k = t.by ?? "";
        const entry = byActor.get(k) ?? { by: t.by, events: [] };
        entry.events.push(t.e);
        byActor.set(k, entry);
      }
      const lines = [...byActor.values()].map((a) =>
        copy.line(esc(name), feedParts(a.events), a.by),
      );
      messages.push({ lead, sponsorName: name, text: lines.join("\n") });
    }
  }
  return { messages, unmatched };
}

/** The actor's HW Contacts row (to skip their own leads) and "by" name. */
function actorOf(
  actor: FeedActor,
  contacts: readonly HwContact[],
): { row: number | null; by: string | null } {
  if (actor.kind !== "organizer") return { row: null, by: null };
  const row = ownContactRow(actor.email, contacts);
  const name =
    (row !== null ? firstName(contacts[row]?.name) : "") ||
    firstName(actor.name) ||
    copy.someone;
  return { row, by: esc(name) };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type FeedDeps = {
  mode?: LeadSlackMode;
  token?: string;
  fetch?: typeof fetch;
  directory?: LeadDirectory | null;
  log?: (line: string) => void;
};

/** Fill in sponsor names for events that came with only an id. */
async function withNames(events: readonly FeedEvent[]): Promise<FeedEvent[]> {
  const ids = [
    ...new Set(
      events.flatMap((e) =>
        !e.sponsorName?.trim() && e.sponsorId ? [e.sponsorId] : [],
      ),
    ),
  ];
  if (ids.length === 0) return [...events];
  const rows = await db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors)
    .where(inArray(sponsorJudgingSponsors.id, ids));
  const nameOf = new Map(rows.map((r) => [r.id, r.name]));
  return events.map((e) =>
    Boolean(e.sponsorName?.trim()) || !e.sponsorId
      ? e
      : { ...e, sponsorName: nameOf.get(e.sponsorId) ?? null },
  );
}

/**
 * Send (or, in dry mode, log) one batch now. Never throws; returns what it
 * did for tests and logs.
 */
export async function flushFeed(
  events: readonly FeedEvent[],
  deps: FeedDeps = {},
): Promise<{ sent: number; logged: number; failed: number; notFound: number }> {
  const out = { sent: 0, logged: 0, failed: 0, notFound: 0 };
  const mode = deps.mode ?? feedMode();
  if (mode === "off" || events.length === 0) return out;
  const log = deps.log ?? ((line: string) => console.info(line));
  try {
    const dir =
      deps.directory !== undefined ? deps.directory : await loadLeadDirectory();
    if (!dir) return out;
    const { messages, unmatched } = planFeedMessages(
      await withNames(events),
      dir,
    );
    for (const u of unmatched) {
      log(
        `[sponsor lead feed] no HW lead with a Login email for ${u.sponsor} (HW lead "${u.lead}")`,
      );
    }
    const token = deps.token ?? env.SLACK_BOT_TOKEN;
    for (const m of messages) {
      if (mode === "dry" || !token) {
        log(`[sponsor lead feed] dry run, to ${m.lead.name}: ${m.text}`);
        out.logged++;
        continue;
      }
      try {
        const result = await dmByEmails(
          token,
          [m.lead.email],
          { text: m.text, unfurl_links: false, unfurl_media: false },
          deps.fetch ?? fetch,
        );
        if (result === "sent") out.sent++;
        else {
          out.notFound++;
          console.warn(
            `[sponsor lead feed] ${m.lead.name} isn't on Slack by their HW Contacts Login email`,
          );
        }
      } catch (error) {
        out.failed++;
        console.error(
          "[sponsor lead feed] DM failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    console.error(
      "[sponsor lead feed] failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  return out;
}

let pending: FeedEvent[] = [];
let flushing: Promise<void> | null = null;

/**
 * Report changes after the write committed. Returns at once (never
 * throws, never fails the caller); the batch goes out FEED_COALESCE_MS
 * later, kept alive on Vercel by waitUntil.
 */
export function reportSponsorChange(
  events: FeedEvent | readonly FeedEvent[],
): void {
  try {
    if (feedMode() === "off") return;
    const list = Array.isArray(events)
      ? (events as readonly FeedEvent[])
      : [events as FeedEvent];
    if (list.length === 0) return;
    pending.push(...list);
    if (flushing) return;
    flushing = new Promise<void>((resolve) => {
      setTimeout(() => {
        const batch = pending;
        pending = [];
        flushing = null;
        void flushFeed(batch).finally(resolve);
      }, FEED_COALESCE_MS);
    });
    waitUntil(flushing);
  } catch (error) {
    console.error(
      "[sponsor lead feed] couldn't queue a change:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
