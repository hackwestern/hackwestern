// src/server/api/utils/results-sheet.ts
//
// Exports final judging results to a Google Sheet (JUDGING_RESULTS_SHEET) in
// one go, once judging is over. An organizer runs it from the judging control
// page (judging.admin.finalizeResultsSheet); nothing writes to the sheet while
// judging is live. It can be re-run: every tab is rebuilt from a fresh db
// snapshot, and completeness scores already typed are kept.
//
// Only the top TOP_N teams by judge average are exported (teams with no
// regular-round marks are never included).
//
//   "Top 20":   rank, team and Final, best first — a single sheet formula
//               over Results, so it re-sorts live as completeness is typed.
//   "Results":  one bold row per team, ranked by judge average, with that
//               team's judge marks in a collapsed row group under it. Next to
//               Average: Devpost / GitHub links, "Completeness" (blank,
//               organizers type 0-10 on team rows; red while blank, green
//               once scored) and "Final" (highlighted) — a formula that
//               counts completeness as one more rubric criterion:
//               (Average × N + Completeness) / (N + 1), N = number of rubric
//               criteria (5 now, so × 5 / 6); the Average alone while
//               Completeness is blank. "Super likes" counts hearts from any
//               judge; judge rows show ♥.
//   "Marks":    flat list, one row per judge mark — easy to filter/sort.
//
// The app's own ranking (and Results' Rank column) stay judges-only;
// completeness only changes Final.
//
// All tabs are created first, then written in ONE spreadsheets.batchUpdate,
// so formulas never point at a tab that doesn't exist yet and the sheet is
// never seen half-written. The spreadsheet must be shared (Editor) with
// SPONSOR_SHEETS_CLIENT_EMAIL. Anything typed into these tabs other than
// Results' Completeness column is overwritten on a re-run.
import { type sheets_v4 } from "googleapis";

import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { env } from "~/env";
import {
  type SheetsClient,
  getSheetsClient,
} from "~/server/api/utils/sponsor-sheets";
import { type TeamResult } from "~/server/api/utils/team-results";
import { loadTeamResults } from "~/server/api/utils/team-results-data";

export const RESULTS_TAB = "Results";
export const MARKS_TAB = "Marks";
/** How many teams the export includes, best judge average first. */
export const TOP_N = 20;
/**
 * A live summary (rank, team, Final) computed by a sheet formula from
 * Results, so it re-sorts as completeness scores are typed.
 */
export const SUMMARY_TAB = `Top ${TOP_N}`;
/** Tabs in the order they appear in the spreadsheet. */
const TABS = [SUMMARY_TAB, RESULTS_TAB, MARKS_TAB];
/**
 * Where scores were typed before they moved into Results. Its scores are
 * carried over on the next export, then the tab is removed.
 */
const LEGACY_COMPLETENESS_TAB = "Completeness";
/** Written by earlier exports (a top-N view). Removed on the next export. */
const LEGACY_CONTROL_TAB = "Control";

/**
 * A cell value. Plain strings are always written as text — never parsed as
 * formulas — so team names, judge names and notes can't inject formulas.
 * Only `{ formula }` cells, built in this file, become formulas.
 */
type Cell =
  | string
  | number
  | boolean
  | { formula: string }
  | { text: string; link: string };

/** Shown on a judge's row when they super liked the team. */
const SUPER_LIKE = "♥";
const JUDGE_PREFIX = "↳";

/** A sheet row plus whether it is a bold summary (header / team) row. */
export interface SheetRow {
  cells: Cell[];
  bold?: boolean;
}

/** 0-based, end-exclusive row range of one team's judge rows. */
export interface TeamGroup {
  teamId: string;
  start: number;
  end: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number | null | undefined): Cell =>
  n === null || n === undefined ? "" : round2(n);

export const COMPLETENESS_LABEL = "Completeness (0-10)";
const RESULTS_HEADER: string[] = [
  "Rank",
  "Table",
  "Team / Judge",
  "Judges",
  "Average",
  "Devpost",
  "GitHub",
  COMPLETENESS_LABEL,
  "Final",
  "Super likes",
  ...DEFAULT_RUBRIC.criteria.map((c) => c.name),
  "Sponsor judges",
  "Sponsor average",
  "Notes",
  "Team ID",
];
const col = (label: string) => RESULTS_HEADER.indexOf(label);
const RANK_COL = col("Rank"); // A
const NAME_COL = col("Team / Judge"); // C
const AVERAGE_COL = col("Average"); // E
const COMPLETENESS_COL = col(COMPLETENESS_LABEL); // H
const FINAL_COL = col("Final"); // I
const TEAM_ID_COL = col("Team ID"); // last

