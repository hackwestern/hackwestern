/**
 * What the organizer coffee chat board shows and allows, cell by cell (mock
 * organizer-coffee-v12): which cell holds what, where a dragged chat may
 * land, how many chats a cell holds, and the hour's invite counts. Pure and
 * typed by shape, so the page and the tests share it. The server checks
 * every write again (src/server/api/utils/coffee-chat-sessions-board.ts).
 */
import { chatsBySession, chatsInWindow } from "~/lib/coffee-chat-sessions";

export type ViewRep = {
  id: string;
  name: string;
  free: readonly string[];
  chatsWanted: number;
};
export type ViewSponsor = {
  id: string;
  name: string;
  chatMinutes: number;
  hackersPerChat: number;
  /** Sessions their workshop window (with travel buffers) blocks. */
  blocked: readonly string[];
  reps: readonly ViewRep[];
};
export type ViewPlacement = {
  id: string;
  repId: string;
  sponsorId: string;
  sessionId: string;
  room: string;
  window: { start: number; end: number } | null;
};
export type ViewBooking = { id: string; room: string; sessionId: string };
export type ViewBoard = {
  sponsors: readonly ViewSponsor[];
  placements: readonly ViewPlacement[];
  bookings: readonly ViewBooking[];
};

export const keyOf = (room: string, session: string) => `${room}|${session}`;
export function splitKey(key: string): { room: string; session: string } {
  const [room = "", session = ""] = key.split("|");
  return { room, session };
}

export type CellOf<B extends ViewBoard> =
  | {
      kind: "chat";
      placement: B["placements"][number];
      sponsor: B["sponsors"][number];
      rep: B["sponsors"][number]["reps"][number];
    }
  | { kind: "booking"; booking: B["bookings"][number] }
  | null;

/** What's in a cell: a chat (with its sponsor and rep), a booking, or nothing. */
export function cellAt<B extends ViewBoard>(board: B, key: string): CellOf<B> {
  const { room, session } = splitKey(key);
  const p = board.placements.find(
    (x) => x.room === room && x.sessionId === session,
  );
  if (p) {
    const sponsor = board.sponsors.find((s) => s.id === p.sponsorId);
    const rep = sponsor?.reps.find((r) => r.id === p.repId);
    if (sponsor && rep)
      return { kind: "chat", placement: p, sponsor, rep } as CellOf<B>;
  }
  const b = board.bookings.find(
    (x) => x.room === room && x.sessionId === session,
  );
  return b ? ({ kind: "booking", booking: b } as CellOf<B>) : null;
}

/**
 * Dropping the cell at `src` on `target`:
 * - "ok": it moves (the cell lights up while dragging). A booking can go to
 *   any empty cell.
 * - "taken": the room is taken then (refused with a toast).
 * - "workshop": during the sponsor's workshop window (refused; Jazz,
 *   2026-11-19: never during the workshop, even after contacting the rep).
 * - "busy": the rep already has a chat elsewhere then (refused: never one
 *   rep in two places).
 * - "notFree": the rep didn't tick that session. Allowed only after the
 *   organizer contacts them (the two-step "isn't free" dialog).
 * - "same" or "gone": nothing to do.
 */
export type DropCheck =
  | "ok"
  | "same"
  | "gone"
  | "taken"
  | "workshop"
  | "busy"
  | "notFree";

export function dropCheck(
  board: ViewBoard,
  src: string,
  target: string,
): DropCheck {
  if (src === target) return "same";
  const from = cellAt(board, src);
  if (!from) return "gone";
  if (cellAt(board, target)) return "taken";
  if (from.kind === "booking") return "ok";
  const { session } = splitKey(target);
  if (from.sponsor.blocked.includes(session)) return "workshop";
  const elsewhere = board.placements.some(
    (p) =>
      p.repId === from.rep.id &&
      p.sessionId === session &&
      p.id !== from.placement.id,
  );
  if (elsewhere) return "busy";
  return from.rep.free.includes(session) ? "ok" : "notFree";
}

/** Every empty cell a dragged cell can drop on with no question (lit while dragging). */
export function litCells(
  board: ViewBoard,
  src: string,
  keys: readonly string[],
): Set<string> {
  return new Set(keys.filter((k) => dropCheck(board, src, k) === "ok"));
}

/**
 * Chats this placement holds: the whole hour (4 1-on-1s or 2 groups), the
 * part a workshop buffer leaves, and never past the rep's wanted chats
 * (filled in time order across their sessions).
 */
export function chatsInCell(
  board: ViewBoard,
  placement: ViewPlacement,
): number {
  const sponsor = board.sponsors.find((s) => s.id === placement.sponsorId);
  const rep = sponsor?.reps.find((r) => r.id === placement.repId);
  if (!sponsor || !rep) return 0;
  const mine = board.placements.filter((p) => p.repId === rep.id);
  const fits = (id: string) =>
    chatsInWindow(
      mine.find((p) => p.sessionId === id)?.window ?? null,
      sponsor.chatMinutes,
    );
  return (
    chatsBySession(
      mine.map((p) => p.sessionId),
      rep.chatsWanted,
      fits,
    ).get(placement.sessionId) ?? 0
  );
}

/** "2:30–3:30 PM", or "11:30 AM–12:30 PM" when it crosses noon. Times are "HH:MM". */
export function clockRange(start: string, end: string): string {
  const part = (t: string) => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return {
      clock: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`,
      pm: h >= 12,
    };
  };
  const a = part(start);
  const b = part(end);
  const mer = (pm: boolean) => (pm ? "PM" : "AM");
  return a.pm === b.pm
    ? `${a.clock}–${b.clock} ${mer(b.pm)}`
    : `${a.clock} ${mer(a.pm)}–${b.clock} ${mer(b.pm)}`;
}

export type HourChat = {
  placementId: string;
  seats: number;
  accepted: number;
  /** Seats held now: waiting plus accepted. */
  filled: number;
};

/** One hour's invites (every chat of one placement): seats, chats, accepted, waiting. */
export function hourCounts(chats: readonly HourChat[], placementId: string) {
  const mine = chats.filter((c) => c.placementId === placementId);
  const sum = (f: (c: HourChat) => number) =>
    mine.reduce((n, c) => n + f(c), 0);
  const accepted = sum((c) => c.accepted);
  return {
    chats: mine.length,
    seats: sum((c) => c.seats),
    accepted,
    waiting: sum((c) => c.filled) - accepted,
  };
}

/** "Dana" from "Dana W." (the dialogs say "Contact Dana"). */
export const firstNameOf = (name: string) =>
  name.trim().split(/\s+/)[0] ?? name;
