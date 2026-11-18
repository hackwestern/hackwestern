import { describe, expect, test } from "vitest";

import {
  askedAt,
  chatRequestOf,
  sheetMismatch,
} from "~/lib/coffee-chat-request";
import { parseCoffeeChatsTab } from "~/server/api/utils/run-of-show-parse";

// The owner's Coffee Chats tab, as pasted (2026-11-18).
const SHEET = parseCoffeeChatsTab([
  ["Sponsor", "AVAILABILITY START", "AVAILABILITY END", "CHATTING HOURS", "SLOTS", "HACKERS CHATTING", "FORMAT", "NOTES"],
  ["StarTech", "9:00 AM", "1:00 PM", "2", "24", "24", "Individual (15 mins)", "3-4 reps (notes based on 3)"],
  ["Sunlife", "10:00 AM", "4:00 PM", "3", "12", "36", "Groups (30 mins with 3 people)", ""],
  ["Canada Life", "10:00 AM", "12:00 PM", "3", "4", "12", "Groups (30 mins with 3 people)", ""],
  ["Scotiabank"],
  ["CSE"],
]);
const row = (name: string) => SHEET.find((s) => s.sponsor === name)!;

describe("chatRequestOf: sheet defaults until the sponsor answers", () => {
  test("Individual -> 1-on-1 with 3 reps (3 hackers per slot)", () => {
    expect(chatRequestOf(row("StarTech"))).toEqual({
      style: "oneOnOne",
      perSlot: 3,
      durationMinutes: 15,
      source: "sheet",
    });
  });

  test("Groups with 3 people -> one group of 3, 30 min", () => {
    expect(chatRequestOf(row("Sunlife"))).toEqual({
      style: "group",
      perSlot: 3,
      durationMinutes: 30,
      source: "sheet",
    });
    expect(chatRequestOf(row("Canada Life")).perSlot).toBe(3);
  });

  test("a blank row is no request yet, still booked as 3 per slot", () => {
    for (const name of ["Scotiabank", "CSE"]) {
      expect(chatRequestOf(row(name))).toMatchObject({
        source: "none",
        style: "oneOnOne",
        perSlot: 3,
      });
    }
    expect(chatRequestOf(null).source).toBe("none");
  });

  test("the sponsor's answer wins; the length stays the sheet's", () => {
    expect(
      chatRequestOf(row("Sunlife"), { style: "oneOnOne", perSlot: 2 }),
    ).toEqual({
      style: "oneOnOne",
      perSlot: 2,
      durationMinutes: 30,
      source: "sponsor",
    });
    // At most 3 hackers per slot, whatever was saved.
    expect(
      chatRequestOf(row("Sunlife"), { style: "group", perSlot: 6 }).perSlot,
    ).toBe(3);
    // Half-saved or unknown values fall back to the sheet.
    expect(
      chatRequestOf(row("StarTech"), { style: "group", perSlot: null }).source,
    ).toBe("sheet");
    expect(
      chatRequestOf(row("StarTech"), { style: "panel", perSlot: 2 }).source,
    ).toBe("sheet");
  });
});

describe("askedAt", () => {
  const limits = [
    { sponsorId: "a", startTime: "11:00", endTime: "12:00", hackers: 2 },
  ];
  test("lowered inside an ask, the request outside it", () => {
    expect(askedAt({ perSlot: 3 }, limits, "a", "11:15")).toEqual({
      asked: 2,
      lowered: true,
    });
    expect(askedAt({ perSlot: 3 }, limits, "a", "12:00")).toEqual({
      asked: 3,
      lowered: false,
    });
    // An ask above the request doesn't raise it.
    expect(askedAt({ perSlot: 1 }, limits, "a", "11:15").asked).toBe(1);
  });
});

describe("sheetMismatch (flagged quietly, never fixed)", () => {
  test("the owner's rows", () => {
    // 24 slots x 3 reps != 24 hackers; 2 h of 15-min chats != 24 slots.
    expect(sheetMismatch(row("StarTech"))).toEqual(["hackers", "hours"]);
    // 12 x 3 = 36 adds up; 3 h of 30-min chats = 6 slots, not 12.
    expect(sheetMismatch(row("Sunlife"))).toEqual(["hours"]);
    // 4 x 3 = 12 adds up; 3 h of 30-min chats = 6 slots, not 4.
    expect(sheetMismatch(row("Canada Life"))).toEqual(["hours"]);
    expect(sheetMismatch(row("Scotiabank"))).toEqual([]);
  });
});
