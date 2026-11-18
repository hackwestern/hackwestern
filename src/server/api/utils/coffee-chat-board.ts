import {
  COFFEE_CHAT_GRID_MINUTES,
  coffeeChatExpiresAt,
  coffeeChatMinutesOf,
  coffeeChatTimeOf,
  effectiveCoffeeChatStatus,
  isActiveCoffeeChat,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import {
  blockFill,
  blockFormatOf,
  blockSlots,
  hackersPerSlot,
  holdCovers,
  type BlockSlot,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import {
  offerStartTimes,
  seatsUsed,
} from "~/server/api/utils/coffee-chat-capacity";

/**
 * The organizer's Saturday coffee chat board (T48): one column per sponsor,
 * one row per 15-minute grid slot. Pure: the router loads sponsors, the
 * Coffee Chats sheet rows and every chat, then builds the board here with
 * the same seat rules as offering (coffee-chat-capacity).
 */

/** A chat on the board, with its status as it reads right now. */
export type BoardChat = {
  chatId: string;
  sponsorId: string;
  firstName: string;
  lastName: string | null;
  /** Badge / wallet pass code, once issued. */
  hackerId: string | null;
  /** GitHub link (avatar photo) only when the hacker agreed to share. */
  github: string | null;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  repName: string | null;
  status: CoffeeChatStatus;
};

/**
 * One cell of a sponsor's column. `rows` grid slots tall: a 30-min chat
 * start spans two rows. `kind`: "open" is a slot start in one of the
 * sponsor's room blocks, "gap" is inside a block but not a start (e.g. the
 * last 15 minutes of a 45-min block of 30-min groups), "out" is outside
 * every block.
 */
export type BoardCell = {
  slotTime: string;
  rows: number;
  kind: "open" | "gap" | "out";
  /** Chats starting inside this cell, any status. */
  chatIds: string[];
  /** Seats a start time has (reps and room size); 0 unless "open". */
  seats: number;
  seatsUsed: number;
  seatsLeft: number;
  /** An organizer can still add a chat here right now. */
  offerable: boolean;
};

/** A room block on the board: one sponsor, one room, a stretch of time. */
export type BoardHold = HoldSpan & {
  holdId: string;
  sponsor: string;
  note: string | null;
  /** The block's slots: hackers booked / hackers the chat type needs. */
  slots: BlockSlot[];
  /** Hackers booked and needed over every slot. */
  booked: number;
  needed: number;
  /** Chats filled out of the block's chats. */
  filled: number;
  total: number;
  /** A slot still before its cutoff has fewer hackers than it needs. */
  needsHacker: boolean;
};

export type BoardSponsor = {
  /** Null when the sheet names a sponsor that isn't registered. */
  sponsorId: string | null;
  sponsor: string;
  /** False when the sheet row has no window yet ("Not set up"). */
  setUp: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  durationMinutes: number;
  groupSize: number;
  hackers: number | null;
  reps: number;
  /** Hackers one slot needs (hackersPerSlot: chat type x reps). */
  perSlot: number;
  watcher: string | null;
  counts: { accepted: number; pending: number; total: number };
  /** This sponsor's blocks with a slot still needing a hacker. */
  holdsNeedingHacker: number;
  cells: BoardCell[];
};

export type ChatBoard = {
  /** Every grid slot ("HH:MM"), earliest first: the table's rows. */
  slots: string[];
  sponsors: BoardSponsor[];
  chats: BoardChat[];
  holds: BoardHold[];
  totals: {
    offered: number;
    accepted: number;
    pending: number;
    /** Open seats at start times that can still be offered. */
    seatsLeft: number;
    /** Blocks with a slot still needing a hacker. */
    needsHacker: number;
  };
  roomsInUse: string[];
};

type BoardSponsorRow = {
  id: string;
  name: string;
  reps: number;
  watcher: string | null;
};

type BoardChatRow = Omit<BoardChat, "status" | "github"> & {
  status: CoffeeChatStatus;
  github?: string | null;
};
type BoardHoldRow = HoldSpan & { holdId: string; note: string | null };

const GRID = COFFEE_CHAT_GRID_MINUTES;

function windowOf(setup: CoffeeChatSetup | undefined) {
  const start = setup?.windowStart
    ? coffeeChatMinutesOf(setup.windowStart)
    : null;
  const end = setup?.windowEnd ? coffeeChatMinutesOf(setup.windowEnd) : null;
  return start !== null && end !== null && start < end ? { start, end } : null;
}

/** Grid minutes from the earliest window start (or chat) to the latest end. */
export function boardSlots(
  windows: { start: number; end: number }[],
  chats: { slotTime: string; durationMinutes: number }[],
): number[] {
  const spans = [
    ...windows,
    ...chats.flatMap((c) => {
      const start = coffeeChatMinutesOf(c.slotTime);
      return start === null ? [] : [{ start, end: start + c.durationMinutes }];
    }),
  ];
  if (spans.length === 0) return [];
  const first = Math.min(...spans.map((s) => s.start));
  const last = Math.max(...spans.map((s) => s.end));
  const slots: number[] = [];
  for (let t = first; t < last; t += GRID) slots.push(t);
  return slots;
}

/**
 * One sponsor's cells down the board. Start times take one row per 15
 * minutes of chat; anything else is one row. Seats count only chats that
 * still hold one (pending in time, or accepted).
 */
export function boardCells(input: {
  slots: number[];
  setup: CoffeeChatSetup | undefined;
  reps: number;
  registered: boolean;
  chats: BoardChatRow[];
  /** The sponsor's own room holds: their start times open too. */
  holds?: readonly HoldSpan[];
  now: Date;
}): BoardCell[] {
  const { setup, now } = input;
  const holds = input.holds ?? [];
  const format = blockFormatOf(setup, input.reps);
  const duration = format.durationMinutes;
  const starts = new Set(
    offerStartTimes(setup ?? null, holds).map((t) => coffeeChatMinutesOf(t)!),
  );
  const active = input.chats.filter((c) => isActiveCoffeeChat(c, now));
  const seats = holds.length > 0 ? hackersPerSlot(format) : 0;
  const last = input.slots[input.slots.length - 1];
  const cells: BoardCell[] = [];

  for (let i = 0; i < input.slots.length; ) {
    const t = input.slots[i]!;
    const open =
      starts.has(t) && last !== undefined && t + duration <= last + GRID;
    const rows = open ? duration / GRID : 1;
    const inHold = holds.some((h) =>
      holdCovers(h, { slotTime: coffeeChatTimeOf(t) }),
    );
    const kind: BoardCell["kind"] = open
      ? "open"
      : inHold
        ? "gap"
        : "out";
    const slotTime = coffeeChatTimeOf(t);
    const chatIds = input.chats
      .filter((c) => {
        const start = coffeeChatMinutesOf(c.slotTime);
        return start !== null && start >= t && start < t + rows * GRID;
      })
      .map((c) => c.chatId);
    const used = open
      ? seatsUsed(active, { slotTime, durationMinutes: duration })
      : 0;
    const left = open ? Math.max(0, seats - used) : 0;
    cells.push({
      slotTime,
      rows,
      kind,
      chatIds,
      seats: open ? seats : 0,
      seatsUsed: used,
      seatsLeft: left,
      offerable:
        open &&
        input.registered &&
        left > 0 &&
        now < coffeeChatExpiresAt(slotTime),
    });
    i += rows;
  }
  return cells;
}

/**
 * The whole board. Columns: every Coffee Chats sheet row (blank rows show
 * as not set up), plus any registered sponsor with chats but no row, set
 * up first, then by name.
 */
export function buildChatBoard(input: {
  sponsors: BoardSponsorRow[];
  setups: CoffeeChatSetup[];
  chats: BoardChatRow[];
  holds?: BoardHoldRow[];
  now: Date;
}): ChatBoard {
  const { now } = input;
  const holdRows = input.holds ?? [];
  const chats: BoardChat[] = input.chats.map((c) => ({
    ...c,
    github: c.github ?? null,
    status: effectiveCoffeeChatStatus(c, now),
  }));
  const byName = new Map(input.sponsors.map((s) => [s.name, s]));
  const columns: { name: string; setup?: CoffeeChatSetup }[] = input.setups.map(
    (setup) => ({ name: setup.sponsor, setup }),
  );
  for (const s of input.sponsors) {
    if (columns.some((c) => c.name === s.name)) continue;
    if (
      chats.some((c) => c.sponsorId === s.id) ||
      holdRows.some((h) => h.sponsorId === s.id)
    ) {
      columns.push({ name: s.name });
    }
  }
  const live = chats.filter((c) => isActiveCoffeeChat(c, now));
  const names = new Map(input.sponsors.map((s) => [s.id, s.name]));
  const formats = new Map(
    input.sponsors.map((s) => [
      s.id,
      blockFormatOf(
        input.setups.find((c) => c.sponsor === s.name),
        s.reps,
      ),
    ]),
  );
  const holds: BoardHold[] = holdRows.map((h) => {
    const format = formats.get(h.sponsorId) ?? blockFormatOf(null, 1);
    const slots = blockSlots(h, format, live);
    const fill = blockFill(h, format, live, now);
    return {
      ...h,
      sponsor: names.get(h.sponsorId) ?? "",
      slots,
      booked: slots.reduce((n, s) => n + s.booked, 0),
      needed: slots.reduce((n, s) => n + s.needed, 0),
      filled: fill.filled,
      total: fill.total,
      needsHacker: fill.firstOpen !== null,
    };
  });

  const slots = boardSlots(
    columns.flatMap((c) => {
      const w = windowOf(c.setup);
      return w ? [w] : [];
    }),
    [
      ...chats,
      ...holdRows.flatMap((h) => {
        const start = coffeeChatMinutesOf(h.startTime);
        const end = coffeeChatMinutesOf(h.endTime);
        return start === null || end === null
          ? []
          : [{ slotTime: h.startTime, durationMinutes: end - start }];
      }),
    ],
  );

  const sponsors: BoardSponsor[] = columns.map(({ name, setup }) => {
    const row = byName.get(name);
    const mine = row ? chats.filter((c) => c.sponsorId === row.id) : [];
    const ownHolds = row ? holds.filter((h) => h.sponsorId === row.id) : [];
    const reps = row?.reps ?? 0;
    return {
      sponsorId: row?.id ?? null,
      sponsor: name,
      setUp: windowOf(setup) !== null,
      windowStart: setup?.windowStart ?? null,
      windowEnd: setup?.windowEnd ?? null,
      durationMinutes: setup?.durationMinutes ?? 15,
      groupSize: setup?.groupSize ?? 1,
      hackers: setup?.hackers ?? null,
      reps,
      perSlot: hackersPerSlot(blockFormatOf(setup, reps)),
      watcher: row?.watcher ?? null,
      counts: {
        accepted: mine.filter((c) => c.status === "accepted").length,
        pending: mine.filter((c) => c.status === "pending").length,
        total: mine.length,
      },
      holdsNeedingHacker: ownHolds.filter((h) => h.needsHacker).length,
      cells: boardCells({
        slots,
        setup,
        reps,
        registered: Boolean(row),
        chats: mine,
        holds: ownHolds,
        now,
      }),
    };
  });
  sponsors.sort(
    (a, b) =>
      Number(b.setUp) - Number(a.setUp) || a.sponsor.localeCompare(b.sponsor),
  );

  const roomsInUse = [...new Set(holds.map((h) => h.room))].sort();

  return {
    slots: slots.map(coffeeChatTimeOf),
    sponsors,
    chats,
    holds,
    totals: {
      offered: chats.length,
      accepted: chats.filter((c) => c.status === "accepted").length,
      pending: chats.filter((c) => c.status === "pending").length,
      seatsLeft: sponsors
        .flatMap((s) => s.cells)
        .reduce((sum, c) => sum + (c.offerable ? c.seatsLeft : 0), 0),
      needsHacker: holds.filter((h) => h.needsHacker).length,
    },
    roomsInUse,
  };
}
