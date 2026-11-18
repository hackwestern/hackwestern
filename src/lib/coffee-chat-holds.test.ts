import { describe, expect, test } from "vitest";

import {
  blockFill,
  blockSlots,
  coffeeChatOfferRoom,
  holdClash,
  holdCovers,
  holdsForSponsor,
  holdStartTimes,
  holdTimesProblem,
  ownHoldAt,
  ownHoldOverlap,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import type { ChatRequest } from "~/lib/coffee-chat-request";
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
const oneOnOne = (reps: number): ChatRequest => ({
  style: "oneOnOne",
  perSlot: reps,
  durationMinutes: 15,
  source: "sponsor",
});
const groupOf = (hackers: number): ChatRequest => ({
  style: "group",
  perSlot: hackers,
  durationMinutes: 30,
  source: "sponsor",
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

  const base = {
    request: oneOnOne(1),
    slotTime: "10:45",
    sponsorId: "a",
    sponsorChats: [],
    hackerChats: [],
    roomChats: [],
    holds: [holds[0]!],
    now: early,
  };

  test("offers need a covering block; the sheet window alone offers nothing", () => {
    expect(offerProblem(base)).toBeNull();
    expect(offerProblem({ ...base, holds: [] })).toBe("noBlock");
    expect(offerProblem({ ...base, slotTime: "10:00" })).toBe("noBlock");
  });

  test("a 1-on-1 slot with 3 reps takes 3 hackers, then is full", () => {
    const three = { ...base, request: oneOnOne(3) };
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
      blockFill(h, oneOnOne(1), [use("a", null, "09:00", 15)], [], early),
    ).toEqual({ filled: 1, total: 4, firstOpen: "09:15" });
  });

  test("1-on-1 with 3 reps: 3 hackers per slot, past 6 people is fine", () => {
    expect(blockSlots(h, oneOnOne(3), []).map((s) => s.needed)).toEqual([
      3, 3, 3, 3,
    ]);
    expect(blockSlots(h, oneOnOne(6), [])[0]!.needed).toBe(6);
  });

  test("group of M hackers: a chat is filled once all M are booked", () => {
    const format = groupOf(3);
    const two = [use("a", null, "09:00"), use("a", null, "09:00")];
    expect(blockSlots(h, format, two).map((s) => s.needed)).toEqual([3, 3]);
    expect(blockFill(h, format, two).filled).toBe(0);
    expect(blockFill(h, format, [...two, use("a", null, "09:00")]).filled).toBe(
      1,
    );
    expect(blockFill(h, format, two).total).toBe(2);
  });

  test("an ask for fewer lowers a slot, down to 0 (no chat then)", () => {
    const limits = [
      { sponsorId: "a", startTime: "09:15", endTime: "09:30", hackers: 2 },
      { sponsorId: "a", startTime: "09:30", endTime: "10:00", hackers: 0 },
      // Overlapping asks: the lowest wins.
      { sponsorId: "a", startTime: "09:00", endTime: "10:00", hackers: 1 },
      { sponsorId: "b", startTime: "09:00", endTime: "10:00", hackers: 0 },
    ];
    const slots = blockSlots(h, oneOnOne(3), [], limits);
    expect(slots.map((s) => [s.needed, s.requested, s.lowered])).toEqual([
      [1, 3, true],
      [1, 3, true],
      [0, 3, true],
      [0, 3, true],
    ]);
    const fill = blockFill(h, oneOnOne(3), [use("a", null, "09:00", 15)], limits);
    expect(fill).toEqual({ filled: 1, total: 2, firstOpen: "09:15" });
    expect(blockSlots(h, oneOnOne(3), [])[0]!.lowered).toBe(false);
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
      [],
      early,
    );
    expect(mine.map((m) => m.holdId)).toEqual(["ha1", "ha2"]);
    expect(mine.map((m) => [m.filled, m.total, m.needsHacker])).toEqual([
      [0, 2, true],
      [2, 2, false],
    ]);
    expect(mine[0]!.firstOpen).toBe("10:30");
    expect(mine.every((m) => !("note" in m) && !("sponsorId" in m))).toBe(true);
    expect(mine[1]!.slots.map((x) => x.booked)).toEqual([1, 1]);
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
