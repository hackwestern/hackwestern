// The organizer Sponsors tab follows the event day (Jazz, 2026-11-18):
// Friday shows who has arrived and has their portal link, Saturday each
// sponsor's coffee chat slots (booked/asked), Sunday where each sponsor is
// in judging and where they should be right now. Pure, so it's tested
// without a page or a database.

import {
  RUN_OF_SHOW_DAYS,
  locationFor,
  type RunOfShowDay,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { PRESENTATION_SLOT_MINUTES } from "~/lib/sponsor-presentations";
import type { SponsorStatus } from "~/lib/sponsor-status";

/** ?day=saturday (any case) -> "Saturday"; anything else -> null. */
export function parseDayParam(
  value: string | string[] | undefined,
): RunOfShowDay | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  if (!raw) return null;
  return RUN_OF_SHOW_DAYS.find((d) => d.toLowerCase() === raw) ?? null;
}

/** The day the Sponsors tab opens on: today during the event, else Friday. */
export function sponsorBoardDefaultDay(now: Date): RunOfShowDay {
  for (const day of RUN_OF_SHOW_DAYS) {
    if (
      now >= runOfShowInstant(day, "00:00") &&
      now < runOfShowInstant(day, "24:00")
    ) {
      return day;
    }
  }
  return "Friday";
}

// ---------------------------------------------------------------------------
// Friday
// ---------------------------------------------------------------------------

/** Any status past "Not arrived" means they got here (even "Left"). */
export function hasArrived(status: SponsorStatus): boolean {
  return status !== "Not arrived";
}

// ---------------------------------------------------------------------------
// Saturday
// ---------------------------------------------------------------------------

export type ChatSlotFill = {
  room: string;
  slotTime: string;
  booked: number;
  /** Hackers asked for in this slot (at most 3; 0 = asked for none). */
  needed: number;
};

export type SlotTone = "full" | "open" | "off";

/** Full when every hacker asked for is booked; off when asked for none. */
export function slotTone(
  slot: Pick<ChatSlotFill, "booked" | "needed">,
): SlotTone {
  if (slot.needed === 0) return "off";
  return slot.booked >= slot.needed ? "full" : "open";
}

/** A sponsor's slots grouped by room, rooms in first-slot order. */
export function slotsByRoom(
  slots: readonly ChatSlotFill[],
): { room: string; slots: ChatSlotFill[] }[] {
  const sorted = [...slots].sort(
    (a, b) =>
      a.slotTime.localeCompare(b.slotTime) || a.room.localeCompare(b.room),
  );
  const groups = new Map<string, ChatSlotFill[]>();
  for (const s of sorted) {
    const list = groups.get(s.room) ?? [];
    list.push(s);
    groups.set(s.room, list);
  }
  return [...groups].map(([room, list]) => ({ room, slots: list }));
}

/**
 * What a slot cell shows: booked capped at the ask ("3/3", never "4/3"),
 * plus how many are booked beyond it (an ask lowered after booking, or
 * chats starting at different times inside one slot). Same cap as
 * slotTotals, so cells and totals agree.
 */
export function slotFill(slot: Pick<ChatSlotFill, "booked" | "needed">): {
  shown: number;
  over: number;
} {
  const shown = Math.min(slot.booked, slot.needed);
  return { shown, over: slot.booked - shown };
}

/** Hackers booked and asked for over some slots (booked capped per slot). */
export function slotTotals(
  slots: readonly Pick<ChatSlotFill, "booked" | "needed">[],
): { booked: number; needed: number; open: number } {
  return slots.reduce<{ booked: number; needed: number; open: number }>(
    (t, s) => ({
      booked: t.booked + slotFill(s).shown,
      needed: t.needed + s.needed,
      open: t.open + (slotTone(s) === "open" ? 1 : 0),
    }),
    { booked: 0, needed: 0, open: 0 },
  );
}

// ---------------------------------------------------------------------------
// Sunday
// ---------------------------------------------------------------------------

export type SundayJudging = {
  /** Shortlist snapshot sent at the end of round 1; null = not sent. */
  shortlistSentAt: Date | string | null;
  shortlistSentCount: number;
  /** Teams scored and shortlisted so far on the portal. */
  scored: number;
  shortlisted: number;
  /** Top 5 submitted in round 2; null = not yet. */
  finalSubmittedAt: Date | string | null;
};

export type Round1State =
  | { kind: "sent"; teams: number; at: Date | string }
  | { kind: "working"; scored: number; shortlisted: number }
  | { kind: "not-started" };

export type Round2State =
  | { kind: "sent"; at: Date | string }
  | { kind: "ranking" }
  | { kind: "not-open" };

/** Round 1: shortlist sent, being worked on, or not touched yet. */
export function round1State(j: SundayJudging): Round1State {
  if (j.shortlistSentAt) {
    return { kind: "sent", teams: j.shortlistSentCount, at: j.shortlistSentAt };
  }
  if (j.scored > 0 || j.shortlisted > 0) {
    return { kind: "working", scored: j.scored, shortlisted: j.shortlisted };
  }
  return { kind: "not-started" };
}

