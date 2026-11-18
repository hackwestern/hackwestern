import { afterEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";

import type { BookingsSheet } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import {
  JUDGING_TAB,
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
    { name: "PCBWay", sponsorId: null },
  ],
  rooms: new Map([
    ["s-scotia", "Rm 2110"],
    ["s-qnx", "Rm 2235"],
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
      teamIds: ["t1", "t3", "t4", "t5", "t2"],
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
  members: new Map([
    ["t1", ["Ada Lovelace", "Alan Turing"]],
    ["t2", ["Grace Hopper"]],
  ]),
  notified: new Map([
    ["t1", "Slack, Email"],
    ["t2", "failed"],
  ]),
  writtenAt: new Date("2026-11-22T12:10:00-05:00"),
};

describe("judgingSheetRows", () => {
  test("lays out the three tables from fixture data", () => {
    const rows = judgingSheetRows(fixture);
    const pad = (row: string[]) => [...row, ...blank(7 - row.length)];
    expect(rows).toEqual(
      [
        [
          "Written by the Hack Western app from its database. Edits here are overwritten on the next change.",
          `Updated ${ts("2026-11-22T12:10:00-05:00")}`,
        ],
        [],
        ["Tracks"],
        [
          "Sponsor",
          "Has track",
          "Judging room",
          "Round 1 shortlist sent",
          "Round 2 top 5 sent",
        ],
        [
          "Scotiabank",
          "Yes",
          "Rm 2110",
          ts("2026-11-22T09:50:00-05:00"),
          ts("2026-11-22T12:05:00-05:00"),
        ],
        ["QNX", "Yes", "Rm 2235", "", ""],
        // Not registered yet: on the list, everything else blank.
        ["PCBWay", "Yes", "", "", ""],
        [],
        ["Chosen teams and presentation schedule"],
        ["Sponsor", "Round", "Team", "Members", "Time", "Room", "Notified"],
        // Placed slots in time order, then teams with no slot.
        [
          "Scotiabank",
          "Round 1",
          "Bravo",
          "Grace Hopper",
          "10:00 AM",
          "Rm 2110",
          "failed",
        ],
        [
          "Scotiabank",
          "Round 1",
          "Alpha",
          "Ada Lovelace, Alan Turing",
          "10:05 AM",
          "Rm 2110",
          "Slack, Email",
        ],
        ["Scotiabank", "Round 1", "Charlie", "", "", "", ""],
        [
          "QNX",
          "Round 1",
          "Alpha",
          "Ada Lovelace, Alan Turing",
          "10:20 AM",
          "Rm 2235",
          "Slack, Email",
        ],
        [],
        ["Final results"],
        ["Sponsor", "Rank", "Team", "Members"],
        ["Scotiabank", "1", "Alpha", "Ada Lovelace, Alan Turing"],
        ["Scotiabank", "2", "Charlie", ""],
        ["Scotiabank", "3", "Delta", ""],
        // A team with no stored name shows its id; never invented.
        ["Scotiabank", "4", "t5", ""],
        ["Scotiabank", "5", "Bravo", "Grace Hopper"],
      ].map(pad),
    );
  });

  test("with nothing stored, only the track list is filled", () => {
    const rows = judgingSheetRows({
      ...fixture,
      rooms: new Map(),
      sends: [],
      finals: [],
      presentations: [],
    });
    expect(
      rows.filter((r) => r[1] === "Yes").map((r) => r.slice(0, 5)),
    ).toEqual([
      ["Scotiabank", "Yes", "", "", ""],
      ["QNX", "Yes", "", "", ""],
      ["PCBWay", "Yes", "", "", ""],
    ]);
    expect(rows.filter((r) => r[1] === "Round 1")).toEqual([]);
    // Ends on the final results header: no rows under it.
    expect(rows.at(-1)!.slice(0, 4)).toEqual([
      "Sponsor",
      "Rank",
      "Team",
      "Members",
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
    const shorter = await writeJudgingSheet(sheet, { ...fixture, finals: [] });
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
  afterEach(() => vi.restoreAllMocks());

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
      "Round 1",
      `Team 1 ${suffix}`,
      "Ada Lovelace",
      "10:00 AM",
      "Rm 2110",
      "Slack",
    ]);
    expect(rows).toContainEqual([
      scotia!.name,
      "1",
      `Team 2 ${suffix}`,
      "",
      "",
      "",
      "",
    ]);
  });
});
