import { describe, expect, test, vi } from "vitest";

import {
  SCORES_TAB,
  SCORES_WIDTH,
  averageFormula,
  mirrorJudgingScores,
  planScoreWrites,
  scoreBlocks,
  writeJudgingScores,
  type ScoresBlock,
  type ScoresInput,
  type ScoresSheet,
} from "~/server/api/utils/sponsor-judging-scores-mirror";

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
const writes = vi.hoisted(() => ({ enabled: true }));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/run-of-show-sheet")
  >()),
  sheetWritesEnabled: () => writes.enabled,
}));

const NOTE =
  "Filled by the app as reps score. If the app is down, type scores here.";
const input: ScoresInput = {
  sponsors: [
    { id: "s-scotia", track: "Scotiabank", name: "Scotiabank" },
    { id: "s-tiny", track: "TinyFish", name: "TinyFish" },
  ],
  slots: [
    { sponsorId: "s-scotia", teamId: "t2", room: "Rm 2110", start: 606 },
    { sponsorId: "s-scotia", teamId: "t1", room: "Rm 2110", start: 600 },
    // Another sponsor's slot doesn't show in Scotiabank's block.
    { sponsorId: "s-other", teamId: "t3", room: "Rm 2235", start: 600 },
  ],
  scores: [
    { sponsorId: "s-scotia", teamId: "t1", judge: "Kevin L.", halves: 12 },
    { sponsorId: "s-scotia", teamId: "t1", judge: " dana  w. ", halves: 17 },
    // Same rep, other spelling: the last row wins.
    { sponsorId: "s-scotia", teamId: "t1", judge: "Dana W.", halves: 19 },
    { sponsorId: "s-scotia", teamId: "t2", judge: "Dana W.", halves: 16 },
    // Scored in round 1 but didn't present: not in the block.
    { sponsorId: "s-scotia", teamId: "t9", judge: "Priya S.", halves: 20 },
  ],
  links: new Map([
    ["t1", "https://devpost.com/software/alpha"],
    ["t2", null],
  ]),
};

describe("scoreBlocks (the row builder)", () => {
  test("one block per sponsor, presenting teams in time order, a column per rep", () => {
    expect(scoreBlocks(input)).toEqual([
      {
        sponsor: "Scotiabank",
        room: "Rm 2110",
        judges: ["Dana W.", "Kevin L."],
        teams: [
          {
            start: 600,
            teamId: "t1",
            devpostUrl: "https://devpost.com/software/alpha",
            scores: [
              { judge: "Dana W.", score: 9.5 },
              { judge: "Kevin L.", score: 6 },
            ],
          },
          {
            start: 606,
            teamId: "t2",
            devpostUrl: null,
            scores: [{ judge: "Dana W.", score: 8 }],
          },
        ],
      },
      // No slots yet: an empty block; TinyFish judges remotely.
      {
        sponsor: "TinyFish",
        room: "Remote (judges online)",
        judges: [],
        teams: [],
      },
    ]);
  });
});

/** The grid after applying `w` on top of `grid` (what the sheet would hold). */
function apply(
  grid: readonly (readonly unknown[])[],
  w: ReturnType<typeof planScoreWrites>["writes"],
) {
  const out = grid.map((row) => [...row]);
  for (const c of w) {
    while (out.length <= c.row) out.push([]);
    const row = out[c.row]!;
    while (row.length <= c.col) row.push("");
    row[c.col] = c.value;
  }
  return out;
}

const blocks = scoreBlocks(input);

