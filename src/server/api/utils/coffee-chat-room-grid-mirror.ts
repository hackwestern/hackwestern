/**
 * One-way mirror of the confirmed coffee chat schedule to the locked
 * "Coffee Chat Room Grid" tab (docs/decisions.md 2026-11-19): note rows,
 * group header row 3 (near rooms B-D, Ivey E-I), header row 4, then one row
 * per 15 minutes from 10:00 AM to 4:45 PM. Each chat or booking is written
 * in its session's first row: "sponsor · rep · format · chats" (no hacker
 * names). Runs only on Send, and only when sheetWritesEnabled() (production,
 * or SHEET_WRITES=1); in dev and tests nothing is written.
 *
 * Not yet: merging each booking's four rows and greying organizer bookings
 * (needs batchUpdate with the tab's sheetId, not the values API).
 */
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { COFFEE_ROOMS, COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { formatClock } from "~/lib/run-of-show";
import {
  googleBookingsSheet,
  SHEET_WRITES_DISABLED,
  type BookingsSheet,
  type MirrorResult,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import type { BoardState } from "~/server/api/utils/coffee-chat-sessions-board";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";

const sheetCopy = coffeeSessionsCopy.sheet;
export const ROOM_GRID_TAB = sheetCopy.tab;
const WIDTH = 1 + COFFEE_ROOMS.length;
const FIRST = 10 * 60;
const LAST = 16 * 60 + 45;

const clock = (min: number) =>
  formatClock(`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);

const stamp = (d: Date) =>
  d.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "short",
    timeStyle: "short",
  });

/**
 * How many chats each of a rep's sessions holds: full sessions in time order,
 * then whatever is left of their wanted chats.
 */
export function chatsBySession(
  sessionIds: readonly string[],
  chatsWanted: number,
  perSession: number,
): Map<string, number> {
  const ordered = COFFEE_SESSIONS.map((s) => s.id as string).filter((id) =>
    sessionIds.includes(id),
  );
  const out = new Map<string, number>();
  let left = chatsWanted;
  for (const id of ordered) {
    const n = Math.max(0, Math.min(perSession, left));
    out.set(id, n);
    left -= n;
  }
  return out;
}

/** The whole tab as rows from A1. Pure: tests build it from a board state. */
export function roomGridRows(
  state: Pick<BoardState, "sponsors" | "placements" | "bookings">,
  writtenAt: Date,
): string[][] {
  const pad = (row: string[]) => [...row, ...Array<string>(Math.max(0, WIDTH - row.length)).fill("")];
  const nearCount = COFFEE_ROOMS.filter((r) => r.building === "near").length;
  const rows: string[][] = [
    [sheetCopy.note, sheetCopy.updated(stamp(writtenAt))],
    [],
    ["", sheetCopy.nearHeader, ...Array<string>(nearCount - 1).fill(""), sheetCopy.iveyHeader],
    [sheetCopy.time, ...COFFEE_ROOMS.map((r) => sheetCopy.rm(r.id))],
  ];
  const text = new Map<string, string>();
  for (const sp of state.sponsors) {
    const format = coffeeSessionsCopy.detail.format(sp);
    for (const rep of sp.reps) {
      const mine = state.placements.filter((p) => p.repId === rep.id);
      const counts = chatsBySession(
        mine.map((p) => p.sessionId),
        rep.chatsWanted,
        sp.chatsPerSession,
      );
      for (const p of mine) {
        text.set(
          `${p.room}|${p.sessionId}`,
          sheetCopy.chat(sp.name, rep.name, format, counts.get(p.sessionId) ?? 0),
        );
      }
    }
  }
  for (const b of state.bookings) {
    text.set(`${b.room}|${b.sessionId}`, sheetCopy.booking(b.label, b.note));
  }
  for (let t = FIRST; t <= LAST; t += 15) {
    const session = COFFEE_SESSIONS.find((s) => s.start === t);
    rows.push([
      clock(t),
      ...COFFEE_ROOMS.map((r) => (session ? (text.get(`${r.id}|${session.id}`) ?? "") : "")),
    ]);
  }
  return rows.map(pad);
}

const TIMEOUT_MS = 5000;

/**
 * Write the tab. Never rejects. With sheet writes off nothing is written
 * and it returns { ok: false, error: "disabled" }.
 */
export async function mirrorRoomGrid(
  state: Pick<BoardState, "sponsors" | "placements" | "bookings">,
  deps: { sheet?: () => Promise<BookingsSheet>; now?: Date } = {},
): Promise<MirrorResult> {
  if (!sheetWritesEnabled()) return { ok: false, error: SHEET_WRITES_DISABLED };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rows = roomGridRows(state, deps.now ?? new Date());
    const write = (async () => {
      const sheet = await (deps.sheet ?? googleBookingsSheet)();
      if (!(await sheet.tabTitles()).includes(ROOM_GRID_TAB)) await sheet.addTab(ROOM_GRID_TAB);
      await sheet.write(`'${ROOM_GRID_TAB}'!A1`, rows);
      return rows.length;
    })();
    void write.catch(() => undefined);
    const n = await Promise.race([
      write,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
      }),
    ]);
    return { ok: true, rows: n };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`coffee chat room grid mirror failed: ${message}`);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
