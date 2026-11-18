/**
 * Room holds: an organizer sets a coffee chat room aside for one sponsor at
 * one Saturday time before any hacker is booked. Until a live chat (pending
 * or accepted) lands inside it, the hold "needs a hacker": organizers see a
 * warning cell, the sponsor sees "You still need a hacker".
 *
 * Rules (docs/decisions.md, 2026-11-17, room holds):
 * - A room can be held by different sponsors at different times. A hold may
 *   not overlap another sponsor's hold, live chat or room window in the same
 *   room. The same sponsor may hold adjacent or overlapping times.
 * - A chat offered at a start inside the sponsor's hold takes the hold's
 *   room. Room precedence for a new chat:
 *     hold room > room the sponsor's live chats already use at that time
 *     (organizer Move room) > organizer per-sponsor room > sheet ROOM > none.
 * - A hold adds its start times to the sponsor's offerable times, one chat
 *   length apart, so a sponsor with only a hold (no sheet window) can still
 *   be offered chats there.
 *
 * Dependency-free (shared by server, organizer and sponsor pages).
 */
import {
  COFFEE_CHAT_GRID_MINUTES,
  coffeeChatMinutesOf,
  coffeeChatRoomOf,
  coffeeChatsOverlap,
  coffeeChatTimeOf,
  resolveCoffeeChatRoom,
} from "~/lib/coffee-chat-requests";

/** A new hold's length unless the organizer picks another. */
export const DEFAULT_HOLD_MINUTES = 30;
/** Lengths offered when holding a room. */
export const HOLD_LENGTHS = [15, 30, 45, 60, 90, 120] as const;
/** Longest single hold (a whole morning is several holds, or a room). */
export const MAX_HOLD_MINUTES = 240;

export type HoldSpan = {
  sponsorId: string;
  room: string;
  /** "HH:MM", on the 15-minute grid. */
  startTime: string;
  /** "HH:MM", exclusive. */
  endTime: string;
};

/** Something that takes a room for a while: a chat, a hold or a window. */
export type RoomUse = {
  sponsorId: string;
  room: string | null;
  slotTime: string;
  durationMinutes: number;
};

type ChatTime = { slotTime: string; durationMinutes: number };

/** Hold length in minutes (0 when the times are off the grid). */
export function holdMinutes(hold: Pick<HoldSpan, "startTime" | "endTime">) {
  const start = coffeeChatMinutesOf(hold.startTime);
  const end = coffeeChatMinutesOf(hold.endTime);
  return start === null || end === null ? 0 : Math.max(0, end - start);
}

/** "HH:MM" plus minutes, or null past midnight. */
export function holdEndOf(startTime: string, minutes: number): string | null {
  const start = coffeeChatMinutesOf(startTime);
  if (start === null || start + minutes > 24 * 60) return null;
  return coffeeChatTimeOf(start + minutes);
}

/**
 * Why these hold times can't be used, or null: both on the 15-minute grid,
 * end after start, at most MAX_HOLD_MINUTES.
 */
export function holdTimesProblem(
  startTime: string,
  endTime: string,
): "offGrid" | "empty" | "tooLong" | null {
  const start = coffeeChatMinutesOf(startTime);
  const end = coffeeChatMinutesOf(endTime);
  if (start === null || end === null) return "offGrid";
  if (end <= start) return "empty";
  if (end - start > MAX_HOLD_MINUTES) return "tooLong";
  return null;
}

/** A hold as a room use (start + length), for overlap checks. */
export function holdAsRoomUse(hold: HoldSpan): RoomUse {
  return {
    sponsorId: hold.sponsorId,
    room: hold.room,
    slotTime: hold.startTime,
    durationMinutes: holdMinutes(hold),
  };
}

