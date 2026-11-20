import { COFFEE_CHAT_ROOMS } from "~/lib/coffee-chat-requests";
import { describe, expect, it } from "vitest";
import {
  buildRoomTable,
  roomCellSpans,
  sponsorStrip,
  type RoomBoard,
  type RoomBoardChat,
  type RoomBoardHold,
} from "~/lib/coffee-chat-room-table";

const chat = (over: Partial<RoomBoardChat>): RoomBoardChat => ({
  chatId: "c",
  sponsorId: "s-cl",
  slotTime: "10:00",
  durationMinutes: 15,
  room: "Rm 2241",
  status: "accepted",
  ...over,
});

// Canada Life: 1-on-1 with 2 reps, Rm 2241 10:00-10:30 (two 15-min slots).
const block: RoomBoardHold = {
  holdId: "h-cl",
  sponsorId: "s-cl",
  room: "Rm 2241",
  startTime: "10:00",
  endTime: "10:30",
  slots: [
    { slotTime: "10:00", booked: 2, needed: 2 },
    { slotTime: "10:15", booked: 0, needed: 2 },
  ],
  booked: 2,
  needed: 4,
  needsHacker: true,
};

const board = (over: Partial<RoomBoard> = {}): RoomBoard => ({
  slots: ["10:00", "10:15", "10:30", "10:45"],
  sponsors: [
    {
      sponsorId: "s-sb",
      sponsor: "Scotiabank",
      setUp: false,
      request: { source: "none" },
      blockMinutes: 0,
    },
    {
      sponsorId: "s-cl",
      sponsor: "Canada Life",
      setUp: true,
      request: { source: "sponsor" },
      blockMinutes: 30,
    },
    {
      sponsorId: "s-st",
      sponsor: "StarTech",
      setUp: true,
      request: { source: "sheet" },
      blockMinutes: 0,
    },
  ],
  chats: [
    chat({ chatId: "a" }),
    chat({ chatId: "b", status: "pending", room: null }),
    chat({ chatId: "x", status: "cancelled" }),
  ],
  holds: [block],
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
    expect(table.rooms).toEqual([...COFFEE_CHAT_ROOMS]);
    expect(table.slots).toHaveLength(4);
  });

  it("a block cell shows its slot's booked / needed, not people / 6", () => {
    const c = cell(table, "10:00", "Rm 2241");
    expect(c.holdId).toBe("h-cl");
    expect(c.occupants.map((o) => [o.sponsor, o.hackers, o.slot])).toEqual([
      ["Canada Life", 2, { slotTime: "10:00", booked: 2, needed: 2 }],
    ]);
    expect(cell(table, "10:15", "Rm 2241").needsHacker).toBe(true);
    expect(cell(table, "10:00", "Rm 2241").needsHacker).toBe(false);
  });

  it("no block, no sponsor: free (the whole-day room is gone)", () => {
    expect(cell(table, "10:30", "Rm 2241").occupants).toEqual([]);
    expect(cell(table, "10:00", "Rm 2242").occupants).toEqual([]);
  });

  it("no room capacity: many hackers in a room is just a count", () => {
    const busy = buildRoomTable(
      board({
        chats: ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
          chat({ chatId: id }),
        ),
      }),
    );
    const c = cell(busy, "10:00", "Rm 2241");
    expect(c.occupants[0]?.hackers).toBe(7);
    expect("over" in c).toBe(false);
  });

  it("a chat booked before blocks still shows, and two sponsors clash", () => {
    const t = buildRoomTable(
      board({
        chats: [chat({ chatId: "old", sponsorId: "s-sb", room: "Rm 2241" })],
      }),
    );
    const c = cell(t, "10:00", "Rm 2241");
    expect(c.occupants.map((o) => o.sponsor).sort()).toEqual([
      "Canada Life",
      "Scotiabank",
    ]);
    expect(c.clash).toBe(true);
    expect(c.holdId).toBeNull();
  });
});

describe("roomCellSpans", () => {
  it("merges a block's cells into its first row", () => {
    const spans = roomCellSpans(buildRoomTable(board()));
    expect(spans.map((row) => row[0])).toEqual([2, 0, 1, 1]);
    expect(spans.map((row) => row[1])).toEqual([1, 1, 1, 1]);
  });
});

describe("sponsorStrip", () => {
  it("sponsors with rooms first, then set up, then by name", () => {
    expect(sponsorStrip(board()).map((s) => s.sponsor)).toEqual([
      "Canada Life",
      "StarTech",
      "Scotiabank",
    ]);
  });
});
