import { describe, expect, test } from "vitest";

import {
  coffeeChatOfferRoom,
  holdClash,
  holdCovers,
  holdNeedsHacker,
  holdsForSponsor,
  holdStartTimes,
  holdTimesProblem,
  ownHoldAt,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import { buildRoomTable, boardStats } from "~/lib/coffee-chat-room-table";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import { buildSponsorSummaries } from "~/lib/sponsor-organizer";
import {
  freeStartTimes,
  offerProblem,
  offerRoomAt,
} from "~/server/api/utils/coffee-chat-capacity";

const hold = (
  sponsorId: string,
  room: string,
  startTime: string,
  endTime: string,
): HoldSpan => ({ sponsorId, room, startTime, endTime });
const use = (
  sponsorId: string,
  room: string | null,
  slotTime: string,
  durationMinutes = 30,
) => ({ sponsorId, room, slotTime, durationMinutes });
const early = new Date("2026-11-21T08:00:00-05:00");

describe("holdClash (overlap rules)", () => {
  const a = hold("a", "Rm 2242", "10:30", "11:00");

  test("another sponsor in the same room at an overlapping time is refused", () => {
    expect(holdClash(a, [use("b", "Rm 2242", "10:45", 15)])).not.toBeNull();
    // A hold, a chat or a room window: all room uses.
    expect(holdClash(a, [use("b", "rm  2242", "10:00", 60)])).not.toBeNull();
  });

  test("the same sponsor may hold adjacent or overlapping times", () => {
    expect(
      holdClash(a, [
        use("a", "Rm 2242", "10:00", 30),
        use("a", "Rm 2242", "10:45", 30),
      ]),
    ).toBeNull();
  });

  test("different times or rooms are fine", () => {
    expect(holdClash(a, [use("b", "Rm 2242", "11:00", 30)])).toBeNull();
    expect(holdClash(a, [use("b", "Rm 2242", "10:00", 30)])).toBeNull();
    expect(holdClash(a, [use("b", "Rm 2241", "10:30", 30)])).toBeNull();
    expect(holdClash(a, [use("b", null, "10:30", 30)])).toBeNull();
  });
});

describe("hold times", () => {
  test("on the grid, non-empty, at most 4 hours", () => {
    expect(holdTimesProblem("10:30", "11:00")).toBeNull();
    expect(holdTimesProblem("10:10", "11:00")).toBe("offGrid");
    expect(holdTimesProblem("11:00", "11:00")).toBe("empty");
    expect(holdTimesProblem("09:00", "13:15")).toBe("tooLong");
  });

  test("start times one chat length apart inside the hold", () => {
    const h = hold("a", "Rm 2242", "10:30", "11:15");
    expect(holdStartTimes(h, 15)).toEqual(["10:30", "10:45", "11:00"]);
    expect(holdStartTimes(h, 30)).toEqual(["10:30"]);
    expect(holdCovers(h, { slotTime: "11:00" })).toBe(true);
    expect(holdCovers(h, { slotTime: "11:15" })).toBe(false);
  });
});

describe("room precedence", () => {
  test("hold > moved chats > organizer room > sheet room > none", () => {
    const all = {
      holdRoom: "Rm 2242",
      movedRoom: "Rm 2243",
      assignedRoom: "Rm 2241",
      sheetRoom: "Rm 9999",
    };
    expect(coffeeChatOfferRoom(all)).toBe("Rm 2242");
    expect(coffeeChatOfferRoom({ ...all, holdRoom: null })).toBe("Rm 2243");
    expect(
      coffeeChatOfferRoom({ ...all, holdRoom: null, movedRoom: null }),
    ).toBe("Rm 2241");
    expect(
      coffeeChatOfferRoom({ sheetRoom: "Rm 9999", assignedRoom: " " }),
    ).toBe("Rm 9999");
    expect(coffeeChatOfferRoom({})).toBeNull();
  });

  test("a chat inside the sponsor's own hold takes the hold's room", () => {
    const holds = [
      hold("a", "Rm 2242", "10:30", "11:00"),
      hold("b", "Rm 2243", "10:30", "11:00"),
    ];
    const at = (slotTime: string) =>
      offerRoomAt({
        sponsorId: "a",
        sponsorChats: [],
        setupRoom: "Rm 2241",
        holds,
        slot: { slotTime, durationMinutes: 15 },
      });
    expect(at("10:45")).toBe("Rm 2242");
    expect(at("10:00")).toBe("Rm 2241");
    expect(ownHoldAt(holds, "b", { slotTime: "10:30" })?.room).toBe("Rm 2243");
  });
});

describe("offers with holds", () => {
  const setup: CoffeeChatSetup = {
    sponsor: "A",
    windowStart: "10:00",
    windowEnd: "10:30",
    durationMinutes: 15,
    groupSize: 1,
    slots: null,
    hackers: null,
    format: null,
    room: "Rm 2241",
  };
  const base = {
    setup,
    slotTime: "10:45",
    reps: 1,
    sponsorId: "a",
    sponsorChats: [],
    hackerChats: [],
    roomChats: [],
    holds: [hold("a", "Rm 2242", "10:30", "11:00")],
    now: early,
  };

  test("a hold adds offerable start times outside the window", () => {
    expect(offerProblem(base)).toBeNull();
    expect(offerProblem({ ...base, holds: [] })).toBe("notInWindow");
    expect(offerProblem({ ...base, setup: null })).toBeNull();
    expect(offerProblem({ ...base, setup: null, holds: [] })).toBe("notSetUp");
  });

  test("another sponsor's hold in the room blocks the offer", () => {
    expect(
      offerProblem({
        ...base,
        roomChats: [use("b", "Rm 2242", "10:45", 15)],
      }),
    ).toBe("roomTaken");
    // Their hold is in another room: fine.
    expect(
      offerProblem({
        ...base,
        roomChats: [use("b", "Rm 2241", "10:45", 15)],
      }),
    ).toBeNull();
  });

  test("free times include the hold's starts, in the hold's room", () => {
    const times = freeStartTimes(base);
    expect(times.map((t) => [t.slotTime, t.room])).toEqual([
      ["10:00", "Rm 2241"],
      ["10:15", "Rm 2241"],
      ["10:30", "Rm 2242"],
      ["10:45", "Rm 2242"],
    ]);
  });
});

describe("needs a hacker", () => {
  const h = hold("a", "Rm 2242", "10:30", "11:00");

  test("until a live chat of the same sponsor overlaps the hold", () => {
    expect(holdNeedsHacker(h, [])).toBe(true);
    expect(holdNeedsHacker(h, [use("b", null, "10:30")])).toBe(true);
    expect(holdNeedsHacker(h, [use("a", "Rm 2242", "10:45", 15)])).toBe(false);
    expect(holdNeedsHacker(h, [use("a", "Rm 2242", "11:00", 15)])).toBe(true);
  });

  test("room table: held cell warns, then fills with the chat", () => {
    const board = {
      slots: ["10:30", "10:45"],
      sponsors: [
        {
          sponsorId: "a",
          sponsor: "Acme",
          setUp: false,
          windowStart: null,
          windowEnd: null,
          reps: 1,
          room: null,
          cells: [],
        },
      ],
      chats: [],
      holds: [{ ...h, holdId: "h1", needsHacker: true }],
    };
    const table = buildRoomTable(board);
    const cell = table.rows[0]![table.rooms.indexOf("Rm 2242")]!;
    expect(cell.needsHacker).toBe(true);
    expect(cell.occupants.map((o) => o.sponsor)).toEqual(["Acme"]);
    expect(cell.occupants[0]!.hold).toEqual({
      holdId: "h1",
      needsHacker: true,
    });
    // Other rooms stay free.
    expect(table.rows[0]![table.rooms.indexOf("Rm 2241")]!.state).toBe("free");
    expect(boardStats(board, null).needsHacker).toBe(1);
    expect(boardStats(board, new Set(["Other"])).needsHacker).toBe(0);

    const filled = {
      ...board,
      chats: [
        {
          chatId: "c1",
          sponsorId: "a",
          slotTime: "10:30",
          durationMinutes: 15,
          room: "Rm 2242",
          status: "pending",
        },
      ],
      holds: [{ ...h, holdId: "h1", needsHacker: false }],
    };
    const after = buildRoomTable(filled).rows[0]![1]!;
    expect(after.needsHacker).toBe(false);
    expect(after.occupants[0]!.hackers).toBe(1);
  });

  test("a hold elsewhere takes the sponsor out of their usual room", () => {
    const board = {
      slots: ["10:30"],
      sponsors: [
        {
          sponsorId: "a",
          sponsor: "Acme",
          setUp: true,
          windowStart: "10:00",
          windowEnd: "12:00",
          reps: 1,
          room: "Rm 2241",
          cells: [],
        },
      ],
      chats: [],
      holds: [{ ...h, holdId: "h1", needsHacker: true }],
    };
    const row = buildRoomTable(board).rows[0]!;
    expect(row[0]!.state).toBe("free"); // Rm 2241
    expect(row[1]!.occupants).toHaveLength(1); // Rm 2242
  });

  test("organizer summary counts holds needing a hacker per sponsor", () => {
    const summary = buildSponsorSummaries({
      sponsors: [
        { id: "a", name: "Acme", coffeeChatRoom: null },
        { id: "b", name: "Beta", coffeeChatRoom: null },
      ],
      setups: [],
      chats: [
        {
          sponsorId: "b",
          room: "Rm 2243",
          slotTime: "10:30",
          durationMinutes: 15,
          status: "accepted",
        },
      ],
      help: [],
      holds: [h, hold("b", "Rm 2243", "10:30", "11:00")],
      now: early,
    });
    expect(summary.needsHacker).toBe(1);
    expect(summary.sponsors.map((s) => [s.name, s.needsHacker])).toEqual([
      ["Acme", 1],
      ["Beta", 0],
    ]);
  });
});

describe("holdsForSponsor (privacy)", () => {
  test("a sponsor sees only their own holds, with no organizer note", () => {
    const holds = [
      { ...hold("b", "Rm 2243", "09:00", "09:30"), holdId: "hb" },
      { ...hold("a", "Rm 2242", "11:00", "11:30"), holdId: "ha2" },
      {
        ...hold("a", "Rm 2242", "10:30", "11:00"),
        holdId: "ha1",
        note: "VIP",
      },
    ];
    const mine = holdsForSponsor(holds, "a", [
      use("a", "Rm 2242", "11:00", 15),
      use("b", "Rm 2243", "10:30", 15),
    ]);
    expect(mine.map((m) => m.holdId)).toEqual(["ha1", "ha2"]);
    expect(mine.map((m) => m.needsHacker)).toEqual([true, false]);
    expect(mine.every((m) => !("note" in m) && !("sponsorId" in m))).toBe(true);
    expect(holdsForSponsor(holds, "c", [])).toEqual([]);
  });
});
