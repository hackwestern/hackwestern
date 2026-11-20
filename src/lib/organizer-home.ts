/**
 * The organizer Home's day view (mock organizer-sponsors-home-v3, decisions
 * 2026-11-19 "Organizer Home = day view"): which columns a day shows, when a
 * sponsor's cell is done, and when it raises an amber flag. Pure, so the
 * rules are tested without the page. Labels live in
 * src/content/sponsor-organizer.ts (`home`).
 */
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { ROUND1_OVER } from "~/lib/judging-board";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { round1State, type SundayJudging } from "~/lib/sponsor-day-board";
import {
  pillDone,
  type MySponsorChats,
} from "~/lib/sponsor-organizer";

/** One rep in one room for one Saturday session, with its seats. */
export type RepBlock = {
  repName: string;
  sessionId: string;
  room: string;
  /** Minutes after midnight, Saturday. */
  start: number;
  end: number;
  accepted: number;
  waiting: number;
};

/**
 * Each rep's sessions with their accepted and waiting invites, by rep then
 * time. Only sent placements: a draft isn't a chat yet.
 */
export function repBlocks({
  reps,
  placements,
  invites,
}: {
  reps: readonly { id: string; name: string; position: number }[];
  placements: readonly {
    id: string;
    repId: string;
    sessionId: string;
    room: string;
    status: "draft" | "sent";
  }[];
  invites: readonly { placementId: string | null; status: string }[];
}): RepBlock[] {
  const out: (RepBlock & { position: number })[] = [];
  for (const p of placements) {
    if (p.status !== "sent") continue;
    const rep = reps.find((r) => r.id === p.repId);
    const session = COFFEE_SESSIONS.find((s) => s.id === p.sessionId);
    if (!rep || !session) continue;
    const mine = invites.filter((i) => i.placementId === p.id);
    out.push({
      repName: rep.name,
      position: rep.position,
      sessionId: p.sessionId,
      room: p.room,
      start: session.start,
      end: session.end,
      accepted: mine.filter((i) => i.status === "accepted").length,
      waiting: mine.filter((i) => i.status === "pending").length,
    });
  }
  return out
    .sort(
      (a, b) =>
        a.start - b.start || a.position - b.position || a.repName.localeCompare(b.repName),
    )
    .map(({ position: _position, ...b }) => b);
}

/** A sponsor as the Home reads it: the sheet row plus our database. */
export type HomeSponsor = {
  name: string;
  sponsorId: string | null;
  /** Sponsor Day-Of status; null when the sheet didn't load. */
  status: string | null;
  /** "At CC workshop"; null when the tab has no such column. */
  atCcWorkshop: boolean | null;
  /** Coffee chat progress; undefined while loading or unregistered. */
  chats: MySponsorChats | undefined;
  blocks: readonly RepBlock[];
  /** Sunday rounds; undefined without a summary. */
  sunday: SundayJudging | undefined;
  /** Sunday judging room is missing (from the judging board). */
  missingRoom: boolean;
  /** Their workshops' times on each day ("HH:MM"). */
  workshops: readonly { day: RunOfShowDay; start: string; end: string | null }[];
  /** Has a prize track (judges on Sunday). */
  prizeTrack: boolean;
  /** Digital prize track (PCBWay): no booth, chats or room. */
  digital: boolean;
};

export type HomeColumnKey =
  | "arrived"
  | "booth"
  | "briefing"
  | "availability"
  | "shortlist"
  | "invites"
  | "chats"
  | "workshop"
  | "boothOpen"
  | "judgingShortlist"
  | "judgingRoom"
  | "top5";

export type HomeFlag =
  | { kind: "notHere" }
  | { kind: "noAvailability" }
  | { kind: "invitesNotOut" }
  | { kind: "changedAfterSend" }
  /** Sent chats nobody has accepted or is answering; `first` is the earliest. */
  | { kind: "emptyBlocks"; count: number; first: { rep: string; start: number } }
  | { kind: "shortlistLate" }
  | { kind: "noRoom" }
  | { kind: "topLate" };

/** Every day's columns, in the order the table shows them. */
export const HOME_COLUMNS: Record<RunOfShowDay, readonly HomeColumnKey[]> = {
  Friday: ["arrived", "booth", "briefing", "availability", "shortlist", "invites"],
  Saturday: ["chats", "workshop", "boothOpen"],
  Sunday: ["judgingShortlist", "judgingRoom", "top5"],
};

/** Info-only columns: never flagged, never collapsed into "All done". */
const INFO_COLUMNS = new Set<HomeColumnKey>(["boothOpen", "shortlist"]);

