/**
 * Sunday sponsor presentations (docs/flows/sponsor-judging.md): every team
 * on a sponsor's sent shortlist gets one slot in that sponsor's room, and a
 * team's own slots never overlap. Pure and dependency-free, so it's unit
 * tested and shared by the server and the organizer, sponsor and hacker
 * views.
 *
 * Times are minutes after midnight on judging day, Eastern (the event's
 * clock): 600 = 10:00 AM.
 */

/** First slot starts at 10:00. */
export const PRESENTATION_WINDOW_START = 10 * 60;
/**
 * Last slot ends by 11:48: 18 slots per room (Jazz, 2026-11-20: "Can we
 * do 18 presentations"), so the last one starts at 11:42.
 */
export const PRESENTATION_WINDOW_END = 11 * 60 + 48;
/**
 * One slot: 3 min pitch, 2 min Q&A, 1 min to switch teams (Jazz,
 * 2026-11-19); 18 slots fill 10:00-11:48.
 */
export const PRESENTATION_SLOT_MINUTES = 6;
export const PRESENTATION_PITCH_MINUTES = 3;
export const PRESENTATION_QA_MINUTES = 2;
/**
 * A team's next presentation starts at least this long after its previous
 * one started: 6 minutes in the slot, 4 minutes to walk to the next room.
 */
export const PRESENTATION_MIN_GAP_MINUTES = 10;

export type PresentationWindow = {
  start: number;
  end: number;
  slotMinutes: number;
  minGapMinutes: number;
};

export const PRESENTATION_WINDOW: PresentationWindow = {
  start: PRESENTATION_WINDOW_START,
  end: PRESENTATION_WINDOW_END,
  slotMinutes: PRESENTATION_SLOT_MINUTES,
  minGapMinutes: PRESENTATION_MIN_GAP_MINUTES,
};

/** Slots one room has in the window (18 for 10:00-11:48 at 6 minutes). */
export function slotsPerRoom(window: PresentationWindow = PRESENTATION_WINDOW) {
  return Math.max(
    0,
    Math.floor((window.end - window.start) / window.slotMinutes),
  );
}

export const PRESENTATION_SLOTS_PER_ROOM = slotsPerRoom();

/**
 * Most teams a sponsor can send for round 1: one per slot in their room
 * (18). sponsorScoring.sendShortlist refuses more.
 */
export const SHORTLIST_MAX = PRESENTATION_SLOTS_PER_ROOM;

/**
 * Slots a room may run past the window's end, so every shortlisted team
 * gets a time even when gaps don't fit them by 11:48 (Jazz, 2026-11-20:
 * "I want to be able to see everything"). In-window slots always fill
 * first; the board marks the rest as running past the end.
 */
export const PRESENTATION_OVERFLOW_SLOTS = SHORTLIST_MAX;

/** A slot that ends after the window: shown as running past the end. */
export const runsPastEnd = (
  start: number,
  window: PresentationWindow = PRESENTATION_WINDOW,
) => start + window.slotMinutes > window.end;

export type PresentationRequest = {
  sponsorId: string;
  /** The sponsor's judging room; null or blank = none known. */
  room: string | null;
  /** The sponsor's sent shortlist. */
  teamIds: readonly string[];
};

export type PresentationSlot = {
  sponsorId: string;
  teamId: string;
  /**
   * The sponsor's room; null until organizers type one. Times don't need
   * it: each sponsor has its own column of slots (Jazz, 2026-11-20).
   */
  room: string | null;
  /** Minutes after midnight. */
  start: number;
};

export type PresentationSchedule = {
  /** By start time, then sponsor. */
  slots: PresentationSlot[];
  /** Shortlisted teams that couldn't get a slot with that sponsor. */
  unplaced: { sponsorId: string; teamId: string }[];
  /**
   * Teams past the first SHORTLIST_MAX of a sponsor's shortlist (in
   * shortlist order): never scheduled. Only an old send can have them.
   */
  overCap: { sponsorId: string; teamIds: string[] }[];
};

/** Cap on backtracking steps per team, so a hopeless team can't hang it. */
export const SEARCH_LIMIT = 50_000;

/** sponsor_presentation.room is varchar(64). */
export const PRESENTATION_ROOM_MAX = 64;

