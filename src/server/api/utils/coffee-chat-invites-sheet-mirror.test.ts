import { afterEach, describe, expect, test, vi } from "vitest";

import {
  INVITES_TAB,
  INVITES_WIDTH,
  invitesSheetRows,
  lockTabRequests,
  mirrorCoffeeInvites,
  resetInvitesMirror,
  shortName,
  writeInvitesTab,
  type InviteSheetRow,
  type InvitesSheet,
} from "~/server/api/utils/coffee-chat-invites-sheet-mirror";

// Never the real Google Sheet: only a fake sheet is used here, and the
// Google client fails loudly if anything reaches for it.
vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: class {
        constructor() {
          throw new Error("Test tried to reach Google Sheets: mock it.");
        }
      },
    },
  },
}));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
const writes = vi.hoisted(() => ({ enabled: true }));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  sheetWritesEnabled: () => writes.enabled,
}));

const NOTE =
  "Read-only. The app writes this tab. To change an invite, use the coffee chat board (Remove · Put first in line).";
// Fri Nov 20 2026, 11 PM Eastern.
const NOW = new Date("2026-11-21T04:00:00Z");
// Sat 10:00 AM Eastern.
const ROUND_ONE_CLOSE = new Date("2026-11-21T15:00:00Z");

const row = (over: Partial<InviteSheetRow>): InviteSheetRow => ({
  sponsor: "Sun Life",
  rep: "Dana",
  sessionId: "10",
  slotTime: "10:30",
  room: "Rm 2241",
  firstName: "Jane",
  lastName: "Doe",
  userName: "Jane Doe",
  hackerId: "HW-1234",
  source: "shortlist",
  status: "pending",
  expiresAt: ROUND_ONE_CLOSE,
  ...over,
});

function fakeSheet(opts: { missing?: boolean } = {}) {
  let missing = opts.missing ?? false;
  const calls: { op: string; arg?: unknown }[] = [];
  const sheet: InvitesSheet = {
    editor: "app@example.test",
    clear(range) {
      calls.push({ op: "clear", arg: range });
      if (missing) return Promise.reject(new Error(`Unable to parse range: ${range}`));
      return Promise.resolve();
    },
    write(range, values) {
      calls.push({ op: "write", arg: { range, values } });
      return Promise.resolve();
    },
    addTab(title) {
      calls.push({ op: "addTab", arg: title });
      missing = false;
      return Promise.resolve(42);
    },
    batchUpdate(requests) {
      calls.push({ op: "batchUpdate", arg: requests });
      return Promise.resolve();
    },
  };
  return { sheet, calls };
}

afterEach(() => {
  writes.enabled = true;
  resetInvitesMirror();
});

describe("invitesSheetRows", () => {
  test("note, updated time, header, then one row per seat", () => {
    const rows = invitesSheetRows([row({})], NOW);
    expect(rows[0]).toEqual([NOTE]);
    expect(rows[1]![0]).toMatch(/^Last updated .+ ET$/);
    expect(rows[2]).toEqual([
      "Sponsor",
      "Rep",
      "Session",
      "Chat time",
      "Room",
      "Hacker",
      "Hacker ID",
      "Source",
      "Status",
      "Answer by",
    ]);
    expect(rows[3]).toEqual([
      "Sun Life",
      "Dana",
      "10–11",
      "10:30 AM",
      "Rm 2241",
      "Jane D.",
      "HW-1234",
      "Shortlist",
      "Waiting",
      "Sat 10:00 AM",
    ]);
    expect(rows.slice(2).every((r) => r.length === INVITES_WIDTH)).toBe(true);
  });

  test("live states only: declined, cancelled and expired seats are left out", () => {
    const rows = invitesSheetRows(
      [
        row({ firstName: "Wait" }),
        row({ firstName: "Yes", status: "accepted" }),
        row({ firstName: "No", status: "declined" }),
        row({ firstName: "Gone", status: "cancelled" }),
        row({ firstName: "Late", status: "expired" }),
        // Pending, but its answer-by has passed: it reads as expired.
        row({ firstName: "Lapsed", expiresAt: new Date("2026-11-21T03:00:00Z") }),
      ],
      NOW,
    );
    const seats = rows.slice(3);
    expect(seats.map((r) => r[5])).toEqual(["Wait D.", "Yes D."]);
    // An accepted seat has nothing to answer by.
    expect(seats[1]!.slice(8)).toEqual(["Accepted", ""]);
  });

  test("sorted by sponsor, then rep, then time", () => {
    const rows = invitesSheetRows(
      [
        row({ sponsor: "TinyFish", rep: "Ari", slotTime: "10:00", firstName: "A" }),
        row({ sponsor: "QNX", rep: "Zed", slotTime: "10:00", firstName: "B" }),
        row({ sponsor: "QNX", rep: "Bo", slotTime: "14:15", firstName: "C" }),
        row({ sponsor: "QNX", rep: "Bo", slotTime: "11:00", firstName: "D" }),
      ],
      NOW,
    );
    expect(rows.slice(3).map((r) => r[5])).toEqual(["D D.", "C D.", "B D.", "A D."]);
  });

  test("no PII beyond first name + last initial and the hacker ID", () => {
    const rows = invitesSheetRows(
      [
        row({ firstName: "Jane", lastName: "Doe", userName: "jane.doe@example.test" }),
        // No application: the account name gives first name + initial only.
        row({ firstName: null, lastName: null, userName: "Sam Rivera Lopez", hackerId: null }),
      ],
      NOW,
    );
    const text = rows.flat().join(" | ");
    expect(text).not.toMatch(/@|Doe|Rivera|Lopez/);
    expect(rows.slice(3).map((r) => r[5])).toEqual(["Jane D.", "Sam L."]);
    expect(rows[4]![6]).toBe("");
  });

  test("source labels", () => {
    const rows = invitesSheetRows(
      ["scanned", "shortlist", "interested", "organizer", null].map((source, i) =>
        row({ source, firstName: `H${i}` }),
      ),
      NOW,
    );
    expect(rows.slice(3).map((r) => r[7])).toEqual([
      "Met at your booth",
      "Shortlist",
      "Interested",
      "Added by organizer",
      "",
    ]);
  });

  test("shortName", () => {
    expect(shortName(" Jane ", " doe", null)).toBe("Jane D.");
    expect(shortName("Jane", null, "Jane Doe")).toBe("Jane");
    expect(shortName(null, null, null)).toBe("");
  });
});

