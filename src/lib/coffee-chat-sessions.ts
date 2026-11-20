/**
 * Coffee chat sessions and rooms (docs/specs/coffee-chat-sessions.md,
 * docs/decisions.md 2026-11-19). Saturday only. One rep-session is one room
 * for one hour. Dependency-free so client components can import it; the
 * labels people read live in src/content/coffee-chat-sessions.ts.
 */

/** Fixed 1-hour sessions. Lunch (12-1) is not a session. Minutes after midnight. */
export const COFFEE_SESSIONS = [
  { id: "10", start: 600, end: 660 },
  { id: "11", start: 660, end: 720 },
  { id: "13", start: 780, end: 840 },
  { id: "14", start: 840, end: 900 },
  { id: "15", start: 900, end: 960 },
  { id: "16", start: 960, end: 1020 },
] as const;

export type CoffeeSessionId = (typeof COFFEE_SESSIONS)[number]["id"];
export const COFFEE_SESSION_IDS = COFFEE_SESSIONS.map(
  (s) => s.id,
) as unknown as readonly [CoffeeSessionId, ...CoffeeSessionId[]];

export type Building = "near" | "ivey";

/**
 * The 8 breakout rooms: 2241-2243 next to the Sponsor Bay, then the Ivey
 * building (a 15-minute walk). Order matters: near before Ivey, and lower
 * numbers first inside a building.
 */
export const COFFEE_ROOMS = [
  { id: "2241", building: "near" },
  { id: "2242", building: "near" },
  { id: "2243", building: "near" },
  { id: "1348", building: "ivey" },
  { id: "1352", building: "ivey" },
  { id: "1354", building: "ivey" },
  { id: "1356", building: "ivey" },
  { id: "1358", building: "ivey" },
] as const satisfies readonly { id: string; building: Building }[];

export type CoffeeRoomId = (typeof COFFEE_ROOMS)[number]["id"];
export const COFFEE_ROOM_IDS = COFFEE_ROOMS.map(
  (r) => r.id,
) as unknown as readonly [CoffeeRoomId, ...CoffeeRoomId[]];

/** Travel buffer before a workshop's setup (or start) and after its end. */
export const WORKSHOP_BUFFER_MIN = 15;

/** Hackers per chat, 1-5 (the room holds 6 with the rep). */
export const MIN_HACKERS_PER_CHAT = 1;
export const MAX_HACKERS_PER_CHAT = 5;
/** Each rep says how many chats they want; 0 = that rep doesn't chat. */
export const MIN_CHATS_WANTED = 0;
export const MAX_CHATS_WANTED = 40;

export function isSessionId(id: string): id is CoffeeSessionId {
  return COFFEE_SESSIONS.some((s) => s.id === id);
}

export function isRoomId(id: string): id is CoffeeRoomId {
  return COFFEE_ROOMS.some((r) => r.id === id);
}

export function buildingOf(room: string): Building | null {
  return COFFEE_ROOMS.find((r) => r.id === room)?.building ?? null;
}

/**
 * Chat length in minutes: 15 for a 1-on-1, 30 for a group. The old
 * longer_one_on_one column is ignored: 1-on-1s are always 15 minutes
 * (docs/decisions.md 2026-11-19, Q1-Q11).
 */
export function chatMinutes(prefs: {
  hackersPerChat: number;
  longerOneOnOne?: boolean;
}): 15 | 30 {
  return prefs.hackersPerChat === 1 ? 15 : 30;
}

/** Chats one rep runs in one 1-hour session (4 at 15 min, 2 at 30). */
export function chatsPerSession(prefs: {
  hackersPerChat: number;
  longerOneOnOne?: boolean;
}): number {
  return 60 / chatMinutes(prefs);
}

/** Sessions a rep's wanted chats need: ceil(chats x chat length / 60). */
export function sessionsForChats(
  chatsWanted: number,
  minutes: 15 | 30,
): number {
  return Math.ceil((Math.max(0, chatsWanted) * minutes) / 60);
}

/** Hackers one rep sees in one session. */
export function hackersPerSession(prefs: {
  hackersPerChat: number;
  longerOneOnOne?: boolean;
}): number {
  return (60 / chatMinutes(prefs)) * prefs.hackersPerChat;
}

