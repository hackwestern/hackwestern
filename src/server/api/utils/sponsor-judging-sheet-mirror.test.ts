import { afterEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";

import type { BookingsSheet } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import {
  JUDGING_TAB,
  MIRROR_TIMEOUT_MS,
  judgingSheetRows,
  loadJudgingSheetInput,
  mirrorSponsorJudging,
  notifiedLabel,
  writeJudgingSheet,
  type JudgingSheetInput,
} from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import { slotsKey } from "~/lib/sponsor-presentations";

// Never the real Google Sheet: the mirror only ever gets a fake sheet here,
// and the Google client fails loudly if anything reaches for it.
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
// Writes are off under Vitest; these tests use a fake sheet, so they turn
// them on (and off for the disabled test).
const writes = vi.hoisted(() => ({ enabled: true }));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/run-of-show-sheet")
  >()),
  sheetWritesEnabled: () => writes.enabled,
}));
// Rooms are read from the sheets: mocked.
vi.mock("~/server/api/utils/sponsor-judging-board", () => ({
  judgingRoomsById: vi.fn(async () => new Map()),
}));
const rooms = vi.mocked(judgingRoomsById);

/** Same format the mirror writes. */
const ts = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "short",
    timeStyle: "short",
  });
const blank = (n: number) => Array<string>(n).fill("");

/** An in-memory sheet: tabs and one grid per tab. */
function fakeSheet(tabs: string[] = ["RUN OF SHOW"]) {
  const grid: string[][] = [];
  const ranges: string[] = [];
  const sheet: BookingsSheet & { fail: Error | null } = {
    fail: null,
    async tabTitles() {
      if (sheet.fail) throw sheet.fail;
      return [...tabs];
    },
    async addTab(title) {
      tabs.push(title);
    },
    async write(range, values) {
      ranges.push(range);
      values.forEach((row, i) => (grid[i] = row));
    },
    async clear(range) {
      ranges.push(range);
      const from = Number(/!A(\d+):Z$/.exec(range)![1]);
      grid.length = Math.min(grid.length, from - 1);
    },
  };
  return { sheet, grid, ranges, tabs };
}

const fixture: JudgingSheetInput = {
  tracks: [
    { name: "Scotiabank", sponsorId: "s-scotia" },
    { name: "QNX", sponsorId: "s-qnx" },
    { name: "TinyFish", sponsorId: "s-tiny" },
    { name: "PCBWay", sponsorId: null },
  ],
  rooms: new Map([
    ["s-scotia", "Rm 2110"],
    ["s-qnx", "Rm 2235"],
    // The sheet's old "Digital" room; remote judging wins.
    ["s-tiny", "Digital"],
  ]),
  sends: [
    {
      sponsorId: "s-scotia",
      teamIds: ["t2", "t1", "t3"],
      sentAt: new Date("2026-11-22T09:50:00-05:00"),
    },
  ],
  finals: [
    {
      sponsorId: "s-scotia",
      teamIds: ["t1", "t3", "t5", "t2", "t4"],
      submittedAt: new Date("2026-11-22T12:05:00-05:00"),
    },
  ],
  presentations: [
    { sponsorId: "s-scotia", teamId: "t1", room: "Rm 2110", startMinute: 605 },
    { sponsorId: "s-scotia", teamId: "t2", room: "Rm 2110", startMinute: 600 },
    // Couldn't fit: no time, so no room either.
    { sponsorId: "s-scotia", teamId: "t3", room: "Rm 2110", startMinute: null },
    // Another sponsor's slot (QNX sent nothing yet but has a slot).
    { sponsorId: "s-qnx", teamId: "t1", room: "Rm 2235", startMinute: 620 },
  ],
  teamNames: new Map([
    ["t1", "Alpha"],
    ["t2", "Bravo"],
    ["t3", "Charlie"],
    ["t4", "Delta"],
  ]),
  teamLinks: new Map([
    ["t1", "https://devpost.com/software/alpha"],
    ["t2", "https://devpost.com/software/bravo/"],
    ["t3", null],
  ]),
  members: new Map([
    ["t1", ["Ada Lovelace", "Alan Turing"]],
    ["t2", ["Grace Hopper"]],
  ]),
  notified: new Map([
    ["t1", "Slack, Email"],
    ["t2", "failed"],
  ]),
  scoring: new Set(["s-tiny"]),
  round2Open: true,
  writtenAt: new Date("2026-11-22T12:10:00-05:00"),
};

