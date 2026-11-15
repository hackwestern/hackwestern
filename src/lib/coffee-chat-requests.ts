/**
 * Rules for coffee chat requests: a sponsor asks one hacker for one 15-minute
 * slot in one room, and the hacker accepts or declines.
 *
 * Decisions (docs/decisions.md, 2026-11-14):
 * - The DB `coffee_chat` table is the source of truth; the sheet is a mirror.
 * - Parallel chats per sponsor per slot = their reps, capped by the room's
 *   capacity from the run-of-show sheet. Rooms aren't shared between sponsors
 *   in a slot.
 * - A request nobody answers expires 20 minutes before the chat.
 *
 * Dependency-free: used by the hacker /live page, the sponsor pages and the
 * server.
 */

import { COFFEE_CHAT_SLOTS } from "~/lib/coffee-chats";

export const COFFEE_CHAT_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
] as const;
export type CoffeeChatStatus = (typeof COFFEE_CHAT_STATUSES)[number];

/** Statuses that hold a seat (and the hacker's time). */
export const ACTIVE_COFFEE_CHAT_STATUSES = ["pending", "accepted"] as const;

/** Top interested, consenting hackers shown to each sponsor. */
export const COFFEE_CHAT_SHORTLIST_SIZE = 40;

/** Reps a sponsor can say they're sending to coffee chats. */
export const MIN_COFFEE_CHAT_REPS = 1;
export const MAX_COFFEE_CHAT_REPS = 10;

/** An unanswered request expires this long before the chat starts. */
export const COFFEE_CHAT_EXPIRY_MINUTES_BEFORE = 20;

/**
 * Coffee chats run on Saturday of the event, Nov 21 2026, in London, Ontario.
 * Eastern time is UTC-5 in November (daylight saving ended Nov 1).
 */
export const COFFEE_CHAT_DATE = "2026-11-21";
const COFFEE_CHAT_UTC_OFFSET = "-05:00";

/** When a "HH:MM" slot starts, as an absolute time. Throws on a bad slot. */
export function coffeeChatStartsAt(slotTime: string): Date {
  if (!COFFEE_CHAT_SLOTS.includes(slotTime)) {
    throw new Error(`Not a coffee chat slot: ${slotTime}`);
  }
  return new Date(`${COFFEE_CHAT_DATE}T${slotTime}:00${COFFEE_CHAT_UTC_OFFSET}`);
}

/** The moment a pending request for this slot stops being answerable. */
export function coffeeChatExpiresAt(slotTime: string): Date {
  return new Date(
    coffeeChatStartsAt(slotTime).getTime() -
      COFFEE_CHAT_EXPIRY_MINUTES_BEFORE * 60_000,
  );
}

/**
 * The status to show and enforce right now. A stored "pending" past its
 * expiry reads as "expired", so expiry needs no background job; a sweep can
 * write it back later (e.g. for the sheet mirror).
 */
export function effectiveCoffeeChatStatus(
  chat: { status: CoffeeChatStatus; slotTime: string },
  now: Date = new Date(),
): CoffeeChatStatus {
  if (chat.status !== "pending") return chat.status;
  return now >= coffeeChatExpiresAt(chat.slotTime) ? "expired" : "pending";
}

/** True when the chat still holds a seat right now. */
export function isActiveCoffeeChat(
  chat: { status: CoffeeChatStatus; slotTime: string },
  now: Date = new Date(),
): boolean {
  const status = effectiveCoffeeChatStatus(chat, now);
  return status === "pending" || status === "accepted";
}

/**
 * How many chats a sponsor can run at once in one slot: their reps, capped
 * by the room's capacity. A room with unknown capacity (sheet not read yet)
 * is treated as fitting all reps; 0 or negative means no chats.
 */
export function coffeeChatSeats(
  reps: number,
  roomCapacity: number | null | undefined,
): number {
  const safeReps = Math.max(0, Math.floor(reps));
  if (roomCapacity === null || roomCapacity === undefined) return safeReps;
  return Math.max(0, Math.min(safeReps, Math.floor(roomCapacity)));
}