/**
 * A short clickable link ("Devpost", "GitHub") instead of the whole URL.
 * Only http(s) URLs become links (a bare "github.com/..." gets https://);
 * anything else is shown as plain text.
 */
export function linkCell(url: string | null | undefined, text: string): Cell {
  const raw = url?.trim();
  if (!raw) return "";
  const href = /^https?:\/\//i.test(raw)
    ? raw
    : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)
      ? `https://${raw}`
      : null;
  return href ? { text, link: href } : raw;
}

function letter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/**
 * Completeness weighs the same as one rubric criterion, so Final is the
 * average over the rubric criteria plus completeness.
 */
export const CRITERIA_COUNT = DEFAULT_RUBRIC.criteria.length;

/** Final for the team row at 1-based sheet row `row`. */
function finalFormula(row: number): Cell {
  const avg = `${letter(AVERAGE_COL)}${row}`;
  const comp = `${letter(COMPLETENESS_COL)}${row}`;
  const n = CRITERIA_COUNT;
  return {
    formula: `=IF(${avg}="", "", IF(ISNUMBER(${comp}), ROUND((${avg} * ${n} + ${comp}) / ${n + 1}, 2), ${avg}))`,
  };
}

/**
 * Teams best-first by regular-round average (ties and unmarked teams keep
 * their table order). Rank is null for teams with no regular marks.
 */
export function rankTeams(
  results: TeamResult[],
): { r: TeamResult; rank: number | null }[] {
  return results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = a.r.regular.average;
      const y = b.r.regular.average;
      if (x !== y) {
        if (x === null) return 1;
        if (y === null) return -1;
        return y - x;
      }
      return a.i - b.i;
    })
    .map(({ r }, i) => ({
      r,
      rank: r.regular.average === null ? null : i + 1,
    }));
}

/**
 * The teams the export includes: the best `n` by regular-round average, best
 * first. Teams with no regular marks have no rank and are left out. A tie at
 * the cut-off keeps the team with the lower table order (see rankTeams).
 */
export function topTeams(results: TeamResult[], n = TOP_N): TeamResult[] {
  return rankTeams(results)
    .filter(({ rank }) => rank !== null && rank <= n)
    .map(({ r }) => r);
}

/**
 * Results tab: header, then per team (ranked by regular-round average,
 * unmarked teams last in table order) a bold summary row followed by one row
 * per judge mark. Team rows carry the typed completeness score (`scores`, by
 * team ID) and the Final formula. Judge rows put their score under "Average"
 * for the regular round or "Sponsor average" for the sponsored round.
 * Returns the rows, every team row's index, and each team's judge-row range.
 */
export function buildResultsRows(
  results: TeamResult[],
  scores = new Map<string, number>(),
): { rows: SheetRow[]; groups: TeamGroup[]; teamRows: number[] } {
  const criteria = DEFAULT_RUBRIC.criteria;
  const rows: SheetRow[] = [{ cells: RESULTS_HEADER, bold: true }];
  const groups: TeamGroup[] = [];
  const teamRows: number[] = [];

  for (const { r, rank } of rankTeams(results)) {
    teamRows.push(rows.length);
    rows.push({
      bold: true,
      cells: [
        rank ?? "",
        r.team.table ?? "",
        r.team.name,
        r.regular.count,
        num(r.regular.average),
        linkCell(r.team.devpost, "Devpost"),
        linkCell(r.team.github, "GitHub"),
        scores.get(r.team.id) ?? "",
        finalFormula(rows.length + 1),
        r.regular.superLikes + r.sponsored.superLikes,
        ...criteria.map((c) => num(r.regular.criteria[c.id])),
        r.sponsored.count,
        num(r.sponsored.average),
        "",
        r.team.id,
      ],
    });

    const start = rows.length;
    for (const [round, summary] of [
      ["regular", r.regular],
      ["sponsored", r.sponsored],
    ] as const) {
      for (const m of summary.marks) {
        rows.push({
          cells: [
            "",
            "",
            `${JUDGE_PREFIX} ${m.judgeName}`,
            round === "regular" ? "judge" : "sponsor",
            round === "regular" ? num(m.score) : "",
            "",
            "",
            "",
            "",
            m.superLike ? SUPER_LIKE : "",
            ...criteria.map((c) => num(m.ratings[c.id])),
            "",
            round === "sponsored" ? num(m.score) : "",
            m.notes,
            r.team.id,
          ],
        });
      }
    }
    if (rows.length > start) {
      groups.push({ teamId: r.team.id, start, end: rows.length });
    }
  }

  return { rows, groups, teamRows };
}

