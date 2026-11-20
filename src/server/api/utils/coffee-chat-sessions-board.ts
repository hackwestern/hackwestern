/**
 * The organizer coffee chat board (session model), loaded from the DB and the
 * run of show. The scheduler itself is pure (src/lib/coffee-chat-schedule.ts);
 * this file turns rows into its inputs and the board the page reads, and holds
 * the guards every write shares (room free, rep free, workshop window).
 */
import { TRPCError } from "@trpc/server";
import { asc, sql } from "drizzle-orm";

import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  availSessions,
  blockedSessions,
  boardFixes,
  buildingSwitches,
  partialSessions,
  cellKey,
  invalidChats,
  repTally,
  withoutCells,
  workshopWindows,
  type Board,
  type Fix,
  type Pin,
  type SchedSponsor,
} from "~/lib/coffee-chat-schedule";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  chatMinutes,
  chatsPerSession,
  isRoomId,
  isSessionId,
  sessionsForChats,
  usableWindow,
  type UsableWindow,
} from "~/lib/coffee-chat-sessions";
import type { RunOfShowItem } from "~/lib/run-of-show";
import { isDigitalJudging } from "~/lib/sponsor-prize-tracks";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChatRoomBookings,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

const errors = coffeeSessionsCopy.errors;
const sessionLabel = (id: string) => coffeeSessionsCopy.sessions[id] ?? id;

/** Default prefs for a sponsor that hasn't submitted (only used for counts). */
const NO_PREFS = { hackersPerChat: 1, longerOneOnOne: false };

export type BoardWorkshop = {
  /** "HH:MM" from the run of show. */
  start: string;
  end: string;
  location: string | null;
};

export type BoardRep = {
  id: string;
  name: string;
  phone: string;
  isPrimary: boolean;
  chatsWanted: number;
  /** Sessions their chats need, before availability and fixes. */
  sessionsWanted: number;
  maxSessions: number | null;
  free: string[];
};

export type BoardSponsorStatus =
  | { kind: "not" }
  /** Submitted, and every rep asked for 0 chats (or there are no reps). */
  | { kind: "none" }
  /**
   * Submitted, but no rep who asked for chats has a free session outside
   * their workshops (reps at 0 chats don't count).
   */
  | { kind: "unavailable" }
  /**
   * The stage once they submitted with reps who want chats: nothing placed
   * ("need"), placed with drafts not sent yet ("scheduled"), or every chat
   * placed is sent ("sent"). Problems ride along as separate counts: reps who
   * want chats but have none that count (`total - done`), and chats on the
   * board that break a rule now (`broken`).
   */
  | { kind: "need" | "scheduled" | "sent"; done: number; total: number; broken: number };

export type BoardSessionSponsor = {
  id: string;
  name: string;
  submitted: boolean;
  submittedAt: Date | null;
  /** Their chats were sent, and they changed preferences or reps after. */
  changedAfterSend: boolean;
  hackersPerChat: number;
  longerOneOnOne: boolean;
  chatMinutes: 15 | 30;
  chatsPerSession: number;
  workshops: BoardWorkshop[];
  /** Session ids blocked by their workshop windows (with travel buffers). */
  blocked: string[];
  /**
   * Sessions a workshop window cuts but leaves usable, with the usable part
   * (minutes after midnight), e.g. Sun Life's 1-2 -> 1:00-1:30.
   */
  partial: Record<string, UsableWindow>;
  status: BoardSponsorStatus;
  reps: BoardRep[];
};

export type BoardPlacement = {
  id: string;
  repId: string;
  sponsorId: string;
  sessionId: string;
  room: string;
  pinned: boolean;
  /**
   * Moved by hand to a session the rep didn't tick as free (after an
   * organizer contacted them): not flagged as a fix for that.
   */
  forced: boolean;
  status: "draft" | "sent";
  sentAt: Date | null;
  /**
   * When the rep's chats run (minutes after midnight): the whole session, or
   * the part a workshop cut leaves. Null if the session is now blocked.
   */
  window: UsableWindow | null;
};

export type BoardBooking = {
  id: string;
  sessionId: string;
  room: string;
  forSponsorId: string | null;
  label: string;
  note: string | null;
};

export type SessionBoard = {
  /** False when the run of show couldn't be read (no workshops blocked). */
  workshopsAvailable: boolean;
  sponsors: BoardSessionSponsor[];
  placements: BoardPlacement[];
  bookings: BoardBooking[];
  /** True once there is anything placed (Auto-schedule has run). */
  scheduled: boolean;
  fixes: Fix[];
  draftCount: number;
  /**
   * Reps booked back to back in two buildings: `session` is the later chat,
   * `toIvey` whether that one is in Ivey. Allowed; the board shows a note.
   */
  walks: { repId: string; sessionId: string; toIvey: boolean }[];
  /** Latest Send, or null. */
  sentAt: Date | null;
};

