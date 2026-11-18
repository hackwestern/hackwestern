import { describe, expect, it } from "vitest";
import { boardTimeAt, coffeeRoomsAt } from "~/lib/coffee-chat-map";
import type {
  BoardChat,
  BoardSponsor,
} from "~/server/api/utils/coffee-chat-board";

const ROOMS = ["Rm 2241", "Rm 2242", "Rm 2243"];

function sponsor(
  id: string,
  name: string,
  room: string | null,
  windowStart: string | null,
  windowEnd: string | null,
): BoardSponsor {
  return {
    sponsorId: id,
    sponsor: name,
    setUp: windowStart !== null,
    windowStart,
    windowEnd,
    durationMinutes: 15,
    groupSize: 1,
    hackers: null,
    reps: 1,
    assignedRoom: room,
    sheetRoom: null,
    room,
    watcher: null,
    counts: { accepted: 0, pending: 0, total: 0 },
    holdsNeedingHacker: 0,
    cells: [],
  };
}

let n = 0;
function chat(
  sponsorId: string,
  slotTime: string,
  status: BoardChat["status"],
  extra: Partial<BoardChat> = {},
): BoardChat {
  n += 1;
  return {
    chatId: `c${n}`,
    sponsorId,
    firstName: "Hacker",
    lastName: null,
    hackerId: null,
    slotTime,
    durationMinutes: 15,
    room: null,
    repName: null,
    status,
    ...extra,
  };
}

const board = {
  sponsors: [
    sponsor("a", "StarTech", "Rm 2241", "10:00", "12:00"),
    sponsor("b", "Northwind", "Rm 2242", "10:30", "12:30"),
    sponsor("c", "Late Co", "Rm 2241", "13:00", "14:00"),
  ],
  chats: [
    chat("a", "10:30", "accepted"),
    chat("a", "10:30", "pending"),
    chat("a", "10:30", "declined"),
    chat("a", "10:45", "accepted"),
    chat("b", "10:30", "accepted", { durationMinutes: 30 }),
    chat("b", "10:15", "accepted", { room: "Rm 2243" }),
  ],
};

describe("coffeeRoomsAt", () => {
  it("names the sponsor in each room and counts live chats then", () => {
    const rooms = coffeeRoomsAt(board, ROOMS, "10:30");
    expect(
      rooms.map((r) => [r.name, r.sponsor, r.accepted, r.pending]),
    ).toEqual([
      ["Rm 2241", "StarTech", 1, 1],
      ["Rm 2242", "Northwind", 1, 0],
      ["Rm 2243", null, 0, 0],
    ]);
    expect(rooms[0]!.pin?.id).toBe("2241");
  });

  it("counts 30-minute chats in their second row", () => {
    const [, northwind] = coffeeRoomsAt(board, ROOMS, "10:45");
    expect(northwind).toMatchObject({ sponsor: "Northwind", accepted: 1 });
  });

  it("gives a shared room to whoever's window covers the time", () => {
    expect(coffeeRoomsAt(board, ROOMS, "13:15")[0]!.sponsor).toBe("Late Co");
    expect(coffeeRoomsAt(board, ROOMS, "12:30")[0]!.sponsor).toBeNull();
  });

  it("places a moved chat in its own room, outside any window", () => {
    expect(coffeeRoomsAt(board, ROOMS, "10:15")[2]).toMatchObject({
      sponsor: "Northwind",
      accepted: 1,
    });
  });
});

describe("boardTimeAt", () => {
  const slots = ["10:00", "10:15", "10:30", "10:45"];
  it("opens on the first row before the event", () => {
    expect(boardTimeAt(slots, new Date("2026-11-20T18:00:00-05:00"))).toBe(
      "10:00",
    );
  });
  it("rounds now down to the grid on Saturday", () => {
    expect(boardTimeAt(slots, new Date("2026-11-21T10:40:00-05:00"))).toBe(
      "10:30",
    );
    expect(boardTimeAt(slots, new Date("2026-11-21T15:05:00-05:00"))).toBe(
      "15:00",
    );
  });
  it("stays on the last row after Saturday", () => {
    expect(boardTimeAt(slots, new Date("2026-11-22T09:00:00-05:00"))).toBe(
      "10:45",
    );
  });
  it("is null with no rows", () => {
    expect(boardTimeAt([], new Date())).toBeNull();
  });
});
