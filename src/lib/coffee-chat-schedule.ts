/**
 * Coffee chat auto-schedule: pure functions, ported from the organizer board
 * mock (mocks/organizer-coffee-v8, its SCHEDULER block and README). They read
 * only their arguments, so the server, the board and the tests share them.
 *
 * A board is a map from "room|session" to what's in that cell: a rep's chat
 * or an organizer's ad hoc room booking. One key = one cell, so a room can
 * never hold two things at once.
 *
 * Rules (docs/decisions.md 2026-11-19, "auto-schedule is a real algorithm"):
 * - a rep gets min(sessions their wanted chats need, sessions they can do);
 *   sessions needed = ceil(chats wanted x chat length / 60), worked out by
 *   sessionsForChats() in coffee-chat-sessions.ts;
 * - only sessions the rep ticked free and that don't overlap their own
 *   sponsor's workshop, counted from 15 min before setup (or start) to 15 min
 *   after the end; a session that window only cuts is still usable for the
 *   part before or after the cut, in whole chats (usableWindow in
 *   coffee-chat-sessions.ts), after the rep's full sessions;
 * - pinned cells (organizer bookings, manual moves, applied fixes, sent
 *   chats) stay exactly where they are and count toward a rep's sessions;
 * - most-constrained sponsors first, then the most-constrained rep;
 * - near rooms (2241-2243) before Ivey, and a sponsor's reps in the same
 *   session stay in one building;
 * - never two things in one room, never one rep in two places;
 * - anything short becomes a suggested fix.
 */
import {
  chatsInWindow,
  sessionWindow,
  type Building,
  type UsableWindow,
  type WorkshopTime,
} from "~/lib/coffee-chat-sessions";

export type SchedSession = { id: string; start: number; end: number };
export type SchedRoom = { id: string; building: Building };
/** Minutes after midnight. `setup` is when they must be in the room. */
export type SchedWorkshop = WorkshopTime;
export type SchedRep = {
  id: string;
  /** Session ids the rep ticked free. */
  free: readonly string[];
  /** Sessions the rep's wanted chats need (sessionsForChats). */
  sessionsWanted: number;
  /**
   * Organizer override in sessions, from a "fewer chats" or "add a session"
   * fix. Set = the organizer decided, so a partial-session shortfall is no
   * longer flagged.
   */
  maxSessions?: number | null;
  /**
   * Chats the rep asked for. With it, a rep whose partial sessions hold
   * fewer chats than this gets a "partial" suggested fix.
   */
  chatsWanted?: number;
};
export type SchedSponsor = {
  id: string;
  submitted: boolean;
  workshops: readonly SchedWorkshop[];
  /**
   * Chat length (15 or 30). A session a workshop window cuts is usable in
   * whole chats of this length. Omitted: whole sessions only.
   */
  chatMinutes?: number;
  reps: readonly SchedRep[];
};

export type ChatCell = { type: "chat"; rep: string; pinned?: boolean };
export type BookingCell = { type: "booking"; ref: string; pinned: true };
export type Cell = ChatCell | BookingCell;
export type Board = Record<string, Cell>;

/** A cell that must stay where it is. */
export type Pin = { room: string; session: string } & (
  | { type: "chat"; rep: string }
  | { type: "booking"; ref: string }
);

export type Place = { rep: string; room: string; session: string };

/**
 * Why a chat on the board now breaks a rule (pins are never re-run).
 * "overCap": the rep has more sessions than they now want (e.g. changed to
 * 0 chats after Send).
 */
export type ChatProblem = "notSubmitted" | "workshop" | "notFree" | "overCap";
/**
 * Why a fix's reps couldn't be placed (text key for the "why" line), or,
 * for an "invalid" fix, what's wrong with the chat that's there.
 */
export type FixReason = "full" | "near" | "ivey" | "open" | "partial" | ChatProblem;
/**
 * "short": one rep short with a room free elsewhere; "group": several, or
 * no room; "invalid": a chat already on the board breaks a rule now.
 */
