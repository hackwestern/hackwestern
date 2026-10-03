import { describe, expect, test } from "vitest";
import { canEditApplication } from "./use-can-edit-application";

// Deadline: 2026-10-18 11:59 PM Eastern (EDT, UTC-4) = 2026-10-19T03:59:00Z.
const before = Date.parse("2026-10-19T03:58:59.999Z");
const at = Date.parse("2026-10-19T03:59:00Z");

describe("canEditApplication", () => {
  test("in-progress and not-started applications are editable before the deadline", () => {
    expect(canEditApplication("IN_PROGRESS", before)).toBe(true);
    expect(canEditApplication("NOT_STARTED", before)).toBe(true);
  });

  test("nothing is editable from the deadline on", () => {
    expect(canEditApplication("IN_PROGRESS", at)).toBe(false);
    expect(canEditApplication("NOT_STARTED", at)).toBe(false);
  });

  test("a submitted application is never editable", () => {
    expect(canEditApplication("PENDING_REVIEW", before)).toBe(false);
    expect(canEditApplication("ACCEPTED", before)).toBe(false);
  });
});