describe("judgingSheetRows", () => {
  test("one wide row per sponsor with 1st-5th place, then presentations", () => {
    const rows = judgingSheetRows(fixture);
    const pad = (row: string[]) => [...row, ...blank(14 - row.length)];
    expect(rows).toEqual(
      [
        [
          "Written by the Hack Western app from its database. Edits here are overwritten on the next change.",
          `Updated ${ts("2026-11-22T12:10:00-05:00")}`,
        ],
        [],
        [
          "Sponsor",
          "In person / Digital",
          "Judging room",
          "Round 1 status",
          "Shortlist sent",
          "Shortlist (team IDs)",
          "Round 2 status",
          "Top 5 sent",
          "1st place",
          "2nd place",
          "3rd place",
          "4th place",
          "5th place",
          "Notes",
        ],
        [
          "Scotiabank",
          "In person",
          "Rm 2110",
          "Shortlist sent",
          ts("2026-11-22T09:50:00-05:00"),
          "t2, t1, t3",
          "Top 5 sent",
          ts("2026-11-22T12:05:00-05:00"),
          // Team ID + Devpost link; no link = ID only; never invented.
          "t1 · devpost.com/software/alpha",
          "t3",
          "t5",
          "t2 · devpost.com/software/bravo",
          "t4",
          "",
        ],
        [
          "QNX",
          "In person",
          "Rm 2235",
          "Not started",
          "",
          "",
          "Ranking",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
        [
          "TinyFish",
          "In person",
          "Remote (judges online)",
          "Scoring",
          "",
          "",
          "Locked: no presentations",
          "",
          "",
          "",
          "",
          "",
          "",
          "Judges remotely; presentations are online.",
        ],
        [
          "PCBWay",
          "Digital",
          "",
          "No round 1 (digital)",
          "",
          "",
          "Waiting for the spon team",
          "",
          "",
          "",
          "",
          "",
          "",
          "Digital sponsor: top 5 entered by the spon team from Devpost links.",
        ],
        [],
        ["Presentations"],
        ["Sponsor", "Team ID", "Team", "Members", "Time", "Room", "Notified"],
        // Placed slots in time order, then teams with no slot.
        [
          "Scotiabank",
          "t2 · devpost.com/software/bravo",
          "Bravo",
          "Grace Hopper",
          "10:00 AM",
          "Rm 2110",
          "failed",
        ],
        [
          "Scotiabank",
          "t1 · devpost.com/software/alpha",
          "Alpha",
          "Ada Lovelace, Alan Turing",
          "10:05 AM",
          "Rm 2110",
          "Slack, Email",
        ],
        ["Scotiabank", "t3", "Charlie", "", "", "", ""],
        [
          "QNX",
          "t1 · devpost.com/software/alpha",
          "Alpha",
          "Ada Lovelace, Alan Turing",
          "10:20 AM",
          "Rm 2235",
          "Slack, Email",
        ],
      ].map(pad),
    );
  });

  test("with nothing stored, every sponsor row is still listed", () => {
    const rows = judgingSheetRows({
      ...fixture,
      rooms: new Map(),
      sends: [],
      finals: [],
      presentations: [],
      scoring: new Set(),
      round2Open: false,
    });
    expect(rows.slice(3, 7).map((r) => [r[0], r[3], r[6]])).toEqual([
      ["Scotiabank", "Not started", "Not open"],
      ["QNX", "Not started", "Not open"],
      ["TinyFish", "Not started", "Not open"],
      ["PCBWay", "No round 1 (digital)", "Waiting for the spon team"],
    ]);
    // Ends on the presentations header: no rows under it.
    expect(rows.at(-1)!.slice(0, 2)).toEqual(["Sponsor", "Team ID"]);
  });

  test("a digital sponsor's entered top 3 fills the place cells", () => {
    const rows = judgingSheetRows({
      ...fixture,
      tracks: [{ name: "PCBWay", sponsorId: "s-pcb" }],
      finals: [
        {
          sponsorId: "s-pcb",
          teamIds: ["t2", "t1", "t3"],
          submittedAt: new Date("2026-11-23T09:05:00-05:00"),
        },
      ],
    });
    expect(rows[3]!.slice(6, 11)).toEqual([
      "Entered by the spon team",
      ts("2026-11-23T09:05:00-05:00"),
      "t2 · devpost.com/software/bravo",
      "t1 · devpost.com/software/alpha",
      "t3",
    ]);
  });
});

describe("notifiedLabel", () => {
  test("names each way members heard, and failures", () => {
    expect(notifiedLabel([])).toBe("");
    expect(
      notifiedLabel([
        { status: "sent", reached: true },
        { status: "sent", reached: true },
      ]),
    ).toBe("Slack");
    expect(
      notifiedLabel([
        { status: "sent", reached: true },
        { status: "emailed", reached: true },
        { status: "not-found", reached: false },
      ]),
    ).toBe("Slack, Email, failed");
    expect(notifiedLabel([{ status: "sending", reached: false }])).toBe("");
  });
});

describe("writeJudgingSheet", () => {
  test("creates the tab once, writes from A1 and clears leftovers", async () => {
    const { sheet, grid, ranges, tabs } = fakeSheet();
    const n = await writeJudgingSheet(sheet, fixture);
    expect(tabs).toEqual(["RUN OF SHOW", JUDGING_TAB]);
    expect(grid).toHaveLength(n);
    expect(ranges).toEqual([
      `'${JUDGING_TAB}'!A1`,
      `'${JUDGING_TAB}'!A${n + 1}:Z`,
    ]);

    // A shorter rewrite drops the old rows; the tab isn't added twice.
    const shorter = await writeJudgingSheet(sheet, {
      ...fixture,
      sends: [],
      presentations: [],
    });
    expect(shorter).toBeLessThan(n);
    expect(grid).toHaveLength(shorter);
    expect(tabs.filter((t) => t === JUDGING_TAB)).toHaveLength(1);
    // Only its own tab is ever written or cleared.
    for (const range of ranges) {
      expect(range.startsWith(`'${JUDGING_TAB}'!`)).toBe(true);
    }
  });
});

describe("mirrorSponsorJudging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    writes.enabled = true;
  });

  test("with sheet writes off nothing is written; logged once", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writes.enabled = false;
    const { sheet, ranges } = fakeSheet();
    const deps = { sheet: async () => sheet, load: async () => fixture };
    await expect(mirrorSponsorJudging(deps)).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    await mirrorSponsorJudging(deps);
    expect(ranges).toEqual([]);
    expect(
      log.mock.calls.filter((args) =>
        String(args[0]).includes("sheet writes are off"),
      ),
    ).toHaveLength(1);
  });

  test("a run that timed out never clears after a newer run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const steps: string[] = [];
    let release!: () => void;
    const slow: BookingsSheet = {
      tabTitles: async () => [JUDGING_TAB],
      addTab: async () => undefined,
      write: () =>
        new Promise<void>((resolve) => {
          steps.push("old write");
          release = resolve;
        }),
      clear: async () => {
        steps.push("old clear");
      },
    };
    const fast: BookingsSheet = {
      tabTitles: async () => [JUDGING_TAB],
      addTab: async () => undefined,
      write: async () => {
        steps.push("new write");
      },
      clear: async () => {
        steps.push("new clear");
      },
    };
    const load = async () => fixture;
    const old = mirrorSponsorJudging({ sheet: async () => slow, load });
    const newer = mirrorSponsorJudging({ sheet: async () => fast, load });
    await vi.advanceTimersByTimeAsync(MIRROR_TIMEOUT_MS);
    await expect(old).resolves.toMatchObject({ ok: false });
    await expect(newer).resolves.toMatchObject({ ok: true });
    // The old write lands late: it must not clear the newer rows.
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(steps).toEqual(["old write", "new write", "new clear"]);
  });

  test("a sheet failure is returned, logged once, and never thrown", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sheet } = fakeSheet();
    sheet.fail = new Error("The caller does not have permission");
    const deps = { sheet: async () => sheet, load: async () => fixture };

    await expect(mirrorSponsorJudging(deps)).resolves.toEqual({
      ok: false,
      error: "The caller does not have permission",
    });
    await mirrorSponsorJudging(deps);
    const logs = log.mock.calls.filter((args) =>
      String(args[0]).startsWith("sponsor judging sheet mirror failed"),
    );
    expect(logs).toHaveLength(1);

    // Fixed (made Editor): the next write goes through.
    sheet.fail = null;
    await expect(mirrorSponsorJudging(deps)).resolves.toMatchObject({
      ok: true,
    });
  });

  test("without a fake sheet it never reaches Google (credentials blank)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await mirrorSponsorJudging({ load: async () => fixture });
    expect(res.ok).toBe(false);
  });
});

