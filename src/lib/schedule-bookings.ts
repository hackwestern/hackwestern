/**
 * Booked coffee chats (the coffee_chat table) as day grid blocks: one block
 * per sponsor, room and start, in the Coffee chats column. Pure, so it's
 * tested.
 */
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  coffeeChatRoomOf,
} from "~/lib/coffee-chat-requests";
import type { RunOfShowDay } from "~/lib/run-of-show";
import {
  minutesIntoDay,
  type CoffeeChatBooking,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";

/** One chat as the grid needs it, from either view's query. */
export type ScheduleChat = {
  chatId: string;
  sponsorName: string;
  /** What this viewer may see of the hacker's name. */
  hacker: string;
  room: string | null;
  slotTime: string;
  durationMinutes: number;
  /** Effective status (expiry already applied by the server). */
  status: string;
  /** ISO start. */
  startsAt: string;
};

const ACTIVE = new Set<string>(ACTIVE_COFFEE_CHAT_STATUSES);

/** "rm 2241" -> "Rm 2241"; other rooms trimmed; blank -> null. */
export function bookingRoom(room: string | null): string | null {
  const trimmed = room?.trim();
  if (!trimmed) return null;
  return coffeeChatRoomOf(trimmed) ?? trimmed;
}

/**
 * Live (pending or accepted) chats on `day` as grid entries, grouped by
 * sponsor + room + start so a group chat is one block. Declined, expired
 * and cancelled chats drop off, so a refetch removes them.
 */
export function coffeeChatEntries(
  day: RunOfShowDay,
  chats: readonly ScheduleChat[],
): TimelineEntry[] {
  const groups = new Map<
    string,
    { booking: CoffeeChatBooking; start: number; end: number }
  >();
  for (const chat of chats) {
    if (!ACTIVE.has(chat.status)) continue;
    const start = Math.round(minutesIntoDay(day, new Date(chat.startsAt)));
    if (!(start >= 0 && start < 1440)) continue;
    const room = bookingRoom(chat.room);
    const key = `${chat.sponsorName}|${room ?? ""}|${start}`;
    const group = groups.get(key) ?? {
      booking: {
        sponsorName: chat.sponsorName,
        room,
        slotTime: chat.slotTime,
        chats: [],
      },
      start,
      end: start + chat.durationMinutes,
    };
    group.end = Math.max(group.end, start + chat.durationMinutes);
    group.booking.chats.push({
      chatId: chat.chatId,
      hacker: chat.hacker,
      status: chat.status,
    });
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, { booking, start, end }]) => ({
      id: `chat-${day}-${key}`,
      kind: "yours" as const,
      category: "coffee-chat" as const,
      title: booking.sponsorName,
      location: booking.room,
      start,
      end,
      booking,
    }))
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** Counts for a booking block: hackers, accepted, still waiting. */
export function bookingCounts(booking: CoffeeChatBooking): {
  hackers: number;
  accepted: number;
  waiting: number;
} {
  const accepted = booking.chats.filter((c) => c.status === "accepted").length;
  const waiting = booking.chats.filter((c) => c.status === "pending").length;
  return { hackers: booking.chats.length, accepted, waiting };
}

/**
 * Only `sponsorName`'s chats. The sponsor query is already scoped on the
 * server; this keeps the grid safe if it's ever fed a wider list.
 */
export function chatsForSponsor<T extends { sponsorName: string }>(
  chats: readonly T[],
  sponsorName: string,
): T[] {
  return chats.filter((c) => c.sponsorName === sponsorName);
}
