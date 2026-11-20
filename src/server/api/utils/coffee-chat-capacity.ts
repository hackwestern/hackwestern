import {
  chatExpiresAt,
  coffeeChatsOverlap,
} from "~/lib/coffee-chat-requests";
import {
  chatsInSlot,
  coffeeChatOfferRoom,
  holdStartTimes,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import {
  askedAt,
  type ChatRequest,
  type SlotLimit,
} from "~/lib/coffee-chat-request";

/**
 * Capacity rules for offering a coffee chat (T15) and for organizer moves
 * (T26). Pure: callers load the sponsor's setup from the Coffee Chats sheet
 * tab and the chats that still hold a seat (isActiveCoffeeChat), then ask
 * here. The server runs these inside a transaction that locks the sponsor
 * and hacker rows, so two offers for the last seat can't both pass.
 */

export type ChatTime = { slotTime: string; durationMinutes: number };
export type RoomChat = ChatTime & { sponsorId: string; room: string | null };
/** A sponsor's own chat; `room` when known, to follow organizer moves. */
export type SponsorChat = ChatTime & { room?: string | null };

export type OfferProblem =
  | "noBlock"
  | "notInWindow"
  | "tooLate"
  | "full"
  | "hackerBusy"
  | "roomTaken";

/**
 * Seats left at `slot`: hackers the sponsor asked for there (their
 * request, lowered by any "Ask for fewer") minus hackers booked. No room
 * capacity (docs/flows/coffee-chat-room-blocks.md v2).
 */
export function seatsLeft(
  sponsorChats: ChatTime[],
  slot: ChatTime,
  asked: number,
): number {
  return Math.max(
    0,
    asked -
      chatsInSlot(sponsorChats, slot.slotTime, slot.durationMinutes).length,
  );
}

/** "Rm 2241", " rm  2241 " -> "rm 2241", for comparing room labels. */
export function normalizeRoom(room: string | null | undefined): string {
  return String(room ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * True when another sponsor holds a chat in `room` that overlaps `slot`.
 * Rooms aren't shared between sponsors at the same time. No room yet (null)
 * never clashes.
 */
export function roomTakenByOtherSponsor(
  roomChats: RoomChat[],
  sponsorId: string,
  room: string | null,
  slot: ChatTime,
): boolean {
  if (!normalizeRoom(room)) return false;
  return roomChats.some(
    (c) =>
      c.sponsorId !== sponsorId &&
      normalizeRoom(c.room) === normalizeRoom(room) &&
      coffeeChatsOverlap(c, slot),
  );
}

/** True when the hacker already has a live chat overlapping `slot`. */
export function hackerBusy(hackerChats: ChatTime[], slot: ChatTime): boolean {
  return hackerChats.some((c) => coffeeChatsOverlap(c, slot));
}

/**
 * The room a chat at `slot` goes in: the sponsor's own block covering its
 * start, else null (and then it can't be offered).
 */
export function offerRoomAt(input: {
  sponsorId: string;
  holds?: readonly HoldSpan[];
  slot: Pick<ChatTime, "slotTime">;
}): string | null {
  return coffeeChatOfferRoom(input.holds ?? [], input.sponsorId, input.slot);
}

/** The request and asks the offer rules read. */
type Asks = {
  sponsorId: string;
  request: Pick<ChatRequest, "perSlot" | "durationMinutes">;
  limits?: readonly SlotLimit[];
};

function askedFor(input: Asks, slotTime: string): number {
  return askedAt(input.request, input.limits ?? [], input.sponsorId, slotTime)
    .asked;
}

/**
 * Every start time the sponsor offers, earliest first: the slot starts of
 * their own room blocks. The sheet window alone offers nothing.
 */
export function offerStartTimes(
  durationMinutes: number,
  holds: readonly HoldSpan[] = [],
): string[] {
  const times = new Set<string>();
  for (const hold of holds) {
    for (const t of holdStartTimes(hold, durationMinutes)) times.add(t);
  }
  return [...times].sort();
}

/**
 * Why an offer can't be made, or null when it can. Checks, in order: one
 * of the sponsor's own blocks (`holds`) covers the start, the time is one
 * of that block's slot starts, it isn't past the reply cutoff, the slot
 * still has hackers asked for, the hacker is free, and no other sponsor is
 * in the room (chats and blocks, passed in `roomChats`).
 */
export function offerProblem(
  input: Asks & {
    slotTime: string;
    sponsorChats: SponsorChat[];
    hackerChats: ChatTime[];
    roomChats: RoomChat[];
    holds?: readonly HoldSpan[];
    now: Date;
  },
): OfferProblem | null {
  const room = offerRoomAt({
    sponsorId: input.sponsorId,
    holds: input.holds,
    slot: input,
  });
  if (!room) return "noBlock";
  const { durationMinutes } = input.request;
  if (!offerStartTimes(durationMinutes, input.holds).includes(input.slotTime)) {
    return "notInWindow";
  }
  if (input.now >= chatExpiresAt({ slotTime: input.slotTime })) return "tooLate";
  const slot = { slotTime: input.slotTime, durationMinutes };
  if (
    seatsLeft(input.sponsorChats, slot, askedFor(input, input.slotTime)) < 1
  ) {
    return "full";
  }
  if (hackerBusy(input.hackerChats, slot)) return "hackerBusy";
  if (roomTakenByOtherSponsor(input.roomChats, input.sponsorId, room, slot)) {
    return "roomTaken";
  }
  return null;
}

/**
 * Open slot starts in the sponsor's own blocks, earliest first, with seats
 * left. Leaves out times past the reply cutoff, and, when a hacker's chats
 * are given, times that clash with them.
 */
export function freeStartTimes(
  input: Asks & {
    sponsorChats: SponsorChat[];
    hackerChats?: ChatTime[];
    roomChats: RoomChat[];
    holds?: readonly HoldSpan[];
    now: Date;
  },
): { slotTime: string; seatsLeft: number; room: string | null }[] {
  const { durationMinutes } = input.request;
  return offerStartTimes(durationMinutes, input.holds).flatMap((slotTime) => {
    const slot = { slotTime, durationMinutes };
    const left = seatsLeft(
      input.sponsorChats,
      slot,
      askedFor(input, slotTime),
    );
    const room = offerRoomAt({
      sponsorId: input.sponsorId,
      holds: input.holds,
      slot,
    });
    const open =
      room !== null &&
      left > 0 &&
      input.now < chatExpiresAt({ slotTime }) &&
      !hackerBusy(input.hackerChats ?? [], slot) &&
      !roomTakenByOtherSponsor(input.roomChats, input.sponsorId, room, slot);
    return open ? [{ slotTime, seatsLeft: left, room }] : [];
  });
}