/** Everything the board and the writes need, in one read. */
export type BoardState = {
  workshopsAvailable: boolean;
  sponsors: BoardSessionSponsor[];
  sched: SchedSponsor[];
  placements: BoardPlacement[];
  bookings: BoardBooking[];
  board: Board;
};

type Items = Pick<RunOfShowItem, "day" | "column" | "start" | "end" | "sponsors" | "location">[];

async function readRunOfShow(names: string[]): Promise<{
  items: Items;
  sheetSponsors: string[];
} | null> {
  try {
    const snapshot = await getRunOfShow();
    const sheet = applySponsorNames(snapshot, names);
    return {
      items: sheet.items,
      sheetSponsors: sheet.coffeeChats.map((c) => c.sponsor),
    };
  } catch (error) {
    console.error("coffee chat board: run-of-show read failed", error);
    return null;
  }
}

/** Board from placements and bookings. Sent chats count as pinned. */
export function boardOf(
  placements: readonly BoardPlacement[],
  bookings: readonly BoardBooking[],
): Board {
  const board: Board = {};
  for (const b of bookings) {
    board[cellKey(b.room, b.sessionId)] = { type: "booking", ref: b.id, pinned: true };
  }
  for (const p of placements) {
    board[cellKey(p.room, p.sessionId)] = {
      type: "chat",
      rep: p.repId,
      pinned: p.pinned || p.status === "sent",
      ...(p.forced ? { forced: true } : {}),
    };
  }
  return board;
}

/** Pins for a re-run: organizer bookings, pinned and sent chats. */
export function pinsOf(state: BoardState): Pin[] {
  return [
    ...state.bookings.map(
      (b): Pin => ({ room: b.room, session: b.sessionId, type: "booking", ref: b.id }),
    ),
    ...state.placements
      .filter((p) => p.pinned || p.status === "sent")
      .map(
        (p): Pin => ({ room: p.room, session: p.sessionId, type: "chat", rep: p.repId, forced: p.forced }),
      ),
  ];
}

