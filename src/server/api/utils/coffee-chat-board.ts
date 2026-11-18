import {
  COFFEE_CHAT_GRID_MINUTES,
  coffeeChatMinutesOf,
  coffeeChatTimeOf,
  effectiveCoffeeChatStatus,
  isActiveCoffeeChat,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import {
  blockFill,
  blockSlots,
  holdMinutes,
  type BlockSlot,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import {
  chatRequestOf,
  sheetMismatch,
  type ChatRequest,
  type SavedChatRequest,
  type SlotLimit,
} from "~/lib/coffee-chat-request";
import type { CoffeeChatSetup } from "~/lib/run-of-show";

/**
 * The organizer's Saturday coffee chat view (docs/flows/coffee-chat-room-
 * blocks.md v2): rooms x time with each sponsor's room blocks, and the
 * sponsor strip above it. Pure: the router loads sponsors, the Coffee
 * Chats sheet rows, chats, blocks and asks for fewer, then builds it here.
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

/** A room block on the board: one sponsor, one room, a stretch of time. */
export type BoardHold = HoldSpan & {
  holdId: string;
  sponsor: string;
  note: string | null;
  /** The block's slots: hackers booked / hackers asked for. */
  slots: BlockSlot[];
  /** Hackers booked and asked for over every slot. */
  booked: number;
  needed: number;
  /** Chats filled out of the block's chats. */
  filled: number;
  total: number;
  /** A slot still before its cutoff has fewer hackers than asked for. */
  needsHacker: boolean;
};

export type BoardSponsor = {
  /** Null when the sheet names a sponsor that isn't registered. */
  sponsorId: string | null;
  sponsor: string;
  /** False when the sheet row has no window yet. */
  setUp: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  /** The request in force (sponsor's answer, else the sheet's default). */
  request: ChatRequest;
  /** The sheet's numbers as written: the request's starting point. */
  sheet: {
    chattingHours: number | null;
    slots: number | null;
    hackers: number | null;
  };
  /** Where the sheet's numbers don't add up (a quiet note, never fixed). */
  mismatch: ("hackers" | "hours")[];
  watcher: string | null;
  counts: { accepted: number; pending: number; total: number };
  /** Minutes of room blocks given to this sponsor. */
  blockMinutes: number;
  /** Hackers booked today (live chats) and asked for over their blocks. */
  booked: number;
  asked: number;
  /** This sponsor's blocks with a slot still needing a hacker. */
  holdsNeedingHacker: number;
};

export type ChatBoard = {
  /** Every grid slot ("HH:MM"), earliest first: the grid's rows. */
  slots: string[];
  sponsors: BoardSponsor[];
  chats: BoardChat[];
  holds: BoardHold[];
  totals: {
    offered: number;
    accepted: number;
    pending: number;
    /** Blocks with a slot still needing a hacker. */
    needsHacker: number;
  };
  roomsInUse: string[];
};

type BoardSponsorRow = SavedChatRequest & {
  id: string;
  name: string;
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
 * The whole view. Sponsors: every Coffee Chats sheet row (a blank row is
 * "No chat request yet"), plus any registered sponsor with chats or
 * blocks but no row; set up first, then by name.
 */
export function buildChatBoard(input: {
  sponsors: BoardSponsorRow[];
  setups: CoffeeChatSetup[];
  chats: BoardChatRow[];
  holds?: BoardHoldRow[];
  limits?: SlotLimit[];
  now: Date;
}): ChatBoard {
  const { now } = input;
  const holdRows = input.holds ?? [];
  const limits = input.limits ?? [];
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
  const requests = new Map(
    input.sponsors.map((s) => [
      s.id,
      chatRequestOf(
        input.setups.find((c) => c.sponsor === s.name),
        s,
      ),
    ]),
  );
  const holds: BoardHold[] = holdRows.map((h) => {
    const request = requests.get(h.sponsorId) ?? chatRequestOf(null);
    const slots = blockSlots(h, request, live, limits);
    const fill = blockFill(h, request, live, limits, now);
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
      ...holdRows.map((h) => ({
        slotTime: h.startTime,
        durationMinutes: holdMinutes(h),
      })),
    ],
  );

  const sponsors: BoardSponsor[] = columns.map(({ name, setup }) => {
    const row = byName.get(name);
    const mine = row ? chats.filter((c) => c.sponsorId === row.id) : [];
    const ownHolds = row ? holds.filter((h) => h.sponsorId === row.id) : [];
    return {
      sponsorId: row?.id ?? null,
      sponsor: name,
      setUp: windowOf(setup) !== null,
      windowStart: setup?.windowStart ?? null,
      windowEnd: setup?.windowEnd ?? null,
      request: chatRequestOf(setup, row),
      sheet: {
        chattingHours: setup?.chattingHours ?? null,
        slots: setup?.slots ?? null,
        hackers: setup?.hackers ?? null,
      },
      mismatch: sheetMismatch(setup),
      watcher: row?.watcher ?? null,
      counts: {
        accepted: mine.filter((c) => c.status === "accepted").length,
        pending: mine.filter((c) => c.status === "pending").length,
        total: mine.length,
      },
      blockMinutes: ownHolds.reduce((n, h) => n + holdMinutes(h), 0),
      booked: row ? live.filter((c) => c.sponsorId === row.id).length : 0,
      asked: ownHolds.reduce((n, h) => n + h.needed, 0),
      holdsNeedingHacker: ownHolds.filter((h) => h.needsHacker).length,
    };
  });
  sponsors.sort(
    (a, b) =>
      Number(b.setUp) - Number(a.setUp) || a.sponsor.localeCompare(b.sponsor),
  );

  return {
    slots: slots.map(coffeeChatTimeOf),
    sponsors,
    chats,
    holds,
    totals: {
      offered: chats.length,
      accepted: chats.filter((c) => c.status === "accepted").length,
      pending: chats.filter((c) => c.status === "pending").length,
      needsHacker: holds.filter((h) => h.needsHacker).length,
    },
    roomsInUse: [...new Set(holds.map((h) => h.room))].sort(),
  };
}