describe("planScoreWrites", () => {
  test("an empty tab: note, then a block with title, header and team rows", () => {
    const { writes: w, skipped } = planScoreWrites([], blocks);
    expect(skipped).toEqual([]);
    const grid = apply([], w);
    expect(grid[0]).toEqual([NOTE]);
    expect(grid[2]!.slice(0, 2)).toEqual(["Scotiabank", "Rm 2110"]);
    expect(grid[3]).toEqual([
      "Time",
      "Team ID",
      "Devpost",
      "Dana W.",
      "Kevin L.",
      "Rep 3",
      "Rep 4",
      "Rep 5",
      "Rep 6",
      "Average",
    ]);
    expect(grid[4]).toEqual([
      "10:00 AM",
      "t1",
      "https://devpost.com/software/alpha",
      9.5,
      6,
      "",
      "",
      "",
      "",
      averageFormula(4),
    ]);
    // No Devpost link: that cell is left alone, not blanked.
    expect(grid[5]!.slice(0, 4)).toEqual(["10:06 AM", "t2", "", 8]);
    // Next block after 15 team rows and a gap.
    expect(grid[2 + 17 + 1]!.slice(0, 2)).toEqual([
      "TinyFish",
      "Remote (judges online)",
    ]);
    expect(averageFormula(4)).toBe('=IFERROR(ROUND(AVERAGE(D5:I5),1),"")');
    expect(w.filter((c) => c.formula).map((c) => c.row)).toEqual([4, 5]);
  });

  test("never writes an empty value or a column right of Average", () => {
    const { writes: w } = planScoreWrites([], blocks);
    expect(w.every((c) => String(c.value).trim() !== "")).toBe(true);
    expect(w.every((c) => c.col < SCORES_WIDTH)).toBe(true);
  });

  test("keeps hand-typed scores, reps and teams; reuses the hand-made block", () => {
    // The app was down: Priya typed her column and a team the app doesn't
    // know, and organizers keep notes in column K.
    const grid = [
      [NOTE],
      [],
      ["Scotiabank", "Rm 2110"],
      [
        "Time",
        "Team ID",
        "Devpost",
        "Priya S.",
        "Rep 2",
        "Rep 3",
        "Rep 4",
        "Rep 5",
        "Rep 6",
        "Average",
        "Notes",
      ],
      ["", "t7", "", 7, "", "", "", "", "", "=AVG", "late"],
      ["10:00 AM", "t1", "", 8.5, 5, "", "", "", "", "", "keep me"],
    ];
    const { writes: w } = planScoreWrites(grid, blocks);
    const after = apply(grid, w);
    // Hand-typed cells and column K are untouched.
    expect(after[4]).toEqual(grid[4]);
    expect(after[3]![3]).toBe("Priya S.");
    expect(after[5]![3]).toBe(8.5);
    expect(after[5]![10]).toBe("keep me");
    expect(w.some((c) => c.col >= SCORES_WIDTH)).toBe(false);
    // t1 keeps its row; the app's reps take the free "Rep N" columns, and
    // overwrite only cells it has a score for.
    expect(after[3]!.slice(4, 6)).toEqual(["Dana W.", "Kevin L."]);
    expect(after[5]!.slice(0, 10)).toEqual([
      "10:00 AM",
      "t1",
      "https://devpost.com/software/alpha",
      8.5,
      9.5,
      6,
      "",
      "",
      "",
      averageFormula(5),
    ]);
    // t2 goes in the first row with no team ID.
    expect(after[6]!.slice(0, 4)).toEqual(["10:06 AM", "t2", "", ""]);
    expect(after[6]![4]).toBe(8);
    // A second run with nothing new writes nothing.
    expect(planScoreWrites(after, blocks).writes).toEqual([]);
  });

  test("a cleared score stays in the sheet (never blanked)", () => {
    const first = apply([], planScoreWrites([], blocks).writes);
    const cleared = scoreBlocks({
      ...input,
      scores: input.scores.filter((s) => s.judge !== "Kevin L."),
    });
    const { writes: w } = planScoreWrites(first, cleared);
    expect(w).toEqual([]);
    expect(apply(first, w)[4]![4]).toBe(6);
  });

  test("a changed score or time is overwritten", () => {
    const first = apply([], planScoreWrites([], blocks).writes);
    const changed: ScoresBlock[] = blocks.map((b) => ({
      ...b,
      teams: b.teams.map((t) =>
        t.teamId === "t1"
          ? { ...t, start: 612, scores: [{ judge: "Dana W.", score: 10 }] }
          : t,
      ),
    }));
    const { writes: w } = planScoreWrites(first, changed);
    expect(w).toEqual([
      { row: 4, col: 0, value: "10:12 AM" },
      { row: 4, col: 3, value: 10 },
    ]);
  });

  test("more reps than columns: the extra ones are skipped, not squeezed in", () => {
    const many: ScoresBlock = {
      ...blocks[0]!,
      judges: ["A", "B", "C", "D", "E", "F", "G"],
    };
    const { skipped } = planScoreWrites([], [many]);
    expect(skipped).toEqual([{ sponsor: "Scotiabank", judge: "G" }]);
  });
});

