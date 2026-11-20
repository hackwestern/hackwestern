import { createHash } from "node:crypto";
import { autoPingCopy as copy } from "~/content/auto-ping";
import {
  displayText,
  emailOf,
  groupUnits,
  planFinal,
  planUnit,
  type Messages,
  type Planned,
  type RosterRow,
  type Unit,
} from "./auto-ping-schedule";

/**
 * Keeps Slack's scheduled Auto-Ping DMs in step with the plan. Templates are
 * free text people edit, so our scheduled messages can't be recognised by
 * their text (the organizer bot's trick). Instead every message we schedule
 * or send has a row on the sheet's Queue tab: its key, Slack's
 * scheduled_message_id, post time and a hash of the text. Each sync settles
 * rows whose time has passed, cancels or replaces rows the plan no longer
 * matches, and schedules what's new. Pure apart from the SlackPort.
 */

/** Leave messages this close to sending alone: Slack can't cancel the last minute. */
export const FREEZE_MS = 2 * 60_000;

export type QueueStatus =
  | "scheduled"
  | "sent"
  | "cancelled"
  | "held"
  | "not-on-slack";
export type QueueRow = {
  key: string;
  role: string;
  name: string;
  email: string;
  /** Messages tab key ("Check-in: Mentor"). */
  message: string;
  channel: string;
  messageId: string;
  /** ISO time. */
  postAt: string;
  /** Text hash, or the missing placeholder while held. */
  hash: string;
  status: QueueStatus;
  updated: string;
};

export const QUEUE_HEADER = [
  "Key",
  "Role",
  "Full name",
  "Email",
  "Message",
  "Channel",
  "Scheduled message id",
  "Post at",
  "Text hash",
  "Status",
  "Updated",
];
const STATUSES: QueueStatus[] = [
  "scheduled",
  "sent",
  "cancelled",
  "held",
  "not-on-slack",
];

export function readQueue(grid: string[][]): QueueRow[] {
  return grid
    .slice(1)
    .filter((r) => r[0]?.trim())
    .map((r) => {
      const c = (i: number) => r[i]?.trim() ?? "";
      const status = STATUSES.find((s) => s === c(9)) ?? "cancelled";
      return {
        key: c(0),
        role: c(1),
        name: c(2),
        email: c(3),
        message: c(4),
        channel: c(5),
        messageId: c(6),
        postAt: c(7),
        hash: c(8),
        status,
        updated: c(10),
      };
    });
}

export function queueGrid(rows: QueueRow[]): string[][] {
  return [
    QUEUE_HEADER,
    ...rows.map((r) => [
      r.key,
      r.role,
      r.name,
      r.email,
      r.message,
      r.channel,
      r.messageId,
      r.postAt,
      r.hash,
      r.status,
      r.updated,
    ]),
  ];
}

export const textHash = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/** What sync needs from Slack, so tests can fake it. */
export type SlackPort = {
  /** User id for an email, or null when nobody on Slack has it. */
  lookup(email: string): Promise<string | null>;
  openDm(user: string): Promise<string>;
  /** Returns the scheduled_message_id. */
  schedule(
    channel: string,
    postAtSeconds: number,
    text: string,
  ): Promise<string>;
  post(channel: string, text: string): Promise<void>;
  /** "gone" when Slack no longer has it (already sent or deleted). */
  cancel(channel: string, id: string): Promise<"ok" | "gone">;
};

export type LogEvent = {
  key: string;
  role: string;
  name: string;
  email: string;
  message: string;
  result: string;
};

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
export const when = (at: Date) => clock.format(at);

const slackMarker = (email: string) => `${email}|slack`;

/**
 * One reconcile pass. `planned` is everything that should be queued now
 * (empty when the bot is off, which cancels the queue). Returns the new
 * Queue rows and one log event per change; unchanged syncs log nothing.
 */