describe("writeInvitesTab", () => {
  test("an existing tab: clear then write, no read, no tab listing, no lock", async () => {
    const { sheet, calls } = fakeSheet();
    const rows = invitesSheetRows([row({})], NOW);
    await expect(writeInvitesTab(sheet, rows)).resolves.toBe(4);
    expect(calls.map((c) => c.op)).toEqual(["clear", "write"]);
    expect(calls[0]!.arg).toBe(`'${INVITES_TAB}'!A:Z`);
    expect(calls[1]!.arg).toEqual({ range: `'${INVITES_TAB}'!A1`, values: rows });
  });

  test("a missing tab is created and locked once", async () => {
    const { sheet, calls } = fakeSheet({ missing: true });
    const rows = invitesSheetRows([], NOW);
    await writeInvitesTab(sheet, rows);
    await writeInvitesTab(sheet, rows);
    expect(calls.map((c) => c.op)).toEqual([
      "clear",
      "addTab",
      "batchUpdate",
      "write",
      "clear",
      "write",
    ]);
    expect(calls.filter((c) => c.op === "batchUpdate")).toHaveLength(1);
    expect(calls[2]!.arg).toEqual(lockTabRequests(42, "app@example.test"));
  });

  test("another Sheets error is thrown, nothing is added", async () => {
    const { sheet, calls } = fakeSheet();
    sheet.clear = () => Promise.reject(new Error("Quota exceeded"));
    await expect(writeInvitesTab(sheet, [])).rejects.toThrow("Quota exceeded");
    expect(calls).toEqual([]);
  });
});

describe("lockTabRequests", () => {
  test("the whole tab, edits refused, the service account the only editor, the note on A1", () => {
    const [protect, note] = lockTabRequests(7, "app@example.test");
    expect(protect!.addProtectedRange!.protectedRange).toMatchObject({
      range: { sheetId: 7 },
      warningOnly: false,
      editors: { users: ["app@example.test"] },
    });
    // No row or column bounds: the whole tab.
    expect(Object.keys(protect!.addProtectedRange!.protectedRange!.range!)).toEqual(["sheetId"]);
    expect(note!.updateCells).toMatchObject({
      range: { sheetId: 7, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ note: NOTE }] }],
      fields: "note",
    });
  });
});

describe("mirrorCoffeeInvites", () => {
  test("sheet writes off: nothing is loaded or written", async () => {
    writes.enabled = false;
    const load = vi.fn(() => Promise.resolve([row({})]));
    const sheet = vi.fn(() => Promise.resolve(fakeSheet().sheet));
    await expect(mirrorCoffeeInvites({ load, sheet, minIntervalMs: 0 })).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    expect(load).not.toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
  });

  test("calls made while a run waits share it", async () => {
    const { sheet, calls } = fakeSheet();
    const load = vi.fn(() => Promise.resolve([row({})]));
    const deps = { load, sheet: () => Promise.resolve(sheet), now: () => NOW, minIntervalMs: 0 };
    const [a, b] = await Promise.all([mirrorCoffeeInvites(deps), mirrorCoffeeInvites(deps)]);
    expect(a).toEqual({ ok: true, rows: 4 });
    expect(b).toEqual(a);
    expect(load).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.op)).toEqual(["clear", "write"]);
  });

  test("a failure is reported, never thrown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await mirrorCoffeeInvites({
      load: () => Promise.reject(new Error("db down")),
      minIntervalMs: 0,
    });
    expect(result).toEqual({ ok: false, error: "db down" });
    error.mockRestore();
  });
});
