import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";
import {
  assertCellFree,
  boardDbError,
  type BoardBooking,
  type BoardPlacement,
  type BoardState,
} from "~/server/api/utils/coffee-chat-sessions-board";

const chat: BoardPlacement = {
  id: "p1",
  repId: "r1",
  sponsorId: "s1",
  sessionId: "10",
  room: "2241",
  pinned: false,
  forced: false,
  status: "draft",
  sentAt: null,
  window: { start: 600, end: 660 },
};
const booking: BoardBooking = {
  id: "b1",
  sessionId: "11",
  room: "2241",
  forSponsorId: null,
  label: "Mentors",
  note: null,
};
const state = {
  workshopsAvailable: true,
  lastScheduledAt: null,
  sponsors: [],
  sched: [],
  placements: [chat],
  bookings: [booking],
  board: {},
} satisfies BoardState;

const codeOf = (fn: () => void) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return (e as TRPCError).code;
  }
};

describe("boardDbError", () => {
  test("unique violation 23505 -> CONFLICT, also down the cause chain", () => {
    const direct = boardDbError(Object.assign(new Error("dup"), { code: "23505" }));
    expect(direct).toBeInstanceOf(TRPCError);
    expect(direct).toMatchObject({
      code: "CONFLICT",
      message: "Someone else just changed the board. Refresh and try again.",
    });
    const wrapped = boardDbError(new Error("query failed", { cause: { code: "23505" } }));
    expect(wrapped).toMatchObject({ code: "CONFLICT" });
  });

  test("foreign key violation 23503 -> BAD_REQUEST", () => {
    expect(boardDbError({ code: "23503" })).toMatchObject({ code: "BAD_REQUEST" });
  });

  test("TRPCErrors and other errors pass through unchanged", () => {
    const t = new TRPCError({ code: "NOT_FOUND" });
    expect(boardDbError(t)).toBe(t);
    const other = Object.assign(new Error("deadlock"), { code: "40P01" });
    expect(boardDbError(other)).toBe(other);
  });
});

describe("assertCellFree: chats and bookings share cells", () => {
  test("a booking can't go on a chat, a chat can't go on a booking", () => {
    expect(codeOf(() => assertCellFree(state, "2241", "10"))).toBe("CONFLICT");
    expect(codeOf(() => assertCellFree(state, "2241", "11"))).toBe("CONFLICT");
    expect(codeOf(() => assertCellFree(state, "2241", "10", { bookingId: "b1" }))).toBe("CONFLICT");
    expect(codeOf(() => assertCellFree(state, "2241", "11", { placementId: "p1" }))).toBe("CONFLICT");
  });

  test("the thing being moved doesn't block its own cell; empty cells are free", () => {
    expect(codeOf(() => assertCellFree(state, "2241", "10", { placementId: "p1" }))).toBe("ok");
    expect(codeOf(() => assertCellFree(state, "2241", "11", { bookingId: "b1" }))).toBe("ok");
    expect(codeOf(() => assertCellFree(state, "2242", "10"))).toBe("ok");
    expect(codeOf(() => assertCellFree(state, "9999", "10"))).toBe("BAD_REQUEST");
  });
});
