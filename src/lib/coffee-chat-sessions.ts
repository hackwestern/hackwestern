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
/** Hours per rep 1, 2, 3 or 4 (4 = "4+", no cap). */
export const MIN_HOURS_PER_REP = 1;
export const MAX_HOURS_PER_REP = 4;

export function isSessionId(id: string): id is CoffeeSessionId {
  return COFFEE_SESSIONS.some((s) => s.id === id);
}

export function isRoomId(id: string): id is CoffeeRoomId {
  return COFFEE_ROOMS.some((r) => r.id === id);
}

export function buildingOf(room: string): Building | null {
  return COFFEE_ROOMS.find((r) => r.id === room)?.building ?? null;
}

/** Chat length in minutes: 15 for a plain 1-on-1, else 30. */
export function chatMinutes(prefs: {
  hackersPerChat: number;
  longerOneOnOne: boolean;
}): 15 | 30 {
  return prefs.hackersPerChat === 1 && !prefs.longerOneOnOne ? 15 : 30;
}

/** Hackers one rep sees in one session. */
export function hackersPerSession(prefs: {
  hackersPerChat: number;
  longerOneOnOne: boolean;
}): number {
  return (60 / chatMinutes(prefs)) * prefs.hackersPerChat;
}

/** "HH:MM" -> minutes after midnight, or null. */
export function minutesOfClock(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
