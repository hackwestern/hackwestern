/**
 * The organizer's coffee chat room table: one column per room, one row per
 * 15-minute grid slot. A room at a time is free or in one sponsor's room
 * block (docs/flows/coffee-chat-room-blocks.md); a block cell says how many
 * hackers its slot has against how many the sponsor asked for. Plus the
 * sponsor strip above the table. No room capacity (v2). Pure functions over the
 * organizer chat board, so the table, the strip and the dialogs agree.
 */
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  COFFEE_CHAT_ROOMS,
  coffeeChatMinutesOf,
  coffeeChatRoomOf,
} from "~/lib/coffee-chat-requests";
import { holdCovers } from "~/lib/coffee-chat-holds";

/** The rooms the table always shows, in order. */
export const ROOM_TABLE_ROOMS: readonly string[] = COFFEE_CHAT_ROOMS;

// The parts of the organizer chat board these helpers read (structural, so
// tests don't need a whole board).
export type RoomBoardSponsor = {
  sponsorId: string | null;
  sponsor: string;
  setUp: boolean;
  request: { source: string };
  blockMinutes: number;
};
export type RoomBoardChat = {
  chatId: string;
  sponsorId: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: string;
};
export type RoomBoardHold = {
  holdId: string;
  sponsorId: string;
  room: string;
  startTime: string;
  endTime: string;
  slots: { slotTime: string; booked: number; needed: number }[];
  booked: number;
  needed: number;
  needsHacker: boolean;
};
export type RoomBoard = {
  slots: string[];
  sponsors: RoomBoardSponsor[];
  chats: RoomBoardChat[];
  holds: RoomBoardHold[];
};

/** One sponsor in a room cell. */
export type RoomOccupant = {
  sponsor: string;
  sponsorId: string | null;
  /** Hackers in live chats running in this room now. */
  hackers: number;
  /** The block this cell falls in; null for a chat booked before blocks. */
  holdId: string | null;
  /** The block's slot covering this time: booked / needed. */
  slot: { slotTime: string; booked: number; needed: number } | null;
};

export type RoomCell = {
  room: string;
  slotTime: string;
  occupants: RoomOccupant[];
  /** A block slot here is short of hackers. */
  needsHacker: boolean;
  /**
   * Two or more sponsors in this room now. The server refuses this for
   * blocks, but a chat booked before blocks can still cause it.
   */
  clash: boolean;
  /** The single block this cell shows (cells of one block merge). */
  holdId: string | null;
};

export type RoomTable = {
  rooms: string[];
  slots: string[];
  /** rows[i][j]: slot i, room j. */
  rows: RoomCell[][];
};

const ACTIVE = new Set<string>(ACTIVE_COFFEE_CHAT_STATUSES);

function sameRoom(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const norm = (r: string) =>
    coffeeChatRoomOf(r) ?? r.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

function covers(start: number | null, minutes: number, t: number): boolean {
  return start !== null && start <= t && t < start + minutes;
}

/**
 * Who has each room at each slot: the sponsor whose block covers it, and
 * any live chat running there (a chat with no room counts in its
 * sponsor's block).
 */
export function buildRoomTable(
  board: RoomBoard,
  { rooms = ROOM_TABLE_ROOMS }: { rooms?: readonly string[] } = {},
): RoomTable {
  const byId = new Map(
    board.sponsors.flatMap((s) => (s.sponsorId ? [[s.sponsorId, s]] : [])),
  );
  const live = board.chats.filter((c) => ACTIVE.has(c.status));
  const rows = board.slots.map((slotTime) => {
    const t = coffeeChatMinutesOf(slotTime) ?? -1;
    return rooms.map((room): RoomCell => {
      const holds = board.holds.filter(
        (h) => sameRoom(h.room, room) && holdCovers(h, { slotTime }),
      );
      const chats = live.filter((c) => {
        if (!covers(coffeeChatMinutesOf(c.slotTime), c.durationMinutes, t)) {
          return false;
        }
        if (c.room) return sameRoom(c.room, room);
        return holds.some((h) => h.sponsorId === c.sponsorId);
      });
      const ids = [
        ...new Set([
          ...holds.map((h) => h.sponsorId),
          ...chats.map((c) => c.sponsorId),
        ]),
      ];
      const occupants = ids.map((id): RoomOccupant => {
        const s = byId.get(id);
        const hold = holds.find((h) => h.sponsorId === id) ?? null;
        const slot =
          [...(hold?.slots ?? [])]
            .reverse()
            .find((x) => (coffeeChatMinutesOf(x.slotTime) ?? Infinity) <= t) ??
          null;
        return {
          sponsor: s?.sponsor ?? "",
          sponsorId: s?.sponsorId ?? id,
          hackers: chats.filter((c) => c.sponsorId === id).length,
          holdId: hold?.holdId ?? null,
          slot,
        };
      });
      const only = occupants.length === 1 ? occupants[0]! : null;
      return {
        room,
        slotTime,
        occupants,
        needsHacker: occupants.some(
          (o) => o.slot !== null && o.slot.booked < o.slot.needed,
        ),
        clash: occupants.length > 1,
        holdId: only?.holdId ?? null,
      };
    });
  });
  return { rooms: [...rooms], slots: [...board.slots], rows };
}

/**
 * Rows each cell spans in the table: cells of one block merge into its
 * first cell (the rest are 0 = not drawn). Anything else is 1 row.
 */
export function roomCellSpans(table: RoomTable): number[][] {
  const spans = table.rows.map((row) => row.map(() => 1));
  table.rooms.forEach((_, j) => {
    let i = 0;
    while (i < table.rows.length) {
      const id = table.rows[i]![j]!.holdId;
      let k = i + 1;
      while (id && k < table.rows.length && table.rows[k]![j]!.holdId === id) {
        spans[k]![j] = 0;
        k += 1;
      }
      spans[i]![j] = k - i;
      i = k;
    }
  });
  return spans;
}

/**
 * The sponsor strip above the room table: every sponsor in the view, those
 * with room blocks first, then set up (a sheet window), then by name.
 */
export function sponsorStrip<S extends RoomBoardSponsor>(
  board: { sponsors: readonly S[] },
): S[] {
  return [...board.sponsors].sort(
    (a, b) =>
      Number(b.blockMinutes > 0) - Number(a.blockMinutes > 0) ||
      Number(b.setUp) - Number(a.setUp) ||
      a.sponsor.localeCompare(b.sponsor),
  );
}