/** A fake Sheets client: a grid, and every write call recorded. */
function fakeSheet(grid: unknown[][] | null) {
  const calls: {
    cells: { range: string; value: string | number }[];
    input: string;
  }[] = [];
  const tabs: string[] = grid ? [SCORES_TAB] : [];
  const addTab = vi.fn(async (title: string) => {
    tabs.push(title);
  });
  const read = vi.fn(async (_range: string) => grid ?? []);
  const sheet: ScoresSheet = {
    tabTitles: async () => tabs,
    addTab,
    read,
    writeCells: async (cells, input) => {
      calls.push({ cells, input });
    },
  };
  return { sheet, calls, addTab, read };
}

describe("writeJudgingScores", () => {
  test("adds the tab if missing, writes RAW cells then formulas, never a blank", async () => {
    const { sheet, calls, addTab, read } = fakeSheet(null);
    const n = await writeJudgingScores(sheet, blocks);
    expect(addTab).toHaveBeenCalledWith(SCORES_TAB);
    expect(read).not.toHaveBeenCalled();
    expect(calls.map((c) => c.input)).toEqual(["RAW", "USER_ENTERED"]);
    const all = calls.flatMap((c) => c.cells);
    expect(all).toHaveLength(n);
    expect(all.every((c) => String(c.value).trim() !== "")).toBe(true);
    expect(all[0]).toEqual({ range: `'${SCORES_TAB}'!A1`, value: NOTE });
    expect(calls[1]!.cells[0]).toEqual({
      range: `'${SCORES_TAB}'!J5`,
      value: averageFormula(4),
    });
  });

  test("an existing tab is read first, and only cells A to J are written", async () => {
    const { sheet, calls, read } = fakeSheet([
      [NOTE],
      [],
      ["Scotiabank", "Rm 2110", "", "", "", "", "", "", "", "", "notes"],
    ]);
    await writeJudgingScores(sheet, blocks);
    expect(read).toHaveBeenCalledWith(`'${SCORES_TAB}'!A:J`);
    const ranges = calls.flatMap((c) => c.cells.map((x) => x.range));
    expect(ranges.every((r) => /!([A-J])\d+$/.test(r))).toBe(true);
    // The existing title row isn't rewritten.
    expect(ranges).not.toContain(`'${SCORES_TAB}'!A3`);
  });
});

describe("mirrorJudgingScores", () => {
  test("does nothing with sheet writes off", async () => {
    writes.enabled = false;
    const load = vi.fn();
    const sheet = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(mirrorJudgingScores({ load, sheet })).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    expect(load).not.toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
    warn.mockRestore();
    writes.enabled = true;
  });

  test("calls made while one is queued share it, and a failure never throws", async () => {
    const { sheet } = fakeSheet(null);
    const load = vi.fn(async () => input);
    const a = mirrorJudgingScores({ load, sheet: async () => sheet });
    const b = mirrorJudgingScores({ load, sheet: async () => sheet });
    expect(b).toBe(a);
    await expect(a).resolves.toMatchObject({ ok: true });
    expect(load).toHaveBeenCalledTimes(1);

    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await expect(
      mirrorJudgingScores({
        load,
        sheet: async () => {
          throw new Error("403 forbidden");
        },
      }),
    ).resolves.toEqual({ ok: false, error: "403 forbidden" });
    error.mockRestore();
  });
});