const at = (day: RunOfShowDay, time: string) => runOfShowInstant(day, time);
/** A workshop with no end time on the sheet counts as one hour. */
const WORKSHOP_GUESS_MS = 60 * 60_000;

/** Has `day` started yet (Eastern)? Days that haven't show the plan, no flags. */
export function dayStarted(day: RunOfShowDay, now: Date): boolean {
  return now >= at(day, "00:00");
}

/** The day of the event `now` falls in; null outside Fri–Sun. */
export function eventToday(now: Date): RunOfShowDay | null {
  return (
    RUN_OF_SHOW_DAYS.find((d) => now >= at(d, "00:00") && now < at(d, "24:00")) ??
    null
  );
}

/** Does this column apply to this sponsor at all? (Else the cell reads "—".) */
export function applies(col: HomeColumnKey, s: HomeSponsor): boolean {
  switch (col) {
    case "arrived":
    case "booth":
    case "boothOpen":
      return !s.digital;
    case "briefing":
      return !s.digital && s.atCcWorkshop !== null;
    case "availability":
    case "shortlist":
    case "chats":
      return !s.digital && !!s.sponsorId;
    case "invites":
      return !s.digital && !!s.chats && s.chats.repsChatting > 0;
    case "workshop":
      return s.workshops.some((w) => w.day === "Saturday");
    case "judgingShortlist":
    case "judgingRoom":
      return s.prizeTrack && !s.digital;
    case "top5":
      return s.prizeTrack;
  }
}

/** "11:48": presentations end, when a missing top 5 is flagged. */
const PRESENTATIONS_OVER = `${Math.floor(ROUND1_OVER / 60)}:${String(ROUND1_OVER % 60).padStart(2, "0")}`;

/** The cell's problems now. Empty before the day starts. */
export function flagsFor(
  col: HomeColumnKey,
  s: HomeSponsor,
  day: RunOfShowDay,
  now: Date,
): HomeFlag[] {
  if (!applies(col, s) || INFO_COLUMNS.has(col) || !dayStarted(day, now)) {
    return [];
  }
  const after = (time: string) => now >= at(day, time);
  switch (col) {
    case "arrived":
      return s.status !== null && !pillDone("arrival", s.status) && after("17:05")
        ? [{ kind: "notHere" }]
        : [];
    case "availability":
      return s.chats && !s.chats.prefsSubmittedAt && after("17:30")
        ? [{ kind: "noAvailability" }]
        : [];
    case "invites":
      return s.chats && s.chats.invites === 0 && after("22:15")
        ? [{ kind: "invitesNotOut" }]
        : [];
    case "chats": {
      const out: HomeFlag[] = [];
      if (s.chats && !s.chats.prefsSubmittedAt) out.push({ kind: "noAvailability" });
      if (s.chats?.changedAfterSend) out.push({ kind: "changedAfterSend" });
      // Sent chats nobody has accepted or is answering, before they start:
      // one flag for all of them, so a sponsor with many reads as one fix.
      const nowMin = minutesInto("Saturday", now);
      const empty = s.blocks.filter(
        (b) => b.accepted + b.waiting === 0 && nowMin < b.start,
      );
      if (empty[0]) {
        out.push({
          kind: "emptyBlocks",
          count: empty.length,
          first: { rep: empty[0].repName, start: empty[0].start },
        });
      }
      return out;
    }
    case "judgingShortlist":
      return s.sunday && round1State(s.sunday).kind !== "sent" && after("09:00")
        ? [{ kind: "shortlistLate" }]
        : [];
    case "judgingRoom":
      return s.missingRoom ? [{ kind: "noRoom" }] : [];
    case "top5":
      return s.sunday && !s.sunday.finalSubmittedAt && after(PRESENTATIONS_OVER)
        ? [{ kind: "topLate" }]
        : [];
    default:
      return [];
  }
}

/** Is the sponsor's part of this column finished (and nothing open)? */
export function isDone(
  col: HomeColumnKey,
  s: HomeSponsor,
  day: RunOfShowDay,
  now: Date,
): boolean {
  if (!applies(col, s)) return true;
  if (flagsFor(col, s, day, now).length > 0) return false;
  switch (col) {
    case "arrived":
      return s.status !== null && pillDone("arrival", s.status);
    case "booth":
      return s.status !== null && pillDone("booth", s.status);
    case "briefing":
      return s.atCcWorkshop === true;
    case "availability":
      return !!s.chats?.prefsSubmittedAt;
    case "invites":
      return !!s.chats && s.chats.invites > 0;
    case "chats": {
      const nowMin = minutesInto("Saturday", now);
      return (
        !!s.chats?.prefsSubmittedAt &&
        (s.blocks.length === 0
          ? s.chats.repsChatting === 0
          : s.blocks.every((b) => b.end <= nowMin))
      );
    }
    case "workshop":
      return s.workshops
        .filter((w) => w.day === "Saturday")
        .every(
          (w) =>
            now.getTime() >=
            (w.end
              ? at("Saturday", w.end).getTime()
              : at("Saturday", w.start).getTime() + WORKSHOP_GUESS_MS),
        );
    case "judgingShortlist":
      return !!s.sunday && round1State(s.sunday).kind === "sent";
    case "judgingRoom":
      return !s.missingRoom;
    case "top5":
      return !!s.sunday?.finalSubmittedAt;
    default:
      return false;
  }
}

