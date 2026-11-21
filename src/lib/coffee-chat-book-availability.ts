/**
 * Book an event's rep picker: is a rep busy in a session (and with what),
 * and their free time that day. Pure and
 * dependency-free (the form and the server both use it), from the same
 * facts the coffee board uses to call a rep busy: the sessions they ticked
 * free, their sponsor's workshop window, their chats (placements) and
 * other organizer bookings they're in. Booking a busy rep anyway is an
 * organizer override. docs/decisions.md 2026-11-20.
 */
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";

/** What the picker knows about one rep. */
export type BookRep = {
  id: string;
  /**
   * Sessions they ticked free; null when their sponsor has no coffee chat
   * setup (nothing ticked to go by, so only chats and events count).
   */
  free: readonly string[] | null;
  /** Sessions their sponsor's workshop blocks. */
  blocked: readonly string[];
};

/** The board facts the picker reads. */
export type BookBoard = {
  placements: readonly {
    repId: string;
    sessionId: string;
    room: string;
    /** When the chats run (minutes after midnight); null = whole session. */
    window?: { start: number; end: number } | null;
  }[];
  bookings: readonly {
    id?: string;
    sessionId: string;
    room: string;
    label: string;
    repIds: readonly string[];
  }[];
};

/** Why a rep can't be in an event then. */
export type RepBusy =
  | { kind: "chat"; room: string; start: number; end: number }
  | { kind: "event"; room: string; label: string }
  | { kind: "workshop" }
  | { kind: "notFree" };

const sessionOf = (id: string) => COFFEE_SESSIONS.find((s) => s.id === id);

/** Why `rep` is busy in `sessionId`, or null when they're free then. */
export function repBusy(
  rep: BookRep,
  sessionId: string,
  board: BookBoard,
): RepBusy | null {
  const chat = board.placements.find(
    (p) => p.repId === rep.id && p.sessionId === sessionId,
  );
  if (chat) {
    const s = sessionOf(sessionId);
    return {
      kind: "chat",
      room: chat.room,
      start: chat.window?.start ?? s?.start ?? 0,
      end: chat.window?.end ?? s?.end ?? 0,
    };
  }
  const event = board.bookings.find(
    (b) => b.sessionId === sessionId && b.repIds.includes(rep.id),
  );
  if (event) return { kind: "event", room: event.room, label: event.label };
  if (rep.blocked.includes(sessionId)) return { kind: "workshop" };
  if (rep.free && !rep.free.includes(sessionId)) return { kind: "notFree" };
  return null;
}

/**
 * The rep's free time that day as ranges (minutes after midnight):
 * neighbouring free sessions join up (10–12), lunch splits them.
 */
export function freeRanges(
  rep: BookRep,
  board: BookBoard,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const s of COFFEE_SESSIONS) {
    if (repBusy(rep, s.id, board)) continue;
    const last = out[out.length - 1];
    if (last && last.end === s.start) last.end = s.end;
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/**
 * A rep as the picker sees them, from the board's sponsors (those set up
 * for coffee chats). A rep of a sponsor that isn't on the board has
 * nothing ticked and no workshop: only chats and events count.
 */
export function bookRepOf(
  board: {
    sponsors: readonly {
      id: string;
      blocked: readonly string[];
      reps: readonly { id: string; free: readonly string[] }[];
    }[];
  },
  sponsorId: string,
  repId: string,
): BookRep {
  const sponsor = board.sponsors.find((s) => s.id === sponsorId);
  const rep = sponsor?.reps.find((r) => r.id === repId);
  return rep
    ? { id: repId, free: rep.free, blocked: sponsor!.blocked }
    : { id: repId, free: null, blocked: [] };
}
