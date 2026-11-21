import { describe, expect, test } from "vitest";

import {
  bookRepOf,
  freeRanges,
  repBusy,
  type BookBoard,
  type BookRep,
} from "~/lib/coffee-chat-book-availability";

// Sessions: 10, 11, (lunch), 13, 14, 15, 16. Minutes after midnight.
const board: BookBoard = {
  placements: [
    {
      repId: "ann",
      sessionId: "11",
      room: "2241",
      window: { start: 660, end: 705 },
    },
  ],
  bookings: [
    { sessionId: "14", room: "1348", label: "Resume pass", repIds: ["ann"] },
  ],
};
const ann: BookRep = {
  id: "ann",
  free: ["10", "11", "13", "14", "15"],
  blocked: ["15"],
};

describe("repBusy", () => {
  test("a chat, an event, the workshop, a session not ticked free", () => {
    expect(repBusy(ann, "10", board)).toBeNull();
    expect(repBusy(ann, "11", board)).toEqual({
      kind: "chat",
      room: "2241",
      start: 660,
      end: 705,
    });
    expect(repBusy(ann, "14", board)).toEqual({
      kind: "event",
      room: "1348",
      label: "Resume pass",
    });
    expect(repBusy(ann, "15", board)).toEqual({ kind: "workshop" });
    expect(repBusy(ann, "16", board)).toEqual({ kind: "notFree" });
  });

  test("a rep with nothing ticked (sponsor not set up): only chats and events count", () => {
    const rep: BookRep = { id: "ann", free: null, blocked: [] };
    expect(repBusy(rep, "16", board)).toBeNull();
    expect(repBusy(rep, "11", board)?.kind).toBe("chat");
  });
});

describe("freeRanges", () => {
  test("free sessions join up; busy ones and lunch split them", () => {
    expect(freeRanges(ann, board)).toEqual([
      { start: 600, end: 660 },
      { start: 780, end: 840 },
    ]);
  });

  test("a free morning is one range, the afternoon another", () => {
    const rep: BookRep = { id: "bo", free: null, blocked: [] };
    expect(freeRanges(rep, { placements: [], bookings: [] })).toEqual([
      { start: 600, end: 720 },
      // Until 9 PM (2026-11-21).
      { start: 780, end: 1260 },
    ]);
  });

  test("busy all day: no ranges", () => {
    expect(freeRanges({ id: "cy", free: [], blocked: [] }, board)).toEqual([]);
  });
});

describe("bookRepOf", () => {
  const sponsors = [
    {
      id: "sun",
      blocked: ["13"],
      reps: [{ id: "sam", free: ["10"] }],
    },
  ];
  test("from the board's sponsor, or nothing ticked when it isn't there", () => {
    expect(bookRepOf({ sponsors }, "sun", "sam")).toEqual({
      id: "sam",
      free: ["10"],
      blocked: ["13"],
    });
    expect(bookRepOf({ sponsors }, "moon", "mo")).toEqual({
      id: "mo",
      free: null,
      blocked: [],
    });
  });
});
