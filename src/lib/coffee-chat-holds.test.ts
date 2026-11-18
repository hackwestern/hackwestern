import { describe, expect, test } from "vitest";

import {
  blockFill,
  blockFormatOf,
  blockSlots,
  chatsPerSlot,
  coffeeChatOfferRoom,
  hackersPerSlot,
  holdClash,
  holdCovers,
  holdsForSponsor,
  holdStartTimes,
  holdTimesProblem,
  ownHoldAt,
  ownHoldOverlap,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import { buildSponsorSummaries } from "~/lib/sponsor-organizer";
import {
  freeStartTimes,
  offerProblem,
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
const oneOnOne = (reps: number) => ({
  durationMinutes: 15,
  groupSize: 1,
  reps,
});

describe("hackersPerSlot (chat type x reps)", () => {
  test("1-on-1: one hacker per rep, not capped by the room", () => {
    expect(hackersPerSlot(oneOnOne(1))).toBe(1);
    expect(hackersPerSlot(oneOnOne(3))).toBe(3);
    // 5 reps + 5 hackers is past 6 people: still 5 (only a quiet note).
    expect(hackersPerSlot(oneOnOne(5))).toBe(5);
  });

  test("group of 3 = 3 hackers (one group per sponsor), whatever the reps", () => {
    expect(hackersPerSlot({ durationMinutes: 30, groupSize: 3, reps: 1 })).toBe(
      3,
    );
    expect(hackersPerSlot({ durationMinutes: 30, groupSize: 3, reps: 2 })).toBe(
      3,
    );
    expect(chatsPerSlot({ durationMinutes: 30, groupSize: 3, reps: 2 })).toBe(
      1,
    );
  });

  test("no sheet row: 1-on-1, 15 min", () => {
    expect(blockFormatOf(null, 2)).toEqual(oneOnOne(2));
  });
});

describe("holdClash (two sponsors never share a room at once)", () => {
  const a = hold("a", "Rm 2242", "10:30", "11:00");

  test("another sponsor in the same room at an overlapping time is refused", () => {
    expect(holdClash(a, [use("b", "Rm 2242", "10:45", 15)])).not.toBeNull();
    expect(holdClash(a, [use("b", "rm  2242", "10:00", 60)])).not.toBeNull();
  });

  test("different times or rooms are fine", () => {
    expect(holdClash(a, [use("b", "Rm 2242", "11:00", 30)])).toBeNull();
    expect(holdClash(a, [use("b", "Rm 2242", "10:00", 30)])).toBeNull();
    expect(holdClash(a, [use("b", "Rm 2241", "10:30", 30)])).toBeNull();
    expect(holdClash(a, [use("b", null, "10:30", 30)])).toBeNull();
  });

  test("a sponsor's own blocks may touch but not overlap", () => {
    const own = [
      { ...hold("a", "Rm 2241", "10:00", "10:30"), holdId: "h1" },
      { ...hold("b", "Rm 2242", "10:30", "11:00"), holdId: "h2" },
    ];
    expect(ownHoldOverlap(a, own)).toBeNull();
    expect(
      ownHoldOverlap(hold("a", "Rm 2243", "10:15", "10:45"), own)?.holdId,
    ).toBe("h1");
    // Changing h1 itself is not an overlap with itself.
    expect(
      ownHoldOverlap(hold("a", "Rm 2241", "10:00", "10:45"), own, "h1"),
    ).toBeNull();
  });
});

describe("block times", () => {
  test("on the grid, non-empty, at most 1 hr 30", () => {
    expect(holdTimesProblem("10:30", "11:00")).toBeNull();
    expect(holdTimesProblem("09:00", "10:30")).toBeNull();
    expect(holdTimesProblem("10:10", "11:00")).toBe("offGrid");
    expect(holdTimesProblem("11:00", "11:00")).toBe("empty");
    expect(holdTimesProblem("09:00", "10:45")).toBe("tooLong");
  });

  test("slot starts one chat length apart inside the block", () => {
    const h = hold("a", "Rm 2242", "10:30", "11:15");
    expect(holdStartTimes(h, 15)).toEqual(["10:30", "10:45", "11:00"]);
    expect(holdStartTimes(h, 30)).toEqual(["10:30"]);
    expect(holdCovers(h, { slotTime: "11:00" })).toBe(true);
    expect(holdCovers(h, { slotTime: "11:15" })).toBe(false);
  });
});

describe("a chat goes in its sponsor's block, or nowhere", () => {
  const holds = [
    hold("a", "Rm 2242", "10:30", "11:00"),
    hold("b", "Rm 2243", "10:30", "11:00"),
  ];

  test("the block's room, else none", () => {
    expect(coffeeChatOfferRoom(holds, "a", { slotTime: "10:45" })).toBe(
      "Rm 2242",
    );
    expect(coffeeChatOfferRoom(holds, "a", { slotTime: "10:00" })).toBeNull();
    expect(ownHoldAt(holds, "b", { slotTime: "10:30" })?.room).toBe("Rm 2243");
  });

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
    holds: [holds[0]!],
    now: early,
  };

  test("offers need a covering block; the sheet window alone offers nothing", () => {
    expect(offerProblem(base)).toBeNull();
    expect(offerProblem({ ...base, setup: null })).toBeNull();
    expect(offerProblem({ ...base, holds: [] })).toBe("noBlock");
    expect(offerProblem({ ...base, slotTime: "10:00" })).toBe("noBlock");
  });

  test("a 1-on-1 slot with 3 reps takes 3 hackers, then is full", () => {
    const three = { ...base, reps: 3 };
    const chats = [
      use("a", "Rm 2242", "10:45", 15),
      use("a", "Rm 2242", "10:45", 15),
    ];
    expect(offerProblem({ ...three, sponsorChats: chats })).toBeNull();
    expect(
      offerProblem({
        ...three,
        sponsorChats: [...chats, use("a", "Rm 2242", "10:45", 15)],
      }),
    ).toBe("full");
  });

  test("another sponsor in the room blocks the offer", () => {
    expect(
      offerProblem({ ...base, roomChats: [use("b", "Rm 2242", "10:45", 15)] }),
    ).toBe("roomTaken");
  });

  test("free times are the block's slot starts, in the block's room", () => {
    expect(freeStartTimes(base).map((t) => [t.slotTime, t.room])).toEqual([
      ["10:30", "Rm 2242"],
      ["10:45", "Rm 2242"],
    ]);
  });
});

describe("block slots and fill", () => {
  const h = hold("a", "Rm 2243", "09:00", "10:00");

  test("1-on-1, 1 rep: four 15-min slots of 0/1", () => {
    const slots = blockSlots(h, oneOnOne(1), [
      { ...use("a", "Rm 2243", "09:00", 15), chatId: "c1" },
      use("b", "Rm 2241", "09:15", 15),
    ]);
    expect(slots.map((s) => [s.slotTime, s.booked, s.needed])).toEqual([
      ["09:00", 1, 1],
      ["09:15", 0, 1],
      ["09:30", 0, 1],
      ["09:45", 0, 1],
    ]);
    expect(slots[0]!.chatIds).toEqual(["c1"]);
    expect(
      blockFill(h, oneOnOne(1), [use("a", null, "09:00", 15)], early),
    ).toEqual({ filled: 1, total: 4, firstOpen: "09:15" });
  });

  test("group of 3: a chat is filled once all 3 hackers are booked", () => {
    const format = { durationMinutes: 30, groupSize: 3, reps: 2 };
    const two = [use("a", null, "09:00"), use("a", null, "09:00")];
    expect(blockSlots(h, format, two).map((s) => s.needed)).toEqual([3, 3]);
    expect(blockFill(h, format, two).filled).toBe(0);
    expect(blockFill(h, format, [...two, use("a", null, "09:00")]).filled).toBe(
      1,
    );
  });
});

describe("sponsor and organizer views", () => {
  test("a sponsor sees only their own blocks, with fill and no note", () => {
    const holds = [
      { ...hold("b", "Rm 2243", "09:00", "09:30"), holdId: "hb" },
      { ...hold("a", "Rm 2242", "11:00", "11:30"), holdId: "ha2" },
      {
        ...hold("a", "Rm 2242", "10:30", "11:00"),
        holdId: "ha1",
        note: "VIP",
      },
    ];
    const mine = holdsForSponsor(
      holds,
      "a",
      [
        use("a", "Rm 2242", "11:00", 15),
        use("a", "Rm 2242", "11:15", 15),
        use("b", "Rm 2243", "10:30", 15),
      ],
      oneOnOne(1),
      early,
    );
    expect(mine.map((m) => m.holdId)).toEqual(["ha1", "ha2"]);
    expect(mine.map((m) => [m.filled, m.total, m.needsHacker])).toEqual([
      [0, 2, true],
      [2, 2, false],
    ]);
    expect(mine[0]!.firstOpen).toBe("10:30");
    expect(mine.every((m) => !("note" in m) && !("sponsorId" in m))).toBe(true);
    expect(holdsForSponsor(holds, "c", [], oneOnOne(1))).toEqual([]);
  });

  test("organizer summary counts blocks still needing a hacker", () => {
    const summary = buildSponsorSummaries({
      sponsors: [
        { id: "a", name: "Acme" },
        { id: "b", name: "Beta" },
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
      holds: [
        hold("a", "Rm 2242", "10:30", "10:45"),
        hold("b", "Rm 2243", "10:30", "10:45"),
      ],
      now: early,
    });
    expect(summary.needsHacker).toBe(1);
    expect(summary.sponsors.map((s) => [s.name, s.needsHacker])).toEqual([
      ["Acme", 1],
      ["Beta", 0],
    ]);
    expect(summary.sponsors[1]!.rooms).toEqual(["Rm 2243"]);
  });
});