/** Marks tab rows: header + one row per mark, grouped by team. */
export function buildMarksRows(results: TeamResult[]): SheetRow[] {
  const criteria = DEFAULT_RUBRIC.criteria;
  const rows: SheetRow[] = [
    {
      bold: true,
      cells: [
        "Table",
        "Team",
        "Round",
        "Judge",
        "Score",
        "Super like",
        ...criteria.map((c) => c.name),
        "Notes",
        "Team ID",
      ],
    },
  ];
  for (const r of results) {
    for (const [round, summary] of [
      ["regular", r.regular],
      ["sponsored", r.sponsored],
    ] as const) {
      for (const m of summary.marks) {
        rows.push({
          cells: [
            r.team.table ?? "",
            r.team.name,
            round,
            m.judgeName,
            num(m.score),
            m.superLike ? SUPER_LIKE : "",
            ...criteria.map((c) => num(m.ratings[c.id])),
            m.notes,
            r.team.id,
          ],
        });
      }
    }
  }
  return rows;
}

/**
 * Typed completeness scores, by team ID, from whatever is in the sheet now.
 * `resultsTab` is Results as read (header row first); columns are found by
 * header label, so an older Results layout without a Completeness column
 * simply yields nothing. `legacyTab` is the old Completeness tab's E2:F
 * (score, team ID), if it still exists. A score in Results wins.
 */
export function readCompletenessScores(
  resultsTab: unknown[][],
  legacyTab: unknown[][] = [],
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [score, id] of legacyTab) {
    if (typeof id === "string" && id && typeof score === "number") {
      scores.set(id, score);
    }
  }
  const header = (resultsTab[0] ?? []).map((h) => String(h ?? ""));
  const compCol = header.indexOf(COMPLETENESS_LABEL);
  const idCol = header.indexOf("Team ID");
  const nameCol = header.indexOf("Team / Judge");
  if (compCol === -1 || idCol === -1) return scores;
  for (const row of resultsTab.slice(1)) {
    const id = row[idCol];
    const score = row[compCol];
    const isJudge = String(row[nameCol] ?? "").startsWith(JUDGE_PREFIX);
    if (!isJudge && typeof id === "string" && id && typeof score === "number") {
      scores.set(id, score);
    }
  }
  return scores;
}

/** Current state of one tab, as read from the spreadsheet. */
export interface TabState {
  sheetId: number;
  rowCount: number;
  columnCount: number;
  rowGroups: sheets_v4.Schema$DimensionGroup[];
  conditionalFormatCount: number;
}

function cellData(value: Cell, bold = false): sheets_v4.Schema$CellData {
  if (typeof value === "object" && "link" in value) {
    return {
      userEnteredValue: { stringValue: value.text },
      userEnteredFormat: {
        textFormat: { bold, link: { uri: value.link } },
      },
    };
  }
  const userEnteredValue =
    typeof value === "object"
      ? { formulaValue: value.formula }
      : typeof value === "number"
        ? { numberValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : value === ""
            ? undefined
            : { stringValue: value };
  return {
    userEnteredValue,
    userEnteredFormat: { textFormat: { bold } },
  };
}

/**
 * Wipe a tab back to an empty grid (values, formats, validation, row groups,
 * conditional formats, hidden columns), make sure it is big enough, then
 * write `rows` from A1 and freeze `frozenRows`.
 */
function rewriteTabRequests(
  tab: TabState,
  rows: SheetRow[],
  frozenRows: number,
): sheets_v4.Schema$Request[] {
  const sheetId = tab.sheetId;
  const width = Math.max(1, ...rows.map((r) => r.cells.length));
  const requests: sheets_v4.Schema$Request[] = [];

  for (const g of tab.rowGroups) {
    requests.push({ deleteDimensionGroup: { range: g.range } });
  }
  for (let i = 0; i < tab.conditionalFormatCount; i++) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  }
  if (rows.length > tab.rowCount) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "ROWS",
        length: rows.length - tab.rowCount + 100,
      },
    });
  }
  if (width > tab.columnCount) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "COLUMNS",
        length: width - tab.columnCount,
      },
    });
  }
  requests.push(
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          // Group +/- toggles sit on the team row above, not below.
          gridProperties: {
            frozenRowCount: frozenRows,
            rowGroupControlAfter: false,
          },
        },
        fields:
          "gridProperties.frozenRowCount,gridProperties.rowGroupControlAfter",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS" },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser",
      },
    },
    {
      updateCells: {
        range: { sheetId },
        fields: "userEnteredValue,userEnteredFormat,dataValidation",
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: rows.map((r) => ({
          values: r.cells.map((c) => cellData(c, r.bold ?? false)),
        })),
        fields: "userEnteredValue,userEnteredFormat.textFormat",
      },
    },
  );
  return requests;
}