/** A sheet room as stored: trimmed, spaces collapsed, at most 64 chars. */
export function normalizeRoom(room: string | null | undefined) {
  const clean = (room ?? "").trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, PRESENTATION_ROOM_MAX).trimEnd() : null;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Build the presentation schedule. Each (sponsor, shortlisted team) pair
 * gets one slot in the sponsor's room; each of a team's slots starts at
 * least `minGapMinutes` after its previous one. Teams on the most
 * shortlists are placed first; each team's slots are found by
 * backtracking over the free slots, and a team that's still stuck is
 * fitted by moving already placed teams to other slots in the same room
 * (augmenting paths). A sponsor gets at most `maxPerSponsor`
 * (SHORTLIST_MAX) teams: the first ones in shortlist order; the rest are
 * returned in `overCap`. Anything that can't fit is returned in
 * `unplaced`; nothing is dropped. A sponsor without a room still gets its
 * times (room null): each sponsor has one room, so its slots are a column
 * of its own, and typing the room later just labels them (Jazz,
 * 2026-11-20). The same input always gives the same schedule.
 *
 * `keep` is the schedule teams were already given: each (sponsor, team)
 * still wanted keeps its start time (in the sponsor's current room), and is
 * never moved to fit someone else. So a room change or a late shortlist
 * never moves a time that's already set (Jazz, judging board v2).
 * `notBefore` (minutes) closes earlier slots to anything not kept, so a
 * team added on judging day never gets a slot that already passed.
 */
export function schedulePresentations(
  requests: readonly PresentationRequest[],
  window: PresentationWindow = PRESENTATION_WINDOW,
  {
    searchLimit = SEARCH_LIMIT,
    maxPerSponsor = SHORTLIST_MAX,
    overflowSlots = PRESENTATION_OVERFLOW_SLOTS,
    keep = [],
    notBefore = -Infinity,
  }: {
    searchLimit?: number;
    /** Extra slots after the window's end, used only when needed. */
    overflowSlots?: number;
    maxPerSponsor?: number;
    keep?: readonly { sponsorId: string; teamId: string; start: number }[];
    notBefore?: number;
  } = {},
): PresentationSchedule {
  // Earliest slots are tried first, so overflow is used only when needed.
  const slotCount = slotsPerRoom(window) + Math.max(0, overflowSlots);
  const startOf = (i: number) => window.start + i * window.slotMinutes;

  // Normalise: one entry per sponsor, unique sorted team ids.
  const sponsors = new Map<
    string,
    { room: string | null; teams: Set<string> }
  >();
  for (const r of requests) {
    const room = r.room?.trim() ? r.room.trim() : null;
    const entry = sponsors.get(r.sponsorId) ?? { room, teams: new Set() };
    entry.room ??= room;
    for (const id of r.teamIds) entry.teams.add(id);
    sponsors.set(r.sponsorId, entry);
  }
  const sponsorIds = [...sponsors.keys()].sort(byText);

  const overCap: PresentationSchedule["overCap"] = [];
  const grids = new Map<string, (string | null)[]>();
  const demand = new Map<string, number>();
  const wanted = new Map<string, string[]>();
  for (const sponsorId of sponsorIds) {
    const s = sponsors.get(sponsorId)!;
    // The first maxPerSponsor in shortlist order (Set keeps send order).
    const inOrder = [...s.teams];
    if (inOrder.length > maxPerSponsor) {
      overCap.push({ sponsorId, teamIds: inOrder.slice(maxPerSponsor) });
    }
    const teams = inOrder.slice(0, maxPerSponsor).sort(byText);
    grids.set(sponsorId, Array<string | null>(slotCount).fill(null));
    demand.set(sponsorId, teams.length);
    for (const teamId of teams) {
      const list = wanted.get(teamId) ?? [];
      list.push(sponsorId);
      wanted.set(teamId, list);
    }
  }

  // teamId -> sponsorId -> slot index
  const placed = new Map<string, Map<string, number>>();
  const slotsOf = (teamId: string) => {
    let m = placed.get(teamId);
    if (!m) {
      m = new Map();
      placed.set(teamId, m);
    }
    return m;
  };
  /** A slot new placements may use (kept times may be earlier). */
  const open = (index: number) => startOf(index) >= notBefore;
  const fits = (teamId: string, index: number, except?: string) => {
    for (const [sponsorId, other] of slotsOf(teamId)) {
      if (sponsorId === except) continue;
      if (Math.abs(startOf(index) - startOf(other)) < window.minGapMinutes) {
        return false;
      }
    }
    return true;
  };
  const assign = (sponsorId: string, teamId: string, index: number) => {
    grids.get(sponsorId)![index] = teamId;
    slotsOf(teamId).set(sponsorId, index);
  };
  const release = (sponsorId: string, teamId: string) => {
    const index = slotsOf(teamId).get(sponsorId);
    if (index === undefined) return;
    grids.get(sponsorId)![index] = null;
    slotsOf(teamId).delete(sponsorId);
  };

  // Times already given stay: pin each one that still fits.
  const pinned = new Set<string>();
  const pinKey = (sponsorId: string, teamId: string) =>
    `${sponsorId}|${teamId}`;
  const keptInOrder = [...keep].sort(
    (a, b) =>
      a.start - b.start ||
      byText(a.sponsorId, b.sponsorId) ||
      byText(a.teamId, b.teamId),
  );
  for (const k of keptInOrder) {
    const grid = grids.get(k.sponsorId);
    const index = (k.start - window.start) / window.slotMinutes;
    if (
      !grid ||
      !wanted.get(k.teamId)?.includes(k.sponsorId) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= slotCount ||
      grid[index] !== null ||
      slotsOf(k.teamId).has(k.sponsorId) ||
      !fits(k.teamId, index)
    ) {
      continue;
    }
    assign(k.sponsorId, k.teamId, index);
    pinned.add(pinKey(k.sponsorId, k.teamId));
  }

  // Most-constrained teams first: most shortlists, then id.
  const teamOrder = [...wanted.keys()].sort(
    (a, b) => wanted.get(b)!.length - wanted.get(a)!.length || byText(a, b),
  );

  const stuck: { sponsorId: string; teamId: string }[] = [];
  for (const teamId of teamOrder) {
    // Busiest rooms first: they have the fewest free slots to choose from.
    const list = wanted
      .get(teamId)!
      .filter((sponsorId) => !slotsOf(teamId).has(sponsorId))
      .sort((a, b) => demand.get(b)! - demand.get(a)! || byText(a, b));
    if (list.length === 0) continue;
    const best = searchTeam(teamId, list);
    for (const [sponsorId, index] of best) assign(sponsorId, teamId, index);
    for (const sponsorId of list) {
      if (!best.has(sponsorId)) stuck.push({ sponsorId, teamId });
    }
  }

  /**
   * The team's best placement in free slots: every sponsor if possible,
   * otherwise as many as fit (earliest slots first on ties). Depth-first,
   * trying each free slot that keeps the team's gaps, then skipping.
   */
  function searchTeam(teamId: string, list: string[]) {
    let best = new Map<string, number>();
    const chosen = new Map<string, number>();
    let steps = 0;
    // The team's pinned slots count for its gaps too.
    const gapOk = (index: number) => {
      for (const other of [...chosen.values(), ...slotsOf(teamId).values()]) {
        if (Math.abs(startOf(index) - startOf(other)) < window.minGapMinutes) {
          return false;
        }
      }
      return true;
    };
    const walk = (k: number): boolean => {
      if (++steps > searchLimit) return true;
      if (chosen.size + (list.length - k) <= best.size) return false;
      if (k === list.length) {
        best = new Map(chosen);
        return best.size === list.length;
      }
      const sponsorId = list[k]!;
      const grid = grids.get(sponsorId)!;
      for (let i = 0; i < slotCount; i++) {
        if (grid[i] !== null || !open(i) || !gapOk(i)) continue;
        chosen.set(sponsorId, i);
        if (walk(k + 1)) return true;
        chosen.delete(sponsorId);
      }
      return walk(k + 1);
    };
    walk(0);
    return best;
  }

  /**
   * Find `teamId` a slot in `sponsorId`'s room, moving teams already there
   * to other slots in the same room when that frees one up. Each moved team
   * keeps its own gaps. Kuhn's augmenting path, slots visited once.
   */
  function augment(sponsorId: string, teamId: string, seen: Set<number>) {
    const grid = grids.get(sponsorId)!;
    for (let i = 0; i < slotCount; i++) {
      if (seen.has(i) || !open(i) || !fits(teamId, i, sponsorId)) continue;
      seen.add(i);
      const occupant = grid[i];
      if (occupant === null || occupant === undefined) {
        assign(sponsorId, teamId, i);
        return true;
      }
      // A time already given never moves.
      if (pinned.has(pinKey(sponsorId, occupant))) continue;
      release(sponsorId, occupant);
      if (augment(sponsorId, occupant, seen)) {
        assign(sponsorId, teamId, i);
        return true;
      }
      assign(sponsorId, occupant, i);
    }
    return false;
  }

  const unplaced: PresentationSchedule["unplaced"] = [];
  for (const item of stuck) {
    if (!augment(item.sponsorId, item.teamId, new Set())) unplaced.push(item);
  }
  unplaced.sort(
    (a, b) => byText(a.sponsorId, b.sponsorId) || byText(a.teamId, b.teamId),
  );

  const slots: PresentationSlot[] = [];
  for (const [sponsorId, grid] of grids) {
    const room = sponsors.get(sponsorId)!.room;
    grid.forEach((teamId, i) => {
      if (teamId !== null)
        slots.push({ sponsorId, teamId, room, start: startOf(i) });
    });
  }
  slots.sort((a, b) => a.start - b.start || byText(a.sponsorId, b.sponsorId));

  return { slots, unplaced, overCap };
}

/**
 * Pairs of a team's slots that start too close together (should be empty
 * for any schedule built above). Used by tests and as a server-side guard.
 */
export function gapViolations(
  slots: readonly PresentationSlot[],
  minGapMinutes = PRESENTATION_MIN_GAP_MINUTES,
) {
  const byTeam = new Map<string, number[]>();
  for (const s of slots) {
    const list = byTeam.get(s.teamId) ?? [];
    list.push(s.start);
    byTeam.set(s.teamId, list);
  }
  const bad: { teamId: string; starts: [number, number] }[] = [];
  for (const [teamId, starts] of byTeam) {
    const sorted = [...starts].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]! - sorted[i - 1]! < minGapMinutes) {
        bad.push({ teamId, starts: [sorted[i - 1]!, sorted[i]!] });
      }
    }
  }
  return bad;
}

