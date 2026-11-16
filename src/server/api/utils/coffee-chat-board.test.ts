import { describe, expect, test } from "vitest";

import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import {
  boardCells,
  boardSlots,
  buildChatBoard,
} from "~/server/api/utils/coffee-chat-board";

// Saturday morning, well before any reply cutoff.
const morning = new Date("2026-11-21T08:00:00-05:00");

function setup(over: Partial<CoffeeChatSetup>): CoffeeChatSetup {
  return {
    sponsor: "Acme",
    windowStart: "10:00",
    windowEnd: "11:00",
    durationMinutes: 15,
    groupSize: 1,
    slots: null,
    hackers: null,
    format: null,
    room: null,
    ...over,
  };
}

let n = 0;
function chat(
  sponsorId: string,
  slotTime: string,
  status: CoffeeChatStatus = "accepted",
  durationMinutes = 15,
) {
  return {
    chatId: `chat-${++n}`,
    sponsorId,
    firstName: "Alex",
    lastName: "Lee",
    hackerId: null,
    slotTime,
    durationMinutes,
    room: null,
    repName: null,
    status,
  };
}

const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("boardSlots", () => {
  test("runs from the earliest window start to the latest end, every 15 min", () => {
    const slots = boardSlots(
      [
        { start: minutes("10:00"), end: minutes("11:00") },
        { start: minutes("10:30"), end: minutes("11:30") },
      ],
      [],
    );
    expect(slots).toEqual(
      ["10:00", "10:15", "10:30", "10:45", "11:00", "11:15"].map(minutes),
    );
  });

  test("stretches to cover a chat outside every window; empty with nothing", () => {
    expect(
      boardSlots(
        [{ start: minutes("10:00"), end: minutes("10:30") }],
        [{ slotTime: "10:30", durationMinutes: 30 }],
      ),
    ).toEqual(["10:00", "10:15", "10:30", "10:45"].map(minutes));
    expect(boardSlots([], [])).toEqual([]);
  });
});

describe("boardCells", () => {
  const slots = [
    "09:45",
    "10:00",
    "10:15",
    "10:30",
    "10:45",
    "11:00",
    "11:15",
  ].map(minutes);

  test("1-on-1s: one row per start, outside the window is out", () => {
    const cells = boardCells({
      slots,
      setup: setup({}),
      reps: 2,
      registered: true,
      chats: [],
      now: morning,
    });
    expect(cells.map((c) => [c.slotTime, c.kind, c.rows])).toEqual([
      ["09:45", "out", 1],
      ["10:00", "open", 1],
      ["10:15", "open", 1],
      ["10:30", "open", 1],
      ["10:45", "open", 1],
      ["11:00", "out", 1],
      ["11:15", "out", 1],
    ]);
    // 2 reps, 1-on-1s: 2 seats per start.
    expect(cells[1]).toMatchObject({ seats: 2, seatsLeft: 2, offerable: true });
    expect(cells[0]).toMatchObject({
      seats: 0,
      seatsLeft: 0,
      offerable: false,
    });
  });

  test("30-min groups span two rows; a window tail shorter than a chat is a gap", () => {
    const cells = boardCells({
      slots,
      setup: setup({
        windowEnd: "11:15",
        durationMinutes: 30,
        groupSize: 3,
      }),
      reps: 1,
      registered: true,
      chats: [],
      now: morning,
    });
    expect(cells.map((c) => [c.slotTime, c.kind, c.rows])).toEqual([
      ["09:45", "out", 1],
      ["10:00", "open", 2],
      ["10:30", "open", 2],
      ["11:00", "gap", 1],
      ["11:15", "out", 1],
    ]);
    // Rows add up to the table, so the column lines up.
    expect(cells.reduce((sum, c) => sum + c.rows, 0)).toBe(slots.length);
    expect(cells[1]).toMatchObject({ seats: 3, seatsLeft: 3 });
  });

  test("seats count only chats that still hold one; every chat is listed", () => {
    const chats = [
      chat("s", "10:00", "accepted"),
      chat("s", "10:00", "pending"),
      chat("s", "10:00", "declined"),
      chat("s", "10:00", "cancelled"),
    ];
    const cells = boardCells({
      slots,
      setup: setup({}),
      reps: 3,
      registered: true,
      chats,
      now: morning,
    });
    const ten = cells.find((c) => c.slotTime === "10:00")!;
    expect(ten.chatIds).toEqual(chats.map((c) => c.chatId));
    expect(ten).toMatchObject({ seats: 3, seatsUsed: 2, seatsLeft: 1 });
  });

  test("a pending request past its cutoff frees the seat and can't be offered", () => {
    const late = new Date("2026-11-21T09:45:00-05:00"); // 10:00 cutoff 9:40
    const cells = boardCells({
      slots,
      setup: setup({}),
      reps: 1,
      registered: true,
      chats: [chat("s", "10:00", "pending")],
      now: late,
    });
    const ten = cells.find((c) => c.slotTime === "10:00")!;
    expect(ten).toMatchObject({ seatsUsed: 0, seatsLeft: 1, offerable: false });
    expect(cells.find((c) => c.slotTime === "10:15")!.offerable).toBe(true);
  });

  test("a 30-min group fills its whole start; full and unregistered aren't offerable", () => {
    const group = setup({ durationMinutes: 30, groupSize: 3 });
    const chats = ["accepted", "accepted", "pending"].map((s) =>
      chat("s", "10:00", s as CoffeeChatStatus, 30),
    );
    const cells = boardCells({
      slots,
      setup: group,
      reps: 2,
      registered: true,
      chats,
      now: morning,
    });
    // 2 reps but a group of 3 + 1 rep fills a 6-person room once: 3 seats.
    expect(cells.find((c) => c.slotTime === "10:00")).toMatchObject({
      rows: 2,
      seats: 3,
      seatsLeft: 0,
      offerable: false,
    });
    const unregistered = boardCells({
      slots,
      setup: group,
      reps: 2,
      registered: false,
      chats: [],
      now: morning,
    });
    expect(unregistered.some((c) => c.offerable)).toBe(false);
  });

  test("not set up: every cell is out, but its chats still show", () => {
    const c = chat("s", "10:15");
    const cells = boardCells({
      slots,
      setup: setup({ windowStart: null, windowEnd: null }),
      reps: 1,
      registered: true,
      chats: [c],
      now: morning,
    });
    expect(cells.every((x) => x.kind === "out" && x.rows === 1)).toBe(true);
    expect(cells.find((x) => x.slotTime === "10:15")!.chatIds).toEqual([
      c.chatId,
    ]);
  });
});

