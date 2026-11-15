import { describe, expect, it } from "vitest";
import {
  coffeeChatExpiresAt,
  coffeeChatSeats,
  coffeeChatStartsAt,
  effectiveCoffeeChatStatus,
  isActiveCoffeeChat,
} from "./coffee-chat-requests";

describe("coffeeChatStartsAt", () => {
  it("is Saturday Nov 21 in Eastern time (UTC-5)", () => {
    expect(coffeeChatStartsAt("10:00").toISOString()).toBe(
      "2026-11-21T15:00:00.000Z",
    );
  });

  it("rejects times that aren't slots", () => {
    expect(() => coffeeChatStartsAt("10:07")).toThrow();
    expect(() => coffeeChatStartsAt("16:00")).toThrow();
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

describe("coffeeChatSeats", () => {
  it("is reps capped by room capacity", () => {
    expect(coffeeChatSeats(3, 2)).toBe(2);
    expect(coffeeChatSeats(2, 5)).toBe(2);
  });

  it("uses reps when capacity is unknown", () => {
    expect(coffeeChatSeats(4, null)).toBe(4);
  });

  it("never goes below zero", () => {
    expect(coffeeChatSeats(3, 0)).toBe(0);
    expect(coffeeChatSeats(-1, 4)).toBe(0);
  });
});
