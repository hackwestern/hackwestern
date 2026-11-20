/**
 * One-way mirror of the confirmed coffee chat schedule to the locked
 * "Coffee Chat Room Grid" tab (docs/decisions.md 2026-11-19): note rows,
 * group header row 3 (near rooms B-D, Ivey E-I), header row 4, then one row
 * per 15 minutes from 10:00 AM to 4:45 PM. Each chat or booking is one block:
 * its text ("sponsor · rep · format · chats", no hacker names) in its first
 * row, its rows merged (4 for a full session, fewer for a partial one), and
 * organizer bookings grey. Runs only when sheetWritesEnabled() (production,
 * or SHEET_WRITES=1); in dev and tests nothing is written.
 *
 * Two calls: the values (values API), then the merges and colours
 * (spreadsheets.batchUpdate, which needs the tab's numeric sheetId).
 */
import { google, type sheets_v4 } from "googleapis";

import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  chatsBySession,
  chatsInWindow,
  type UsableWindow,
} from "~/lib/coffee-chat-sessions";
import { formatClock } from "~/lib/run-of-show";
import {
  SHEET_WRITES_DISABLED,
  type MirrorResult,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import type { BoardState } from "~/server/api/utils/coffee-chat-sessions-board";
import {
  runOfShowCredentials,
  runOfShowSpreadsheetId,
  sheetWritesEnabled,
} from "~/server/api/utils/run-of-show-sheet";

const sheetCopy = coffeeSessionsCopy.sheet;
export const ROOM_GRID_TAB = sheetCopy.tab;
const WIDTH = 1 + COFFEE_ROOMS.length;
const FIRST = 10 * 60;
const LAST = 16 * 60 + 45;
const STEP = 15;
/** Rows above the first time row (note, blank, groups, header). */
const HEAD_ROWS = 4;
const TIME_ROWS = (LAST - FIRST) / STEP + 1;
/** Organizer bookings: Sheets' "light grey 2" (#d9d9d9). */
export const BOOKING_GREY = { red: 217 / 255, green: 217 / 255, blue: 217 / 255 };

const clock = (min: number) =>
  formatClock(`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);

const stamp = (d: Date) =>
  d.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "short",
    timeStyle: "short",
  });

type GridState = Pick<BoardState, "sponsors" | "placements" | "bookings">;

/** One block on the grid: a chat or a booking, its rows and its text. */
export type GridBlock = {
  kind: "chat" | "booking";
  /** 0-based column (A = 0, so rooms start at 1). */
  col: number;
  /** 0-based first row and the row after the last (end-exclusive). */
  startRow: number;
  endRow: number;
  text: string;
};

const rowOf = (min: number) => HEAD_ROWS + (min - FIRST) / STEP;

/**
 * Every block on the grid. A chat covers its usable window (a partial
 * session covers only its part); a booking covers its whole session.
 */
export function roomGridBlocks(state: GridState): GridBlock[] {
  const blocks: GridBlock[] = [];
  const colOf = (room: string) => 1 + COFFEE_ROOMS.findIndex((r) => r.id === room);
  const sessionOf = (id: string) => COFFEE_SESSIONS.find((s) => s.id === id);
  const span = (w: UsableWindow) => ({ startRow: rowOf(w.start), endRow: rowOf(w.end) });
  for (const sp of state.sponsors) {
    const format = coffeeSessionsCopy.detail.format(sp);
    for (const rep of sp.reps) {
      const mine = state.placements.filter((p) => p.repId === rep.id);
      const windowOf = (id: string) => {
        const p = mine.find((x) => x.sessionId === id);
        return p?.window ?? sessionOf(id) ?? null;
      };
      const counts = chatsBySession(
        mine.map((p) => p.sessionId),
        rep.chatsWanted,
        (id) => chatsInWindow(windowOf(id), sp.chatMinutes),
      );
      for (const p of mine) {
        const w = windowOf(p.sessionId);
        if (!w || colOf(p.room) < 1) continue;
        blocks.push({
          kind: "chat",
          col: colOf(p.room),
          ...span(w),
          text: sheetCopy.chat(sp.name, rep.name, format, counts.get(p.sessionId) ?? 0),
        });
      }
    }
  }
  for (const b of state.bookings) {
    const s = sessionOf(b.sessionId);
    if (!s || colOf(b.room) < 1) continue;
    blocks.push({ kind: "booking", col: colOf(b.room), ...span(s), text: sheetCopy.booking(b.label) });
  }
  return blocks;
}

/** The whole tab as rows from A1. Pure: tests build it from a board state. */
export function roomGridRows(state: GridState, writtenAt: Date): string[][] {
  const pad = (row: string[]) => [...row, ...Array<string>(Math.max(0, WIDTH - row.length)).fill("")];
  const nearCount = COFFEE_ROOMS.filter((r) => r.building === "near").length;
  const rows: string[][] = [
    [sheetCopy.note, sheetCopy.updated(stamp(writtenAt))],
    [],
    ["", sheetCopy.nearHeader, ...Array<string>(nearCount - 1).fill(""), sheetCopy.iveyHeader],
    [sheetCopy.time, ...COFFEE_ROOMS.map((r) => sheetCopy.rm(r.id))],
  ];
  for (let t = FIRST; t <= LAST; t += STEP) rows.push([clock(t)]);
  const out = rows.map(pad);
  for (const b of roomGridBlocks(state)) out[b.startRow]![b.col] = b.text;
  return out;
}

/**
 * The batchUpdate requests that format the tab after its values are
 * written: unmerge the time grid, reset its fill (wrapped, top-aligned
 * text), merge each block that spans more than one row, then grey the
 * organizer bookings. Pure: unit-tested, never run against the live sheet
 * from dev or tests.
 */
export function roomGridRequests(state: GridState, sheetId: number): sheets_v4.Schema$Request[] {
  const grid = {
    sheetId,
    startRowIndex: HEAD_ROWS,
    endRowIndex: HEAD_ROWS + TIME_ROWS,
    startColumnIndex: 1,
    endColumnIndex: WIDTH,
  };
  const rangeOf = (b: GridBlock) => ({
    sheetId,
    startRowIndex: b.startRow,
    endRowIndex: b.endRow,
    startColumnIndex: b.col,
    endColumnIndex: b.col + 1,
  });
  const blocks = roomGridBlocks(state);
  return [
    { unmergeCells: { range: grid } },
    {
      // backgroundColor is in the field mask but not the cell: Sheets clears it.
      repeatCell: {
        range: grid,
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment)",
      },
    },
    ...blocks
      .filter((b) => b.endRow - b.startRow > 1)
      .map((b): sheets_v4.Schema$Request => ({ mergeCells: { range: rangeOf(b), mergeType: "MERGE_ALL" } })),
    ...blocks
      .filter((b) => b.kind === "booking")
      .map((b): sheets_v4.Schema$Request => ({
        repeatCell: {
          range: rangeOf(b),
          cell: { userEnteredFormat: { backgroundColor: BOOKING_GREY } },
          fields: "userEnteredFormat.backgroundColor",
        },
      })),
  ];
}

/** The few Sheets calls this mirror makes; tests pass a fake. */
export type RoomGridSheet = {
  /** The tab's numeric sheetId, or null when there's no such tab. */
  sheetId(title: string): Promise<number | null>;
  /** Adds the tab and returns its sheetId. */
  addTab(title: string): Promise<number>;
  write(range: string, values: string[][]): Promise<void>;
  batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void>;
};

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** A writer client for the run-of-show sheet. Refuses when writes are off. */
export async function googleRoomGridSheet(): Promise<RoomGridSheet> {
  // Second line of defence: mirrorRoomGrid checks this before calling here.
  if (!sheetWritesEnabled()) throw new Error(SHEET_WRITES_DISABLED);
  const { email, key } = runOfShowCredentials();
  const spreadsheetId = runOfShowSpreadsheetId();
  const auth = new google.auth.JWT({ email, key, scopes: [WRITE_SCOPE] });
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  return {
    async sheetId(title) {
      const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(sheetId,title))",
      });
      const tab = (res.data.sheets ?? []).find((s) => s.properties?.title === title);
      return tab?.properties?.sheetId ?? null;
    },
    async addTab(title) {
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      // Never fall back to 0: that's the first tab, and the formatting
      // would land on the live RUN OF SHOW.
      const id = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
      if (typeof id !== "number") throw new Error(`addSheet returned no sheetId for "${title}"`);
      return id;
    },
    async write(range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    },
    async batchUpdate(requests) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    },
  };
}

const TIMEOUT_MS = 5000;

/**
 * Write the tab. Never rejects. With sheet writes off nothing is written
 * and it returns { ok: false, error: "disabled" }.
 */
export async function mirrorRoomGrid(
  state: GridState,
  deps: { sheet?: () => Promise<RoomGridSheet>; now?: Date } = {},
): Promise<MirrorResult> {
  if (!sheetWritesEnabled()) return { ok: false, error: SHEET_WRITES_DISABLED };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rows = roomGridRows(state, deps.now ?? new Date());
    const write = (async () => {
      const sheet = await (deps.sheet ?? googleRoomGridSheet)();
      const id = (await sheet.sheetId(ROOM_GRID_TAB)) ?? (await sheet.addTab(ROOM_GRID_TAB));
      await sheet.write(`'${ROOM_GRID_TAB}'!A1`, rows);
      await sheet.batchUpdate(roomGridRequests(state, id));
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
