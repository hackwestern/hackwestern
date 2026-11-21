import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Sheet writes are off under Vitest; the write tests below turn the flag on
// against a fake client (never the network).
const writes = vi.hoisted(() => ({ on: false }));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sheetWritesEnabled: () => writes.on,
}));

import {
  fetchAllSponsorInfo,
  isDigitalFormat,
  normalizeTier,
  parseSponsorDayOfColumns,
  parseSponsorDayOfRows,
  sheetSponsorsFromDayOf,
  sponsorDayOfCache,
  sponsorInfoFromDayOf,
  type SheetsClient,
} from "~/server/api/utils/sponsor-sheets";
import {
  sponsorStatusCell,
  writeSponsorCcWorkshop,
  writeSponsorStatus,
} from "~/server/api/utils/sponsor-info-tab";
import { prizeTrackNamesFromSheet } from "~/server/api/utils/sponsor-prize-track-sheet";

// The real Sponsor Day-Of header row (2026-11-19, after the Sponsor Status
// merge). Data rows below are fake.
const HEADER = [
  "Sponsor Name",
  "In person / Digital",
  "HW lead",
  "Lead phone",
  "Status",
  "Booth location",
  "Workshop room",
  "Workshop time",
  "Judging room",
  "Team track filter",
  "Sponsor Booth",
  "Company Mentors",
  "Resume & Profile Access",
  "Dedicated Workshop",
  "Coffee Chats & Interviews",
  "Custom API / Prize Track",
  "Opening Ceremony Stage Time",
  "Other",
];

const row = (cells: Record<number, string>) =>
  Array.from({ length: HEADER.length }, (_, i) => cells[i] ?? "");

const ROWS = [
  HEADER,
  row({
    0: "Acme",
    1: "In person",
    2: "Pat Lead",
    4: "Checked in",
    5: "Booth 3",
    6: "Rm 1",
    7: "1:00 PM",
    8: "Rm 9",
    9: "Best Domain",
    13: "TRUE",
    15: "TRUE",
  }),
  row({
    0: "Globex",
    1: "In person",
    2: "Sam Lead",
    13: "TRUE",
    14: "TRUE",
    15: "FALSE",
  }),
  row({ 0: "Initech", 1: "Digital", 8: "Remote", 15: "TRUE" }),
  [],
  ["Every on-site sponsor", "", "Footer text, not a sponsor"],
];

describe("parseSponsorDayOfColumns", () => {
  test("finds each field by exact header name, not the contract checkboxes", () => {
    const cols = parseSponsorDayOfColumns(HEADER);
    expect(cols).toMatchObject({
      name: 0,
      format: 1,
      hwLead: 2,
      status: 4,
      booth: 5,
      workshopLocation: 6,
      workshopTime: 7,
      judgingRoom: 8,
      track: 9,
      prizeTrack: 15,
      maxMinutes: -1,
      notes: -1,
    });
  });

  test("accepts the old Sponsor Status names", () => {
    const cols = parseSponsorDayOfColumns([
      "Sponsor Name",
      "Status",
      "Judging Room Number",
      "Booth Location",
      "HW Contact",
      "Workshop Location",
      "Workshop Time",
      "Coffee Chat Max Minutes",
      "Sponsor Track",
    ]);
    expect(cols).toMatchObject({
      status: 1,
      judgingRoom: 2,
      booth: 3,
      hwLead: 4,
      workshopLocation: 5,
      workshopTime: 6,
      maxMinutes: 7,
      track: 8,
      prizeTrack: -1,
    });
  });
});

