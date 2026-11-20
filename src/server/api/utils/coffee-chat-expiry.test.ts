import { describe, expect, test } from "vitest";

import {
  answeredStatus,
  coffeeChatTimes,
} from "~/server/api/utils/coffee-chat-expiry";

// A 10:00 chat on Saturday Nov 21 (Eastern, UTC-5): replies close at 9:40.
const at = (time: string) => new Date(`2026-11-21T${time}:00-05:00`);
const pending = { status: "pending" as const, slotTime: "10:00" };
const accepted = { status: "accepted" as const, slotTime: "10:00" };

describe("coffeeChatTimes", () => {
  test("pending reads as expired from 20 minutes before the chat", () => {
    expect(coffeeChatTimes(pending, at("09:39")).status).toBe("pending");
    expect(coffeeChatTimes(pending, at("09:40")).status).toBe("expired");
    expect(coffeeChatTimes(pending, at("09:40"))).toMatchObject({
      startsAt: "2026-11-21T15:00:00.000Z",
      expiresAt: "2026-11-21T14:40:00.000Z",
    });
  });

  test("answered chats keep their status", () => {
    expect(coffeeChatTimes(accepted, at("11:00")).status).toBe("accepted");
  });
});

describe("answeredStatus", () => {
  test("accept only while pending", () => {
    expect(answeredStatus(pending, "accept", at("09:00"))).toBe("accepted");
    expect(answeredStatus(pending, "accept", at("09:40"))).toBeNull();
    expect(answeredStatus(accepted, "accept", at("09:00"))).toBeNull();
    for (const status of ["declined", "expired", "cancelled"] as const) {
      expect(
        answeredStatus({ status, slotTime: "10:00" }, "accept", at("09:00")),
      ).toBeNull();
    }
  });

  test("decline while pending, or after accepting until the chat starts", () => {
    expect(answeredStatus(pending, "decline", at("09:00"))).toBe("declined");
    expect(answeredStatus(pending, "decline", at("09:45"))).toBeNull();
    expect(answeredStatus(accepted, "decline", at("09:59"))).toBe("declined");
    expect(answeredStatus(accepted, "decline", at("10:00"))).toBeNull();
    expect(
      answeredStatus(
        { status: "cancelled", slotTime: "10:00" },
        "decline",
        at("09:00"),
      ),
    ).toBeNull();
  });
});
