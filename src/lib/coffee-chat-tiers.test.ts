import { describe, expect, it } from "vitest";
import {
  effectiveChatMinutes,
  tierChattingMinutes,
} from "~/lib/coffee-chat-tiers";

describe("chatting hours", () => {
  it("maps each tier to its default, like the Tiers tab", () => {
    expect(tierChattingMinutes("Gold")).toBe(240);
    expect(tierChattingMinutes(" silver ")).toBe(180);
    expect(tierChattingMinutes("Bronze")).toBe(120);
    expect(tierChattingMinutes("")).toBeNull();
    expect(tierChattingMinutes("Platinum")).toBeNull();
  });

  it("uses the tier default when the sheet cell is blank", () => {
    expect(effectiveChatMinutes({ sheetMinutes: null, tier: "Silver" })).toBe(
      180,
    );
  });

  it("lets a number in the sheet win over the tier", () => {
    expect(effectiveChatMinutes({ sheetMinutes: 300, tier: "Bronze" })).toBe(
      300,
    );
  });

  it("is no limit with no tier and no sheet value", () => {
    expect(effectiveChatMinutes({ sheetMinutes: null, tier: "" })).toBeNull();
  });
});
