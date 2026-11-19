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
 * - a rep gets min(hours per rep, sessions they can do); 4 = 4+ = no cap;
 * - only sessions the rep ticked free and that don't overlap their own
 *   sponsor's workshop, counted from 15 min before setup (or start) to 15 min
 *   after the end;
 * - pinned cells (organizer bookings, manual moves, applied fixes, sent
 *   chats) stay exactly where they are and count toward a rep's hours;
 * - most-constrained sponsors first, then the most-constrained rep;
 * - near rooms (2241-2243) before Ivey, and a sponsor's reps in the same
 *   session stay in one building;
 * - never two things in one room, never one rep in two places;
 * - anything short becomes a suggested fix.
 */
import { WORKSHOP_BUFFER_MIN, type Building } from "~/lib/coffee-chat-sessions";

export type SchedSession = { id: string; start: number; end: number };
export type SchedRoom = { id: string; building: Building };
/** Minutes after midnight. `setup` is when they must be in the room. */
export type SchedWorkshop = {
  setup?: number | null;
  start: number;
  end: number;
};
export type SchedRep = {
  id: string;
  /** Session ids the rep ticked free. */
  free: readonly string[];
  /** Organizer override from a "fewer hours" fix. */
  maxHours?: number | null;
};
export type SchedSponsor = {
  id: string;
  submitted: boolean;
  /** 1-4; 4 means 4+ (no cap). */
  hoursPerRep: number;
  workshops: readonly SchedWorkshop[];
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

/** Why a fix's reps couldn't be placed (text key for the "why" line). */
export type FixReason = "full" | "near" | "ivey" | "open";
/** "short": one rep short with a room free elsewhere; else "group". */
export type FixProblem = "short" | "group";
export type FixItem = { rep: string; got: number; want: number };
export type Suggestion =
  | { kind: "session"; places: Place[] }
  | { kind: "ivey"; session: string; remove: string[]; places: Place[] }
  | { kind: "fewer"; hours: { rep: string; hours: number; want: number }[] };
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

const NO_CAP = Number.POSITIVE_INFINITY;

/**
 * Sessions a sponsor can never use: any that overlap one of their workshop
 * windows, from (setup, or start) minus 15 min to end plus 15 min.
 */
export function blockedSessions(
  sponsor: Pick<SchedSponsor, "workshops">,
  sessions: readonly SchedSession[],
): Set<string> {
  const out = new Set<string>();
  for (const w of sponsor.workshops) {
    const from = (w.setup ?? w.start) - WORKSHOP_BUFFER_MIN;
    const to = w.end + WORKSHOP_BUFFER_MIN;
    for (const s of sessions) if (s.start < to && from < s.end) out.add(s.id);
  }
  return out;
}

/** Sessions a rep can be placed in: ticked free and not blocked. Time order. */
export function availSessions(
  sponsor: Pick<SchedSponsor, "workshops">,
  rep: SchedRep,
  sessions: readonly SchedSession[],
): string[] {
  const blocked = blockedSessions(sponsor, sessions);
  return sessions
    .filter((s) => rep.free.includes(s.id) && !blocked.has(s.id))
    .map((s) => s.id);
}

/** The most sessions this rep may have (the cap, before availability). */
export function hourCap(sponsor: SchedSponsor, rep: SchedRep): number {
  if (rep.maxHours != null) return rep.maxHours;
  return sponsor.hoursPerRep >= 4 ? NO_CAP : sponsor.hoursPerRep;
}

/** How many sessions this rep should get: min(cap, sessions they can do). */
export function hoursNeeded(
  sponsor: SchedSponsor,
  rep: SchedRep,
  sessions: readonly SchedSession[],
): number {
  return Math.min(
    hourCap(sponsor, rep),
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
      // 4. min(hours per rep, available sessions), minus what's pinned.
      let left = hoursNeeded(sp, rep, sessions) - repCount(board, rep.id);
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
      const want = hoursNeeded(sp, rep, sessions);
      const got = repCount(board, rep.id);
      if (got >= want) continue;
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
 * The first alternative that works: (a) another available session for each
 * short rep; (b) all of the sponsor's reps in that session (and the short
 * ones) to Ivey together, unless any is pinned or they're already in Ivey;
 * (c) fewer hours. Never suggests a blocked session.
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
  // (c) fewer hours: cap each short rep at what they have now
  return {
    kind: "fewer",
    hours: items.map((i) => ({ rep: i.rep, hours: i.got, want: i.want })),
  };
}

/**
 * Apply a suggestion to a board. Returns the new board and rep hour caps.
 * Throws if a placement is in a blocked session or would double-book a
 * room or a rep.
 */
export function applySuggestion(
  sponsors: readonly SchedSponsor[],
  sessions: readonly SchedSession[],
  board: Board,
  maxHours: Readonly<Record<string, number>>,
  sug: Suggestion,
): { board: Board; maxHours: Record<string, number> } {
  const out: Board = { ...board };
  const caps = { ...maxHours };
  const sponsorOf = sponsorIndex(sponsors);
  if (sug.kind === "fewer") {
    for (const h of sug.hours) caps[h.rep] = h.hours;
    return { board: out, maxHours: caps };
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
  return { board: out, maxHours: caps };
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
      const cap = hourCap(sp, rep);
      if (n > cap) bad.push(`${rep.id} has ${n} > ${cap} hours`);
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
  const need = sponsor.reps.filter((r) => hoursNeeded(sponsor, r, sessions) > 0);
  const done = need.filter(
    (r) => repCount(board, r.id) >= hoursNeeded(sponsor, r, sessions),
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
