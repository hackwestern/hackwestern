/**
 * Rules for coffee chat requests: a sponsor asks one hacker for a seat in a
 * chat in the sponsor's room, and the hacker accepts or declines. A chat is
 * either a 15-min 1-on-1 or a 30-min group of 3 hackers, per the sponsor's
 * FORMAT in the Coffee Chats sheet tab. Each hacker has their own request
 * row, so a group is up to 3 rows with the same sponsor and start time.
 *
 * Decisions (docs/decisions.md, 2026-11-14):
 * - The DB `coffee_chat` table is the source of truth; the sheet is a mirror.
 * - Saturday only. Chats happen in room blocks (one sponsor, one of rooms
 *   2241-2243, a stretch of time; src/lib/coffee-chat-holds.ts).
 * - Window, format (length + group size) and total hackers come from the
 *   Coffee Chats tab; the sponsor sets how many reps they send.
 * - One rep per chat at a time. Hackers per slot = chat type x reps
 *   (hackersPerSlot); going past the room's 6 people is only a note.
 * - A request nobody answers expires 20 minutes before the chat.
 *
 * Dependency-free: used by the hacker /live page, the sponsor pages and the
 * server.
 */

export const COFFEE_CHAT_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;
export type CoffeeChatStatus = (typeof COFFEE_CHAT_STATUSES)[number];

/** Statuses that hold a seat (and the hacker's time). */
export const ACTIVE_COFFEE_CHAT_STATUSES = ["pending", "accepted"] as const;

/** Top interested, consenting hackers shown to each sponsor. */
export const COFFEE_CHAT_SHORTLIST_SIZE = 40;

/** The fewest hacker profiles a sponsor gets to shortlist from. */
export const SHORTLIST_POOL_MIN = 40;
/** How many more profiles than hackers they asked to meet (Jazz, 2026-11-20). */
export const SHORTLIST_POOL_EXTRA = 20;

/**
 * How many hacker profiles a sponsor shortlists from: the hackers their
 * availability asks for (hackers per chat x every rep's chats) plus
 * SHORTLIST_POOL_EXTRA, and never fewer than SHORTLIST_POOL_MIN.
 * 60 hackers wanted -> 80 profiles; 10 wanted -> 40.
 */
export function shortlistPoolSize(hackersWanted: number): number {
  return Math.max(SHORTLIST_POOL_MIN, hackersWanted + SHORTLIST_POOL_EXTRA);
}

/** An unanswered request expires this long before the chat starts. */
export const COFFEE_CHAT_EXPIRY_MINUTES_BEFORE = 20;

/**
 * Coffee chats run on Saturday of the event, Nov 21 2026, in London, Ontario.
 * Eastern time is UTC-5 in November (daylight saving ended Nov 1).
 */
export const COFFEE_CHAT_DATE = "2026-11-21";
/** Eastern time on chat day (daylight saving ended Nov 1): the one offset. */
export const COFFEE_CHAT_UTC_OFFSET = "-05:00";

/** People a coffee chat room fits at once. */
export const COFFEE_CHAT_ROOM_PEOPLE = 6;

/**
 * Saturday coffee chat rooms organizers give sponsors blocks in (same
 * labels as migration 0040). Docs/decisions.md 2026-11-15.
 */
// Rm 1348-1358 added (Jazz, 2026-11-18): also Sat 10 AM-5 PM.
export const COFFEE_CHAT_ROOMS = [
  "Rm 2241",
  "Rm 2242",
  "Rm 2243",
  "Rm 1348",
  "Rm 1352",
  "Rm 1354",
  "Rm 1356",
  "Rm 1358",
] as const;
export type CoffeeChatRoom = (typeof COFFEE_CHAT_ROOMS)[number];

/** "rm 2241", " Rm  2241 " -> "Rm 2241"; null when not a coffee chat room. */
export function coffeeChatRoomOf(
  room: string | null | undefined,
): CoffeeChatRoom | null {
  const key = String(room ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return COFFEE_CHAT_ROOMS.find((r) => r.toLowerCase() === key) ?? null;
}

export const COFFEE_CHAT_GRID_MINUTES = 15;
export const COFFEE_CHAT_DURATIONS = [15, 30] as const;
export type CoffeeChatDuration = (typeof COFFEE_CHAT_DURATIONS)[number];

/** "HH:MM" -> minutes after midnight, or null if not on the 15-min grid. */
export function coffeeChatMinutesOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes % COFFEE_CHAT_GRID_MINUTES === 0 ? minutes : null;
}