/**
 * Results (with collapsed judge groups and the Completeness/Final columns)
 * and Marks.
 */
export function buildResultsAndMarksRequests(input: {
  resultsTab: TabState;
  marksTab: TabState;
  results: TeamResult[];
  scores: Map<string, number>;
}): sheets_v4.Schema$Request[] {
  const { rows, groups, teamRows } = buildResultsRows(
    input.results,
    input.scores,
  );
  const sheetId = input.resultsTab.sheetId;
  const range = (g: TeamGroup): sheets_v4.Schema$DimensionRange => ({
    sheetId,
    dimension: "ROWS",
    startIndex: g.start,
    endIndex: g.end,
  });
  const cell = (
    column: number,
    startRow: number,
    endRow = startRow + 1,
  ): sheets_v4.Schema$GridRange => ({
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: column,
    endColumnIndex: column + 1,
  });
  const compCells = teamRows.map((row) => cell(COMPLETENESS_COL, row));
  const statusRule = (
    type: "BLANK" | "NOT_BLANK",
    color: sheets_v4.Schema$Color,
    index: number,
  ): sheets_v4.Schema$Request => ({
    addConditionalFormatRule: {
      index,
      rule: {
        ranges: compCells,
        booleanRule: {
          condition: { type },
          format: { backgroundColor: color },
        },
      },
    },
  });
  const border = {
    style: "SOLID_MEDIUM",
    color: { red: 0.85, green: 0.6, blue: 0.05 },
  };

  return [
    ...rewriteTabRequests(input.resultsTab, rows, 1),
    ...rewriteTabRequests(input.marksTab, buildMarksRows(input.results), 1),
    // Completeness is typed on team rows only: validate those, and show them
    // red while blank, green once scored.
    ...compCells.map((range) => ({
      setDataValidation: {
        range,
        rule: {
          condition: {
            type: "NUMBER_BETWEEN",
            values: [{ userEnteredValue: "0" }, { userEnteredValue: "10" }],
          },
          strict: true,
          inputMessage: "Completeness, 0 to 10",
        },
      },
    })),
    ...(compCells.length > 0
      ? [
          statusRule("BLANK", { red: 0.96, green: 0.8, blue: 0.8 }, 0),
          statusRule("NOT_BLANK", { red: 0.8, green: 0.92, blue: 0.78 }, 1),
        ]
      : []),
    // Final stands out: amber column with a border, bigger bold team scores.
    {
      repeatCell: {
        range: cell(FINAL_COL, 1, rows.length),
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
          },
        },
        fields: "userEnteredFormat.backgroundColor",
      },
    },
    {
      repeatCell: {
        range: cell(FINAL_COL, 0),
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.98, green: 0.74, blue: 0.18 },
            textFormat: { bold: true, fontSize: 12 },
          },
        },
        fields:
          "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
      },
    },
    ...teamRows.map((row) => ({
      repeatCell: {
        range: cell(FINAL_COL, row),
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 12 },
            numberFormat: { type: "NUMBER", pattern: "0.00" },
          },
        },
        fields: "userEnteredFormat.textFormat,userEnteredFormat.numberFormat",
      },
    })),
    {
      updateBorders: {
        range: cell(FINAL_COL, 0, rows.length),
        left: border,
        right: border,
        top: border,
        bottom: border,
      },
    },
    ...groups.map((g) => ({ addDimensionGroup: { range: range(g) } })),
    ...groups.map((g) => ({
      updateDimensionGroup: {
        dimensionGroup: { range: range(g), depth: 1, collapsed: true },
        fields: "collapsed",
      },
    })),
  ];
}

/**
 * The summary tab: one formula in A1 that lists Results' team rows as rank,
 * team, Final, best Final first. It re-sorts by itself as completeness is
 * typed. Only A:C is touched; anything else on the tab is left alone.
 */
