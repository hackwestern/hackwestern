import { describe, expect, it } from "vitest";
import {
  canClaimHelp,
  canCloseHelp,
  dueHelpReping,
  isActiveHelpStatus,
  isHelpVisibleToSponsor,
  normalizeHelpNote,
  SPONSOR_HELP_REASONS,
} from "./sponsor-help";

const created = new Date("2026-11-21T15:00:00Z");
const at = (minutes: number) => new Date(created.getTime() + minutes * 60_000);

describe("reasons", () => {
  it("has the five quick reasons", () => {
    expect(SPONSOR_HELP_REASONS).toEqual([
      "swag",
      "tech",
      "food",
      "hacker",
      "other",
    ]);
  });
});

describe("statuses", () => {
  it("open and claimed are live", () => {
    expect(isActiveHelpStatus("open")).toBe(true);
    expect(isActiveHelpStatus("claimed")).toBe(true);
    expect(isActiveHelpStatus("resolved")).toBe(false);
    expect(isActiveHelpStatus("cancelled")).toBe(false);
  });

  it("first claim wins: only open can be claimed", () => {
    expect(canClaimHelp("open")).toBe(true);
    expect(canClaimHelp("claimed")).toBe(false);
    expect(canClaimHelp("resolved")).toBe(false);
  });

  it("only live requests can be cancelled or resolved", () => {
    expect(canCloseHelp("open")).toBe(true);
    expect(canCloseHelp("claimed")).toBe(true);
    expect(canCloseHelp("cancelled")).toBe(false);
  });
});

describe("dueHelpReping", () => {
  const open = { status: "open" as const, pingCount: 0, createdAt: created };

  it("nothing before 3 minutes", () => {
    expect(dueHelpReping(open, at(2.9))).toBeNull();
  });

  it("step 1 at 3 minutes", () => {
    expect(dueHelpReping(open, at(3))).toBe(1);
  });

  it("step 2 at 6 minutes once step 1 was sent", () => {
    expect(dueHelpReping({ ...open, pingCount: 1 }, at(5))).toBeNull();
    expect(dueHelpReping({ ...open, pingCount: 1 }, at(6))).toBe(2);
  });

  it("a late poll sends step 1 first, not both at once", () => {
    expect(dueHelpReping(open, at(10))).toBe(1);
  });

  it("no more after two re-pings", () => {
    expect(dueHelpReping({ ...open, pingCount: 2 }, at(60))).toBeNull();
  });

  it("never re-pings a claimed request", () => {
    expect(dueHelpReping({ ...open, status: "claimed" }, at(10))).toBeNull();
  });
});

describe("isHelpVisibleToSponsor", () => {
  it("live requests always show", () => {
    expect(
      isHelpVisibleToSponsor({ status: "open", resolvedAt: null }, at(100)),
    ).toBe(true);
  });

  it("resolved shows for 10 minutes", () => {
    const r = { status: "resolved" as const, resolvedAt: created };
    expect(isHelpVisibleToSponsor(r, at(9))).toBe(true);
    expect(isHelpVisibleToSponsor(r, at(10))).toBe(false);
  });

  it("cancelled never shows", () => {
    expect(
      isHelpVisibleToSponsor(
        { status: "cancelled", resolvedAt: created },
        at(1),
      ),
    ).toBe(false);
  });
});

describe("normalizeHelpNote", () => {
  it("trims and nulls blanks", () => {
    expect(normalizeHelpNote("  hi ")).toBe("hi");
    expect(normalizeHelpNote("   ")).toBeNull();
    expect(normalizeHelpNote(undefined)).toBeNull();
  });
});
