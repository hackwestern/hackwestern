import {
  COFFEE_CHAT_GRID_MINUTES,
  coffeeChatMinutesOf,
  coffeeChatStartsAt,
  coffeeChatTimeOf,
} from "~/lib/coffee-chat-requests";
import { mapRoomFor, type SponsorMapRoom } from "~/lib/sponsor-map-rooms";
import type { ChatBoard } from "~/server/api/utils/coffee-chat-board";

/**
 * The organizer Coffee chats tab's side panel (T52): which sponsor is in
 * each coffee chat room at a time, and how many chats they have then.
 * Pure: built from the organizerChatBoard data the table already loads.
 */

export type CoffeeRoomAt = {
  /** Room name as assigned ("Rm 2241"). */
  name: string;
  /** Map pin, or null when the map has no pin for it. */
  pin: SponsorMapRoom | null;
  /** Sponsor using the room then, or null when it's free. */
  sponsor: string | null;
  accepted: number;
  pending: number;
};

function covers(start: number | null, minutes: number, t: number): boolean {
  return start !== null && t >= start && t < start + minutes;
}

/**
 * Each coffee chat room at `time` ("HH:MM", Saturday). A room is a
 * sponsor's while their window covers the time and the room is theirs
 * (assigned, else the sheet's), or while one of their live chats there
 * does. Counts are accepted and pending chats running at that time.
 */
export function coffeeRoomsAt(
  board: Pick<ChatBoard, "sponsors" | "chats">,
  rooms: readonly string[],
  time: string,
): CoffeeRoomAt[] {
  const t = coffeeChatMinutesOf(time);
  const byId = new Map(
    board.sponsors.flatMap((s) => (s.sponsorId ? [[s.sponsorId, s]] : [])),
  );
  return rooms.map((name) => {
    const key = name.toLowerCase();
    const same = (room: string | null) => room?.toLowerCase() === key;
    const live =
      t === null
        ? []
        : board.chats.filter(
            (c) =>
              (c.status === "accepted" || c.status === "pending") &&
              covers(coffeeChatMinutesOf(c.slotTime), c.durationMinutes, t) &&
              same(c.room ?? byId.get(c.sponsorId)?.room ?? null),
          );
    const windowed =
      t === null
        ? undefined
        : board.sponsors.find(
            (s) =>
              same(s.room) &&
              s.windowStart !== null &&
              s.windowEnd !== null &&
              t >= coffeeChatMinutesOf(s.windowStart)! &&
              t < coffeeChatMinutesOf(s.windowEnd)!,
          );
    const sponsor =
      windowed?.sponsor ??
      (live[0] ? (byId.get(live[0].sponsorId)?.sponsor ?? null) : null);
    const mine = live.filter((c) => byId.get(c.sponsorId)?.sponsor === sponsor);
    return {
      name,
      pin: mapRoomFor(name),
      sponsor,
      accepted: mine.filter((c) => c.status === "accepted").length,
      pending: mine.filter((c) => c.status === "pending").length,
    };
  });
}

/**
 * The time the panel opens on: before Saturday's board starts, its first
 * row; after Saturday, its last row; on Saturday, now rounded down to the
 * 15-minute grid (the row holding now, when there is one).
 */
export function boardTimeAt(
  slots: readonly string[],
  now: Date,
): string | null {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return null;
  if (now < coffeeChatStartsAt(first)) return first;
  const minutes = Math.floor(
    (now.getTime() - coffeeChatStartsAt("00:00").getTime()) / 60_000,
  );
  if (minutes >= 24 * 60) return last;
  return coffeeChatTimeOf(minutes - (minutes % COFFEE_CHAT_GRID_MINUTES));
}