/** Minutes after midnight -> "HH:MM". */
export function coffeeChatTimeOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Sheet time like "9:00 AM" or "1:00 PM" -> "09:00" / "13:00". Null when the
 * cell is empty or not a time on the 15-minute grid.
 */
export function parseSheetTime(cell: string | undefined | null): string | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(String(cell ?? ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const hour24 = (hour % 12) + (match[3]!.toUpperCase() === "PM" ? 12 : 0);
  const time = coffeeChatTimeOf(hour24 * 60 + minute);
  return coffeeChatMinutesOf(time) === null ? null : time;
}

/**
 * Chat length from the sheet's FORMAT cell, e.g. "Individual (15 mins)" ->
 * 15, "Groups (30 mins with 3 people)" -> 30. Defaults to 15 when missing.
 */
export function parseCoffeeChatDuration(
  format: string | undefined | null,
): CoffeeChatDuration {
  const match = /(\d+)\s*min/i.exec(String(format ?? ""));
  return match && Number(match[1]) === 30 ? 30 : 15;
}

/**
 * Hackers per chat from FORMAT: "Groups (30 mins with 3 people)" -> 3,
 * "Individual (15 mins)" or missing -> 1.
 */
export function parseCoffeeChatGroupSize(
  format: string | undefined | null,
): number {
  const match = /with\s+(\d+)\s+(people|hackers)/i.exec(String(format ?? ""));
  const size = match ? Number(match[1]) : 1;
  return Number.isInteger(size) && size >= 1 ? size : 1;
}

/** When a "HH:MM" Saturday chat starts, as an absolute time. */
export function coffeeChatStartsAt(slotTime: string): Date {
  if (coffeeChatMinutesOf(slotTime) === null) {
    throw new Error(`Not a coffee chat time: ${slotTime}`);
  }
  return new Date(
    `${COFFEE_CHAT_DATE}T${slotTime}:00${COFFEE_CHAT_UTC_OFFSET}`,
  );
}

/** The moment a pending request for this slot stops being answerable. */
export function coffeeChatExpiresAt(slotTime: string): Date {
  return new Date(
    coffeeChatStartsAt(slotTime).getTime() -
      COFFEE_CHAT_EXPIRY_MINUTES_BEFORE * 60_000,
  );
}

/** True when two chats overlap in time (used to stop double booking). */
export function coffeeChatsOverlap(
  a: { slotTime: string; durationMinutes: number },
  b: { slotTime: string; durationMinutes: number },
): boolean {
  const aStart = coffeeChatMinutesOf(a.slotTime);
  const bStart = coffeeChatMinutesOf(b.slotTime);
  if (aStart === null || bStart === null) return false;
  return (
    aStart < bStart + b.durationMinutes && bStart < aStart + a.durationMinutes
  );
}

/**
 * The status to show and enforce right now. A stored "pending" past its
 * expiry reads as "expired", so expiry needs no background job; a sweep can
 * write it back later (e.g. for the sheet mirror).
 */
export function effectiveCoffeeChatStatus(
  chat: CoffeeChatClock,
  now: Date = new Date(),
): CoffeeChatStatus {
  if (chat.status !== "pending") return chat.status;
  return now >= chatExpiresAt(chat) ? "expired" : "pending";
}

/**
 * A chat's status and times. Session invites (src/lib/coffee-chat-invites.ts)
 * carry their own `expiresAt` (the invite round's answer-by time); old
 * per-slot requests leave it null and expire 20 minutes before the chat.
 */
export type CoffeeChatClock = {
  status: CoffeeChatStatus;
  slotTime: string;
  expiresAt?: Date | null;
};

/** When a pending chat stops being answerable. */
export function chatExpiresAt(
  chat: Pick<CoffeeChatClock, "slotTime" | "expiresAt">,
): Date {
  return chat.expiresAt ?? coffeeChatExpiresAt(chat.slotTime);
}

/** True when the chat still holds a seat right now. */
export function isActiveCoffeeChat(
  chat: CoffeeChatClock,
  now: Date = new Date(),
): boolean {
  const status = effectiveCoffeeChatStatus(chat, now);
  return status === "pending" || status === "accepted";
}
