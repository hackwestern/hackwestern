import { describe, expect, test } from "vitest";

import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import {
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
    chattingHours: null,
    slots: null,
    hackers: null,
    format: null,
    notes: null,
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

const row = (id: string, name: string, over: object = {}) => ({
  id,
  name,
  style: null,
  perSlot: null,
  watcher: null,
  ...over,
});

describe("buildChatBoard", () => {
  test("sponsors, requests, sheet numbers, counts and totals", () => {
    const board = buildChatBoard({
      sponsors: [
        row("a", "Acme", { watcher: "Sam" }),
        row("b", "Beta", { style: "oneOnOne", perSlot: 2 }),
        row("c", "Cobalt"),
        row("d", "Delta"),
      ],
      setups: [
        setup({
          sponsor: "Beta",
          windowStart: "10:30",
          windowEnd: "11:30",
          durationMinutes: 30,
          groupSize: 3,
          format: "Groups (30 mins with 3 people)",
          chattingHours: 3,
          slots: 12,
          hackers: 36,
        }),
        setup({
          sponsor: "Acme",
          format: "Individual (15 mins)",
          notes: "3-4 reps (notes based on 3)",
        }),
        setup({ sponsor: "Blank Co", windowStart: null, windowEnd: null }),
        setup({ sponsor: "Cobalt", windowStart: null, windowEnd: null }),
      ],
      chats: [
        chat("a", "10:00", "accepted"),
        chat("a", "10:15", "pending"),
        chat("b", "10:30", "declined", 30),
        // Delta has no sheet row but has a chat: still listed.
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
    const [acme, beta, blank, cobalt] = board.sponsors;
    expect(acme).toMatchObject({
      watcher: "Sam",
      request: { style: "oneOnOne", perSlot: 3, source: "sheet" },
      counts: { accepted: 1, pending: 1, total: 2 },
      booked: 2,
    });
    // Beta answered 1-on-1 x 2; the length stays the sheet's 30 min.
    expect(beta).toMatchObject({
      request: {
        style: "oneOnOne",
        perSlot: 2,
        durationMinutes: 30,
        source: "sponsor",
      },
      sheet: { chattingHours: 3, slots: 12, hackers: 36 },
      // The sheet's own numbers: 12 x 3 = 36 adds up, 3 h != 12 slots.
      mismatch: ["hours"],
      booked: 0,
    });
    expect(blank!.sponsorId).toBeNull();
    expect(cobalt!.request.source).toBe("none");
    expect(board.totals).toEqual({
      offered: 4,
      accepted: 1,
      pending: 2,
      needsHacker: 0,
    });
    expect(board.roomsInUse).toEqual([]);
  });
});

describe("buildChatBoard with room blocks", () => {
  const sponsors = [row("h", "Holdco", { style: "oneOnOne", perSlot: 2 })];
  const holds = [
    {
      holdId: "h1",
      sponsorId: "h",
      room: "Rm 2242",
      startTime: "13:00",
      endTime: "13:30",
      note: null,
    },
  ];

  test("a block-only sponsor is listed; slots show booked / asked", () => {
    const board = buildChatBoard({
      sponsors,
      setups: [],
      chats: [{ ...chat("h", "13:00"), room: "Rm 2242" }],
      holds,
      limits: [
        { sponsorId: "h", startTime: "13:15", endTime: "13:30", hackers: 1 },
      ],
      now: morning,
    });
    expect(board.slots).toEqual(["13:00", "13:15"]);
    const s = board.sponsors[0]!;
    expect(s).toMatchObject({
      sponsor: "Holdco",
      blockMinutes: 30,
      booked: 1,
      asked: 3,
      holdsNeedingHacker: 1,
    });
    expect(
      board.holds[0]!.slots.map((x) => [x.booked, x.needed, x.lowered]),
    ).toEqual([
      [1, 2, false],
      [0, 1, true],
    ]);
    expect(board.holds[0]).toMatchObject({
      sponsor: "Holdco",
      booked: 1,
      needed: 3,
      filled: 1,
      total: 3,
      needsHacker: true,
    });
    expect(board.totals.needsHacker).toBe(1);
    expect(board.roomsInUse).toEqual(["Rm 2242"]);
  });

  test("filling every asked seat clears it; a declined chat doesn't", () => {
    const withChats = (status: CoffeeChatStatus) =>
      buildChatBoard({
        sponsors,
        setups: [],
        chats: ["13:00", "13:00", "13:15", "13:15"].map((t) => ({
          ...chat("h", t, status),
          room: "Rm 2242",
        })),
        holds,
        now: morning,
      });
    expect(withChats("pending").holds[0]!.needsHacker).toBe(false);
    expect(withChats("pending").totals.needsHacker).toBe(0);
    expect(withChats("declined").holds[0]!.needsHacker).toBe(true);
  });
});