/** Round 2: top 5 sent, open and not sent yet, or not open. */
export function round2State(
  j: SundayJudging,
  round2Open: boolean,
): Round2State {
  if (j.finalSubmittedAt) return { kind: "sent", at: j.finalSubmittedAt };
  return round2Open ? { kind: "ranking" } : { kind: "not-open" };
}

/** A sponsor's presentation slot (minutes after midnight, Sunday). */
export type PresentationSlot = {
  room: string;
  start: number;
  teamName: string;
};

export type SundayWhere =
  /** In their room for presentations; `team` is presenting now, if any. */
  | {
      kind: "presenting";
      room: string;
      team: string | null;
      /** "HH:MM" the last presentation ends. */
      until: string;
    }
  /** A run-of-show block (theirs or everyone's); `now` = on right now. */
  | {
      kind: "item";
      title: string;
      location: string | null;
      start: string;
      end: string;
      now: boolean;
    }
  /** Nothing on now; their presentations are next. */
  | { kind: "presenting-next"; room: string; start: string }
  /** Their Sunday is over. */
  | { kind: "done" }
  /** Nothing on the run of show for them that day. */
  | { kind: "none" };

function hhmm(minutes: number): string {
  const m = Math.min(Math.max(minutes, 0), 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/**
 * The run-of-show blocks that concern one sponsor on a day: blocks naming
 * them, plus blocks naming no sponsor outside the per-sponsor columns
 * (main events, food, Sponsor Bay). Another sponsor's workshop or chats
 * aren't theirs.
 */
export function sponsorItems(
  items: readonly RunOfShowItem[],
  sponsorName: string,
  day: RunOfShowDay,
): RunOfShowItem[] {
  return items.filter(
    (i) =>
      i.day === day &&
      (i.sponsors.includes(sponsorName) ||
        (i.sponsors.length === 0 &&
          i.column !== "sponsor-workshop" &&
          i.column !== "coffee-chats")),
  );
}

// Which block wins when several are on at once: the sponsor's own first,
// then main events, then food, and the all-day Sponsor Bay last.
function rank(item: RunOfShowItem, sponsorName: string): number {
  if (item.sponsors.includes(sponsorName)) return 0;
  if (item.column === "big-event") return 1;
  if (item.column === "food") return 2;
  return 3;
}

/**
 * Where a sponsor should be on Sunday at `now`: in their room while their
 * presentations run (first slot start to last slot end), else the run-of-
 * show block they're in, else their next block. Before Sunday it answers
 * for the start of Sunday (their first block); after their last block,
 * "done". Never guesses a room the data doesn't have.
 */
export function sundayWhere({
  sponsorName,
  items,
  slots,
  now,
  day = "Sunday",
}: {
  sponsorName: string;
  items: readonly RunOfShowItem[];
  slots: readonly PresentationSlot[];
  now: Date;
  day?: RunOfShowDay;
}): SundayWhere {
  const dayStart = runOfShowInstant(day, "00:00");
  const dayEnd = runOfShowInstant(day, "24:00");
  const at = now < dayStart ? dayStart : now;
  if (at >= dayEnd) return { kind: "done" };
  const minute = Math.floor((at.getTime() - dayStart.getTime()) / 60_000);

  const placed = [...slots].sort((a, b) => a.start - b.start);
  const first = placed[0];
  const last = placed[placed.length - 1];
  if (first && last) {
    const end = last.start + PRESENTATION_SLOT_MINUTES;
    if (minute >= first.start && minute < end) {
      const current = placed.find(
        (s) =>
          minute >= s.start && minute < s.start + PRESENTATION_SLOT_MINUTES,
      );
      return {
        kind: "presenting",
        room: current?.room ?? first.room,
        team: current?.teamName ?? null,
        until: hhmm(end),
      };
    }
  }

  const own = sponsorItems(items, sponsorName, day);
  const on = own
    .filter((i) => minute >= minutesOf(i.start) && minute < minutesOf(i.end))
    .sort(
      (a, b) =>
        rank(a, sponsorName) - rank(b, sponsorName) ||
        a.start.localeCompare(b.start),
    );
  // The Sponsor Bay runs all day; only say so when nothing else is on.
  const current = on[0];
  const next = own
    .filter((i) => minutesOf(i.start) > minute && i.column !== "spon-booth")
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const upcomingPresentation =
    first && minute < first.start ? first : undefined;

  const asItem = (i: RunOfShowItem, isNow: boolean): SundayWhere => ({
    kind: "item",
    title: i.title,
    location: i.location ? locationFor(i.location, sponsorName) : null,
    start: i.start,
    end: i.end,
    now: isNow,
  });

  if (current) return asItem(current, true);
  if (
    upcomingPresentation &&
    (!next || minutesOf(next.start) >= upcomingPresentation.start)
  ) {
    return {
      kind: "presenting-next",
      room: upcomingPresentation.room,
      start: hhmm(upcomingPresentation.start),
    };
  }
  if (next) return asItem(next, false);
  return own.length > 0 || placed.length > 0
    ? { kind: "done" }
    : { kind: "none" };
}
