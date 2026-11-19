import { describe, expect, test } from "vitest";
import { senderCheckOf, senderLoginEmails } from "~/server/api/utils/coffee-chat-sender";

// Made-up addresses: real ones live only in the private sheet.
const rows = [
  ["Name", "Phone", "Login email", "Slack name"],
  ["Caroline Ge", "5195550101", "caroline@example.test", "[ORGANIZER] Caroline Ge"],
  [" Noah  Medland ", "5195550102", " Noah@Example.TEST ", "[ORGANIZER] Noah Medland"],
];

describe("senderLoginEmails", () => {
  test("finds Noah's row by name and reads its Login email, trimmed and lowercased", () => {
    expect(senderLoginEmails(rows)).toEqual(["noah@example.test"]);
  });

  test("columns can move; the header can sit in the first three rows", () => {
    const moved = [["HW Contacts"], ["Login email", "Name"], ["noah@example.test", "Noah Medland"]];
    expect(senderLoginEmails(moved)).toEqual(["noah@example.test"]);
  });

  test("no Noah row, a blank email, or no Login email column -> null", () => {
    expect(senderLoginEmails(rows.slice(0, 2))).toBeNull();
    expect(senderLoginEmails([rows[0]!, ["Noah Medland", "1", ""]])).toBeNull();
    expect(senderLoginEmails([["Name", "Phone"], ["Noah Medland", "1"]])).toBeNull();
  });
});

describe("senderLoginEmails: Same view as", () => {
  const head = ["Name", "Phone", "Login email", "Slack name", "Same view as"];
  const noahRow = ["Noah Medland", "5195550102", "noah@example.test", "", ""];

  test("a row whose Same view as is Noah may send too, after Noah", () => {
    const sheet = [head, ["Robin Vale", "5195550103", " Robin@Example.test ", "", "noah  medland"], noahRow];
    expect(senderLoginEmails(sheet)).toEqual(["noah@example.test", "robin@example.test"]);
    expect(senderCheckOf("robin@example.test", senderLoginEmails(sheet))).toEqual({ canSend: true, reason: null });
  });

  test("blank, unknown or someone else's view: no change", () => {
    const sheet = [
      head,
      ["Robin Vale", "1", "robin@example.test", "", ""],
      ["Sam Ortiz", "2", "sam@example.test", "", "Nobody Here"],
      ["Kai Lund", "3", "kai@example.test", "", "Robin Vale"],
      noahRow,
    ];
    expect(senderLoginEmails(sheet)).toEqual(["noah@example.test"]);
  });

  test("no chains: Kai -> Robin -> Noah does not let Kai send", () => {
    const sheet = [
      head,
      ["Robin Vale", "1", "robin@example.test", "", "Noah Medland"],
      ["Kai Lund", "2", "kai@example.test", "", "Robin Vale"],
      noahRow,
    ];
    const allowed = senderLoginEmails(sheet);
    expect(allowed).toEqual(["noah@example.test", "robin@example.test"]);
    expect(senderCheckOf("kai@example.test", allowed)).toEqual({ canSend: false, reason: "notSender" });
  });

  test("fail-closed: Noah's row without a login email means nobody, Same view as or not", () => {
    const sheet = [head, ["Robin Vale", "1", "robin@example.test", "", "Noah Medland"], ["Noah Medland", "2", "", "", ""]];
    expect(senderLoginEmails(sheet)).toBeNull();
    expect(senderCheckOf("robin@example.test", senderLoginEmails(sheet))).toEqual({ canSend: false, reason: "noLoginEmail" });
  });

  test("no Same view as column: same as before", () => {
    expect(senderLoginEmails(rows)).toEqual(["noah@example.test"]);
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