export async function loadBoardState(
  database: Pick<typeof db, "select"> = db,
): Promise<BoardState> {
  // Every list the scheduler walks is fully ordered (id last), so the same
  // rows always give the same board.
  const [registered, prefs, reps, repSessions, placementRows, bookings] =
    await Promise.all([
      database
        .select({ id: sponsorJudgingSponsors.id, name: sponsorJudgingSponsors.name })
        .from(sponsorJudgingSponsors)
        .orderBy(asc(sponsorJudgingSponsors.name), asc(sponsorJudgingSponsors.id)),
      database.select().from(coffeeChatPrefs),
      database
        .select()
        .from(coffeeChatReps)
        .orderBy(asc(coffeeChatReps.position), asc(coffeeChatReps.createdAt), asc(coffeeChatReps.id)),
      database.select().from(coffeeChatRepSessions),
      database
        .select()
        .from(coffeeChatPlacements)
        .orderBy(asc(coffeeChatPlacements.createdAt), asc(coffeeChatPlacements.id)),
      database
        .select()
        .from(coffeeChatRoomBookings)
        .orderBy(asc(coffeeChatRoomBookings.createdAt), asc(coffeeChatRoomBookings.id)),
    ]);
  const ros = await readRunOfShow(registered.map((s) => s.name));
  const sheetNames = new Set((ros?.sheetSponsors ?? []).map((n) => n.toLowerCase()));
  const prefOf = new Map(prefs.map((p) => [p.sponsorId, p]));
  const freeOf = new Map<string, string[]>();
  for (const rs of repSessions) {
    if (!isSessionId(rs.sessionId)) continue;
    freeOf.set(rs.repId, [...(freeOf.get(rs.repId) ?? []), rs.sessionId]);
  }
  const sponsorOfRep = new Map(reps.map((r) => [r.id, r.sponsorId]));

  // Sponsors doing coffee chats: in the Coffee Chat Setup tab, or with
  // preferences or reps saved. Digital sponsors (PCBWay) never do.
  const doing = registered.filter(
    (s) =>
      !isDigitalJudging(s.name) &&
      (prefOf.has(s.id) ||
        reps.some((r) => r.sponsorId === s.id) ||
        sheetNames.has(s.name.toLowerCase())),
  );

  const placements: BoardPlacement[] = placementRows.map((p) => ({
    id: p.id,
    repId: p.repId,
    sponsorId: sponsorOfRep.get(p.repId) ?? "",
    sessionId: p.sessionId,
    room: p.room,
    pinned: p.pinned,
    forced: p.forced,
    status: p.status,
    sentAt: p.sentAt,
    // Filled in below, once each sponsor's workshops are known.
    window: null,
  }));
  const boardBookings: BoardBooking[] = bookings.map((b) => ({
    id: b.id,
    sessionId: b.sessionId,
    room: b.room,
    forSponsorId: b.forSponsorId,
    label: b.label,
    note: b.note,
  }));
  const board = boardOf(placements, boardBookings);
  const latest = (ds: (Date | null | undefined)[]) => {
    const t = ds.filter((d): d is Date => !!d).map((d) => d.getTime());
    return t.length ? new Date(Math.max(...t)) : null;
  };

  const sched: SchedSponsor[] = [];
  const sponsors: BoardSessionSponsor[] = doing.map((s) => {
    const pref = prefOf.get(s.id);
    const submitted = !!pref?.submittedAt;
    const format = pref ?? NO_PREFS;
    const minutes = chatMinutes(format);
    const items = (ros?.items ?? []).filter(
      (i) =>
        i.day === "Saturday" &&
        i.column === "sponsor-workshop" &&
        i.sponsors.includes(s.name),
    );
    const windows = workshopWindows(items, s.name);
    const boardReps: BoardRep[] = reps
      .filter((r) => r.sponsorId === s.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        isPrimary: r.isPrimary,
        chatsWanted: r.chatsWanted,
        sessionsWanted: sessionsForChats(r.chatsWanted, minutes),
        maxSessions: r.maxSessions,
        free: COFFEE_SESSIONS.map((x) => x.id as string).filter((id) =>
          (freeOf.get(r.id) ?? []).includes(id),
        ),
      }));
    const sp: SchedSponsor = {
      id: s.id,
      submitted,
      workshops: windows,
      chatMinutes: minutes,
      reps: boardReps.map((r) => ({
        id: r.id,
        free: r.free,
        sessionsWanted: r.sessionsWanted,
        maxSessions: r.maxSessions,
        chatsWanted: r.chatsWanted,
      })),
    };
    sched.push(sp);
    const mine = placements.filter((p) => p.sponsorId === s.id);
    for (const p of mine) p.window = usableWindow(p.sessionId, windows, minutes);
    // Chats that break a rule now don't count as scheduled.
    const bad = invalidChats([sp], COFFEE_SESSIONS, board).map((x) => x.key);
    const tally = repTally(sp, COFFEE_SESSIONS, withoutCells(board, bad));
    // Reps at 0 chats don't chat: they never make a sponsor "No availability".
    const chatting = sp.reps.filter((r) => r.sessionsWanted > 0);
    const free = chatting.reduce((n, r) => n + availSessions(sp, r, COFFEE_SESSIONS).length, 0);
    const status: BoardSponsorStatus = !submitted
      ? { kind: "not" }
      : chatting.length === 0
        ? { kind: "none" }
        : free === 0
        ? { kind: "unavailable" }
        : {
            kind:
              mine.length === 0
                ? "need"
                : mine.every((p) => p.status === "sent")
                  ? "sent"
                  : "scheduled",
            ...tally,
            broken: mine.filter((p) => bad.includes(cellKey(p.room, p.sessionId))).length,
          };
    // Sponsors are the only ones who write their preferences, so an update
    // after their chats were sent is the sponsor's change.
    // (Track A bumps coffee_chat_pref.updated_at on every reps/times edit.)
    const theirSent = latest(mine.map((p) => p.sentAt));
    const changedAt = latest([pref?.submittedAt, pref?.updatedAt]);
    return {
      id: s.id,
      name: s.name,
      submitted,
      submittedAt: pref?.submittedAt ?? null,
      changedAfterSend: !!theirSent && !!changedAt && changedAt > theirSent,
      hackersPerChat: format.hackersPerChat,
      longerOneOnOne: format.longerOneOnOne,
      chatMinutes: minutes,
      chatsPerSession: chatsPerSession(format),
      workshops: items.map((i) => ({ start: i.start, end: i.end, location: i.location })),
      blocked: [...blockedSessions(sp, COFFEE_SESSIONS)],
      partial: Object.fromEntries(partialSessions(sp, COFFEE_SESSIONS)),
      status,
      reps: boardReps,
    };
  });

  return {
    workshopsAvailable: ros !== null,
    sponsors,
    sched,
    placements,
    bookings: boardBookings,
    board,
  };
}