describe("buildChatBoard", () => {
  test("columns, counts, totals and rooms in use", () => {
    const sponsors = [
      {
        id: "a",
        name: "Acme",
        reps: 1,
        assignedRoom: "Rm 2241",
        watcher: "Sam",
      },
      { id: "b", name: "Beta", reps: 1, assignedRoom: null, watcher: null },
      { id: "c", name: "Cobalt", reps: 1, assignedRoom: null, watcher: null },
      { id: "d", name: "Delta", reps: 1, assignedRoom: null, watcher: null },
    ];
    const board = buildChatBoard({
      sponsors,
      setups: [
        setup({
          sponsor: "Beta",
          windowStart: "10:30",
          windowEnd: "11:30",
          room: "Rm 2242",
          durationMinutes: 30,
          groupSize: 3,
        }),
        setup({ sponsor: "Acme", room: "Rm 2243" }),
        setup({ sponsor: "Blank Co", windowStart: null, windowEnd: null }),
        setup({ sponsor: "Cobalt", windowStart: null, windowEnd: null }),
      ],
      chats: [
        chat("a", "10:00", "accepted"),
        chat("a", "10:15", "pending"),
        chat("b", "10:30", "declined", 30),
        // Delta has no sheet row but has a chat: still a column.
        chat("d", "11:30", "pending"),
      ],
      now: morning,
    });

    expect(board.slots[0]).toBe("10:00");
    expect(board.slots.at(-1)).toBe("11:30");
    expect(board.sponsors.map((s) => [s.sponsor, s.setUp])).toEqual([
      ["Acme", true],
      ["Beta", true],
      ["Blank Co", false],
      ["Cobalt", false],
      ["Delta", false],
    ]);
    const acme = board.sponsors[0]!;
    expect(acme).toMatchObject({
      room: "Rm 2241",
      sheetRoom: "Rm 2243",
      watcher: "Sam",
      counts: { accepted: 1, pending: 1, total: 2 },
    });
    expect(board.sponsors[2]!.sponsorId).toBeNull();
    expect(board.totals).toEqual({
      offered: 4,
      accepted: 1,
      pending: 2,
      // Acme: 4 starts x 1 seat - 2 used = 2. Beta: 2 starts x 1 group of 3
      // (1 rep) = 6, the declined chat holds none.
      seatsLeft: 2 + 6,
    });
    expect(board.roomsInUse).toEqual(["Rm 2241", "Rm 2242"]);
  });
});
