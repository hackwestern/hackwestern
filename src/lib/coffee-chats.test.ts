import { describe, expect, test } from "vitest";

import {
  COFFEE_CHAT_ROOMS,
  COFFEE_CHAT_SLOTS,
  coffeeChatBlocksFor,
  coffeeChatColorFor,
  coffeeChatSlotKeyOf,
  coffeeChatSlotOrder,
  diffCoffeeChatGrid,
  findCoffeeChatConflicts,
  formatCoffeeChatTime,
  groupCoffeeChatSlotsByHour,
  hexColorToRgb01,
  isBookedBy,
  isCoffeeChatSlot,
  isPureCancellation,
  mergeCoffeeChatBookings,
  normalizeCoffeeChatMinutes,
  parseCoffeeChatGrid,
  sortCoffeeChatSlots,
} from "./coffee-chats";

describe("formatCoffeeChatTime", () => {
  test("12-hour AM/PM output", () => {
    expect(formatCoffeeChatTime("10:00")).toBe("10:00 AM");
    expect(formatCoffeeChatTime("11:45")).toBe("11:45 AM");
    expect(formatCoffeeChatTime("12:00")).toBe("12:00 PM");
    expect(formatCoffeeChatTime("13:15")).toBe("1:15 PM");
    expect(formatCoffeeChatTime("15:45")).toBe("3:45 PM");
    expect(formatCoffeeChatTime("09:05")).toBe("9:05 AM");
  });

  test("malformed input passes through unchanged", () => {
    expect(formatCoffeeChatTime("nonsense")).toBe("nonsense");
  });
});

describe("diffCoffeeChatGrid", () => {
  test("changes are limited to added/removed/retaken slots", () => {
    const current = [
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
    ];
    const next = [
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 1, time: "10:15", sponsor: "Acme Co" },
      {
        room: 2,
        time: "10:15",
        sponsor: "Beta Corp",
      },
    ];
    expect(diffCoffeeChatGrid(current, next)).toEqual([
      { roomIndex: 0, slotIndex: 1, sponsor: "Acme Co" },
    ]);
  });

  test("clearing a slot emits an empty-sponsor change", () => {
    const current = [{ room: 1, time: "10:00", sponsor: "Acme Co" }];
    expect(diffCoffeeChatGrid(current, [])).toEqual([
      { roomIndex: 0, slotIndex: 0, sponsor: "" },
    ]);
  });

  test("no changes when grids match, even with differing casing", () => {
    const current = [{ room: 1, time: "10:00", sponsor: "ACME  CO" }];
    const next = [{ room: 1, time: "10:00", sponsor: "Acme Co" }];
    expect(diffCoffeeChatGrid(current, next)).toEqual([]);
  });

  test("positions map onto the canonical grid", () => {
    // Room 3, slot "15:45" = last room row, last slot column.
    expect(
      diffCoffeeChatGrid([], [{ room: 3, time: "15:45", sponsor: "X" }]),
    ).toEqual([
      { roomIndex: 2, slotIndex: COFFEE_CHAT_SLOTS.length - 1, sponsor: "X" },
    ]);
  });
});

