/**
 * Room blocks (stored as coffee_chat_hold rows; the code keeps the name
 * "hold"): one sponsor in one coffee chat room for a stretch of Saturday
 * time. Hackers are booked into a block, one slot at a time.
 *
 * Rules (docs/flows/coffee-chat-room-blocks.md, docs/decisions.md
 * 2026-11-18 room blocks):
 * - Two sponsors never overlap in one room. A sponsor's own blocks may
 *   touch but not overlap (one room per sponsor at any moment).
 * - A block lasts 15 minutes to 1 hr 30, on the 15-minute grid.
 * - A chat always goes in the sponsor's block covering its start, in the
 *   block's room. No block then = no offer.
 * - A block's slots start one chat length apart. Each slot takes the
 *   hackers the sponsor asked for (coffee-chat-request.ts). No room
 *   capacity: reps organize themselves in the room.
 *
 * Dependency-free (shared by server, organizer and sponsor pages).
 */
import {
  COFFEE_CHAT_GRID_MINUTES,
  chatExpiresAt,
  coffeeChatMinutesOf,
  coffeeChatRoomOf,
  coffeeChatsOverlap,
  coffeeChatTimeOf,
} from "~/lib/coffee-chat-requests";
import {
  askedAt,
  type ChatRequest,
  type SlotLimit,
} from "~/lib/coffee-chat-request";

/** A new block's length unless the organizer picks another. */
export const DEFAULT_HOLD_MINUTES = 60;
/** Lengths offered when giving a room (15 min to 1 hr 30). */
export const HOLD_LENGTHS = [15, 30, 45, 60, 75, 90] as const;
/** Longest single block; a longer stretch is back-to-back blocks. */
export const MAX_HOLD_MINUTES = 90;

export type HoldSpan = {
  sponsorId: string;
  room: string;
  /** "HH:MM", on the 15-minute grid. */
  startTime: string;
  /** "HH:MM", exclusive. */
  endTime: string;
};

/** Something that takes a room for a while: a chat or a block. */
export type RoomUse = {
  sponsorId: string;
  room: string | null;
  slotTime: string;
  durationMinutes: number;
};

type ChatTime = { slotTime: string; durationMinutes: number };

/** Block length in minutes (0 when the times are off the grid). */
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
 * Why these block times can't be used, or null: both on the 15-minute
 * grid, end after start, at most MAX_HOLD_MINUTES.
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

/** A block as a room use (start + length), for overlap checks. */
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
 * The first room use by ANOTHER sponsor in the block's room at an
 * overlapping time, or null. Own blocks are checked by ownHoldOverlap.
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

/**
 * The first of the sponsor's other blocks the span overlaps, or null. A
 * sponsor is in one room at a time, so own blocks may touch, not overlap.
 */
export function ownHoldOverlap<H extends HoldSpan & { holdId: string }>(
  span: HoldSpan,
  holds: readonly H[],
  exceptHoldId?: string,
): H | null {
  const use = holdAsRoomUse(span);
  return (
    holds.find(
      (h) =>
        h.holdId !== exceptHoldId &&
        h.sponsorId === span.sponsorId &&
        coffeeChatsOverlap(holdAsRoomUse(h), use),
    ) ?? null
  );
}

/** True when a chat starting at `slot` starts inside the block. */
export function holdCovers(
  hold: Pick<HoldSpan, "startTime" | "endTime">,
  slot: Pick<ChatTime, "slotTime">,
): boolean {
  const start = coffeeChatMinutesOf(hold.startTime);
  const end = coffeeChatMinutesOf(hold.endTime);
  const t = coffeeChatMinutesOf(slot.slotTime);
  return start !== null && end !== null && t !== null && t >= start && t < end;
}

/** The sponsor's own block a chat at `slot` falls in (earliest), or null. */
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
 * The room a new chat at `slot` goes in: the room of the sponsor's own
 * block covering it, else null (no block = no offer).
 */
export function coffeeChatOfferRoom(
  holds: readonly HoldSpan[],
  sponsorId: string,
  slot: Pick<ChatTime, "slotTime">,
): string | null {
  return ownHoldAt(holds, sponsorId, slot)?.room ?? null;
}

/**
 * Slot starts in a block for chats lasting `duration` minutes: from the
 * block's start, one chat length apart, each ending by the block's end.
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

/** True when a block this long fits at least one chat of `duration`. */
export function holdFitsChat(minutes: number, duration: number): boolean {
  return minutes >= duration;
}

/** A live chat (pending or accepted, filtered by the caller). */
type LiveChat = ChatTime & { sponsorId: string; chatId?: string };

/**
 * The chats booked in one slot: those starting in [slot start, start +
 * chat length). The one seat count for offers (server) and block slots
 * (pages), so both always agree. Chats start on slot starts, so this only
 * differs from an overlap count if the sheet's FORMAT length changes after
 * booking opens, which it must not (docs/decisions.md 2026-11-18).
 */
