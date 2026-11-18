/**
 * The organizer's coffee chat room table: one column per room, one row per
 * 15-minute grid slot, each cell saying who holds the room and how full it
 * is. Plus the board stats for a chosen set of sponsors. Pure functions over
 * the organizer chat board, so the table, the filter and the stats agree.
 */
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  COFFEE_CHAT_GRID_MINUTES,
  COFFEE_CHAT_ROOM_PEOPLE,
  COFFEE_CHAT_ROOMS,
  coffeeChatMinutesOf,
  coffeeChatRoomOf,
} from "~/lib/coffee-chat-requests";

/** People one coffee chat room fits at once (rooms 2241-2243). */
export const ROOM_CAPACITY = COFFEE_CHAT_ROOM_PEOPLE;

/** The rooms the table always shows, in order. */
export const ROOM_TABLE_ROOMS: readonly string[] = COFFEE_CHAT_ROOMS;

// The parts of the organizer chat board these helpers read (structural, so
// tests don't need a whole board).
export type RoomBoardSponsor = {
  sponsorId: string | null;
  sponsor: string;
  setUp: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  reps: number;
  room: string | null;
  cells: { offerable: boolean; seatsLeft: number }[];
};
export type RoomBoardChat = {
  chatId: string;
  sponsorId: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: string;
};
export type RoomBoard = {
  slots: string[];
  sponsors: RoomBoardSponsor[];
  chats: RoomBoardChat[];
};

/** One sponsor in a room cell. */
export type RoomOccupant = {
  sponsor: string;
  sponsorId: string | null;
  hackers: number;
  accepted: number;
  pending: number;
  /** Reps the sponsor said they're sending (0 when not given). */
  reps: number;
  /** In the sponsor filter (false = shown dimmed). */
  selected: boolean;
};

export type RoomCellState = "free" | "booked" | "full" | "over";

export type RoomCell = {
  room: string;
  slotTime: string;
  occupants: RoomOccupant[];
  /** Hackers in live chats plus the occupying sponsors' reps. */
  used: number;
  capacity: number;
  state: RoomCellState;
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

export function roomCellState(used: number, occupied: boolean): RoomCellState {
  if (!occupied) return "free";
  if (used > ROOM_CAPACITY) return "over";
  if (used === ROOM_CAPACITY) return "full";
  return "booked";
}

/**
 * Who holds each room at each slot. A sponsor holds a room through its
 * coffee chat window when the room is theirs (assignment, else sheet ROOM),
 * and wherever one of its live chats (pending or accepted) is running; a
 * chat with no room of its own is in its sponsor's room. `selected` = null
 * means every sponsor is in the filter.
 */
export function buildRoomTable(
  board: RoomBoard,
  {
    rooms = ROOM_TABLE_ROOMS,
    selected = null,
  }: { rooms?: readonly string[]; selected?: ReadonlySet<string> | null } = {},
): RoomTable {
  const byId = new Map(
    board.sponsors.flatMap((s) => (s.sponsorId ? [[s.sponsorId, s]] : [])),
  );
  const live = board.chats.filter((c) => ACTIVE.has(c.status));
  const rows = board.slots.map((slotTime) => {
    const t = coffeeChatMinutesOf(slotTime) ?? -1;
    return rooms.map((room): RoomCell => {
      const occupants: RoomOccupant[] = [];
      for (const s of board.sponsors) {
        const chats = live.filter(
          (c) =>
            c.sponsorId === s.sponsorId &&
            sameRoom(c.room ?? s.room, room) &&
            covers(coffeeChatMinutesOf(c.slotTime), c.durationMinutes, t),
        );
        const start = s.windowStart ? coffeeChatMinutesOf(s.windowStart) : null;
        const end = s.windowEnd ? coffeeChatMinutesOf(s.windowEnd) : null;
        const holds =
          s.setUp &&
          sameRoom(s.room, room) &&
          start !== null &&
          end !== null &&
          t >= start &&
          t < end;
        if (!holds && chats.length === 0) continue;
        occupants.push({
          sponsor: s.sponsor,
          sponsorId: s.sponsorId,
          hackers: chats.length,
          accepted: chats.filter((c) => c.status === "accepted").length,
          pending: chats.filter((c) => c.status === "pending").length,
          reps: s.reps,
          selected: selected === null || selected.has(s.sponsor),
        });
      }
      // Chats whose sponsor isn't a board column still take seats.
      const orphans = live.filter(
        (c) =>
          !byId.has(c.sponsorId) &&
          sameRoom(c.room, room) &&
          covers(coffeeChatMinutesOf(c.slotTime), c.durationMinutes, t),
      ).length;
      const used =
        occupants.reduce((n, o) => n + o.hackers + o.reps, 0) + orphans;
      return {
        room,
        slotTime,
        occupants,
        used,
        capacity: ROOM_CAPACITY,
        state: roomCellState(used, occupants.length > 0 || orphans > 0),
      };
    });
  });
  return { rooms: [...rooms], slots: [...board.slots], rows };
}

export type BoardStats = {
  offered: number;
  accepted: number;
  pending: number;
  seatsLeft: number;
  roomsInUse: string[];
};

/**
 * The summary numbers for the chosen sponsors (null = all), counted the
 * same way as the server's board totals.
 */
export function boardStats(
  board: RoomBoard,
  selected: ReadonlySet<string> | null,
): BoardStats {
  const sponsors = board.sponsors.filter(
    (s) => selected === null || selected.has(s.sponsor),
  );
  const ids = new Set(
    sponsors.flatMap((s) => (s.sponsorId ? [s.sponsorId] : [])),
  );
  const chats =
    selected === null
      ? board.chats
      : board.chats.filter((c) => ids.has(c.sponsorId));
  return {
    offered: chats.length,
    accepted: chats.filter((c) => c.status === "accepted").length,
    pending: chats.filter((c) => c.status === "pending").length,
    seatsLeft: sponsors
      .flatMap((s) => s.cells)
      .reduce((sum, c) => sum + (c.offerable ? c.seatsLeft : 0), 0),
    roomsInUse: [
      ...new Set(sponsors.flatMap((s) => (s.setUp && s.room ? [s.room] : []))),
    ].sort(),
  };
}

/** Grid minutes per table row, re-exported for the component. */
export const ROOM_TABLE_ROW_MINUTES = COFFEE_CHAT_GRID_MINUTES;