export async function reconcile(options: {
  planned: Planned[];
  queue: QueueRow[];
  slack: SlackPort;
  now?: () => number;
}) {
  const { planned, slack } = options;
  const now = options.now ?? Date.now;
  const nowMs = now();
  const stamp = new Date(nowMs).toISOString();
  const cutoff = nowMs + FREEZE_MS;
  const rows = new Map(options.queue.map((r) => [r.key, { ...r }]));
  const wanted = new Map(planned.map((p) => [p.key, p]));
  const events: LogEvent[] = [];
  const issues: string[] = [];
  const counts = {
    scheduled: 0,
    sent: 0,
    kept: 0,
    cancelled: 0,
    held: 0,
    notOnSlack: 0,
  };
  const log = (
    from: {
      key: string;
      role: string;
      name: string;
      email: string | null;
      message: string;
    },
    result: string,
  ) =>
    events.push({
      key: from.key,
      role: from.role,
      name: from.name,
      email: from.email ?? "",
      message: from.message,
      result,
    });
  const fromPlan = (p: Planned) => ({ ...p, message: p.template });

  // 1. Scheduled messages whose time has passed went out.
  for (const row of rows.values()) {
    if (row.status === "scheduled" && Date.parse(row.postAt) <= nowMs) {
      row.status = "sent";
      row.updated = stamp;
      log(row, copy.log.sent);
    }
  }

  // 2. Cancel queued messages the plan no longer matches (or wants).
  const replaced = new Set<string>();
  for (const row of rows.values()) {
    if (row.status !== "scheduled" || Date.parse(row.postAt) <= cutoff)
      continue;
    const want = wanted.get(row.key);
    if (
      want?.text != null &&
      want.email === row.email &&
      want.postAt.toISOString() === row.postAt &&
      textHash(want.text) === row.hash
    ) {
      counts.kept++;
      continue;
    }
    try {
      await slack.cancel(row.channel, row.messageId);
      row.status = "cancelled";
      row.updated = stamp;
      counts.cancelled++;
      if (want?.text != null) replaced.add(row.key);
      else if (!want) log(row, copy.log.cancelled);
    } catch (error) {
      issues.push(`Could not cancel a scheduled DM: ${String(error)}`);
    }
  }

  // 3. Queue (or send late) what's wanted and not already handled.
  const users = new Map<string, string | null>();
  const channels = new Map<string, string>();
  for (const p of planned) {
    const row = rows.get(p.key);
    if (row?.status === "sent" || row?.status === "scheduled") continue;
    if (+p.deadline <= nowMs || !p.email) continue;
    const base = {
      key: p.key,
      role: p.role,
      name: p.name,
      email: p.email,
      message: p.template,
      channel: row?.channel ?? "",
      messageId: "",
      postAt: p.postAt.toISOString(),
      updated: stamp,
    };
    if (p.text === null) {
      counts.held++;
      const missing = p.missing ?? "";
      if (row?.status !== "held" || row.hash !== missing) {
        rows.set(p.key, { ...base, hash: missing, status: "held" });
        log(fromPlan(p), copy.log.held(missing));
      }
      continue;
    }
    const late = +p.postAt <= cutoff;
    try {
      if (!users.has(p.email)) users.set(p.email, await slack.lookup(p.email));
      const user = users.get(p.email);
      const marker = slackMarker(p.email);
      if (!user) {
        counts.notOnSlack++;
        if (!rows.has(marker)) {
          rows.set(marker, {
            ...base,
            key: marker,
            message: "",
            postAt: "",
            hash: "",
            status: "not-on-slack",
          });
          log(
            { ...fromPlan(p), key: marker, message: "" },
            copy.log.notOnSlack,
          );
        }
        continue;
      }
      rows.delete(marker);
      let channel = channels.get(user);
      if (!channel) {
        channel = await slack.openDm(user);
        channels.set(user, channel);
      }
      const hash = textHash(p.text);
      if (late) {
        await slack.post(channel, p.text);
        rows.set(p.key, { ...base, channel, hash, status: "sent" });
        counts.sent++;
        log(fromPlan(p), +p.postAt < nowMs ? copy.log.sentLate : copy.log.sent);
      } else {
        const id = await slack.schedule(
          channel,
          Math.floor(+p.postAt / 1000),
          p.text,
        );
        rows.set(p.key, {
          ...base,
          channel,
          messageId: id,
          hash,
          status: "scheduled",
        });
        counts.scheduled++;
        log(
          fromPlan(p),
          (replaced.has(p.key) ? copy.log.rescheduled : copy.log.scheduled)(
            when(p.postAt),
          ),
        );
      }
    } catch (error) {
      issues.push(`Could not queue a DM: ${String(error)}`);
    }
  }
  return { queue: [...rows.values()], events, issues, counts };
}

/** One row of the "Planned messages" tab. */
export type PlanLine = {
  email: string;
  name: string;
  role: string;
  message: string;
  sendsAt: string;
  status: string;
  text: string;
  sortAt: number;
};

/**
 * Where one planned message stands, for the Planned messages tab. What
 * Slack has (sent, queued) wins; then why it won't go (not ticked, a
 * problem in column J, no email, not on Slack, a blank fill-in, too late).
 */
