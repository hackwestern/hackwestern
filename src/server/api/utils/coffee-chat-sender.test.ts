import { describe, expect, test } from "vitest";
import { senderCheckOf, senderLoginEmail } from "~/server/api/utils/coffee-chat-sender";

// Made-up addresses: real ones live only in the private sheet.
const rows = [
  ["Name", "Phone", "Login email", "Slack name"],
  ["Caroline Ge", "5195550101", "caroline@example.test", "[ORGANIZER] Caroline Ge"],
  [" Noah  Medland ", "5195550102", " Noah@Example.TEST ", "[ORGANIZER] Noah Medland"],
];

describe("senderLoginEmail", () => {
  test("finds Noah's row by name and reads its Login email, trimmed and lowercased", () => {
    expect(senderLoginEmail(rows)).toBe("noah@example.test");
  });

  test("columns can move; the header can sit in the first three rows", () => {
    const moved = [["HW Contacts"], ["Login email", "Name"], ["noah@example.test", "Noah Medland"]];
    expect(senderLoginEmail(moved)).toBe("noah@example.test");
  });

  test("no Noah row, a blank email, or no Login email column -> null", () => {
    expect(senderLoginEmail(rows.slice(0, 2))).toBeNull();
    expect(senderLoginEmail([rows[0]!, ["Noah Medland", "1", ""]])).toBeNull();
    expect(senderLoginEmail([["Name", "Phone"], ["Noah Medland", "1"]])).toBeNull();
  });
});

describe("senderCheckOf", () => {
  test("only the matching login email can send (case-insensitive)", () => {
    expect(senderCheckOf("NOAH@example.test", "noah@example.test")).toEqual({ canSend: true, reason: null });
    expect(senderCheckOf("caroline@example.test", "noah@example.test")).toEqual({ canSend: false, reason: "notSender" });
    expect(senderCheckOf(null, "noah@example.test")).toEqual({ canSend: false, reason: "notSender" });
  });

  test("an unreadable sheet or no login email means nobody can send", () => {
    expect(senderCheckOf("noah@example.test", "unreadable")).toEqual({ canSend: false, reason: "sheetUnreadable" });
    expect(senderCheckOf("noah@example.test", null)).toEqual({ canSend: false, reason: "noLoginEmail" });
  });
});
