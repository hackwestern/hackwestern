import { describe, expect, it } from "vitest";
import {
  boardStats,
  buildRoomTable,
  ROOM_CAPACITY,
  roomCellState,
  type RoomBoard,
  type RoomBoardChat,
  type RoomBoardSponsor,
} from "~/lib/coffee-chat-room-table";

const sponsor = (over: Partial<RoomBoardSponsor>): RoomBoardSponsor => ({
  sponsorId: "s-cl",
  sponsor: "Canada Life",
  setUp: true,
  windowStart: "10:00",
  windowEnd: "11:00",
  reps: 2,
  room: "Rm 2241",
  cells: [],
  ...over,
});

const chat = (over: Partial<RoomBoardChat>): RoomBoardChat => ({
  chatId: "c",
  sponsorId: "s-cl",
  slotTime: "10:00",
  durationMinutes: 30,
  room: "Rm 2241",
  status: "accepted",
  ...over,
});

const board = (over: Partial<RoomBoard> = {}): RoomBoard => ({
  slots: ["10:00", "10:15", "10:30", "10:45", "11:00"],
  sponsors: [
    sponsor({ cells: [{ offerable: true, seatsLeft: 3 }] }),
    sponsor({
      sponsorId: "s-sb",
      sponsor: "Scotiabank",
      room: "Rm 2242",
      reps: 1,
      cells: [
        { offerable: true, seatsLeft: 2 },
        { offerable: false, seatsLeft: 5 },
      ],
    }),
  ],
  chats: [
    chat({ chatId: "a" }),
    chat({ chatId: "b", status: "pending" }),
    chat({ chatId: "x", status: "cancelled" }),
    chat({ chatId: "d", sponsorId: "s-sb", room: null, slotTime: "10:30" }),
  ],
  ...over,
});

const cell = (
  t: ReturnType<typeof buildRoomTable>,
  slot: string,
  room: string,
) => t.rows[t.slots.indexOf(slot)]![t.rooms.indexOf(room)]!;

describe("buildRoomTable", () => {
  const table = buildRoomTable(board());

  it("has one column per coffee chat room and a row per grid slot", () => {
    expect(table.rooms).toEqual(["Rm 2241", "Rm 2242", "Rm 2243"]);
    expect(table.slots).toHaveLength(5);
  });

  it("counts live hackers plus the sponsor's reps against capacity", () => {
    const c = cell(table, "10:15", "Rm 2241");
    expect(
      c.occupants.map((o) => [o.sponsor, o.hackers, o.accepted, o.pending]),
    ).toEqual([["Canada Life", 2, 1, 1]]);
    expect(c.used).toBe(4); // 2 hackers + 2 reps; the cancelled chat is out
    expect(c.capacity).toBe(ROOM_CAPACITY);
    expect(c.state).toBe("booked");
  });

  it("holds the room through the sponsor's window, even with no chats", () => {
    const c = cell(table, "10:45", "Rm 2241");
    expect(c.occupants[0]?.hackers).toBe(0);
    expect(c.used).toBe(2);
    expect(cell(table, "11:00", "Rm 2241").state).toBe("free");
  });

  it("puts a chat with no room in its sponsor's room", () => {
    expect(cell(table, "10:30", "Rm 2242").used).toBe(2);
    expect(cell(table, "10:30", "Rm 2243").state).toBe("free");
  });

  it("flags full and over-capacity rooms", () => {
    expect(roomCellState(ROOM_CAPACITY, true)).toBe("full");
    expect(roomCellState(ROOM_CAPACITY + 1, true)).toBe("over");
    expect(roomCellState(0, false)).toBe("free");
    const busy = buildRoomTable(
      board({
        chats: ["a", "b", "c", "d", "e"].map((id) => chat({ chatId: id })),
      }),
    );
    expect(cell(busy, "10:00", "Rm 2241").state).toBe("over"); // 5 + 2 reps
  });

  it("marks sponsors outside the filter so the table can dim them", () => {
    const t = buildRoomTable(board(), { selected: new Set(["Scotiabank"]) });
    expect(cell(t, "10:00", "Rm 2241").occupants[0]?.selected).toBe(false);
    expect(cell(t, "10:00", "Rm 2242").occupants[0]?.selected).toBe(true);
  });
});

describe("boardStats", () => {
  it("counts everything when every sponsor is selected", () => {
    expect(boardStats(board(), null)).toEqual({
      offered: 4,
      accepted: 2,
      pending: 1,
      seatsLeft: 5,
      roomsInUse: ["Rm 2241", "Rm 2242"],
    });
  });

  it("recounts for the chosen sponsors only", () => {
    expect(boardStats(board(), new Set(["Canada Life"]))).toEqual({
      offered: 3,
      accepted: 1,
      pending: 1,
      seatsLeft: 3,
      roomsInUse: ["Rm 2241"],
    });
    expect(boardStats(board(), new Set())).toEqual({
      offered: 0,
      accepted: 0,
      pending: 0,
      seatsLeft: 0,
      roomsInUse: [],
    });
  });
});