export type FixProblem = "short" | "group" | "invalid";
export type FixItem = {
  rep: string;
  /** Sessions placed and wanted. */
  got: number;
  want: number;
  /** For a "partial" fix: chats the placed sessions hold, and chats asked. */
  chats?: { got: number; want: number };
};
export type Suggestion =
  | { kind: "session"; places: Place[] }
  | { kind: "ivey"; session: string; remove: string[]; places: Place[] }
  | { kind: "fewer"; caps: { rep: string; sessions: number; want: number }[] }
  /**
   * One more session for a rep short of chats because of a partial session:
   * place them, and raise their session cap to fit it.
   */
  | { kind: "extra"; place: Place; cap: { rep: string; sessions: number } }
  /** Move the chat at cell `from` to `to`, or remove it when `to` is null. */
  | { kind: "move"; from: string; to: Place | null };
export type Fix = {
  /** Stable for one board: sponsor|session|reason. */
  id: string;
  sponsor: string;
  session: string;
  reason: FixReason;
  problem: FixProblem;
  items: FixItem[];
  suggestion: Suggestion;
};

export const cellKey = (room: string, session: string) => `${room}|${session}`;
export function parseKey(key: string): { room: string; session: string } {
  const [room = "", session = ""] = key.split("|");
  return { room, session };
}


/** Omitted chat length: only whole sessions count. */
const WHOLE_SESSION = 60;
type Timed = Pick<SchedSponsor, "workshops" | "chatMinutes">;

/** The usable part of session `s` for this sponsor, or null (blocked). */
export function windowAt(sponsor: Timed, s: SchedSession): UsableWindow | null {
  return sessionWindow(s, sponsor.workshops, sponsor.chatMinutes ?? WHOLE_SESSION);
}

/** Whole chats one rep of this sponsor fits in session `s` (0 = blocked). */
export function chatsAt(sponsor: Timed, s: SchedSession): number {
  return chatsInWindow(windowAt(sponsor, s), sponsor.chatMinutes ?? WHOLE_SESSION);
}

/**
 * Sessions a sponsor can never use: a workshop window, from (setup, or
 * start) minus 15 min to end plus 15 min, leaves no whole chat in them.
 */
export function blockedSessions(sponsor: Timed, sessions: readonly SchedSession[]): Set<string> {
  return new Set(sessions.filter((s) => !windowAt(sponsor, s)).map((s) => s.id));
}

/** Sessions a workshop window cuts but leaves usable, with the part left. */
export function partialSessions(
  sponsor: Timed,
  sessions: readonly SchedSession[],
): Map<string, UsableWindow> {
  const out = new Map<string, UsableWindow>();
  for (const s of sessions) {
    const w = windowAt(sponsor, s);
    if (w && (w.start !== s.start || w.end !== s.end)) out.set(s.id, w);
  }
  return out;
}

/**
 * Sessions a rep can be placed in: ticked free and not blocked. Full
 * sessions first, then partial ones, each in time order, so a partial
 * session is only used when the full ones run out or have no room.
 */
export function availSessions(
  sponsor: Timed,
  rep: SchedRep,
  sessions: readonly SchedSession[],
): string[] {
  const blocked = blockedSessions(sponsor, sessions);
  const partial = partialSessions(sponsor, sessions);
  const ok = sessions.filter((s) => rep.free.includes(s.id) && !blocked.has(s.id));
  return [...ok.filter((s) => !partial.has(s.id)), ...ok.filter((s) => partial.has(s.id))].map(
    (s) => s.id,
  );
}

/** The most sessions this rep may have (the cap, before availability). */
export function sessionCap(rep: SchedRep): number {
  return rep.maxSessions ?? rep.sessionsWanted;
}

/** How many sessions this rep should get: min(cap, sessions they can do). */
export function sessionsNeeded(
  sponsor: SchedSponsor,
  rep: SchedRep,
  sessions: readonly SchedSession[],
): number {
  return Math.min(
    sessionCap(rep),
    availSessions(sponsor, rep, sessions).length,
  );
}

const chatsOf = (board: Board) =>
  Object.entries(board).filter(
    (e): e is [string, ChatCell] => e[1].type === "chat",
  );

/** The cell key where this rep is in session `s`, or null. */
export function repKeyAt(board: Board, rep: string, s: string): string | null {
  for (const [k, v] of chatsOf(board)) {
    if (v.rep === rep && parseKey(k).session === s) return k;
  }
  return null;
}

