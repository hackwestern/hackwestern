import { describe, expect, it } from "vitest";
import {
  bookingCounts,
  bookingRoom,
  chatsForSponsor,
  coffeeChatEntries,
  type ScheduleChat,
} from "~/lib/schedule-bookings";
import { layoutGrid } from "~/lib/sponsor-timeline";

const chat = (over: Partial<ScheduleChat>): ScheduleChat => ({
  chatId: "c1",
  sponsorName: "Canada Life",
  hacker: "Ana",
  room: "Rm 2241",
  slotTime: "10:30",
  durationMinutes: 30,
  status: "accepted",
  startsAt: "2026-11-21T10:30:00-05:00",
  ...over,
});

describe("coffeeChatEntries", () => {
  it("groups a sponsor's chats at one start in one room into one block", () => {
    const entries = coffeeChatEntries("Saturday", [
      chat({ chatId: "a" }),
      chat({
        chatId: "b",
        hacker: "Ben",
        status: "pending",
        room: " rm 2241 ",
      }),
      chat({ chatId: "c", sponsorName: "Scotiabank", room: null }),
    ]);
    expect(entries.map((e) => [e.title, e.location, e.start, e.end])).toEqual([
      ["Canada Life", "Rm 2241", 630, 660],
      ["Scotiabank", null, 630, 660],
    ]);
    expect(entries[0]?.booking?.chats.map((c) => c.hacker)).toEqual([
      "Ana",
      "Ben",
    ]);
    expect(bookingCounts(entries[0]!.booking!)).toEqual({
      hackers: 2,
      accepted: 1,
      waiting: 1,
    });
  });

  it("drops declined, expired and cancelled chats (they leave on refetch)", () => {
    const entries = coffeeChatEntries("Saturday", [
      chat({ chatId: "a", status: "cancelled" }),
      chat({ chatId: "b", status: "declined" }),
      chat({ chatId: "c", status: "expired" }),
    ]);
    expect(entries).toEqual([]);
  });

  it("only uses chats on the given day", () => {
    expect(coffeeChatEntries("Friday", [chat({})])).toEqual([]);
    expect(coffeeChatEntries("Sunday", [chat({})])).toEqual([]);
  });

  it("lands in the Coffee chats column of the day grid", () => {
    const grid = layoutGrid(coffeeChatEntries("Saturday", [chat({})]));
    expect(
      grid
        .find((c) => c.column === "coffee-chats")
        ?.entries.map((e) => e.title),
    ).toEqual(["Canada Life"]);
  });
});

describe("bookingRoom", () => {
  it("normalizes coffee chat rooms and keeps other rooms", () => {
    expect(bookingRoom("rm  2242")).toBe("Rm 2242");
    expect(bookingRoom(" Rm 3100 ")).toBe("Rm 3100");
    expect(bookingRoom("  ")).toBeNull();
    expect(bookingRoom(null)).toBeNull();
  });
});

describe("chatsForSponsor", () => {
  it("keeps only that sponsor's chats", () => {
    const chats = [
      chat({ chatId: "a" }),
      chat({ chatId: "b", sponsorName: "Scotiabank", room: "Rm 2242" }),
    ];
    expect(chatsForSponsor(chats, "Scotiabank").map((c) => c.chatId)).toEqual([
      "b",
    ]);
  });
});