export function chatsInSlot<C extends ChatTime>(
  chats: readonly C[],
  slotTime: string,
  durationMinutes: number,
): C[] {
  const start = coffeeChatMinutesOf(slotTime);
  if (start === null) return [];
  return chats.filter((c) => {
    const t = coffeeChatMinutesOf(c.slotTime);
    return t !== null && t >= start && t < start + durationMinutes;
  });
}

/** One slot of a block: hackers booked against hackers asked for. */
export type BlockSlot = {
  slotTime: string;
  booked: number;
  /** Hackers asked for here: the request, lowered by any ask. */
  needed: number;
  /** The request before any "Ask for fewer". */
  requested: number;
  /** An ask lowered this slot (shown as "asked for N"). */
  lowered: boolean;
  chatIds: string[];
};

/**
 * The block's slots, earliest first. Each live chat of the block's
 * sponsor counts in the slot its start falls in. Hackers asked for per
 * slot come from the sponsor's request and their asks for fewer.
 */
export function blockSlots(
  block: HoldSpan,
  request: Pick<ChatRequest, "perSlot" | "durationMinutes">,
  liveChats: readonly LiveChat[],
  limits: readonly SlotLimit[] = [],
): BlockSlot[] {
  const duration = request.durationMinutes;
  const own = liveChats.filter((c) => c.sponsorId === block.sponsorId);
  return holdStartTimes(block, duration).map((slotTime) => {
    const inside = chatsInSlot(own, slotTime, duration);
    const { asked, lowered } = askedAt(
      request,
      limits,
      block.sponsorId,
      slotTime,
    );
    return {
      slotTime,
      booked: inside.length,
      needed: asked,
      requested: request.perSlot,
      lowered,
      chatIds: inside.flatMap((c) => (c.chatId ? [c.chatId] : [])),
    };
  });
}

/**
 * "n of m chats filled" for a block. 1-on-1: every hacker asked for is a
 * chat. Group: every slot asking for hackers is one chat, filled once all
 * its hackers are booked. `firstOpen` is the earliest slot still short of
 * hackers (and, with `now`, still before its reply cutoff), or null.
 */
export function blockFill(
  block: HoldSpan,
  request: Pick<ChatRequest, "style" | "perSlot" | "durationMinutes">,
  liveChats: readonly LiveChat[],
  limits: readonly SlotLimit[] = [],
  now?: Date,
): { filled: number; total: number; firstOpen: string | null } {
  const slots = blockSlots(block, request, liveChats, limits);
  const group = request.style === "group";
  return {
    filled: slots.reduce(
      (n, s) =>
        n +
        (group
          ? Number(s.needed > 0 && s.booked >= s.needed)
          : Math.min(s.booked, s.needed)),
      0,
    ),
    total: slots.reduce(
      (n, s) => n + (group ? Number(s.needed > 0) : s.needed),
      0,
    ),
    firstOpen:
      slots.find((s) => s.booked < s.needed && (!now || now < chatExpiresAt(s)))
        ?.slotTime ?? null,
  };
}

/** Live chats inside the block (same sponsor, starting inside it). */
export function chatsInHold<C extends LiveChat>(
  hold: HoldSpan,
  liveChats: readonly C[],
): C[] {
  return liveChats.filter(
    (c) => c.sponsorId === hold.sponsorId && holdCovers(hold, c),
  );
}

/** One of a sponsor's own blocks, as their pages show it (no note). */
export type SponsorHoldView = {
  holdId: string;
  room: string;
  startTime: string;
  endTime: string;
  /** Chats filled out of the block's chats ("1 of 4 chats filled"). */
  filled: number;
  total: number;
  /** Earliest slot still short of hackers, for Scan a badge. */
  firstOpen: string | null;
  needsHacker: boolean;
  /** Each slot, for "Ask for fewer". */
  slots: BlockSlot[];
};

/**
 * A sponsor's view of room blocks: only blocks of `sponsorId` (never
 * another sponsor's room or time), earliest first, with how full each is.
 * `liveChats` are chats that hold a seat right now.
 */
export function holdsForSponsor(
  holds: readonly (HoldSpan & { holdId: string })[],
  sponsorId: string,
  liveChats: readonly LiveChat[],
  request: Pick<ChatRequest, "style" | "perSlot" | "durationMinutes">,
  limits: readonly SlotLimit[] = [],
  now?: Date,
): SponsorHoldView[] {
  return holds
    .filter((h) => h.sponsorId === sponsorId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((h) => {
      const fill = blockFill(h, request, liveChats, limits, now);
      return {
        holdId: h.holdId,
        room: h.room,
        startTime: h.startTime,
        endTime: h.endTime,
        ...fill,
        needsHacker: fill.firstOpen !== null,
        slots: blockSlots(h, request, liveChats, limits),
      };
    });
}
