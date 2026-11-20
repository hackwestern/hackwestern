import { describe, expect, test, vi } from "vitest";
import type { BoardSessionSponsor, BoardState } from "~/server/api/utils/coffee-chat-sessions-board";

const writes = vi.hoisted(() => ({ on: false }));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  sheetWritesEnabled: () => writes.on,
  runOfShowCredentials: () => ({ email: "test@example.test", key: "k" }),
  runOfShowSpreadsheetId: () => "sheet-id",
}));
// No network: a fake Sheets client whose addSheet reply has no sheetId.
vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: class {
        authorize() {
          return Promise.resolve();
        }
      },
    },
    sheets: () => ({
      spreadsheets: {
        batchUpdate: () => Promise.resolve({ data: { replies: [{ addSheet: { properties: { title: "x" } } }] } }),
      },
    }),
  },
}));

const {
  BOOKING_GREY,
  googleRoomGridSheet,
  mirrorRoomGrid,
  roomGridBlocks,
  roomGridRequests,
  roomGridRows,
} = await import("~/server/api/utils/coffee-chat-room-grid-mirror");

const sponsor = (over: Partial<BoardSessionSponsor>): BoardSessionSponsor => ({
  id: "sun",
  name: "Sun Life",
  submitted: true,
  submittedAt: null,
  change: null,
  changedAfterSend: false,
  hackersPerChat: 3,
  longerOneOnOne: false,
  chatMinutes: 30,
  chatsPerSession: 2,
  workshops: [],
  blocked: ["14", "15"],
  partial: { "13": { start: 780, end: 810 } },
  status: { kind: "scheduled", done: 1, total: 1, broken: 0 },
  reps: [
    { id: "r1", name: "Dana", phone: "5195550101", isPrimary: true, chatsWanted: 3, sessionsWanted: 2, maxSessions: null, free: ["10", "13"] },
  ],
  ...over,
});

const placement = (sessionId: string, room: string, window: { start: number; end: number }) => ({
  id: `p${sessionId}`,
  repId: "r1",
  sponsorId: "sun",
  sessionId,
  room,
  pinned: false,
  forced: false,
  status: "sent" as const,
  sentAt: null,
  window,
});

const state: Pick<BoardState, "sponsors" | "placements" | "bookings"> = {
  sponsors: [sponsor({})],
  placements: [placement("10", "2241", { start: 600, end: 660 }), placement("13", "1348", { start: 780, end: 810 })],
  bookings: [{ id: "b1", sessionId: "11", room: "2242", forSponsorId: null, label: "Mentors", note: "Resumes" }],
};

// Rows: 0 note, 1 blank, 2 groups, 3 header, then 10:00 at row 4 (one per 15 min).
const row = (h: number, m = 0) => 4 + ((h * 60 + m) - 600) / 15;

describe("roomGridBlocks", () => {
  test("a full session spans 4 rows; a partial one only its part; bookings their session", () => {
    expect(roomGridBlocks(state)).toEqual([
      { kind: "chat", col: 1, startRow: row(10), endRow: row(11), text: "Sun Life · Dana · Group of 3 · 2 chats" },
      // 1:00-1:30 holds one 30-min chat: Dana gets 3 chats, 2 + 1.
      { kind: "chat", col: 4, startRow: row(13), endRow: row(13, 30), text: "Sun Life · Dana · Group of 3 · 1 chat" },
      { kind: "booking", col: 2, startRow: row(11), endRow: row(12), text: "Mentors · Resumes" },
    ]);
  });

  test("rows put each block's text in its first row", () => {
    const rows = roomGridRows(state, new Date("2026-11-21T02:00:00Z"));
    expect(rows[row(13)]![4]).toBe("Sun Life · Dana · Group of 3 · 1 chat");
    expect(rows[row(13, 15)]![4]).toBe("");
    expect(rows.every((r) => r.length === 9)).toBe(true);
  });
});

describe("roomGridRequests", () => {
  const reqs = roomGridRequests(state, 42);
  const grid = { sheetId: 42, startRowIndex: 4, endRowIndex: 4 + 28, startColumnIndex: 1, endColumnIndex: 9 };

  test("unmerges and resets the time grid first", () => {
    expect(reqs[0]).toEqual({ unmergeCells: { range: grid } });
    expect(reqs[1]).toMatchObject({
      repeatCell: { range: grid, fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment)" },
    });
  });

  test("merges every block of more than one row (4 rows full, 2 rows for 1:00-1:30)", () => {
    const merges = reqs.flatMap((r) => (r.mergeCells ? [r.mergeCells] : []));
    expect(merges).toEqual([
      { range: { sheetId: 42, startRowIndex: row(10), endRowIndex: row(11), startColumnIndex: 1, endColumnIndex: 2 }, mergeType: "MERGE_ALL" },
      { range: { sheetId: 42, startRowIndex: row(13), endRowIndex: row(13, 30), startColumnIndex: 4, endColumnIndex: 5 }, mergeType: "MERGE_ALL" },
      { range: { sheetId: 42, startRowIndex: row(11), endRowIndex: row(12), startColumnIndex: 2, endColumnIndex: 3 }, mergeType: "MERGE_ALL" },
    ]);
  });

  test("greys organizer bookings only", () => {
    const greys = reqs.slice(2).filter((r) => r.repeatCell);
    expect(greys).toEqual([
      {
        repeatCell: {
          range: { sheetId: 42, startRowIndex: row(11), endRowIndex: row(12), startColumnIndex: 2, endColumnIndex: 3 },
          cell: { userEnteredFormat: { backgroundColor: BOOKING_GREY } },
          fields: "userEnteredFormat.backgroundColor",
        },
      },
    ]);
  });
});

describe("mirrorRoomGrid", () => {
  const fake = () => {
    const calls: string[] = [];
    return {
      calls,
      sheet: () =>
        Promise.resolve({
          sheetId: () => (calls.push("sheetId"), Promise.resolve(null)),
          addTab: () => (calls.push("addTab"), Promise.resolve(7)),
          write: () => (calls.push("write"), Promise.resolve()),
          batchUpdate: (r: unknown[]) => (calls.push(`batchUpdate:${r.length}`), Promise.resolve()),
        }),
    };
  };

  test("with sheet writes off it writes nothing", async () => {
    const f = fake();
    expect(await mirrorRoomGrid(state, { sheet: f.sheet })).toEqual({ ok: false, error: "disabled" });
    expect(f.calls).toEqual([]);
  });

  test("with writes on (fake sheet only): add the tab, write values, then format", async () => {
    writes.on = true;
    try {
      const f = fake();
      expect(await mirrorRoomGrid(state, { sheet: f.sheet })).toMatchObject({ ok: true });
      expect(f.calls).toEqual(["sheetId", "addTab", "write", `batchUpdate:${roomGridRequests(state, 7).length}`]);
    } finally {
      writes.on = false;
    }
  });
});

describe("googleRoomGridSheet.addTab", () => {
  test("throws when addSheet returns no sheetId, never falls back to tab 0", async () => {
    writes.on = true;
    try {
      const sheet = await googleRoomGridSheet();
      await expect(sheet.addTab("Coffee Chat Room Grid")).rejects.toThrow(/no sheetId/);
    } finally {
      writes.on = false;
    }
  });
});
