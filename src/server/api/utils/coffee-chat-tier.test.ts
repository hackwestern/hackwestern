import { describe, expect, it } from "vitest";

import { assertWithinTier } from "~/server/api/utils/coffee-chat-setup";
import { chattingMinutesOf } from "~/server/api/utils/sponsor-sheets";

describe("tier chatting hours", () => {
  it("reads Sponsor Day-Of's Chatting hours as minutes; blank is no limit", () => {
    expect(chattingMinutesOf("4")).toBe(240);
    expect(chattingMinutesOf("2.5")).toBe(150);
    expect(chattingMinutesOf("")).toBeNull();
    expect(chattingMinutesOf("TBD")).toBeNull();
    expect(chattingMinutesOf("0")).toBeNull();
  });

  it("allows chats up to the tier and refuses more", () => {
    // Bronze: 2 h. Three reps, 30-minute group chats.
    expect(() => assertWithinTier([2, 1, 1], 30, 120)).not.toThrow();
    expect(() => assertWithinTier([2, 2, 1], 30, 120)).toThrow(
      /includes 2 h of coffee chats.*2 h 30 min/,
    );
    // 1-on-1s are 15 minutes: 8 chats fit in 2 h.
    expect(() => assertWithinTier([4, 4], 15, 120)).not.toThrow();
    // No tier: no limit.
    expect(() => assertWithinTier([10, 10], 30, null)).not.toThrow();
  });
});
