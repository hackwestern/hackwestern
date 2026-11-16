import { describe, expect, it } from "vitest";
import {
  applyAssignedRooms,
  coffeeChatRoomClash,
  coffeeChatRoomOf,
  coffeeChatWindowsOverlap,
  resolveCoffeeChatRoom,
  coffeeChatExpiresAt,
  coffeeChatParallelChats,
  coffeeChatSeats,
  coffeeChatStartsAt,
  coffeeChatsOverlap,
  effectiveCoffeeChatStatus,
  isActiveCoffeeChat,
  parseCoffeeChatDuration,
  parseCoffeeChatGroupSize,
  parseSheetTime,
} from "./coffee-chat-requests";

describe("coffeeChatStartsAt", () => {
  it("is Saturday Nov 21 in Eastern time (UTC-5)", () => {
    expect(coffeeChatStartsAt("10:00").toISOString()).toBe(
      "2026-11-21T15:00:00.000Z",
    );
  });

  it("allows a 9:00 AM start (StarTech's window)", () => {
    expect(coffeeChatStartsAt("09:00").toISOString()).toBe(
      "2026-11-21T14:00:00.000Z",
    );
  });

  it("rejects times off the 15-minute grid", () => {
    expect(() => coffeeChatStartsAt("10:07")).toThrow();
    expect(() => coffeeChatStartsAt("9:00")).toThrow();
  });
});

describe("expiry", () => {
  const chat = { status: "pending" as const, slotTime: "11:00" };

  it("expires 20 minutes before the chat", () => {
    expect(coffeeChatExpiresAt("11:00").toISOString()).toBe(
      "2026-11-21T15:40:00.000Z",
    );
  });

  it("stays pending until then, then reads as expired", () => {
    expect(
      effectiveCoffeeChatStatus(chat, new Date("2026-11-21T15:39:59Z")),
    ).toBe("pending");
    expect(
      effectiveCoffeeChatStatus(chat, new Date("2026-11-21T15:40:00Z")),
    ).toBe("expired");
  });

  it("never changes an answered chat", () => {
    const late = new Date("2026-11-22T00:00:00Z");
    expect(
      effectiveCoffeeChatStatus({ ...chat, status: "accepted" }, late),
    ).toBe("accepted");
    expect(
      effectiveCoffeeChatStatus({ ...chat, status: "declined" }, late),
    ).toBe("declined");
  });

  it("an expired or declined chat frees its seat", () => {
    const late = new Date("2026-11-21T15:45:00Z");
    expect(isActiveCoffeeChat(chat, late)).toBe(false);
    expect(isActiveCoffeeChat({ ...chat, status: "declined" })).toBe(false);
    expect(isActiveCoffeeChat({ ...chat, status: "accepted" }, late)).toBe(
      true,
    );
  });
});

describe("seats (room fits 6 people)", () => {
  it("1-on-1s: one per rep, at most 3 at once", () => {
    expect(coffeeChatParallelChats(2, 1)).toBe(2);
    expect(coffeeChatSeats(3, 1)).toBe(3);
    expect(coffeeChatSeats(4, 1)).toBe(3);
  });

  it("groups of 3: one group at once (3 hackers + rep = 4 people)", () => {
    expect(coffeeChatParallelChats(3, 3)).toBe(1);
    expect(coffeeChatSeats(3, 3)).toBe(3);
  });

  it("no reps, no seats", () => {
    expect(coffeeChatSeats(0, 1)).toBe(0);
    expect(coffeeChatSeats(-1, 3)).toBe(0);
  });
});

describe("reading the Coffee Chats tab", () => {
  it("parses sheet times", () => {
    expect(parseSheetTime("9:00 AM")).toBe("09:00");
    expect(parseSheetTime("1:00 PM")).toBe("13:00");
    expect(parseSheetTime("12:00 PM")).toBe("12:00");
    expect(parseSheetTime("")).toBeNull();
    expect(parseSheetTime("10:10 AM")).toBeNull();
  });

  it("reads chat length from FORMAT", () => {
    expect(parseCoffeeChatDuration("Individual (15 mins)")).toBe(15);
    expect(parseCoffeeChatDuration("Groups (30 mins with 3 people)")).toBe(30);
    expect(parseCoffeeChatDuration(undefined)).toBe(15);
  });

  it("reads group size from FORMAT", () => {
    expect(parseCoffeeChatGroupSize("Groups (30 mins with 3 people)")).toBe(3);
    expect(parseCoffeeChatGroupSize("Individual (15 mins)")).toBe(1);
    expect(parseCoffeeChatGroupSize("")).toBe(1);
  });
});

describe("coffeeChatsOverlap", () => {
  it("a 30-min chat blocks the next 15-min slot", () => {
    const long = { slotTime: "10:00", durationMinutes: 30 };
    expect(
      coffeeChatsOverlap(long, { slotTime: "10:15", durationMinutes: 15 }),
    ).toBe(true);
    expect(
      coffeeChatsOverlap(long, { slotTime: "10:30", durationMinutes: 15 }),
    ).toBe(false);
    expect(
      coffeeChatsOverlap({ slotTime: "09:45", durationMinutes: 30 }, long),
    ).toBe(true);
  });
});

describe("coffee chat rooms (T41)", () => {
  it("only 2241-2243, any spacing or case", () => {
    expect(coffeeChatRoomOf(" rm  2242 ")).toBe("Rm 2242");
    expect(coffeeChatRoomOf("Rm 2230")).toBeNull();
    expect(coffeeChatRoomOf(null)).toBeNull();
  });

  it("assignment beats the sheet, which beats nothing", () => {
    expect(resolveCoffeeChatRoom("Rm 2241", "Rm 2230")).toBe("Rm 2241");
    expect(resolveCoffeeChatRoom(null, "Rm 2230")).toBe("Rm 2230");
    expect(resolveCoffeeChatRoom(null, " ")).toBeNull();
    expect(
      applyAssignedRooms(
        [
          { sponsor: "A", room: "Rm 2230" },
          { sponsor: "B", room: null },
        ],
        [{ name: "A", coffeeChatRoom: "Rm 2243" }],
      ).map((s) => s.room),
    ).toEqual(["Rm 2243", null]);
  });

  it("windows overlap only when they share time", () => {
    const w = (windowStart: string | null, windowEnd: string | null) => ({
      windowStart,
      windowEnd,
    });
    expect(
      coffeeChatWindowsOverlap(w("10:00", "11:00"), w("10:45", "12:00")),
    ).toBe(true);
    expect(
      coffeeChatWindowsOverlap(w("10:00", "11:00"), w("11:00", "12:00")),
    ).toBe(false);
    expect(coffeeChatWindowsOverlap(w(null, null), w("10:00", "11:00"))).toBe(
      false,
    );
  });

  it("a clash is another sponsor in the same room at an overlapping time", () => {
    const sponsors = [
      { id: "a", room: "Rm 2241", windowStart: "10:00", windowEnd: "11:00" },
      { id: "b", room: null, windowStart: "10:30", windowEnd: "11:30" },
      { id: "c", room: "Rm 2242", windowStart: "10:30", windowEnd: "11:30" },
    ];
    expect(coffeeChatRoomClash("b", "rm 2241", sponsors)?.id).toBe("a");
    expect(coffeeChatRoomClash("b", "Rm 2243", sponsors)).toBeNull();
    expect(coffeeChatRoomClash("a", "Rm 2241", sponsors)).toBeNull();
  });
});