/** "HH:MM" -> minutes after midnight, or null. */
export function minutesOfClock(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** A sponsor workshop in minutes after midnight; `setup` is when they must be in the room. */
export type WorkshopTime = {
  setup?: number | null;
  start: number;
  end: number;
};

/** Minutes a workshop blocks: (setup, or start) - 15 to end + 15. */
export function workshopBlock(w: WorkshopTime): { from: number; to: number } {
  return {
    from: (w.setup ?? w.start) - WORKSHOP_BUFFER_MIN,
    to: w.end + WORKSHOP_BUFFER_MIN,
  };
}

/** Start and end of the part of a session a rep can use, minutes after midnight. */
export type UsableWindow = { start: number; end: number };

/**
 * The part of a session a sponsor's rep can use (docs/decisions.md
 * 2026-11-19, Q1-Q11: partial sessions). The whole hour when no workshop
 * window touches it. When a workshop's travel buffer cuts it, the longest
 * part before or after the cut, trimmed to whole chats and kept against the
 * session's own edge: Sun Life sets up at 2:00 (blocked from 1:45), so with
 * 30-minute chats its 1-2 session is 1:00-1:30. Null when not one whole chat
 * fits, or for an unknown session.
 *
 * Track B: a placement's seat times come from this window (its start, then
 * every `chatMinutes`), not from the session's full hour.
 */
export function usableWindow(
  sessionId: string,
  workshops: readonly WorkshopTime[],
  chatMinutes: number,
): UsableWindow | null {
  const s = COFFEE_SESSIONS.find((x) => x.id === sessionId);
  return s ? sessionWindow(s, workshops, chatMinutes) : null;
}

/** usableWindow for any session's times (the scheduler passes its own list). */
export function sessionWindow(
  s: { start: number; end: number },
  workshops: readonly WorkshopTime[],
  chatMinutes: number,
): UsableWindow | null {
  if (chatMinutes <= 0) return null;
  // Free stretches of the hour once every workshop window is cut out.
  let free: UsableWindow[] = [{ start: s.start, end: s.end }];
  for (const w of workshops) {
    const { from, to } = workshopBlock(w);
    free = free.flatMap((f) =>
      to <= f.start || from >= f.end
        ? [f]
        : [
            ...(from > f.start ? [{ start: f.start, end: from }] : []),
            ...(to < f.end ? [{ start: to, end: f.end }] : []),
          ],
    );
  }
  // Longest stretch first; on a tie, the earlier one.
  const best = [...free].sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
  )[0];
  if (!best) return null;
  const chats = Math.floor((best.end - best.start) / chatMinutes);
  if (chats === 0) return null;
  const len = chats * chatMinutes;
  // After the cut, the chats run up to the session's end; otherwise from its start.
  return best.end === s.end && best.start !== s.start
    ? { start: best.end - len, end: best.end }
    : { start: best.start, end: best.start + len };
}

/** Whole chats that fit in a window. */
export function chatsInWindow(
  w: UsableWindow | null,
  chatMinutes: number,
): number {
  return w && chatMinutes > 0 ? Math.floor((w.end - w.start) / chatMinutes) : 0;
}

/**
 * How many chats each of a rep's sessions holds: sessions in time order,
 * each up to what it fits (`perSession`, or a function of the session id
 * for partial sessions), until the rep's wanted chats run out.
 */
export function chatsBySession(
  sessionIds: readonly string[],
  chatsWanted: number,
  perSession: number | ((sessionId: string) => number),
): Map<string, number> {
  const ordered = COFFEE_SESSIONS.map((s) => s.id as string).filter((id) =>
    sessionIds.includes(id),
  );
  const fits = typeof perSession === "number" ? () => perSession : perSession;
  const out = new Map<string, number>();
  let left = chatsWanted;
  for (const id of ordered) {
    const n = Math.max(0, Math.min(fits(id), left));
    out.set(id, n);
    left -= n;
  }
  return out;
}

/** "Rm 1348" (a chat's stored room) -> "ivey"; null when it isn't a session room. */
export function buildingOfRoomLabel(room: string | null): Building | null {
  const id = /(\d{4})/.exec(room ?? "")?.[1];
  return id ? buildingOf(id) : null;
}