describe("slots", () => {
  test("Saturday 10:00–16:00 in 15-minute steps, 24 per room", () => {
    expect(COFFEE_CHAT_SLOTS.length).toBe(24);
    expect(COFFEE_CHAT_SLOTS[0]).toBe("10:00");
    expect(COFFEE_CHAT_SLOTS[1]).toBe("10:15");
    expect(COFFEE_CHAT_SLOTS[COFFEE_CHAT_SLOTS.length - 1]).toBe("15:45");
  });

  test("rooms are 1-3", () => {
    expect(COFFEE_CHAT_ROOMS.map((room) => room.id)).toEqual([1, 2, 3]);
  });

  test("isCoffeeChatSlot rejects unknown rooms/times", () => {
    expect(isCoffeeChatSlot({ room: 1, time: "10:00" })).toBe(true);
    expect(isCoffeeChatSlot({ room: 4, time: "10:00" })).toBe(false);
    expect(isCoffeeChatSlot({ room: 1, time: "16:00" })).toBe(false);
    expect(isCoffeeChatSlot({ room: 1, time: "09:45" })).toBe(false);
  });

  test("slot keys and ordering are stable", () => {
    expect(coffeeChatSlotKeyOf({ room: 2, time: "10:15" })).toBe("2:10:15");
    const sorted = sortCoffeeChatSlots([
      { room: 2, time: "10:00" },
      { room: 1, time: "10:45" },
      { room: 1, time: "10:00" },
      { room: 2, time: "09:30" },
    ]);
    expect(sorted.map((slot) => coffeeChatSlotKeyOf(slot))).toEqual([
      "1:10:00",
      "1:10:45",
      "2:10:00",
      "2:09:30",
    ]);
    // Unknown slots sort to the end.
    expect(coffeeChatSlotOrder({ room: 1, time: "23:99" })).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  test("hour groups split on the 24h hour and label AM/PM", () => {
    const groups = groupCoffeeChatSlotsByHour(COFFEE_CHAT_SLOTS);
    expect(groups[0]).toEqual({
      label: "10 AM",
      slots: ["10:00", "10:15", "10:30", "10:45"],
    });
    expect(groups.find((group) => group.label === "12 PM")?.slots).toEqual([
      "12:00",
      "12:15",
      "12:30",
      "12:45",
    ]);
    expect(groups[groups.length - 1]?.label).toBe("3 PM");
    expect(groups.length).toBe(6);
  });
});

describe("normalizeCoffeeChatMinutes", () => {
  test("empty, blank, or missing is 0 (no allowance)", () => {
    expect(normalizeCoffeeChatMinutes(undefined)).toBe(0);
    expect(normalizeCoffeeChatMinutes(null)).toBe(0);
    expect(normalizeCoffeeChatMinutes("")).toBe(0);
    expect(normalizeCoffeeChatMinutes("   ")).toBe(0);
  });

  test("parses sheet values (strings, commas, invisible chars)", () => {
    expect(normalizeCoffeeChatMinutes(60)).toBe(60);
    expect(normalizeCoffeeChatMinutes("60")).toBe(60);
    expect(normalizeCoffeeChatMinutes(" 90 ")).toBe(90);
    expect(normalizeCoffeeChatMinutes("1,200\u202c")).toBe(1200);
  });

  test("garbage and negatives are 0", () => {
    expect(normalizeCoffeeChatMinutes("open bar")).toBe(0);
    expect(normalizeCoffeeChatMinutes(-30)).toBe(0);
    expect(normalizeCoffeeChatMinutes("0")).toBe(0);
    expect(normalizeCoffeeChatMinutes(Infinity)).toBe(0);
  });

  test("floors fractional values", () => {
    expect(normalizeCoffeeChatMinutes(45.9)).toBe(45);
  });
});

describe("coffeeChatBlocksFor", () => {
  test("minutes to 15-minute blocks", () => {
    expect(coffeeChatBlocksFor(0)).toBe(0);
    expect(coffeeChatBlocksFor(14)).toBe(0);
    expect(coffeeChatBlocksFor(15)).toBe(1);
    expect(coffeeChatBlocksFor(45)).toBe(3);
    expect(coffeeChatBlocksFor(60)).toBe(4);
    expect(coffeeChatBlocksFor(47)).toBe(3);
  });
});

describe("colors", () => {
  test("deterministic per sponsor name", () => {
    expect(coffeeChatColorFor("Acme Co")).toBe(coffeeChatColorFor("acme  co"));
    expect(coffeeChatColorFor("Acme Co")).toMatch(/^#[0-9a-f]{6}$/);
    expect(coffeeChatColorFor("Acme Co")).not.toBe(
      coffeeChatColorFor("Beta Corp"),
    );
  });

  test("hex converts to 0-1 sheet channels", () => {
    expect(hexColorToRgb01("#ff0000")).toEqual({ red: 1, green: 0, blue: 0 });
    expect(hexColorToRgb01("#4f46e5")).toEqual({
      red: 0x4f / 255,
      green: 0x46 / 255,
      blue: 0xe5 / 255,
    });
  });
});

describe("parseCoffeeChatGrid", () => {
  // Rooms across the top (header row), times stacked down column A.
  function headerRow(): (string | undefined)[] {
    return ["Time", "Room A", "Room B", "Room C"];
  }

  function timeRow(
    time: string,
    rooms: (string | undefined)[] = [],
  ): (string | undefined)[] {
    return [time, ...rooms];
  }

  test("parses a canonical grid", () => {
    const rows = [
      headerRow(),
      timeRow("10:00", [undefined, "Acme Co", undefined]),
      timeRow("10:15", [undefined, "Acme Co", undefined]),
      timeRow("10:30", [undefined, undefined, "Beta Corp"]),
      timeRow("10:45", [undefined, undefined, undefined]),
    ];

    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 2, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:15", sponsor: "Acme Co" },
      { room: 3, time: "10:30", sponsor: "Beta Corp" },
    ]);
  });

  test("skips preamble rows before the header", () => {
    const rows = [
      timeRow("Coffee Chats — Saturday"),
      timeRow("", ["junk", "notes"]),
      headerRow(),
      timeRow("10:00", ["Acme Co"]),
      timeRow("10:15"),
    ];

    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 1, time: "10:00", sponsor: "Acme Co" },
    ]);
  });

  test("renamed room columns map by position, extras beyond three ignored", () => {
    const rows = [
      ["", "Quiet Lounge", "Big Room", "Chill Corner", "Extra Column"],
      timeRow("10:00", ["Acme Co", undefined, undefined, "Gamma"]),
      timeRow("10:15", [undefined, "Beta Corp"]),
    ];
    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
    ]);
  });

  test("unknown time labels are skipped, parsing continues", () => {
    const rows = [
      headerRow(),
      timeRow("10:00", ["Acme Co"]),
      timeRow("10:15", [undefined, "Beta Corp"]),
      timeRow("9:30", ["Not a slot mid-grid"]),
      timeRow("", ["lunch break note"]),
      timeRow("10:30", [undefined, undefined, "Gamma"]),
    ];
    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
      { room: 3, time: "10:30", sponsor: "Gamma" },
    ]);
  });

  test("dup sheet copies below the grid don't double-book (first cell wins)", () => {
    const rows = [
      headerRow(),
      timeRow("10:00", ["Acme Co"]),
      timeRow("10:15"),
      timeRow("10:00", ["Beta Corp"]),
      timeRow("10:15", ["Beta Corp"]),
    ];
    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 1, time: "10:15", sponsor: "Beta Corp" },
    ]);
  });

  test("12-hour AM/PM time labels map back to canonical slots", () => {
    const rows = [
      ["Time", "Rm 2241", "Rm 2242", "Rm 2243"],
      timeRow("10:00 AM", ["Acme Co"]),
      timeRow("10:15 am", [undefined, "Beta Corp"]),
      timeRow("12:00 PM", [undefined, undefined, "Noon"]),
      timeRow("1:15 pm", ["Afternoon"]),
      timeRow("3:45 PM", [undefined, undefined, "Last"]),
      timeRow("11:60 AM", ["garbage minutes"]),
      timeRow("6:00 PM", ["outside the window"]),
    ];
    expect(parseCoffeeChatGrid(rows)).toEqual([
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 1, time: "13:15", sponsor: "Afternoon" },
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
      { room: 3, time: "12:00", sponsor: "Noon" },
      { room: 3, time: "15:45", sponsor: "Last" },
    ]);
  });

  test("no two consecutive time rows parses to nothing", () => {
    expect(parseCoffeeChatGrid([])).toEqual([]);
    expect(
      parseCoffeeChatGrid([headerRow(), timeRow("10:00", ["Acme Co"])]),
    ).toEqual([]);
    expect(
      parseCoffeeChatGrid([
        timeRow("Coffee Chats", ["Rm 2241"]),
        ["Random", "10:00"],
      ]),
    ).toEqual([]);
  });
});

