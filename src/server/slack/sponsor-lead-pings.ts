import { createHash } from "node:crypto";

import { waitUntil } from "@vercel/functions";
import { and, eq, inArray } from "drizzle-orm";

import { iveyWalkCopy } from "~/content/ivey-walk";
import { sponsorLeadSlackCopy } from "~/content/sponsor-lead-slack";
import { AGENDA, type AgendaStep } from "~/content/sponsor-home";
import { env } from "~/env";
import type { RunOfShowDay, RunOfShowTask } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { setupWindows } from "~/lib/coffee-chat-setup";
import {
  buildingOf,
  chatMinutes,
  COFFEE_SESSIONS,
  minutesOfClock,
} from "~/lib/coffee-chat-sessions";
import { clockTime, roomLabel } from "~/lib/sponsor-home";
import { contactRowsNamed } from "~/lib/sponsor-organizer";
import { hasPrizeTrack } from "~/lib/sponsor-prize-tracks";
import {
  IVEY_REMINDER_LEAD_MS,
  MIN_SCHEDULE_AHEAD_MS,
  RECALL_MARGIN_MS,
  REMINDER_LEAD_MS,
  isStaleClaim,
  planReminder,
  type DesiredReminder,
} from "~/server/api/utils/coffee-chat-reminder";
import { doesChats } from "~/server/api/utils/coffee-chats-on";
import type { HwContact } from "~/server/api/utils/sponsor-hw-contacts";
import { runOfShowFor } from "~/server/api/utils/sponsor-judging-board";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import { coffeeChatSponsorNames } from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import {
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatReps,
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorLeadPings,
  sponsorShortlistSends,
} from "~/server/db/schema";
import {
  SlackApiError,
  escapeSlackText,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";
import { openDmByEmails } from "~/server/slack/dm";
import {
  infoOf,
  leadsFor,
  loadLeadDirectory,
  pingsMode,
  type LeadSlackMode,
  type LeadTarget,
} from "~/server/slack/sponsor-leads";

/**
 * Action-item pings: a Slack DM to a sponsor's HW lead 15 minutes before
 * each thing the sponsor has to be at or get done, so the lead can get them
 * there: their own workshop (arrive 15 min before it, like the portal's Up
 * next), each rep's coffee chat session (30 min ahead at Ivey, with the
 * walk warning), and the agenda's due steps still not done (judging
 * finalists 9:45 AM, top 5 12:00 PM Sunday). Chats only for sponsors doing
 * chats, judging only for prize track sponsors, nothing on site for digital
 * sponsors.
 *
 * Slack holds each ping (chat.scheduleMessage), like the hackers' coffee
 * chat reminders (coffee-chat-reminder.ts, same plan and claim rules): one
 * sponsor_lead_ping row per sponsor + item + lead keeps the scheduled id,
 * so a moved, cancelled or finished item deletes it, and a change
 * reschedules it. syncSponsorLeadPings runs every minute from the pings
 * cron and after the writes that finish an item (shortlist sent, top 5
 * submitted, chats sent). SPONSOR_LEAD_PINGS: "1" sends, "dry" logs, unset
 * does nothing. docs/decisions.md 2026-11-21.
 */

const copy = sponsorLeadSlackCopy.pings;

/** The lead hears this long before the item is due. */
export const PING_LEAD_MS = REMINDER_LEAD_MS;
/** An Ivey coffee chat: a 15-minute walk, so 30 minutes ahead. */
export const IVEY_PING_LEAD_MS = IVEY_REMINDER_LEAD_MS;
/** Sponsors arrive this long before their workshop starts to set up. */
export const WORKSHOP_ARRIVE_MIN = 15;
/** A run-of-show task this close to a workshop can be the same thing. */
const TASK_MATCH_MIN = 30;

const DAYS: readonly RunOfShowDay[] = ["Friday", "Saturday", "Sunday"];
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Pure planning
// ---------------------------------------------------------------------------

/** Which agenda steps a sponsor has finished. */
export type DoneSteps = {
  availability: boolean;
  shortlist: boolean;
  finalists: boolean;
  top5: boolean;
};

export type PingSponsor = {
  id: string;
  name: string;
  /** Sponsor Day-Of's "HW lead" cell. */
  leadCell: string;
  /** "In person / Digital" says Digital: no on-site pings. */
  digital: boolean;
  prizeTrack: boolean;
  /** Does coffee chats (checkbox ticked, not opted out). */
  chatsOn: boolean;
  /** Their own Saturday workshops from the run of show. */
  workshops: { start: string; title: string; location: string | null }[];
  /** Each rep's sent coffee chat session; start in minutes after midnight Saturday. */
  chats: { placementId: string; rep: string; start: number; room: string }[];
  done: DoneSteps;
};

export type PlannedPing = {
  /** "<sponsorId>:<item>:<lead email>" */
  key: string;
  sponsorId: string;
  sponsorName: string;
  /** "workshop:13:00", "chat:<placementId>" or "due:u3". */
  item: string;
  lead: LeadTarget;
  /** When the thing happens or is due. */
  dueAt: Date;
  /** When the ping goes out (dueAt minus 15, or 30 at Ivey). */
  postAt: Date;
  /** The DM with the minutes left until dueAt. */
  text: (minutesLeft: number) => string;
  contentKey: string;
};

/** The step's done flag, or undefined for a step nothing marks done. */
function stepDone(step: AgendaStep, done: DoneSteps): boolean | undefined {
  return step.doneWhen ? done[step.doneWhen] : undefined;
}

/**
 * The agenda steps with a deadline the sponsor must meet ("By 10:00 PM",
 * "due 9:45 AM", or done once sent), for this sponsor, with the deadline in
 * minutes after that day's midnight.
 */
export function dueSteps(
  s: Pick<PingSponsor, "prizeTrack" | "chatsOn">,
): { step: AgendaStep; due: number }[] {
  return AGENDA.filter(
    (step) =>
      !step.note &&
      (step.by === true ||
        step.due !== undefined ||
        step.doneWhen !== undefined) &&
      (!step.prizeOnly || s.prizeTrack) &&
      (!step.chatsOnly || s.chatsOn),
  ).map((step) => ({ step, due: step.due ?? step.end }));
}

/**
 * The organizer-reminders bot already pings a run-of-show task's owners 15
 * minutes before it. A lead who owns a task naming this sponsor near the
 * workshop hears from that bot, so this one stays quiet for them.
 */
export function ownsWorkshopTask(
  lead: LeadTarget,
  sponsorName: string,
  workshopStart: number,
  tasks: readonly RunOfShowTask[],
  contactNames: readonly string[],
): boolean {
  const name = sponsorName.toLowerCase();
  return tasks.some((t) => {
    if (t.day !== "Saturday" || !t.owner) return false;
    const start = minutesOfClock(t.start);
    if (start === null || Math.abs(start - workshopStart) > TASK_MATCH_MIN) {
      return false;
    }
    if (!t.task.toLowerCase().includes(name)) return false;
    return contactRowsNamed(t.owner, contactNames).has(lead.row);
  });
}

const hash = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/**
 * Pure: every ping each sponsor's leads should get, past ones included
 * (desiredPing drops those). Done steps are left out, so a ping waiting in
 * Slack for one is deleted on the next sync. `unmatched` lists sponsors
 * whose HW lead names nobody in HW Contacts with a Login email.
 */
export function planLeadPings(input: {
  sponsors: readonly PingSponsor[];
  contacts: readonly HwContact[];
  tasks: readonly RunOfShowTask[];
}): { pings: PlannedPing[]; unmatched: { sponsor: string; lead: string }[] } {
  const pings: PlannedPing[] = [];
  const unmatched: { sponsor: string; lead: string }[] = [];
  const contactNames = input.contacts.map((c) => c.name);
  for (const s of input.sponsors) {
    const leads = leadsFor(s.leadCell, input.contacts);
    if (leads.length === 0) {
      unmatched.push({ sponsor: s.name, lead: s.leadCell });
      continue;
    }
    const sponsor = escapeSlackText(s.name);
    const items: {
      item: string;
      dueAt: Date;
      leadMs: number;
      text: (m: number) => string;
      content: unknown[];
      skipFor?: (lead: LeadTarget) => boolean;
    }[] = [];

    if (!s.digital) {
      for (const w of s.workshops) {
        const start = minutesOfClock(w.start);
        if (start === null) continue;
        const arrive = start - WORKSHOP_ARRIVE_MIN;
        const where = roomLabel(w.location);
        items.push({
          item: `workshop:${w.start}`,
          dueAt: runOfShowInstant("Saturday", hhmm(arrive)),
          leadMs: PING_LEAD_MS,
          text: (m) =>
            copy.workshop(
              sponsor,
              m,
              clockTime(arrive),
              escapeSlackText(w.title),
              clockTime(start),
              where ? escapeSlackText(where) : null,
            ),
          content: ["workshop", s.name, w.start, w.title, w.location],
          skipFor: (lead) =>
            ownsWorkshopTask(lead, s.name, start, input.tasks, contactNames),
        });
      }
      if (s.chatsOn) {
        for (const c of s.chats) {
          const ivey = buildingOf(c.room) === "ivey";
          const where = ivey ? copy.iveyRoom(c.room) : copy.room(c.room);
          items.push({
            item: `chat:${c.placementId}`,
            dueAt: runOfShowInstant("Saturday", hhmm(c.start)),
            leadMs: ivey ? IVEY_PING_LEAD_MS : PING_LEAD_MS,
            text: (m) =>
              [
                copy.chat(
                  sponsor,
                  m,
                  escapeSlackText(c.rep),
                  clockTime(c.start),
                  where,
                ),
                ...(ivey
                  ? [
                      iveyWalkCopy.slackLine(
                        iveyWalkCopy.sponsor,
                        iveyWalkCopy.hackerMapUrl,
                      ),
                    ]
                  : []),
              ].join("\n"),
            content: ["chat", s.name, c.rep, c.start, c.room],
          });
        }
      }
    }

    for (const { step, due } of dueSteps(s)) {
      if (stepDone(step, s.done)) continue;
      items.push({
        item: `due:${step.id}`,
        dueAt: runOfShowInstant(DAYS[step.day]!, hhmm(due)),
        leadMs: PING_LEAD_MS,
        text: (m) =>
          copy.due(sponsor, m, escapeSlackText(step.title), clockTime(due)),
        content: ["due", s.name, step.id, step.title, due],
      });
    }

    for (const lead of leads) {
      for (const it of items) {
        if (it.skipFor?.(lead)) continue;
        pings.push({
          key: `${s.id}:${it.item}:${lead.email.toLowerCase()}`.slice(0, 255),
          sponsorId: s.id,
          sponsorName: s.name,
          item: it.item,
          lead,
          dueAt: it.dueAt,
          postAt: new Date(it.dueAt.getTime() - it.leadMs),
          text: it.text,
          contentKey: hash([...it.content, it.leadMs]),
        });
      }
    }
  }
  return { pings, unmatched };
}

/**
 * The ping this item should have now, or null once it's due. Scheduled at
 * postAt; closer than MIN_SCHEDULE_AHEAD_MS (or past postAt but not yet
 * due, e.g. the switch went on late) it goes at once with the real minutes.
 */
export function desiredPing(
  p: Pick<PlannedPing, "dueAt" | "postAt" | "text" | "contentKey">,
  now: Date,
): DesiredReminder | null {
  const due = p.dueAt.getTime();
  if (now.getTime() >= due) return null;
  if (p.postAt.getTime() - now.getTime() >= MIN_SCHEDULE_AHEAD_MS) {
    return {
      mode: "schedule",
      postAt: p.postAt,
      text: p.text(Math.round((due - p.postAt.getTime()) / 60_000)),
      contentKey: p.contentKey,
    };
  }
  const minutesLeft = Math.max(1, Math.ceil((due - now.getTime()) / 60_000));
  return {
    mode: "now",
    postAt: now,
    text: p.text(minutesLeft),
    contentKey: p.contentKey,
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export type PingInputs = {
  sponsors: PingSponsor[];
  contacts: HwContact[];
  tasks: RunOfShowTask[];
};

/**
 * Everything planLeadPings needs, or null when a sheet (HW Contacts,
 * Sponsor Day-Of, run of show) can't be read: then nothing changes, so a
 * Google hiccup never cancels pings.
 */
export async function loadPingInputs(
  sponsorIds?: readonly string[],
): Promise<PingInputs | null> {
  try {
    const dir = await loadLeadDirectory();
    if (!dir) return null;
    const registered = await db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors);
    const [ros, tracks, ticked, prefs, reps, placements, sends, finals] =
      await Promise.all([
        runOfShowFor(registered.map((s) => s.name)),
        prizeTrackSponsors(),
        coffeeChatSponsorNames(),
        db.select().from(coffeeChatPrefs),
        db
          .select({
            id: coffeeChatReps.id,
            sponsorId: coffeeChatReps.sponsorId,
            name: coffeeChatReps.name,
            chatsWanted: coffeeChatReps.chatsWanted,
          })
          .from(coffeeChatReps),
        db
          .select({
            id: coffeeChatPlacements.id,
            repId: coffeeChatPlacements.repId,
            sessionId: coffeeChatPlacements.sessionId,
            room: coffeeChatPlacements.room,
          })
          .from(coffeeChatPlacements)
          .where(eq(coffeeChatPlacements.status, "sent")),
        db
          .select({ sponsorId: sponsorShortlistSends.sponsorId })
          .from(sponsorShortlistSends),
        db
          .select({ sponsorId: sponsorFinalPicks.sponsorId })
          .from(sponsorFinalPicks),
      ]);
    if (!ros) return null;
    const want = sponsorIds ? new Set(sponsorIds) : null;
    const sent = new Set(sends.map((r) => r.sponsorId));
    const final = new Set(finals.map((r) => r.sponsorId));
    const sponsors: PingSponsor[] = [];
    for (const sp of registered) {
      if (want && !want.has(sp.id)) continue;
      const info = infoOf(dir, sp.name);
      if (!info) continue;
      const pref = prefs.find((p) => p.sponsorId === sp.id);
      const mine = reps.filter((r) => r.sponsorId === sp.id);
      const workshops = ros.items
        .filter(
          (i) =>
            i.day === "Saturday" &&
            i.column === "sponsor-workshop" &&
            i.sponsors.includes(sp.name),
        )
        .sort((a, b) => a.start.localeCompare(b.start));
      // Same chat start as the portal's Your chats: a session cut by their
      // workshop starts when its usable part does.
      const windows = setupWindows(
        workshops,
        chatMinutes({ hackersPerChat: pref?.hackersPerChat ?? 1 }),
      );
      const chats = placements.flatMap((p) => {
        const rep = mine.find((r) => r.id === p.repId);
        const session = COFFEE_SESSIONS.find((x) => x.id === p.sessionId);
        if (!rep || !session) return [];
        const start = (windows.partial[p.sessionId] ?? session).start;
        return [{ placementId: p.id, rep: rep.name, start, room: p.room }];
      });
      sponsors.push({
        id: sp.id,
        name: sp.name,
        leadCell: info.hwContact,
        digital: info.digital,
        prizeTrack: hasPrizeTrack(sp.name, tracks),
        chatsOn: doesChats(
          ticked,
          sp.name,
          pref?.submittedAt,
          mine.map((r) => r.chatsWanted),
        ),
        workshops: workshops.map((w) => ({
          start: w.start,
          title: w.title,
          location: w.location,
        })),
        chats,
        done: {
          availability: !!pref?.submittedAt,
          shortlist: !!pref?.shortlistSubmittedAt,
          finalists: sent.has(sp.id),
          top5: final.has(sp.id),
        },
      });
    }
    return { sponsors, contacts: dir.contacts, tasks: ros.tasks };
  } catch (error) {
    console.error(
      "[sponsor lead pings] couldn't load sponsors:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

type StoredPing = typeof sponsorLeadPings.$inferSelect;
type ScheduleResponse = SlackResponse & { scheduled_message_id?: string };
type PostResponse = SlackResponse & { ts?: string };

export type PingDeps = {
  mode?: LeadSlackMode;
  token?: string;
  fetch?: typeof fetch;
  now?: Date;
  /** Only these sponsors (a change hook); all when unset (the cron). */
  sponsorIds?: readonly string[];
  /** Stop starting new pings after this long; the rest count as `left`. */
  budgetMs?: number;
  /** Tests: the loaded sponsors, instead of reading the sheets. */
  inputs?: PingInputs;
  log?: (line: string) => void;
};

export type PingOutcome =
  | "kept"
  | "scheduled"
  | "sent"
  | "cancelled"
  | "not-found"
  | "failed"
  | "dry";

export type PingSweep = {
  mode: LeadSlackMode;
  /** True when a sheet couldn't be read (nothing changed). */
  skipped: boolean;
  left: number;
} & Record<PingOutcome, number>;

/** Dry-run lines already logged by this instance (the cron runs each minute). */
const dryLogged = new Set<string>();

/** Delete a waiting ping in Slack, then its row (coffee-chat-reminder's rules). */
async function cancelPing(
  token: string,
  stored: StoredPing,
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
      const gone =
        error instanceof SlackApiError &&
        error.code === "invalid_scheduled_message_id";
      const tooLate =
        stored.postAt.getTime() - now.getTime() < RECALL_MARGIN_MS;
      if (!gone && !tooLate) throw error;
    }
  }
  await db
    .delete(sponsorLeadPings)
    .where(
      and(
        eq(sponsorLeadPings.key, stored.key),
        eq(sponsorLeadPings.messageId, stored.messageId),
      ),
    );
}

/** Schedule (or send now) and store one ping; never twice. */
async function createPing(
  token: string,
  ping: PlannedPing,
  desired: DesiredReminder,
  channelOf: (email: string) => Promise<string | null>,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<"scheduled" | "sent" | "not-found" | "kept"> {
  const channel = await channelOf(ping.lead.email);
  if (!channel) return "not-found";
  const row = {
    key: ping.key,
    sponsorId: ping.sponsorId,
    slackChannel: channel,
    postAt: desired.postAt,
    contentKey: desired.contentKey,
    createdAt: now,
  };
  if (desired.mode === "now") {
    const claimed = await db
      .insert(sponsorLeadPings)
      .values({ ...row, kind: "sent", messageId: "" })
      .onConflictDoNothing()
      .returning({ key: sponsorLeadPings.key });
    if (!claimed.length) return "kept";
    let posted: PostResponse;
    try {
      posted = await slackApi<PostResponse>(
        token,
        "chat.postMessage",
        { channel, text: desired.text, unfurl_links: false },
        fetchImpl,
      );
    } catch (error) {
      await db
        .delete(sponsorLeadPings)
        .where(
          and(
            eq(sponsorLeadPings.key, ping.key),
            eq(sponsorLeadPings.messageId, ""),
          ),
        );
      throw error;
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await db
          .update(sponsorLeadPings)
          .set({ messageId: posted.ts ?? "sent" })
          .where(eq(sponsorLeadPings.key, ping.key));
        break;
      } catch (error) {
        console.error(
          `[sponsor lead pings] sent, but saving it failed (try ${attempt}):`,
          error instanceof Error ? error.message : String(error),
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
      unfurl_links: false,
    },
    fetchImpl,
  );
  const messageId = scheduled.scheduled_message_id;
  if (!messageId) {
    throw new SlackApiError("chat.scheduleMessage", "no_scheduled_message_id");
  }
  const stored = await db
    .insert(sponsorLeadPings)
    .values({ ...row, kind: "scheduled", messageId })
    .onConflictDoNothing()
    .returning({ key: sponsorLeadPings.key });
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
 * Make Slack match every planned ping now (or only `sponsorIds`').
 * Idempotent; never throws (failures are logged and counted). Dry mode
 * logs what it would do and writes nothing.
 */
export async function syncSponsorLeadPings(
  deps: PingDeps = {},
): Promise<PingSweep> {
  const mode = deps.mode ?? pingsMode();
  const sweep: PingSweep = {
    mode,
    skipped: false,
    left: 0,
    kept: 0,
    scheduled: 0,
    sent: 0,
    cancelled: 0,
    "not-found": 0,
    failed: 0,
    dry: 0,
  };
  if (mode === "off") return sweep;
  const log = deps.log ?? ((line: string) => console.info(line));
  const token = deps.token ?? env.SLACK_BOT_TOKEN;
  const fetchImpl = deps.fetch ?? fetch;
  try {
    const inputs = deps.inputs ?? (await loadPingInputs(deps.sponsorIds));
    if (!inputs) {
      sweep.skipped = true;
      return sweep;
    }
    const { pings } = planLeadPings(inputs);
    const stored = await db
      .select()
      .from(sponsorLeadPings)
      .where(
        deps.sponsorIds
          ? inArray(sponsorLeadPings.sponsorId, [...deps.sponsorIds])
          : undefined,
      );
    const storedBy = new Map(stored.map((r) => [r.key, r]));
    const plannedBy = new Map(pings.map((p) => [p.key, p]));
    const startedAt = Date.now();
    const now0 = deps.now ?? new Date();
    // Planned pings soonest first, then rows still waiting whose item is gone.
    const keys = [
      ...[...pings].sort((a, b) => a.postAt.getTime() - b.postAt.getTime()),
    ].map((p) => p.key);
    for (const r of stored) {
      if (plannedBy.has(r.key)) continue;
      if (
        (r.kind === "scheduled" && r.postAt > now0) ||
        isStaleClaim(r, now0)
      ) {
        keys.push(r.key);
      }
    }
    const channels = new Map<string, Promise<string | null>>();
    const channelOf = (email: string) => {
      const k = email.toLowerCase();
      let c = channels.get(k);
      if (!c) {
        c = openDmByEmails(token!, [email], fetchImpl);
        channels.set(k, c);
      }
      return c;
    };
    for (const [i, key] of keys.entries()) {
      if (
        deps.budgetMs !== undefined &&
        Date.now() - startedAt > deps.budgetMs
      ) {
        sweep.left = keys.length - i;
        break;
      }
      const now = deps.now ?? new Date();
      const ping = plannedBy.get(key) ?? null;
      const row = storedBy.get(key) ?? null;
      const desired = ping ? desiredPing(ping, now) : null;
      const plan = planReminder(row, desired, now);
      if (plan.action === "keep" || plan.action === "none") {
        if (plan.action === "keep") sweep.kept++;
        continue;
      }
      if (mode === "dry" || !token) {
        const what = plan.create
          ? `${plan.cancel ? "re" : ""}${plan.create.mode === "now" ? "send now" : `schedule for ${plan.create.postAt.toISOString()}`}`
          : "cancel";
        const line = `[sponsor lead pings] dry run, would ${what}${ping ? ` to ${ping.lead.name}: ${plan.create?.text ?? ""}` : `: ${key}`}`;
        const once = `${key}|${desired?.contentKey ?? ""}|${what}`;
        if (!dryLogged.has(once)) {
          dryLogged.add(once);
          log(line);
        }
        sweep.dry++;
        continue;
      }
      try {
        if (plan.cancel) await cancelPing(token, plan.cancel, now, fetchImpl);
        if (!plan.create || !ping) {
          sweep.cancelled++;
          continue;
        }
        const outcome = await createPing(
          token,
          ping,
          plan.create,
          channelOf,
          fetchImpl,
          now,
        );
        sweep[outcome]++;
        if (outcome === "not-found") {
          console.warn(
            `[sponsor lead pings] ${ping.lead.name} isn't on Slack by their HW Contacts Login email`,
          );
        }
      } catch (error) {
        sweep.failed++;
        console.error(
          "[sponsor lead pings] sync failed for one ping:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    sweep.failed++;
    console.error(
      "[sponsor lead pings] sync failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  return sweep;
}

/**
 * After a write that finishes or changes a sponsor's items: sync just those
 * sponsors in the background (waitUntil). Never throws; no-op when off.
 */
export function syncLeadPingsLater(sponsorIds: readonly string[]): void {
  try {
    if (sponsorIds.length === 0 || pingsMode() === "off") return;
    waitUntil(syncSponsorLeadPings({ sponsorIds: [...new Set(sponsorIds)] }));
  } catch (error) {
    console.error(
      "[sponsor lead pings] couldn't start a sync:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export type LeadPingPreviewRow = {
  sponsorName: string;
  item: string;
  lead: string;
  dueAt: Date;
  postAt: Date;
  text: string;
  /** In Slack already, sent, still to schedule, or past (never sent). */
  state: "scheduled" | "sent" | "planned" | "past";
};

/**
 * For organizers: every planned ping and where it stands, plus sponsors
 * whose HW lead doesn't match HW Contacts. Reads only; sends nothing.
 */
export async function previewSponsorLeadPings(now: Date = new Date()): Promise<{
  mode: LeadSlackMode;
  readable: boolean;
  pings: LeadPingPreviewRow[];
  unmatched: { sponsor: string; lead: string }[];
}> {
  const mode = pingsMode();
  const inputs = await loadPingInputs();
  if (!inputs) return { mode, readable: false, pings: [], unmatched: [] };
  const { pings, unmatched } = planLeadPings(inputs);
  const stored = await db.select().from(sponsorLeadPings);
  const storedBy = new Map(stored.map((r) => [r.key, r]));
  return {
    mode,
    readable: true,
    unmatched,
    pings: pings
      .sort((a, b) => a.postAt.getTime() - b.postAt.getTime())
      .map((p) => {
        const row = storedBy.get(p.key);
        const desired = desiredPing(p, now);
        return {
          sponsorName: p.sponsorName,
          item: p.item,
          lead: p.lead.name,
          dueAt: p.dueAt,
          postAt: p.postAt,
          text:
            desired?.text ??
            p.text(
              Math.round((p.dueAt.getTime() - p.postAt.getTime()) / 60_000),
            ),
          state: row
            ? row.kind === "scheduled" && row.postAt > now
              ? "scheduled"
              : "sent"
            : desired
              ? "planned"
              : "past",
        };
      }),
  };
}