describe("Sponsor Day-Of reads", () => {
  const dayOf = parseSponsorDayOfRows("Sponsor Day-Of", ROWS)!;

  test("sponsor info stops at the first blank name", () => {
    const info = sponsorInfoFromDayOf(dayOf)!;
    expect([...info.keys()]).toEqual(["acme", "globex", "initech"]);
    expect(info.get("acme")).toEqual({
      status: "Checked in",
      // No "Tier" column in this header: no tier.
      tier: "",
      roomNumber: "Rm 9",
      boothLocation: "Booth 3",
      hwContact: "Pat Lead",
      workshopLocation: "Rm 1",
      workshopTime: "1:00 PM",
      maxCoffeeChatMinutes: 0,
      track: "Best Domain",
      hasPrizeTrack: true,
      // This header has no "At CC workshop" column yet: unknown, not false.
      atCcWorkshop: null,
      // No "Chatting hours" column in this header: no limit.
      chattingMinutes: null,
      digital: false,
    });
    // Blank cells read as before: Not arrived, TBD, an em dash, empty.
    expect(info.get("globex")).toMatchObject({
      status: "Not arrived",
      roomNumber: "TBD",
      boothLocation: "TBD",
      workshopLocation: "",
      track: null,
      hasPrizeTrack: false,
    });
    expect(info.get("initech")).toMatchObject({
      hwContact: "—",
      roomNumber: "Remote",
      hasPrizeTrack: true,
      digital: true,
    });
    expect(info.get("globex")?.digital).toBe(false);
  });

  test("In person / Digital: only Digital counts, blank is in person", () => {
    expect(isDigitalFormat("Digital")).toBe(true);
    expect(isDigitalFormat(" digital ")).toBe(true);
    expect(isDigitalFormat("In person")).toBe(false);
    expect(isDigitalFormat("")).toBe(false);
    const noColumn = parseSponsorDayOfRows("Sponsor Day-Of", [
      ["Sponsor Name", "Status"],
      ["Acme", "Not arrived"],
    ])!;
    expect(sponsorInfoFromDayOf(noColumn)?.get("acme")?.digital).toBe(false);
  });

  test("an optional Tier column feeds the portal's welcome line", () => {
    const withTier = parseSponsorDayOfRows("Sponsor Day-Of", [
      ["Sponsor Name", "Status", "Tier"],
      ["Acme", "Checked in", "Gold Sponsor"],
      ["Globex", "Checked in", ""],
    ])!;
    const info = sponsorInfoFromDayOf(withTier)!;
    expect(info.get("acme")?.tier).toBe("Gold");
    expect(info.get("globex")?.tier).toBe("");
    expect(normalizeTier("N/A")).toBe("");
    expect(normalizeTier(" Sponsor ")).toBe("");
    expect(normalizeTier("Title Sponsors")).toBe("Title");
  });

  test("no Status column means the sheet isn't merged yet", () => {
    const old = parseSponsorDayOfRows("Sponsor Day-Of", [
      ["Sponsor Name", "In person / Digital", "HW lead"],
      ["Acme", "In person", "Pat Lead"],
    ])!;
    expect(sponsorInfoFromDayOf(old)).toBeNull();
  });

  test("the sponsor list carries the prize track checkbox", () => {
    const sponsors = sheetSponsorsFromDayOf(dayOf);
    expect(sponsors.map((s) => [s.name, s.hwContact, s.hasPrizeTrack])).toEqual(
      [
        ["Acme", "Pat Lead", true],
        ["Globex", "Sam Lead", false],
        ["Initech", "", true],
      ],
    );
    expect(prizeTrackNamesFromSheet(sponsors)).toEqual(["Acme", "Initech"]);
  });

  test("no prize track column gives no list (callers use the built-in one)", () => {
    expect(
      prizeTrackNamesFromSheet([{ name: "Acme", hasPrizeTrack: null }]),
    ).toBeNull();
  });

  test("a missing header row reads as no tab", () => {
    expect(parseSponsorDayOfRows("Sponsor Day-Of", [["Hello"]])).toBeNull();
  });
});

/** A fake Sheets client over named tabs; records every write. */
function fakeSheets(tabs: Record<string, string[][]>) {
  const updates: { range: string; values: unknown }[] = [];
  const client = {
    spreadsheets: {
      get: vi.fn(async () => ({
        data: {
          sheets: Object.keys(tabs).map((title) => ({ properties: { title } })),
        },
      })),
      values: {
        get: vi.fn(async ({ range }: { range: string }) => {
          const title = /^'(.+)'!/.exec(range)?.[1] ?? "";
          return { data: { values: tabs[title] ?? [] } };
        }),
        update: vi.fn(
          async (req: { range: string; requestBody: { values: unknown } }) => {
            updates.push({ range: req.range, values: req.requestBody.values });
            return {};
          },
        ),
      },
    },
  };
  return { sheets: client as unknown as SheetsClient, updates };
}