/** How many sessions this rep has on the board. */
export function repCount(board: Board, rep: string): number {
  return chatsOf(board).filter(([, v]) => v.rep === rep).length;
}

/** Whole chats this rep's placed sessions hold (a partial session holds fewer). */
export function placedChats(
  sponsor: Timed,
  rep: Pick<SchedRep, "id">,
  sessions: readonly SchedSession[],
  board: Board,
): { chats: number; partial: string[] } {
  const partial = partialSessions(sponsor, sessions);
  let chats = 0;
  const cut: string[] = [];
  for (const s of sessions) {
    if (!repKeyAt(board, rep.id, s.id)) continue;
    chats += chatsAt(sponsor, s);
    if (partial.has(s.id)) cut.push(s.id);
  }
  return { chats, partial: cut };
}

/** rep id -> sponsor id. */
function sponsorIndex(sponsors: readonly SchedSponsor[]): Map<string, string> {
  return new Map(sponsors.flatMap((sp) => sp.reps.map((r) => [r.id, sp.id])));
}

type Ctx = {
  rooms: readonly SchedRoom[];
  sponsorOf: Map<string, string>;
};

/** The building this sponsor's other reps use in session s, or null. */
function teamBuilding(
  ctx: Ctx,
  board: Board,
  sponsorId: string,
  s: string,
  exceptRep: string,
): Building | null {
  for (const [k, v] of chatsOf(board)) {
    const { room, session } = parseKey(k);
    if (session !== s || v.rep === exceptRep) continue;
    if (ctx.sponsorOf.get(v.rep) !== sponsorId) continue;
    return ctx.rooms.find((r) => r.id === room)?.building ?? null;
  }
  return null;
}

/**
 * A room for this rep in session s: their team's building if a teammate is
 * already there, else near before Ivey. Keeps `prevRoom` (the rep's room the
 * hour before) when it's free. No room: `reason` is "full" (nothing free at
 * all) or the team's building that is full.
 */
function pickRoom(
  ctx: Ctx,
  board: Board,
  sponsorId: string,
  rep: string,
  s: string,
  prevRoom: string | null = null,
): { room: string } | { room: null; reason: "full" | Building } {
  const team = teamBuilding(ctx, board, sponsorId, s, rep);
  const order: Building[] = team ? [team] : ["near", "ivey"];
  for (const g of order) {
    const free = ctx.rooms.filter(
      (r) => r.building === g && !board[cellKey(r.id, s)],
    );
    if (free.length > 0) {
      return { room: (free.find((r) => r.id === prevRoom) ?? free[0]!).id };
    }
  }
  const anyFree = ctx.rooms.some((r) => !board[cellKey(r.id, s)]);
  return { room: null, reason: anyFree && team ? team : "full" };
}

/** Pins in order; a pin that would double-book a room or a rep is skipped. */
function placePins(board: Board, pins: readonly Pin[]): void {
  for (const p of pins) {
    const k = cellKey(p.room, p.session);
    if (board[k]) continue;
    if (p.type === "chat") {
      if (repKeyAt(board, p.rep, p.session)) continue;
      board[k] = { type: "chat", rep: p.rep, pinned: true };
    } else {
      board[k] = { type: "booking", ref: p.ref, pinned: true };
    }
  }
}

/**
 * Auto-schedule. Returns the whole board (pins included) and the fixes for
 * anything still short. Deterministic: same input, same board.
 */