describe("loadJudgingSheetInput", () => {
  test("reads track sponsors, sends, slots, notices and finals from the DB", async () => {
    const suffix = faker.string.alphanumeric(6);
    const [scotia, other] = await db
      .insert(sponsorJudgingSponsors)
      .values([
        { name: `Scotiabank ${suffix}` },
        { name: `No Track Co ${suffix}` },
      ])
      .returning();
    const teamIds = [1, 2].map(() => faker.string.alphanumeric(12));
    await db.insert(teams).values(
      teamIds.map((id, i) => ({
        id,
        name: `Team ${i + 1} ${suffix}`,
        joinCode: faker.string.alphanumeric(6),
        submissionStatus: "submitted" as const,
        tracks: ["General" as const],
      })),
    );
    const [ada] = await db
      .insert(users)
      .values({
        id: `ada-${suffix}`,
        email: `ada-${suffix}@example.com`,
        name: "Ada Lovelace",
        type: "hacker",
        teamId: teamIds[0],
      })
      .returning();
    await db.insert(sponsorShortlistSends).values([
      { sponsorId: scotia!.id, teamIds },
      { sponsorId: other!.id, teamIds },
    ]);
    await db.insert(sponsorPresentations).values({
      sponsorId: scotia!.id,
      teamId: teamIds[0]!,
      room: "Rm 2110",
      startMinute: 600,
    });
    await db.insert(sponsorPresentationNotices).values({
      userId: ada!.id,
      teamId: teamIds[0]!,
      status: "sent",
      slotsKey: slotsKey([
        { sponsorId: scotia!.id, room: "Rm 2110", start: 600 },
      ]),
      sentAt: new Date(),
    });
    await db.insert(sponsorFinalPicks).values({
      sponsorId: scotia!.id,
      teamIds: [teamIds[1]!, teamIds[0]!],
    });
    rooms.mockResolvedValueOnce(new Map([[scotia!.id, "Rm 2110"]]));

    const input = await loadJudgingSheetInput();
    // Only prize track sponsors; PCBWay listed even though unregistered.
    expect(input.tracks.map((t) => t.name)).toContain(scotia!.name);
    expect(input.tracks.map((t) => t.name)).not.toContain(other!.name);
    expect(input.tracks).toContainEqual({ name: "PCBWay", sponsorId: null });
    expect(rooms.mock.calls.at(-1)![0].map((s) => s.id)).not.toContain(
      other!.id,
    );
    expect(input.sends.map((s) => s.sponsorId)).toEqual([scotia!.id]);
    expect(input.notified.get(teamIds[0]!)).toBe("Slack");
    expect(input.members.get(teamIds[0]!)).toEqual(["Ada Lovelace"]);

    const rows = judgingSheetRows(input);
    expect(rows).toContainEqual([
      scotia!.name,
      teamIds[0],
      `Team 1 ${suffix}`,
      "Ada Lovelace",
      "10:00 AM",
      "Rm 2110",
      "Slack",
      ...blank(7),
    ]);
    const row = rows.find((r) => r[0] === scotia!.name)!;
    expect(row.slice(8, 10)).toEqual([teamIds[1], teamIds[0]]);
    expect(input.round2Open).toBe(false);
  });
});