export function sessionBoardOf(state: BoardState): SessionBoard {
  const scheduled = state.placements.length > 0;
  const sent = state.placements
    .map((p) => p.sentAt)
    .filter((d): d is Date => d !== null);
  return {
    workshopsAvailable: state.workshopsAvailable,
    sponsors: state.sponsors,
    placements: state.placements,
    bookings: state.bookings,
    scheduled,
    fixes: scheduled
      ? boardFixes(state.sched, COFFEE_ROOMS, COFFEE_SESSIONS, state.board)
      : [],
    draftCount: state.placements.filter((p) => p.status === "draft").length,
    walks: [...buildingSwitches(state.board, COFFEE_ROOMS, COFFEE_SESSIONS)].flatMap(
      ([repId, later]) =>
        later.map((sessionId) => {
          const room = state.placements.find(
            (p) => p.repId === repId && p.sessionId === sessionId,
          )?.room;
          return {
            repId,
            sessionId,
            toIvey: COFFEE_ROOMS.find((r) => r.id === room)?.building === "ivey",
          };
        }),
    ),
    sentAt: sent.length ? new Date(Math.max(...sent.map((d) => d.getTime()))) : null,
  };
}

/**
 * One Postgres advisory lock for the whole coffee chat board. Chats and room
 * bookings live in two tables with no shared constraint, so under READ
 * COMMITTED two writes could fill one cell. Every board write takes this
 * lock first, then reads and checks the board inside the same transaction.
 */
export const BOARD_LOCK_KEY = "4812026112"; // any constant bigint, unique in this app

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run one board write: transaction, board lock, fresh board state, then
 * `fn`. Database constraint errors come back as clear TRPCErrors.
 */
export async function boardWrite<T>(
  fn: (tx: Tx, state: BoardState) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${sql.raw(BOARD_LOCK_KEY)})`);
      return fn(tx, await loadBoardState(tx));
    });
  } catch (error) {
    throw boardDbError(error);
  }
}

/** The Postgres error code on an error or anywhere down its cause chain. */
function pgCode(error: unknown): string | undefined {
  let e: unknown = error;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    const code = (e as { code?: unknown }).code;
    if (code === "23505" || code === "23503") return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Unique violation (23505: a cell or rep-session taken meanwhile) ->
 * CONFLICT; foreign key violation (23503: a rep or sponsor gone) ->
 * BAD_REQUEST. Anything else is returned as is.
 */
export function boardDbError(error: unknown): unknown {
  if (error instanceof TRPCError) return error;
  const code = pgCode(error);
  if (code === "23505") {
    return new TRPCError({ code: "CONFLICT", message: errors.boardChanged, cause: error });
  }
  if (code === "23503") {
    return new TRPCError({ code: "BAD_REQUEST", message: errors.badReference, cause: error });
  }
  return error;
}

/**
 * Every board write needs the workshop windows: without the run of show a
 * chat could land in a sponsor's workshop. Throws PRECONDITION_FAILED.
 */
export function assertWorkshopsKnown(state: Pick<BoardState, "workshopsAvailable">): void {
  if (!state.workshopsAvailable) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: errors.workshopsUnknown });
  }
}

/** Throws a clear error unless (room, session) is a real, empty cell. */
export function assertCellFree(
  state: BoardState,
  room: string,
  sessionId: string,
  except: { placementId?: string; bookingId?: string } = {},
): void {
  if (!isRoomId(room) || !isSessionId(sessionId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.badCell });
  }
  const taken =
    state.placements.some(
      (p) => p.room === room && p.sessionId === sessionId && p.id !== except.placementId,
    ) ||
    state.bookings.some(
      (b) => b.room === room && b.sessionId === sessionId && b.id !== except.bookingId,
    );
  if (taken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: errors.roomTaken(coffeeSessionsCopy.rooms.rm(room), sessionLabel(sessionId)),
    });
  }
}

/**
 * Throws unless this rep may chat in this session: their sponsor submitted,
 * not during their workshop window, ticked free, and not already elsewhere.
 * With `allowNotFree` (an organizer contacted the rep first), a session they
 * didn't tick is allowed; the workshop window and "two places at once" never
 * are (Jazz, 2026-11-19). Returns true when the session isn't ticked free
 * (the chat is then "forced").
 */
export function assertRepCanChat(
  state: BoardState,
  repId: string,
  sessionId: string,
  exceptPlacementId?: string,
  opts: { allowNotFree?: boolean } = {},
): boolean {
  assertWorkshopsKnown(state);
  const sponsor = state.sponsors.find((s) => s.reps.some((r) => r.id === repId));
  const rep = sponsor?.reps.find((r) => r.id === repId);
  if (!sponsor || !rep) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownPlacement });
  }
  const s = sessionLabel(sessionId);
  if (!sponsor.submitted) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.notSubmitted(sponsor.name) });
  }
  if (sponsor.blocked.includes(sessionId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.duringWorkshop(sponsor.name) });
  }
  if (
    state.placements.some(
      (p) => p.repId === repId && p.sessionId === sessionId && p.id !== exceptPlacementId,
    )
  ) {
    throw new TRPCError({ code: "CONFLICT", message: errors.repBusy(rep.name, s) });
  }
  const notFree = !rep.free.includes(sessionId);
  if (notFree && !opts.allowNotFree) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.notFree(rep.name, s) });
  }
  return notFree;
}