export function summaryFormula(): string {
  const r = (c: number) => `${RESULTS_TAB}!${letter(c)}2:${letter(c)}`;
  return (
    `={"Rank", "Team", "Final"; ` +
    `LET(t, SORT(FILTER({${r(NAME_COL)}, ${r(FINAL_COL)}}, ${r(RANK_COL)}<>""), 2, FALSE), ` +
    `{SEQUENCE(ROWS(t)), t})}`
  );
}

export function buildSummaryRequests(
  tab: TabState,
): sheets_v4.Schema$Request[] {
  const sheetId = tab.sheetId;
  return [
    {
      updateCells: {
        range: { sheetId, startColumnIndex: 0, endColumnIndex: 3 },
        fields: "userEnteredValue",
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: [{ values: [cellData({ formula: summaryFormula() })] }],
        fields: "userEnteredValue",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startColumnIndex: 2, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "NUMBER", pattern: "0.00" },
          },
        },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
  ];
}

async function readTabs(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<Map<string, TabState>> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),rowGroups,conditionalFormats)",
  });
  const tabs = new Map<string, TabState>();
  for (const s of meta.data.sheets ?? []) {
    const p = s.properties;
    if (p?.title == null || p.sheetId == null) continue;
    tabs.set(p.title, {
      sheetId: p.sheetId,
      rowCount: p.gridProperties?.rowCount ?? 0,
      columnCount: p.gridProperties?.columnCount ?? 0,
      rowGroups: s.rowGroups ?? [],
      conditionalFormatCount: s.conditionalFormats?.length ?? 0,
    });
  }
  return tabs;
}

/** Our tabs, created (in TABS order, at the front) if missing. */
async function ensureTabs(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<Map<string, TabState>> {
  const tabs = await readTabs(sheets, spreadsheetId);
  const missing = TABS.filter((t) => !tabs.has(t));
  if (missing.length === 0) return tabs;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title, index: TABS.indexOf(title) } },
      })),
    },
  });
  return readTabs(sheets, spreadsheetId);
}

/**
 * Build every tab from the db in one write, for the top TOP_N teams. Typed
 * completeness scores survive a re-run; scores still in the old Completeness
 * tab move into Results and that tab is removed, as is an old Control tab.
 */
export async function finalizeResultsSheet(): Promise<{
  /** Teams written (at most TOP_N). */
  teams: number;
  /** Teams in the db, written or not. */
  totalTeams: number;
  marks: number;
  scoresKept: number;
  url: string;
}> {
  const spreadsheetId = env.JUDGING_RESULTS_SHEET;
  if (!spreadsheetId) {
    throw new Error("JUDGING_RESULTS_SHEET env variable is not set");
  }

  const [allResults, sheets] = await Promise.all([
    loadTeamResults(),
    getSheetsClient(),
  ]);
  const results = topTeams(allResults);
  const tabs = await ensureTabs(sheets, spreadsheetId);
  const legacy = tabs.get(LEGACY_COMPLETENESS_TAB);
  const oldControl = tabs.get(LEGACY_CONTROL_TAB);

  const read = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${RESULTS_TAB}!A1:${letter(Math.max(TEAM_ID_COL, 25))}`,
      ...(legacy ? [`${LEGACY_COMPLETENESS_TAB}!E2:F`] : []),
    ],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const [resultsRead, legacyRead] = read.data.valueRanges ?? [];
  const scores = readCompletenessScores(
    resultsRead?.values ?? [],
    legacyRead?.values ?? [],
  );

  const requests: sheets_v4.Schema$Request[] = [
    ...(legacy ? [{ deleteSheet: { sheetId: legacy.sheetId } }] : []),
    ...(oldControl ? [{ deleteSheet: { sheetId: oldControl.sheetId } }] : []),
    ...buildResultsAndMarksRequests({
      resultsTab: tabs.get(RESULTS_TAB)!,
      marksTab: tabs.get(MARKS_TAB)!,
      results,
      scores,
    }),
    ...buildSummaryRequests(tabs.get(SUMMARY_TAB)!),
  ];
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  const teamIds = new Set(results.map((r) => r.team.id));
  return {
    teams: results.length,
    totalTeams: allResults.length,
    marks: results.reduce((n, r) => n + r.regular.count + r.sponsored.count, 0),
    scoresKept: [...scores.keys()].filter((id) => teamIds.has(id)).length,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}