export function schedule(
  sponsors: readonly SchedSponsor[],
  rooms: readonly SchedRoom[],
  sessions: readonly SchedSession[],
  pins: readonly Pin[],
): { board: Board; fixes: Fix[] } {
  const ctx: Ctx = { rooms, sponsorOf: sponsorIndex(sponsors) };
  const board: Board = {};
  // 1. Pinned cells first, exactly as they are.
  placePins(board, pins);

  // 2. Most constrained sponsors first (fewest available sessions over their
  //    reps); ties keep list order.
  const avail = (sp: SchedSponsor, r: SchedRep) =>
    availSessions(sp, r, sessions).length;
  const order = sponsors
    .filter((sp) => sp.submitted)
    .map((sp, i) => ({
      sp,
      i,
      n: sp.reps.reduce((sum, r) => sum + avail(sp, r), 0),
    }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .map((x) => x.sp);

  for (const sp of order) {
    // 3. Inside a sponsor, the rep with the fewest available sessions first.
    const reps = sp.reps
      .map((r, i) => ({ r, i, n: avail(sp, r) }))
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .map((x) => x.r);
    for (const rep of reps) {
      // 4. min(sessions wanted, available sessions), minus what's pinned.
      let left = sessionsNeeded(sp, rep, sessions) - repCount(board, rep.id);
      for (const s of availSessions(sp, rep, sessions)) {
        if (left <= 0) break;
        if (repKeyAt(board, rep.id, s)) continue;
        const i = sessions.findIndex((x) => x.id === s);
        const prevKey = i > 0 ? repKeyAt(board, rep.id, sessions[i - 1]!.id) : null;
        const pick = pickRoom(
          ctx,
          board,
          sp.id,
          rep.id,
          s,
          prevKey ? parseKey(prevKey).room : null,
        );
        // 5. No room in the right building: try their next session.
        if (!pick.room) continue;
        board[cellKey(pick.room, s)] = { type: "chat", rep: rep.id };
        left--;
      }
    }
  }
  // 6. Whatever is still short becomes a suggested fix.
  return { board, fixes: findFixes(sponsors, rooms, sessions, board) };
}

/**
 * Chats on the board that break a rule now: the sponsor unsubmitted, the
 * session is in their workshop window (the run of show changed), or the rep
 * unticked it. Pinned, sent and moved chats are never re-run by the
 * scheduler, so these have to be checked. Only reps of `sponsors` count.
 */
export function invalidChats(
  sponsors: readonly SchedSponsor[],
  sessions: readonly SchedSession[],
  board: Board,
): { key: string; rep: string; sponsor: string; session: string; pinned: boolean; problem: ChatProblem }[] {
  const out: ReturnType<typeof invalidChats> = [];
  const at = (key: string) => sessions.findIndex((x) => x.id === parseKey(key).session);
  // Valid chats so far per rep; past their cap the later ones are "overCap".
  const kept = new Map<string, number>();
  // Time order, so the chats over a rep's cap are their latest ones.
  const chats = chatsOf(board).sort(([a], [b]) => at(a) - at(b));
  for (const [key, v] of chats) {
    const sp = sponsors.find((x) => x.reps.some((r) => r.id === v.rep));
    const rep = sp?.reps.find((r) => r.id === v.rep);
    if (!sp || !rep) continue;
    const { session } = parseKey(key);
    let problem: ChatProblem | null = !sp.submitted
      ? "notSubmitted"
      : blockedSessions(sp, sessions).has(session)
        ? "workshop"
        : !rep.free.includes(session)
          ? "notFree"
          : null;
    if (!problem) {
      const n = (kept.get(rep.id) ?? 0) + 1;
      kept.set(rep.id, n);
      if (n > sessionCap(rep)) problem = "overCap";
    }
    if (problem) {
      out.push({ key, rep: rep.id, sponsor: sp.id, session, pinned: !!v.pinned, problem });
    }
  }
  return out;
}

/** The board without the given cells. */
export function withoutCells(board: Board, keys: Iterable<string>): Board {
  const out: Board = { ...board };
  for (const k of keys) delete out[k];
  return out;
}

/**
 * Every suggested fix for a board: first a "move or remove" fix for each
 * chat that breaks a rule now (invalidChats), then findFixes for reps that
 * are short.
 */
export function boardFixes(
  sponsors: readonly SchedSponsor[],
  rooms: readonly SchedRoom[],
  sessions: readonly SchedSession[],
  board: Board,
): Fix[] {
  const ctx: Ctx = { rooms, sponsorOf: sponsorIndex(sponsors) };
  const invalid = invalidChats(sponsors, sessions, board);
  // Cells already suggested to an earlier fix count as taken.
  const taken: Board = { ...board };
  const fixes: Fix[] = [];
  for (const bad of invalid) {
    const clean = withoutCells(taken, [bad.key]);
    const sp = sponsors.find((x) => x.id === bad.sponsor)!;
    const rep = sp.reps.find((r) => r.id === bad.rep)!;
    let to: Place | null = null;
    // Not submitted or one too many: the suggestion is to remove it.
    if (bad.problem !== "notSubmitted" && bad.problem !== "overCap") {
      for (const s of availSessions(sp, rep, sessions)) {
        if (repKeyAt(clean, rep.id, s)) continue;
        const pick = pickRoom(ctx, clean, sp.id, rep.id, s);
        if (!pick.room) continue;
        to = { rep: rep.id, room: pick.room, session: s };
        taken[cellKey(pick.room, s)] = { type: "chat", rep: rep.id, pinned: true };
        break;
      }
    }
    fixes.push({
      id: `${sp.id}|${bad.key}|${bad.problem}`,
      sponsor: sp.id,
      session: bad.session,
      reason: bad.problem,
      problem: "invalid",
      items: [{ rep: rep.id, got: repCount(board, rep.id), want: sessionsNeeded(sp, rep, sessions) }],
      suggestion: { kind: "move", from: bad.key, to },
    });
  }
  return [...fixes, ...findFixes(sponsors, rooms, sessions, board)];
}

/**
 * Suggested fixes for any board (after auto-schedule or after hand edits):
 * one per sponsor + first session that failed + reason.
 */
export function findFixes(
  sponsors: readonly SchedSponsor[],
  rooms: readonly SchedRoom[],
  sessions: readonly SchedSession[],
  board: Board,
): Fix[] {
  const ctx: Ctx = { rooms, sponsorOf: sponsorIndex(sponsors) };
  const fixes: Fix[] = [];
  for (const sp of sponsors.filter((x) => x.submitted)) {
    const groups = new Map<
      string,
      { s: string; reason: FixReason; items: FixItem[] }
    >();
    for (const rep of sp.reps) {
      const want = sessionsNeeded(sp, rep, sessions);
      const got = repCount(board, rep.id);
      if (got >= want) {
        const short = partialShortfall(ctx, sp, rep, sessions, board, got);
        if (short) fixes.push(short);
        continue;
      }
      const tries = availSessions(sp, rep, sessions).filter(
        (s) => !repKeyAt(board, rep.id, s),
      );
      const open = tries.find(
        (s) => pickRoom(ctx, board, sp.id, rep.id, s).room,
      );
      const s = open ?? tries[0];
      if (s === undefined) continue; // can't happen: want <= available
      let reason: FixReason = "open";
      if (!open) {
        const pick = pickRoom(ctx, board, sp.id, rep.id, s);
        reason = "reason" in pick ? pick.reason : "open";
      }
      const g = `${s}|${reason}`;
      if (!groups.has(g)) groups.set(g, { s, reason, items: [] });
      groups.get(g)!.items.push({ rep: rep.id, got, want });
    }
    for (const { s, reason, items } of groups.values()) {
      fixes.push({
        id: `${sp.id}|${s}|${reason}`,
        sponsor: sp.id,
        session: s,
        reason,
        problem: reason === "open" && items.length === 1 ? "short" : "group",
        items,
        suggestion: suggest(ctx, sp, sessions, board, s, items),
      });
    }
  }
  return fixes;
}

/**
 * A rep with all their sessions placed, but a partial session leaves them
 * short of the chats they asked for: "add a session" when a free session
 * with a room is left, else "fewer chats" (keeps what they have). Skipped
 * once an organizer set the rep's cap (maxSessions), or with no chatsWanted.
 */
function partialShortfall(
  ctx: Ctx,
  sp: SchedSponsor,
  rep: SchedRep,
  sessions: readonly SchedSession[],
  board: Board,
  got: number,
): Fix | null {
  if (rep.chatsWanted === undefined || rep.maxSessions != null) return null;
  const placed = placedChats(sp, rep, sessions, board);
  if (placed.partial.length === 0 || placed.chats >= rep.chatsWanted) return null;
  const session = placed.partial[0]!;
  const item: FixItem = {
    rep: rep.id,
    got,
    want: got,
    chats: { got: placed.chats, want: rep.chatsWanted },
  };
  let suggestion: Suggestion = { kind: "fewer", caps: [{ rep: rep.id, sessions: got, want: got }] };
  for (const s of availSessions(sp, rep, sessions)) {
    if (repKeyAt(board, rep.id, s)) continue;
    const pick = pickRoom(ctx, board, sp.id, rep.id, s);
    if (!pick.room) continue;
    suggestion = {
      kind: "extra",
      place: { rep: rep.id, room: pick.room, session: s },
      cap: { rep: rep.id, sessions: got + 1 },
    };
    break;
  }
  return {
    id: `${sp.id}|${rep.id}|partial`,
    sponsor: sp.id,
    session,
    reason: "partial",
    problem: "short",
    items: [item],
    suggestion,
  };
}

/**
 * The first alternative that works: (a) another available session for each
 * short rep; (b) all of the sponsor's reps in that session (and the short
 * ones) to Ivey together, unless any is pinned or they're already in Ivey;
 * (c) fewer chats. Never suggests a blocked session.
 */
function suggest(
  ctx: Ctx,
  sp: SchedSponsor,
  sessions: readonly SchedSession[],
  board: Board,
  s: string,
  items: FixItem[],
): Suggestion {
  const blocked = blockedSessions(sp, sessions);
  // (a) another available session
  const copy: Board = { ...board };
  const places: Place[] = [];
  for (const it of items) {
    const rep = sp.reps.find((r) => r.id === it.rep);
    if (!rep) break;
    const s2 = availSessions(sp, rep, sessions).find(
      (x) =>
        !blocked.has(x) &&
        !repKeyAt(copy, rep.id, x) &&
        pickRoom(ctx, copy, sp.id, rep.id, x).room,
    );
    if (!s2) break;
    const pick = pickRoom(ctx, copy, sp.id, rep.id, s2);
    if (!pick.room) break;
    copy[cellKey(pick.room, s2)] = { type: "chat", rep: rep.id, pinned: true };
    places.push({ rep: rep.id, room: pick.room, session: s2 });
  }
  if (places.length === items.length) return { kind: "session", places };

  // (b) everyone from this sponsor at s to Ivey together
  if (!blocked.has(s)) {
    const here = chatsOf(board).filter(
      ([k, v]) =>
        parseKey(k).session === s && ctx.sponsorOf.get(v.rep) === sp.id,
    );
    if (here.every(([, v]) => !v.pinned)) {
      const movers = [...here.map(([, v]) => v.rep), ...items.map((i) => i.rep)];
      const without: Board = { ...board };
      for (const [k] of here) delete without[k];
      const free = ctx.rooms.filter(
        (r) => r.building === "ivey" && !without[cellKey(r.id, s)],
      );
      const alreadyIvey =
        here.length > 0 &&
        here.every(
          ([k]) =>
            ctx.rooms.find((r) => r.id === parseKey(k).room)?.building ===
            "ivey",
        );
      if (free.length >= movers.length && !alreadyIvey) {
        return {
          kind: "ivey",
          session: s,
          remove: here.map(([k]) => k),
          places: movers.map((rep, j) => ({ rep, room: free[j]!.id, session: s })),
        };
      }
    }
  }
  // (c) fewer chats: cap each short rep at the sessions they have now
  return {
    kind: "fewer",
    caps: items.map((i) => ({ rep: i.rep, sessions: i.got, want: i.want })),
  };
}

/**
 * Apply a suggestion to a board. Returns the new board and rep session caps.
 * Throws if a placement is in a blocked session or would double-book a
 * room or a rep.
 */
export function applySuggestion(
  sponsors: readonly SchedSponsor[],
  sessions: readonly SchedSession[],
  board: Board,
  maxSessions: Readonly<Record<string, number>>,
  sug: Suggestion,
): { board: Board; maxSessions: Record<string, number> } {
  const out: Board = { ...board };
  const caps = { ...maxSessions };
  const sponsorOf = sponsorIndex(sponsors);
  if (sug.kind === "fewer") {
    for (const c of sug.caps) caps[c.rep] = c.sessions;
    return { board: out, maxSessions: caps };
  }
  if (sug.kind === "extra") {
    caps[sug.cap.rep] = sug.cap.sessions;
    sug = { kind: "session", places: [sug.place] };
  }
  if (sug.kind === "move") {
    const from = out[sug.from];
    if (from?.type !== "chat") throw new Error(`fix moves an empty cell ${sug.from}`);
    delete out[sug.from];
    if (!sug.to) return { board: out, maxSessions: caps };
    sug = { kind: "session", places: [sug.to] };
  }
  for (const p of sug.places) {
    const sp = sponsors.find((x) => x.id === sponsorOf.get(p.rep));
    if (!sp || blockedSessions(sp, sessions).has(p.session)) {
      throw new Error(`fix uses a blocked session: ${p.rep} at ${p.session}`);
    }
  }
  if (sug.kind === "ivey") for (const k of sug.remove) delete out[k];
  for (const p of sug.places) {
    const k = cellKey(p.room, p.session);
    if (out[k]) throw new Error(`fix double-books ${p.room} at ${p.session}`);
    if (repKeyAt(out, p.rep, p.session)) {
      throw new Error(`fix puts ${p.rep} in two places at ${p.session}`);
    }
    out[k] = { type: "chat", rep: p.rep, pinned: true };
  }
  return { board: out, maxSessions: caps };
}

/**
 * The invariants as a list of problems (empty = valid): known rooms and
 * sessions, only submitted sponsors, only free and unblocked sessions, one
 * place per rep per session, within each rep's cap, and one building per
 * sponsor per session for auto placements.
 */
export function checkBoard(
  sponsors: readonly SchedSponsor[],
  rooms: readonly SchedRoom[],
  sessions: readonly SchedSession[],
  board: Board,
): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  const sponsorOf = sponsorIndex(sponsors);
  const spById = new Map(sponsors.map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(board)) {
    const { room, session } = parseKey(k);
    if (!rooms.some((r) => r.id === room) || !sessions.some((x) => x.id === session)) {
      bad.push(`bad cell ${k}`);
    }
    if (v.type !== "chat") continue;
    const sp = spById.get(sponsorOf.get(v.rep) ?? "");
    const rep = sp?.reps.find((r) => r.id === v.rep);
    if (!sp || !rep) {
      bad.push(`unknown rep ${v.rep}`);
      continue;
    }
    if (!sp.submitted) bad.push(`${sp.id} not submitted but placed`);
    if (!rep.free.includes(session)) bad.push(`${rep.id} at ${session} but not free`);
    if (blockedSessions(sp, sessions).has(session)) {
      bad.push(`${rep.id} at ${session} during ${sp.id}'s workshop window`);
    }
    if (seen.has(`${v.rep}|${session}`)) bad.push(`${rep.id} in two rooms at ${session}`);
    seen.add(`${v.rep}|${session}`);
  }
  for (const sp of sponsors) {
    for (const rep of sp.reps) {
      const n = repCount(board, rep.id);
      const cap = sessionCap(rep);
      if (n > cap) bad.push(`${rep.id} has ${n} > ${cap} sessions`);
    }
    for (const s of sessions) {
      const buildings = new Set(
        chatsOf(board)
          .filter(
            ([k, v]) =>
              !v.pinned &&
              parseKey(k).session === s.id &&
              sponsorOf.get(v.rep) === sp.id,
          )
          .map(([k]) => rooms.find((r) => r.id === parseKey(k).room)?.building),
      );
      if (buildings.size > 1) bad.push(`${sp.id} split across buildings at ${s.id}`);
    }
  }
  return bad;
}

/**
 * Reps fully scheduled out of reps that need scheduling (for the status
 * chip, "Needs scheduling · 1 of 3").
 */
export function repTally(
  sponsor: SchedSponsor,
  sessions: readonly SchedSession[],
  board: Board,
): { done: number; total: number } {
  const need = sponsor.reps.filter((r) => sessionsNeeded(sponsor, r, sessions) > 0);
  const done = need.filter(
    (r) => repCount(board, r.id) >= sessionsNeeded(sponsor, r, sessions),
  );
  return { done: done.length, total: need.length };
}

/**
 * A sponsor's workshop windows from run-of-show items (their Saturday
 * "Sponsor Workshop" column blocks, setup blocks included). Each item is
 * its own window; blockedSessions unions them.
 */
export function workshopWindows(
  items: readonly {
    day: string;
    column: string;
    start: string;
    end: string;
    sponsors: readonly string[];
  }[],
  sponsorName: string,
): SchedWorkshop[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return items
    .filter(
      (i) =>
        i.day === "Saturday" &&
        i.column === "sponsor-workshop" &&
        i.sponsors.includes(sponsorName),
    )
    .map((i) => ({ start: toMin(i.start), end: toMin(i.end) }))
    .sort((a, b) => a.start - b.start);
}