describe("fetchAllSponsorInfo", () => {
  test("reads Sponsor Day-Of once it has a Status column", async () => {
    const { sheets } = fakeSheets({
      "Sponsor Day-Of": ROWS,
      "Sponsor Status": [
        ["Sponsor Name", "Status"],
        ["Acme", "Left"],
      ],
    });
    const info = await fetchAllSponsorInfo(sheets, "id");
    expect(info.get("acme")?.status).toBe("Checked in");
  });

  test("falls back to the old Sponsor Status tab before the merge", async () => {
    const { sheets } = fakeSheets({
      "Sponsor Day-Of": [
        ["Sponsor Name", "HW lead"],
        ["Acme", "Pat Lead"],
      ],
      "Sponsor Status": [
        ["Sponsor Name", "Status"],
        ["Acme", "Left"],
      ],
    });
    const info = await fetchAllSponsorInfo(sheets, "id");
    expect(info.get("acme")).toMatchObject({
      status: "Left",
      hasPrizeTrack: null,
    });
  });

  test("never reads the retired (old) Sponsor Status tab", async () => {
    const { sheets } = fakeSheets({
      "Sponsor Day-Of": [
        ["Sponsor Name", "HW lead"],
        ["Acme", "Pat Lead"],
      ],
      "(old) Sponsor Status": [
        ["Sponsor Name", "Status"],
        ["Acme", "Left"],
      ],
    });
    expect((await fetchAllSponsorInfo(sheets, "id")).size).toBe(0);
  });
});