function sameRoom(a: string | null | undefined, b: string | null | undefined) {
  const norm = (r: string | null | undefined) =>
    coffeeChatRoomOf(r) ??
    String(r ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  return Boolean(norm(a)) && norm(a) === norm(b);
}

/**
 * The first room use by ANOTHER sponsor in the hold's room at an
 * overlapping time, or null. The hold's own sponsor never clashes with
 * itself (adjacent and overlapping own holds are fine).
 */
export function holdClash<U extends RoomUse>(
  hold: HoldSpan,
  uses: readonly U[],
): U | null {
  const span = holdAsRoomUse(hold);
  return (
    uses.find(
      (u) =>
        u.sponsorId !== hold.sponsorId &&
        sameRoom(u.room, hold.room) &&
        coffeeChatsOverlap(u, span),
    ) ?? null
  );
}

/** True when a chat starting at `slot` starts inside the hold. */
export function holdCovers(
  hold: Pick<HoldSpan, "startTime" | "endTime">,
  slot: Pick<ChatTime, "slotTime">,
): boolean {
  const start = coffeeChatMinutesOf(hold.startTime);
  const end = coffeeChatMinutesOf(hold.endTime);
  const t = coffeeChatMinutesOf(slot.slotTime);
  return start !== null && end !== null && t !== null && t >= start && t < end;
}

/** The sponsor's own hold a chat at `slot` falls in (earliest), or null. */
export function ownHoldAt<H extends HoldSpan>(
  holds: readonly H[],
  sponsorId: string,
  slot: Pick<ChatTime, "slotTime">,
): H | null {
  return (
    [...holds]
      .filter((h) => h.sponsorId === sponsorId && holdCovers(h, slot))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
  );
}

/**
 * The room a new chat goes in: hold room > room the sponsor's chats already
 * use then (organizer Move room) > organizer per-sponsor room > sheet ROOM
 * > none.
 */
export function coffeeChatOfferRoom(input: {
  holdRoom?: string | null;
  movedRoom?: string | null;
  assignedRoom?: string | null;
  sheetRoom?: string | null;
}): string | null {
  if (input.holdRoom?.trim()) return input.holdRoom;
  if (input.movedRoom?.trim()) return input.movedRoom;
  return resolveCoffeeChatRoom(input.assignedRoom, input.sheetRoom);
}

/**
 * Start times a hold adds for a sponsor whose chats last `duration`
 * minutes: from the hold's start, one chat length apart, each ending by the
 * hold's end.
 */
export function holdStartTimes(
  hold: Pick<HoldSpan, "startTime" | "endTime">,
  duration: number,
): string[] {
  const start = coffeeChatMinutesOf(hold.startTime);
  const end = coffeeChatMinutesOf(hold.endTime);
  if (start === null || end === null || duration < COFFEE_CHAT_GRID_MINUTES) {
    return [];
  }
  const times: string[] = [];
  for (let t = start; t + duration <= end; t += duration) {
    times.push(coffeeChatTimeOf(t));
  }
  return times;
}

/**
 * True while no live chat (pending or accepted, already filtered by the
 * caller) of the hold's sponsor overlaps it.
 */
export function holdNeedsHacker(
  hold: HoldSpan,
  liveChats: readonly (ChatTime & { sponsorId: string })[],
): boolean {
  const span = holdAsRoomUse(hold);
  return !liveChats.some(
    (c) => c.sponsorId === hold.sponsorId && coffeeChatsOverlap(c, span),
  );
}

/** Live chats inside the hold (same sponsor, overlapping). */
export function chatsInHold<C extends ChatTime & { sponsorId: string }>(
  hold: HoldSpan,
  liveChats: readonly C[],
): C[] {
  const span = holdAsRoomUse(hold);
  return liveChats.filter(
    (c) => c.sponsorId === hold.sponsorId && coffeeChatsOverlap(c, span),
  );
}

/** One of a sponsor's own holds, as their pages show it (no organizer note). */
export type SponsorHoldView = {
  holdId: string;
  room: string;
  startTime: string;
  endTime: string;
  /** Live chats (pending or accepted) inside the hold. */
  chats: number;
  needsHacker: boolean;
};

/**
 * A sponsor's view of room holds: only holds of `sponsorId` (never another
 * sponsor's room or time), earliest first, each with whether it still
 * needs a hacker. `liveChats` are chats that hold a seat right now.
 */
export function holdsForSponsor(
  holds: readonly (HoldSpan & { holdId: string })[],
  sponsorId: string,
  liveChats: readonly (ChatTime & { sponsorId: string })[],
): SponsorHoldView[] {
  return holds
    .filter((h) => h.sponsorId === sponsorId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((h) => {
      const chats = chatsInHold(h, liveChats).length;
      return {
        holdId: h.holdId,
        room: h.room,
        startTime: h.startTime,
        endTime: h.endTime,
        chats,
        needsHacker: chats === 0,
      };
    });
}