/** A sponsor's (or a team's) slots grouped, each group by start time. */
export function groupSlots<K extends "sponsorId" | "teamId">(
  slots: readonly PresentationSlot[],
  key: K,
): { key: string; slots: PresentationSlot[] }[] {
  const groups = new Map<string, PresentationSlot[]>();
  for (const s of slots) {
    const list = groups.get(s[key]) ?? [];
    list.push(s);
    groups.set(s[key], list);
  }
  return [...groups.entries()].map(([k, list]) => ({
    key: k,
    slots: [...list].sort((a, b) => a.start - b.start),
  }));
}

/** "10:05 AM" from minutes after midnight. */
export function formatPresentationTime(minutes: number) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export type JudgingRound = "shortlist" | "sent" | "locked" | "rank";

/**
 * Where one sponsor is in Sunday judging. Round 2 starts only once
 * organizers open it (`round2Open`, after presentations): then "rank" (they
 * have at least one placed slot: rank the teams that presented) or
 * "locked" (a schedule exists but has no slot for them: sent late, no
 * room, or none of their teams fit). A sponsor with no slot can't rank in
 * round 2 (Jazz, 2026-11-18); sponsorScoring.submit refuses them too.
 * Before that, "sent" (shortlist sent, waiting for round 2) or "shortlist"
 * (round 1, nothing sent). No top list can be submitted until round 2 is
 * open. For the picks page; takes sponsorScoring.get's `round`.
 */
export function judgingRound(round: {
  shortlistSent: unknown;
  scheduledAt: Date | string | null;
  slots: readonly unknown[];
  round2Open: boolean;
  /**
   * The sponsor judges online (a remote sponsor, REMOTE_JUDGING_SPONSORS):
   * their teams don't present, so they rank their sent shortlist in round
   * 2 (Jazz, 2026-11-19).
   */
  remote?: boolean;
}): JudgingRound {
  if (round.round2Open) {
    if (round.slots.length > 0 || (round.remote && round.shortlistSent)) {
      return "rank";
    }
    if (round.scheduledAt) return "locked";
  }
  return round.shortlistSent ? "sent" : "shortlist";
}

/**
 * A team's slots as one comparable string: a member whose DM was sent
 * for this key has the team's current times.
 */
export function slotsKey(
  slots: readonly { sponsorId: string; room: string | null; start: number }[],
) {
  return slots
    .map((s) => `${s.start}|${s.sponsorId}|${s.room ?? ""}`)
    .sort()
    .join(";");
}
