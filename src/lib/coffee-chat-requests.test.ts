import { describe, expect, it } from "vitest";
import {
  coffeeChatRoomOf,
  coffeeChatExpiresAt,
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
});