/**
 * Columns that collapse into a green "All done" chip: every sponsor they
 * apply to is done with no flag. Info columns never collapse, and a column
 * that applies to nobody shows as done too.
 */
export function doneColumns(
  day: RunOfShowDay,
  sponsors: readonly HomeSponsor[],
  now: Date,
): Set<HomeColumnKey> {
  const out = new Set<HomeColumnKey>();
  if (sponsors.length === 0) return out;
  for (const col of HOME_COLUMNS[day]) {
    if (INFO_COLUMNS.has(col)) continue;
    if (sponsors.every((s) => isDone(col, s, day, now))) out.add(col);
  }
  return out;
}

/** Every flag a sponsor has on `day`. */
export function sponsorFlags(
  s: HomeSponsor,
  day: RunOfShowDay,
  now: Date,
): HomeFlag[] {
  return HOME_COLUMNS[day].flatMap((col) => flagsFor(col, s, day, now));
}

/** Which sponsors the day shows: digital ones only on Sunday. */
export function sponsorsOnDay(
  day: RunOfShowDay,
  sponsors: readonly HomeSponsor[],
): HomeSponsor[] {
  return sponsors.filter((s) => !s.digital || day === "Sunday");
}

/**
 * The board button's count, over every sponsor. Friday and Saturday: coffee
 * chat sponsors that still need an organizer on the board (no availability,
 * invites not out on Friday; changed reps or an empty chat on Saturday).
 * Sunday: prize-track sponsors whose shortlist, or top 5 once round 2 is
 * open, isn't in.
 */
export function boardCount(
  day: RunOfShowDay,
  sponsors: readonly HomeSponsor[],
  now: Date,
  round2Open: boolean,
): number {
  if (day === "Sunday") {
    return sponsors.filter(
      (s) =>
        s.prizeTrack &&
        s.sunday &&
        (s.digital
          ? round2Open && !s.sunday.finalSubmittedAt
          : round1State(s.sunday).kind !== "sent" ||
            (round2Open && !s.sunday.finalSubmittedAt)),
    ).length;
  }
  return sponsors.filter((s) => {
    if (s.digital || !s.chats) return false;
    if (!s.chats.prefsSubmittedAt) return true;
    if (day === "Friday") return s.chats.repsChatting > 0 && s.chats.invites === 0;
    const nowMin = minutesInto("Saturday", now);
    return (
      s.chats.changedAfterSend ||
      s.blocks.some((b) => b.accepted + b.waiting === 0 && nowMin < b.start)
    );
  }).length;
}

/** Minutes since `day`'s midnight (Eastern); negative before the day. */
export function minutesInto(day: RunOfShowDay, now: Date): number {
  return Math.floor((now.getTime() - at(day, "00:00").getTime()) / 60_000);
}

/** A team task with its start instant. */
export type DatedTask = { day: RunOfShowDay; start: string; task: string; owner: string | null };

export type UpNext =
  | { kind: "next"; task: DatedTask; minutes: number }
  | { kind: "first"; task: DatedTask }
  | { kind: "over" }
  | { kind: "none" };

/**
 * The Up next line for the picked day. Today: the organizer's next task
 * (minutes away, 0 = starting now). A later day: its first task. A past
 * day: over. `isMine` picks the organizer's own tasks.
 */
export function upNext(
  day: RunOfShowDay,
  tasks: readonly DatedTask[],
  now: Date,
  isMine: (owner: string | null) => boolean,
): UpNext {
  if (now >= at(day, "24:00")) return { kind: "over" };
  const mine = tasks
    .filter((t) => t.day === day && isMine(t.owner))
    .map((t) => ({ t, when: at(t.day, t.start) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  if (!dayStarted(day, now)) {
    return mine[0] ? { kind: "first", task: mine[0].t } : { kind: "none" };
  }
  const next = mine.find((m) => m.when.getTime() >= now.getTime() - 60_000);
  return next
    ? {
        kind: "next",
        task: next.t,
        minutes: Math.max(0, Math.round((next.when.getTime() - now.getTime()) / 60_000)),
      }
    : { kind: "none" };
}