describe("findCoffeeChatConflicts", () => {
  const existing = [
    { room: 1, time: "10:00", sponsor: "Acme Co" },
    { room: 2, time: "10:15", sponsor: "Beta Corp" },
  ];

  test("flags slots held by other sponsors", () => {
    const conflicts = findCoffeeChatConflicts(
      [
        { room: 1, time: "10:00" },
        { room: 3, time: "11:00" },
      ],
      existing,
      "Gamma LLC",
    );
    expect(conflicts).toEqual([{ room: 1, time: "10:00" }]);
  });

  test("own bookings (any casing) are not conflicts", () => {
    const conflicts = findCoffeeChatConflicts(
      [{ room: 1, time: "10:00" }],
      existing,
      "\u202cACME  co",
    );
    expect(conflicts).toEqual([]);
  });

  test("free slots are not conflicts", () => {
    expect(
      findCoffeeChatConflicts([{ room: 3, time: "15:45" }], existing, "Gamma"),
    ).toEqual([]);
  });
});

describe("isPureCancellation", () => {
  const existing = [
    { room: 1, time: "10:00", sponsor: "Acme Co" },
    { room: 1, time: "10:15", sponsor: "Acme Co" },
    { room: 2, time: "10:00", sponsor: "Beta Corp" },
  ];

  test("subset of own bookings only", () => {
    expect(
      isPureCancellation(
        [{ room: 1, time: "10:15" }],
        existing,
        "Acme Co",
      ),
    ).toBe(true);
    expect(
      isPureCancellation([{ room: 2, time: "10:00" }], existing, "Acme Co"),
    ).toBe(false);
    expect(
      isPureCancellation(
        [{ room: 3, time: "10:00" }],
        existing,
        "Acme Co",
      ),
    ).toBe(false);
  });

  test("empty selection is a pure cancellation", () => {
    expect(isPureCancellation([], existing, "Acme Co")).toBe(true);
  });
});

