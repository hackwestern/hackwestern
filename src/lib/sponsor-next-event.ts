/**
 * "Your next event" for the sponsor schedule: the sponsor's next own item
 * from now, including their ceremony speaking slots and coffee chat window.
 * Pure, so it's unit tested.
 */
import {
  locationFor,
  type CeremonyKind,
  type CoffeeChatSetup,
  type RunOfShowDay,
  type RunOfShowItem,
  type SponsorCeremonySegment,
} from "~/lib/run-of-show";
import type { SponsorHoldView } from "~/lib/coffee-chat-holds";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { isOwnItem } from "~/lib/sponsor-timeline";

export type NextEvent = {
  /** "item": a run-of-show block; the others get their title from copy. */
  kind: "item" | "ceremony" | "coffee" | "hold";
  title: string;
  ceremony?: CeremonyKind;
  day: RunOfShowDay;
  start: string;
  location: string | null;
  /** True when it has started and not ended. */
  now: boolean;
  /** Whole minutes until it starts (0 when it's on now). */
  minutesUntil: number;
  /** A room hold with no hacker booked yet (kind "hold"). */
  needsHacker?: boolean;
};

const CEREMONY_TITLE: Record<CeremonyKind, RegExp> = {
  opening: /opening\s+ceremony/i,
  closing: /closing\s+ceremony/i,
};

/** The ceremony's own block in RUN OF SHOW (big event column). */
export function ceremonyItem(
  items: RunOfShowItem[],
  ceremony: CeremonyKind,
): RunOfShowItem | undefined {
  return items.find(
    (i) => i.column === "big-event" && CEREMONY_TITLE[ceremony].test(i.title),
  );
}

// When the sheet has no ceremony block to date it: opening is Friday,
// closing is Sunday.
const CEREMONY_DEFAULT_DAY: Record<CeremonyKind, RunOfShowDay> = {
  opening: "Friday",
  closing: "Sunday",
};

/** The day a ceremony happens, from its run-of-show block. */
export function ceremonyDay(
  items: RunOfShowItem[],
  ceremony: CeremonyKind,
): RunOfShowDay {
  return ceremonyItem(items, ceremony)?.day ?? CEREMONY_DEFAULT_DAY[ceremony];
}

/**
 * Info under the organizer run of show follows the picked day (Jazz,
 * 2026-11-18): only that day's ceremony segments and workshops.
 */
export function ceremonySegmentsForDay<T extends { ceremony: CeremonyKind }>(
  segments: T[],
  items: RunOfShowItem[],
  day: RunOfShowDay,
): T[] {
  return segments.filter((s) => ceremonyDay(items, s.ceremony) === day);
}

export function workshopsForDay<T extends { day: RunOfShowDay | null }>(
  workshops: T[],
  day: RunOfShowDay,
): T[] {
  return workshops.filter((w) => w.day === day);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = Math.min(h * 60 + m + minutes, 24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type Candidate = Omit<NextEvent, "now" | "minutesUntil"> & {
  end: string;
  /** Sponsor Bay hours: long, so only shown when nothing else is coming. */
  background?: boolean;
};

export function nextOwnEvent({
  sponsorName,
  items,
  ceremonies,
  coffeeChat,
  holds = [],
  now,
}: {
  sponsorName: string;
  items: RunOfShowItem[];
  ceremonies: SponsorCeremonySegment[];
  coffeeChat: CoffeeChatSetup | null;
  /** The sponsor's own room holds (Saturday). */
  holds?: readonly SponsorHoldView[];
  now: Date;
}): NextEvent | null {
  const candidates: Candidate[] = items
    .filter((i) => isOwnItem(i, sponsorName))
    .map((i) => ({
      kind: "item",
      title: i.title,
      day: i.day,
      start: i.start,
      end: i.end,
      location: i.location ? locationFor(i.location, sponsorName) : null,
      background: i.column === "spon-booth",
    }));

  for (const segment of ceremonies) {
    if (!segment.yours) continue;
    const block = ceremonyItem(items, segment.ceremony);
    if (!block) continue;
    const start = segment.start ?? block.start;
    candidates.push({
      kind: "ceremony",
      title: segment.title,
      ceremony: segment.ceremony,
      day: block.day,
      start,
      end:
        segment.start && segment.durationMinutes
          ? addMinutes(start, segment.durationMinutes)
          : block.end,
      location: block.location,
    });
  }

  // The Coffee Chats tab window, unless RUN OF SHOW already has a block.
  const hasCoffeeBlock = items.some(
    (i) => i.column === "coffee-chats" && i.sponsors.includes(sponsorName),
  );
  if (coffeeChat?.windowStart && coffeeChat.windowEnd && !hasCoffeeBlock) {
    candidates.push({
      kind: "coffee",
      title: "",
      day: "Saturday",
      start: coffeeChat.windowStart,
      end: coffeeChat.windowEnd,
      location: coffeeChat.room,
    });
  }

  // Rooms organizers held for this sponsor, flagged while no hacker is in.
  for (const hold of holds) {
    candidates.push({
      kind: "hold",
      title: "",
      day: "Saturday",
      start: hold.startTime,
      end: hold.endTime,
      location: hold.room,
      needsHacker: hold.needsHacker,
    });
  }

  const upcoming = candidates
    .map((c) => ({
      c,
      start: runOfShowInstant(c.day, c.start).getTime(),
      end: runOfShowInstant(c.day, c.end).getTime(),
    }))
    .filter((x) => x.end > now.getTime())
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const t = now.getTime();
  const next =
    upcoming.find((x) => !(x.c.background && x.start <= t)) ?? upcoming[0];
  if (!next) return null;
  const { kind, title, ceremony, day, start, location, needsHacker } = next.c;
  return {
    kind,
    title,
    ...(ceremony ? { ceremony } : {}),
    ...(kind === "hold" ? { needsHacker: Boolean(needsHacker) } : {}),
    day,
    start,
    location,
    now: next.start <= now.getTime(),
    minutesUntil: Math.max(0, Math.ceil((next.start - now.getTime()) / 60_000)),
  };
}