export function messageStatus(
  p: Planned,
  context: {
    queue: QueueRow[];
    nowMs: number;
    enabled: boolean;
    /** Why this person isn't messaged at all (Send? off etc.), if so. */
    gate: string | null;
  },
): string {
  const s = copy.planned.status;
  const row = context.queue.find((r) => r.key === p.key);
  if (row?.status === "sent") return s.sent;
  if (row?.status === "scheduled" && Date.parse(row.postAt) > context.nowMs)
    return s.queued;
  if (context.gate) return context.gate;
  if (p.email && context.queue.some((r) => r.key === `${p.email}|slack`))
    return s.notOnSlack;
  if (p.text === null) return s.held(p.missing ?? "");
  if (p.kind === "final") return s.final;
  if (+p.deadline <= context.nowMs) return s.past;
  if (!context.enabled) return s.paused;
  return s.notQueued;
}

/**
 * Every message every person will get, ticked or not, sorted by person then
 * time. Ticked people's messages are exactly the sync's plan; everyone
 * else's are what they'd get once ticked (and fixed).
 */
export function planLines(
  roster: RosterRow[],
  messages: Messages,
  options: { queue: QueueRow[]; nowMs: number; enabled: boolean },
): PlanLine[] {
  const s = copy.planned.status;
  const gated = groupUnits(roster, true);
  const inPlan = new Set(gated.flatMap((u) => u.rows));
  const rest = groupUnits(
    roster.filter((r) => !inPlan.has(r)),
    false,
  );
  const now = new Date(options.nowMs);
  const lines: PlanLine[] = [];
  const add = (unit: Unit, gate: string | null) => {
    if (!unit.shifts.length) return; // no shifts, no messages (see column J)
    for (const p of [
      ...planUnit(unit, messages),
      planFinal(unit, messages, now),
    ]) {
      const final = p.kind === "final";
      lines.push({
        email: unit.email ?? "",
        name: unit.name,
        role: [...new Set(unit.rows.map((r) => r.role))].join(" + "),
        message: p.template,
        sendsAt: final ? copy.planned.byHand : when(p.postAt),
        status: messageStatus(p, { ...options, gate }),
        text:
          p.text === null
            ? copy.planned.heldText(p.missing ?? "a fill-in")
            : displayText(p.text),
        sortAt: final ? Number.MAX_SAFE_INTEGER : +p.postAt,
      });
    }
  };
  for (const unit of gated) add(unit, null);
  for (const unit of rest) {
    const gate = unit.rows.some((r) => r.flags.some((f) => f.blocking))
      ? s.blocked
      : !unit.rows.some((r) => r.send)
        ? s.notTicked
        : s.noEmail;
    add(unit, gate);
  }
  return lines.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.email.localeCompare(b.email) ||
      a.sortAt - b.sortAt,
  );
}

export function planGrid(lines: PlanLine[]): string[][] {
  return [
    copy.planned.header,
    ...lines.map((l) => [
      l.email,
      l.name,
      l.role,
      l.message,
      l.sendsAt,
      l.status,
      l.text,
    ]),
  ];
}

/**
 * People column I ("Sent / next") for one row: why nothing goes, or how many
 * went and what's next. `planned` is the live plan (empty when the bot is off).
 */
export function sentNext(
  row: RosterRow,
  context: {
    queue: QueueRow[];
    planned: Planned[];
    nowMs: number;
    enabled: boolean;
  },
): string {
  const c = copy.sentNext;
  if (row.flags.some((f) => f.blocking)) return c.blocked;
  if (!row.send) return c.notTicked;
  const email = emailOf(row);
  if (!email) return c.noEmail;
  const mine = context.queue.filter((r) => r.email === email);
  if (mine.some((r) => r.status === "not-on-slack")) return c.notOnSlack;
  const held = context.planned.find(
    (p) => p.email === email && p.text === null && +p.deadline > context.nowMs,
  );
  if (held) return c.held(held.missing ?? "");
  const sent = mine.filter((r) => r.status === "sent").length;
  const next = mine
    .filter(
      (r) => r.status === "scheduled" && Date.parse(r.postAt) > context.nowMs,
    )
    .sort((a, b) => Date.parse(a.postAt) - Date.parse(b.postAt))[0];
  if (next) return c.next(sent, next.message, when(new Date(next.postAt)));
  if (!context.enabled) return c.paused;
  return sent ? c.allSent : c.nothing;
}