describe("mergeCoffeeChatBookings", () => {
  test("keeps others, replaces the sponsor's own set", () => {
    const current = [
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
      { room: 1, time: "10:15", sponsor: "acme  co" },
    ];
    const merged = mergeCoffeeChatBookings(current, "Acme Co", [
      { room: 3, time: "12:00" },
      { room: 1, time: "10:00" },
    ]);
    expect(merged).toEqual([
      { room: 2, time: "10:15", sponsor: "Beta Corp" },
      { room: 3, time: "12:00", sponsor: "Acme Co" },
      { room: 1, time: "10:00", sponsor: "Acme Co" },
    ]);
  });

  test("empty request cancels all of the sponsor's slots", () => {
    const current = [
      { room: 1, time: "10:00", sponsor: "Acme Co" },
      { room: 2, time: "10:00", sponsor: "Beta Corp" },
    ];
    expect(mergeCoffeeChatBookings(current, "Acme Co", [])).toEqual([
      { room: 2, time: "10:00", sponsor: "Beta Corp" },
    ]);
  });
});

describe("isBookedBy", () => {
  test("case- and invisible-char-insensitive", () => {
    expect(isBookedBy({ room: 1, time: "10:00", sponsor: "Acme Co" }, "acme  co")).toBe(true);
    expect(
      isBookedBy(
        { room: 1, time: "10:00", sponsor: "Acme Co" },
        "Beta Corp",
      ),
    ).toBe(false);
  });
});