describe("sponsor status writes", () => {
  const dayOf = parseSponsorDayOfRows("Sponsor Day-Of", ROWS)!;
  beforeEach(() => {
    writes.on = true;
  });
  afterEach(() => {
    writes.on = false;
  });

  test("with sheet writes off: no Sheets call at all, not written", async () => {
    writes.on = false;
    const { sheets, updates } = fakeSheets({ "Sponsor Day-Of": ROWS });
    await expect(
      writeSponsorStatus(sheets, "id", "Initech", "Left"),
    ).resolves.toEqual({
      ok: true,
      written: false,
      reason: "sheet-writes-off",
    });
    expect(updates).toHaveLength(0);
    const api = sheets.spreadsheets as unknown as {
      get: ReturnType<typeof vi.fn>;
      values: Record<string, ReturnType<typeof vi.fn>>;
    };
    expect(api.get).not.toHaveBeenCalled();
    expect(api.values.get).not.toHaveBeenCalled();
    expect(api.values.update).not.toHaveBeenCalled();
  });

  test("target the Status column of the sponsor's own row", () => {
    expect(sponsorStatusCell(dayOf, " globex ")).toEqual({
      ok: true,
      range: "'Sponsor Day-Of'!E3",
      rowIndex: 2,
      col: 4,
    });
    expect(sponsorStatusCell(dayOf, "Every on-site sponsor")).toEqual({
      ok: false,
      reason: "not-found",
    });
    const old = parseSponsorDayOfRows("Sponsor Day-Of", [
      ["Sponsor Name"],
      ["Acme"],
    ])!;
    expect(sponsorStatusCell(old, "Acme")).toEqual({
      ok: false,
      reason: "no-column",
    });
  });

  test("write one cell and never add a row", async () => {
    const { sheets, updates } = fakeSheets({ "Sponsor Day-Of": ROWS });
    await expect(
      writeSponsorStatus(sheets, "id", "Initech", "Left"),
    ).resolves.toEqual({ ok: true, range: "'Sponsor Day-Of'!E4" });
    expect(updates).toEqual([
      { range: "'Sponsor Day-Of'!E4", values: [["Left"]] },
    ]);

    await expect(
      writeSponsorStatus(sheets, "id", "Nobody", "Left"),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(updates).toHaveLength(1);
  });

  test("the shared copy holds the new status straight after the write", async () => {
    const { sheets } = fakeSheets({ "Sponsor Day-Of": ROWS });
    await writeSponsorStatus(sheets, "id", "Globex", "Checked in");
    const load = vi.fn(async () => dayOf);
    const after = await sponsorDayOfCache.read("id", load);
    // No extra read of the sheet, and the other rows are as read.
    expect(load).not.toHaveBeenCalled();
    const info = sponsorInfoFromDayOf(after!)!;
    expect(info.get("globex")?.status).toBe("Checked in");
    expect(info.get("acme")?.status).toBe("Checked in");
    expect(info.get("initech")?.status).toBe("Not arrived");
    sponsorDayOfCache.clear();
  });

  test("no Sponsor Day-Of tab is reported, not created", async () => {
    const { sheets, updates } = fakeSheets({});
    await expect(
      writeSponsorStatus(sheets, "id", "Acme", "Left"),
    ).resolves.toEqual({ ok: false, reason: "no-tab" });
    expect(updates).toHaveLength(0);
  });
});

describe("At CC workshop (coffee chat workshop attendance)", () => {
  // The live sheet: a checkbox column right after "Team track filter".
  const WITH_CC = [
    ...HEADER.slice(0, 10),
    "At CC workshop",
    ...HEADER.slice(10),
  ];
  const ccRows = [
    WITH_CC,
    [
      "Acme",
      "In person",
      "Pat Lead",
      "",
      "Checked in",
      "",
      "",
      "",
      "",
      "",
      "TRUE",
    ],
    ["Globex", "In person", "Sam Lead", "", "", "", "", "", "", "", "FALSE"],
  ];
  afterEach(() => {
    writes.on = false;
  });

  test("read like Status: ticked, unticked, or null when the column is missing", () => {
    expect(parseSponsorDayOfColumns(WITH_CC).ccWorkshop).toBe(10);
    // Adding it doesn't move the fields found by name.
    expect(parseSponsorDayOfColumns(WITH_CC)).toMatchObject({
      status: 4,
      track: 9,
      prizeTrack: 16,
    });
    const info = sponsorInfoFromDayOf(
      parseSponsorDayOfRows("Sponsor Day-Of", ccRows)!,
    )!;
    expect(info.get("acme")!.atCcWorkshop).toBe(true);
    expect(info.get("globex")!.atCcWorkshop).toBe(false);
    const without = sponsorInfoFromDayOf(
      parseSponsorDayOfRows("Sponsor Day-Of", ROWS)!,
    )!;
    expect(without.get("acme")!.atCcWorkshop).toBeNull();
  });

  test("written as a checkbox in the sponsor's own row, only with sheet writes on", async () => {
    const off = fakeSheets({ "Sponsor Day-Of": ccRows });
    await expect(
      writeSponsorCcWorkshop(off.sheets, "id", "Globex", true),
    ).resolves.toEqual({
      ok: true,
      written: false,
      reason: "sheet-writes-off",
    });
    expect(off.updates).toHaveLength(0);

    writes.on = true;
    const on = fakeSheets({ "Sponsor Day-Of": ccRows });
    await expect(
      writeSponsorCcWorkshop(on.sheets, "id", "Globex", true),
    ).resolves.toEqual({
      ok: true,
      range: "'Sponsor Day-Of'!K3",
    });
    expect(on.updates).toEqual([
      { range: "'Sponsor Day-Of'!K3", values: [[true]] },
    ]);
    // The shared copy reads it back as the sheet will: ticked.
    const after = await sponsorDayOfCache.read("id", () =>
      Promise.reject(new Error("should not read")),
    );
    expect(sponsorInfoFromDayOf(after!)!.get("globex")?.atCcWorkshop).toBe(
      true,
    );
    sponsorDayOfCache.clear();
    // No column yet: reported, nothing written.
    const old = fakeSheets({ "Sponsor Day-Of": ROWS });
    await expect(
      writeSponsorCcWorkshop(old.sheets, "id", "Acme", true),
    ).resolves.toEqual({
      ok: false,
      reason: "no-column",
    });
    expect(old.updates).toHaveLength(0);
  });
});
