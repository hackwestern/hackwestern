import { describe, expect, test } from "vitest";
import {
  cellAt,
  chatsInCell,
  clockRange,
  dropCheck,
  firstNameOf,
  hourCounts,
  keyOf,
  litCells,
  type ViewBoard,
} from "~/lib/coffee-chat-board-view";

// Sun Life: groups of 3 (30 min), workshop blocks 14 and 15. Dana is free 10, 11, 14 and 16.
const board: ViewBoard = {
  sponsors: [
    {
      id: "sun",
      name: "Sun Life",
      chatMinutes: 30,
      hackersPerChat: 3,
      blocked: ["14", "15"],
      reps: [
        {
          id: "dana",
          name: "Dana W.",
          free: ["10", "11", "14", "16"],
          chatsWanted: 3,
        },
        { id: "sam", name: "Sam R.", free: ["11"], chatsWanted: 2 },
      ],
    },
  ],
  placements: [
    {
      id: "p1",
      repId: "dana",
      sponsorId: "sun",
      sessionId: "10",
      room: "2241",
      window: { start: 600, end: 660 },
    },
    {
      id: "p2",
      repId: "dana",
      sponsorId: "sun",
      sessionId: "11",
      room: "2241",
      window: { start: 660, end: 720 },
    },
    {
      id: "p3",
      repId: "sam",
      sponsorId: "sun",
      sessionId: "11",
      room: "2242",
      window: { start: 660, end: 720 },
    },
  ],
  bookings: [{ id: "b1", room: "2243", sessionId: "13" }],
};

describe("cellAt", () => {
  test("a chat with its sponsor and rep, a booking, or nothing", () => {
    expect(cellAt(board, keyOf("2241", "10"))).toMatchObject({
      kind: "chat",
      rep: { name: "Dana W." },
      sponsor: { name: "Sun Life" },
    });
    expect(cellAt(board, keyOf("2243", "13"))).toMatchObject({
      kind: "booking",
      booking: { id: "b1" },
    });
    expect(cellAt(board, keyOf("2243", "10"))).toBeNull();
  });
});

describe("dropCheck", () => {
  const src = keyOf("2241", "10");
  test("lit cells: empty, rep free, not their workshop, no chat elsewhere then", () => {
    expect(dropCheck(board, src, keyOf("2243", "16"))).toBe("ok");
    expect(dropCheck(board, src, keyOf("2242", "11"))).toBe("taken");
    expect(dropCheck(board, src, keyOf("2243", "11"))).toBe("busy");
    expect(dropCheck(board, src, keyOf("2243", "14"))).toBe("workshop"); // ticked, but the workshop wins
    expect(dropCheck(board, src, keyOf("2243", "13"))).toBe("taken");
    expect(dropCheck(board, src, keyOf("2242", "13"))).toBe("notFree");
    expect(dropCheck(board, src, src)).toBe("same");
    expect(dropCheck(board, keyOf("1348", "10"), keyOf("2243", "16"))).toBe(
      "gone",
    );
  });
  test("a booking can go to any empty cell", () => {
    expect(dropCheck(board, keyOf("2243", "13"), keyOf("2242", "14"))).toBe(
      "ok",
    );
    expect(dropCheck(board, keyOf("2243", "13"), keyOf("2241", "10"))).toBe(
      "taken",
    );
  });
  test("litCells is exactly the ok cells (another room in the same hour counts)", () => {
    const keys = ["2241", "2242", "2243"].flatMap((r) =>
      ["10", "11", "13", "14", "15", "16"].map((s) => keyOf(r, s)),
    );
    expect([...litCells(board, src, keys)].sort()).toEqual([
      keyOf("2241", "16"),
      keyOf("2242", "10"),
      keyOf("2242", "16"),
      keyOf("2243", "10"),
      keyOf("2243", "16"),
    ]);
  });
});

describe("chatsInCell", () => {
  test("a whole hour of groups is 2 chats; the rep's wanted chats cap the later hour", () => {
    expect(chatsInCell(board, board.placements[0]!)).toBe(2);
    expect(chatsInCell(board, board.placements[1]!)).toBe(1);
    expect(chatsInCell(board, board.placements[2]!)).toBe(2);
  });
  test("a partial session holds the chats that fit", () => {
    const cut: ViewBoard = {
      ...board,
      placements: [
        { ...board.placements[2]!, window: { start: 660, end: 690 } },
      ],
    };
    expect(chatsInCell(cut, cut.placements[0]!)).toBe(1);
  });
});

describe("clockRange and names", () => {
  test("start and end, with AM/PM once unless it crosses noon", () => {
    expect(clockRange("14:30", "15:30")).toBe("2:30–3:30 PM");
    expect(clockRange("11:30", "12:30")).toBe("11:30 AM–12:30 PM");
    expect(clockRange("10:00", "11:00")).toBe("10:00–11:00 AM");
    expect(firstNameOf("Dana W.")).toBe("Dana");
  });
});

describe("hourCounts", () => {
  test("adds up one placement's chats", () => {
    const chats = [
      { placementId: "p1", seats: 3, accepted: 2, filled: 3 },
      { placementId: "p1", seats: 3, accepted: 1, filled: 3 },
      { placementId: "p2", seats: 3, accepted: 3, filled: 3 },
    ];
    expect(hourCounts(chats, "p1")).toEqual({
      chats: 2,
      seats: 6,
      accepted: 3,
      waiting: 3,
    });
    expect(hourCounts(chats, "x")).toEqual({
      chats: 0,
      seats: 0,
      accepted: 0,
      waiting: 0,
    });
  });
});
