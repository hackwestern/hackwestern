// src/server/api/utils/results-sheet.ts
//
// Exports final judging results to a Google Sheet (JUDGING_RESULTS_SHEET) in
// one go, once judging is over. An organizer runs it from the judging control
// page (judging.admin.finalizeResultsSheet); nothing writes to the sheet while
// judging is live. It can be re-run: every tab is rebuilt from a fresh db
// snapshot, and completeness scores already typed are kept.
//
// The export includes the top TOP_N teams by normalized score plus the top
// TOP_N by adventure score (teams with no regular-round marks are never
// included).
//
//   "Top 20":            rank, team, Final and super likes, best first,
//                        capped at 20.
//   "Top 20 Adventure":  rank, team, Adventure final and super likes, best
//                        first, capped at 20. Both are single sheet formulas
//                        over Results, so they re-sort live as completeness
//                        is typed. Ties on the score go to more super
//                        likes, then Results' (overall) order.
//   "Results":  one bold row per team in overall order, with that team's
//               judge marks in a collapsed row group under it. Rank is the
//               overall rank among every team (a team included only for
//               adventure shows its real rank, e.g. 27).
//               Columns: Rank, Final (amber), Adventure final (teal), Table,
//               Team, the Devpost / GitHub links, "Completeness" (blank,
//               organizers type 0-10 on team rows; red while blank, green
//               once scored), Judges, then "Normalized" and "Adventure"
//               from the judging_team_scores view (0-10, adjusted for harsh
//               / generous judges; blank until judging_normalize() has run),
//               "Adventurous score" and "Other 4" (the adventurous rating
//               and the other four ratings as one score, 0-10: normalized
//               once normalization has run, raw averages before), "Raw
//               total" (the five rating averages / 5), the judges' plain
//               "Average" (judge rows show their own score there) and
//               "Super likes".
//               Final = (b × N + Completeness) / (N + 1), N = number of
//               rubric criteria (5 now, so × 5 / 6), b = Normalized (the
//               Average until normalized); b alone while Completeness is
//               blank.
//               Adventure final = 65% × Adventurous score + 35% × the avg of
//               the other four criteria and completeness:
//               0.65 × Adventurous + 0.35 × (Other 4 × 4 + Completeness) / 5;
//               0.65 × Adventurous + 0.35 × Other 4 while Completeness is
//               blank (= the Adventure score once normalized).
//               "Super likes" counts hearts from any judge; judge rows
//               show ♥.
// Older exports also wrote Marks and Control tabs; they're removed.
//
// Overall ranking: normalized q (the unclipped estimate, since the top teams
// all clip to a normalized 10), then the normalized score, then the judge
// average. Completeness only changes Final / Adventure final.
//
// All tabs are created first, then written in ONE spreadsheets.batchUpdate,
// so formulas never point at a tab that doesn't exist yet and the sheet is
// never seen half-written. It signs in with its own client
// (results-sheet-client.ts: JUDGING_RESULTS_CLIENT_EMAIL / _PRIVATE_KEY or else SPONSOR_SHEETS_*),
// which must be an Editor on the spreadsheet. Writes need
// resultsSheetWritesEnabled().
// Anything typed into these tabs other than Results' Completeness column is
// overwritten on a re-run (on the Top 20 tabs, only columns A-D).
import { type sheets_v4 } from "googleapis";

import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { env } from "~/env";
import {
  type ResultsSheetsClient,
  getResultsSheetsClient,
  resultsSheetWritesEnabled,
} from "~/server/api/utils/results-sheet-client";
import { type TeamResult } from "~/server/api/utils/team-results";
import { loadTeamResults } from "~/server/api/utils/team-results-data";

export const RESULTS_TAB = "Results";
/**
 * The export includes the top TOP_N teams overall plus the top TOP_N by
 * adventure (often mostly the same teams).
 */
export const TOP_N = 20;
/**
 * Live summaries (rank, team, score) computed by sheet formulas from
 * Results, so they re-sort as completeness scores are typed.
 */
export const SUMMARY_TAB = `Top ${TOP_N}`;
export const ADVENTURE_TAB = `Top ${TOP_N} Adventure`;
/** Tabs in the order they appear in the spreadsheet. */
const TABS = [SUMMARY_TAB, ADVENTURE_TAB, RESULTS_TAB];
/**
 * Where scores were typed before they moved into Results. Its scores are
 * carried over on the next export, then the tab is removed.
 */
const LEGACY_COMPLETENESS_TAB = "Completeness";
/** Written by earlier exports. Removed on the next export. */
const LEGACY_TABS = ["Control", "Marks"];

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
export const NORMALIZED_LABEL = "Normalized";
export const ADVENTURE_FINAL_LABEL = "Adventure final";
/** Not "Adventurous": that is the rubric criterion's column. */
export const ADVENTUROUS_LABEL = "Adventurous score";
const RESULTS_HEADER: string[] = [
  "Rank",
  "Final",
  ADVENTURE_FINAL_LABEL,
  "Table",
  "Team / Judge",
  "Devpost",
  "GitHub",
  COMPLETENESS_LABEL,
  "Judges",
  NORMALIZED_LABEL,
  "Adventure",
  ADVENTUROUS_LABEL,
  "Other 4",
  "Raw total",
  "Average",
  "Super likes",
  ...DEFAULT_RUBRIC.criteria.map((c) => c.name),
  "Sponsor judges",
  "Sponsor average",
  "Notes",
  "Team ID",
];
if (new Set(RESULTS_HEADER).size !== RESULTS_HEADER.length) {
  // Rows are built by column label, so every label must be unique.
  throw new Error("results-sheet: duplicate column label in RESULTS_HEADER");
}
const col = (label: string) => RESULTS_HEADER.indexOf(label);
const RANK_COL = col("Rank"); // A
const FINAL_COL = col("Final"); // B
const ADVENTURE_FINAL_COL = col(ADVENTURE_FINAL_LABEL); // C
const NAME_COL = col("Team / Judge"); // E
const NORMALIZED_COL = col(NORMALIZED_LABEL); // J
const ADVENTUROUS_COL = col(ADVENTUROUS_LABEL); // L
const OTHER_FOUR_COL = col("Other 4"); // M
const AVERAGE_COL = col("Average"); // O
const SUPER_LIKES_COL = col("Super likes"); // P
const COMPLETENESS_COL = col(COMPLETENESS_LABEL); // H
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

/**
 * A score with completeness folded in as one more criterion, for the team
 * row at 1-based sheet row `row`: b = the `main` column, or `fallback` while
 * `main` is blank (the normalization hasn't run yet); then
 * (b × N + Completeness) / (N + 1), or b alone while Completeness is blank.
 */
function withCompleteness(row: number, main: number, fallback: number): Cell {
  const m = `${letter(main)}${row}`;
  const f = `${letter(fallback)}${row}`;
  const comp = `${letter(COMPLETENESS_COL)}${row}`;
  const n = CRITERIA_COUNT;
  return {
    formula: `=LET(b, IF(ISNUMBER(${m}), ${m}, ${f}), IF(b="", "", IF(ISNUMBER(${comp}), ROUND((b * ${n} + ${comp}) / ${n + 1}, 2), b)))`,
  };
}

/** Final: the normalized score (or the judge Average) plus completeness. */
const finalFormula = (row: number) =>
  withCompleteness(row, NORMALIZED_COL, AVERAGE_COL);

/** Adventure weighting: adventurous vs. the average of everything else. */
export const ADVENTUROUS_WEIGHT = 0.65;

/** The adventure score without completeness (what rankByAdventure sorts on). */
export function adventureScore(r: TeamResult): number | null {
  const { adventurous: a, otherFour: o } = r.team;
  if (a == null || o == null) return null;
  return ADVENTUROUS_WEIGHT * a + (1 - ADVENTUROUS_WEIGHT) * o;
}

/**
 * Adventure final for the team row at 1-based sheet row `row`:
 * 65% × Adventurous + 35% × the average of the other four criteria and
 * completeness, i.e. (Other 4 × 4 + Completeness) / 5. While Completeness
 * is blank: 65% × Adventurous + 35% × Other 4.
 */
function adventureFinalFormula(row: number): Cell {
  const a = `${letter(ADVENTUROUS_COL)}${row}`;
  const o = `${letter(OTHER_FOUR_COL)}${row}`;
  const comp = `${letter(COMPLETENESS_COL)}${row}`;
  const w = ADVENTUROUS_WEIGHT;
  const rest = Math.round((1 - w) * 100) / 100;
  const others = CRITERIA_COUNT - 1;
  return {
    formula: `=IF(OR(${a}="", ${o}=""), "", IF(ISNUMBER(${comp}), ROUND(${w} * ${a} + ${rest} * (${o} * ${others} + ${comp}) / ${others + 1}, 2), ROUND(${w} * ${a} + ${rest} * ${o}, 2)))`,
  };
}

/** Higher first, nulls last; 0 when equal. */
function desc(x: number | null | undefined, y: number | null | undefined) {
  if (x === y || (x == null && y == null)) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return y - x;
}

/**
 * Teams best-first by normalized score: the unclipped estimate (q) first,
 * since every top team clips to a normalized 10, then the normalized score,
 * then the regular-round average (all a team has before normalization has
 * run). Ties and unmarked teams keep their table order. Rank is null for
 * teams with no regular marks.
 */
export function rankTeams(
  results: TeamResult[],
): { r: TeamResult; rank: number | null }[] {
  return results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const unmarked =
        Number(a.r.regular.average === null) -
        Number(b.r.regular.average === null);
      return (
        unmarked ||
        desc(a.r.team.normalizedQ, b.r.team.normalizedQ) ||
        desc(a.r.team.normalized, b.r.team.normalized) ||
        desc(a.r.regular.average, b.r.regular.average) ||
        a.i - b.i
      );
    })
    .map(({ r }, i) => ({
      r,
      rank: r.regular.average === null ? null : i + 1,
    }));
}

/**
 * Teams best-first by adventure score (adventureScore: normalized once
 * normalization has run, raw before); ties keep table order. Teams with no
 * regular marks or no adventure data are left out.
 */
export function rankByAdventure(results: TeamResult[]): TeamResult[] {
  return results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.regular.average !== null && adventureScore(r) !== null)
    .sort((a, b) => desc(adventureScore(a.r), adventureScore(b.r)) || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * The teams the export includes, in overall order: the best `n` overall (see
 * rankTeams) plus the best `n` by adventure (see rankByAdventure). Teams
 * with no regular marks are left out. A tie at a cut-off keeps the team with
 * the lower table order.
 */
export function topTeams(results: TeamResult[], n = TOP_N): TeamResult[] {
  const ranked = rankTeams(results)
    .filter(({ rank }) => rank !== null)
    .map(({ r }) => r);
  const keep = new Set(
    [...ranked.slice(0, n), ...rankByAdventure(results).slice(0, n)].map(
      (r) => r.team.id,
    ),
  );
  return ranked.filter((r) => keep.has(r.team.id));
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
  /** Only these teams get rows; ranks still count every team in `results`. */
  include?: Set<string>,
): { rows: SheetRow[]; groups: TeamGroup[]; teamRows: number[] } {
  const criteria = DEFAULT_RUBRIC.criteria;
  const rows: SheetRow[] = [{ cells: RESULTS_HEADER, bold: true }];
  const groups: TeamGroup[] = [];
  const teamRows: number[] = [];
  /** Cells in RESULTS_HEADER order, by column label; missing ones blank. */
  const byLabel = (values: Record<string, Cell>): Cell[] =>
    RESULTS_HEADER.map((label) => values[label] ?? "");

  for (const { r, rank } of rankTeams(results)) {
    if (include && !include.has(r.team.id)) continue;
    teamRows.push(rows.length);
    rows.push({
      bold: true,
      cells: byLabel({
        Rank: rank ?? "",
        Final: finalFormula(rows.length + 1),
        [ADVENTURE_FINAL_LABEL]: adventureFinalFormula(rows.length + 1),
        Table: r.team.table ?? "",
        "Team / Judge": r.team.name,
        Judges: r.regular.count,
        [NORMALIZED_LABEL]: num(r.team.normalized),
        Adventure: num(r.team.adventure),
        [ADVENTUROUS_LABEL]: num(r.team.adventurous),
        Devpost: linkCell(r.team.devpost, "Devpost"),
        GitHub: linkCell(r.team.github, "GitHub"),
        [COMPLETENESS_LABEL]: scores.get(r.team.id) ?? "",
        "Other 4": num(r.team.otherFour),
        "Raw total": num(r.team.rawTotal),
        Average: num(r.regular.average),
        "Super likes": r.regular.superLikes + r.sponsored.superLikes,
        ...Object.fromEntries(
          criteria.map((c) => [c.name, num(r.regular.criteria[c.id])]),
        ),
        "Sponsor judges": r.sponsored.count,
        "Sponsor average": num(r.sponsored.average),
        "Team ID": r.team.id,
      }),
    });

    const start = rows.length;
    for (const [round, summary] of [
      ["regular", r.regular],
      ["sponsored", r.sponsored],
    ] as const) {
      for (const m of summary.marks) {
        rows.push({
          cells: byLabel({
            "Team / Judge": `${JUDGE_PREFIX} ${m.judgeName}`,
            Judges: round === "regular" ? "judge" : "sponsor",
            Average: round === "regular" ? num(m.score) : "",
            "Super likes": m.superLike ? SUPER_LIKE : "",
            ...Object.fromEntries(
              criteria.map((c) => [c.name, num(m.ratings[c.id])]),
            ),
            "Sponsor average": round === "sponsored" ? num(m.score) : "",
            Notes: m.notes,
            "Team ID": r.team.id,
          }),
        });
      }
    }
    if (rows.length > start) {
      groups.push({ teamId: r.team.id, start, end: rows.length });
    }
  }

  return { rows, groups, teamRows };
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

/** Results, with collapsed judge groups and the Completeness/Final columns. */
export function buildResultsRequests(input: {
  resultsTab: TabState;
  /** Every team; ranks count them all. */
  results: TeamResult[];
  scores: Map<string, number>;
  /** The teams to write (see topTeams); every team when omitted. */
  include?: Set<string>;
}): sheets_v4.Schema$Request[] {
  const { rows, groups, teamRows } = buildResultsRows(
    input.results,
    input.scores,
    input.include,
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
  const emphasize = (
    column: number,
    colors: Record<"header" | "body" | "border", sheets_v4.Schema$Color>,
  ): sheets_v4.Schema$Request[] => {
    const border = { style: "SOLID_MEDIUM", color: colors.border };
    return [
      {
        repeatCell: {
          range: cell(column, 1, rows.length),
          cell: { userEnteredFormat: { backgroundColor: colors.body } },
          fields: "userEnteredFormat.backgroundColor",
        },
      },
      {
        repeatCell: {
          range: cell(column, 0),
          cell: {
            userEnteredFormat: {
              backgroundColor: colors.header,
              textFormat: { bold: true, fontSize: 12 },
            },
          },
          fields:
            "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
        },
      },
      ...teamRows.map((row) => ({
        repeatCell: {
          range: cell(column, row),
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
          range: cell(column, 0, rows.length),
          left: border,
          right: border,
          top: border,
          bottom: border,
        },
      },
    ];
  };

  return [
    ...rewriteTabRequests(input.resultsTab, rows, 1),
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
    // Final (amber) and Adventure final (teal) stand out: tinted column with
    // a border, bigger bold team scores.
    ...emphasize(FINAL_COL, {
      header: { red: 0.98, green: 0.74, blue: 0.18 },
      body: { red: 1, green: 0.95, blue: 0.8 },
      border: { red: 0.85, green: 0.6, blue: 0.05 },
    }),
    ...emphasize(ADVENTURE_FINAL_COL, {
      header: { red: 0.4, green: 0.8, blue: 0.74 },
      body: { red: 0.87, green: 0.96, blue: 0.94 },
      border: { red: 0.15, green: 0.55, blue: 0.5 },
    }),
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
 * A summary tab's formula (in A2, under a plain header row): Results' team
 * rows that have a `scoreCol` value, best first, as rank, team, score,
 * super likes —
 * capped at TOP_N. Ties on the score go to more super likes, then Results'
 * order (the overall ranking). Re-sorts
 * by itself as completeness is typed; blank when Results has no teams.
 */
export function summaryFormula(scoreCol = FINAL_COL): string {
  const r = (c: number) => `${RESULTS_TAB}!${letter(c)}2:${letter(c)}`;
  return (
    `=IFERROR(ARRAY_CONSTRAIN(LET(t, SORT(FILTER({${r(NAME_COL)}, ${r(scoreCol)}, ROW(${r(NAME_COL)}), ${r(SUPER_LIKES_COL)}}, ${r(RANK_COL)}<>"", ${r(scoreCol)}<>""), 2, FALSE, 4, FALSE, 3, TRUE), ` +
    `{SEQUENCE(ROWS(t)), CHOOSECOLS(t, 1, 2, 4)}), ${TOP_N}, 4), "")`
  );
}

/** Writes a summary tab ranking Results' teams by `scoreCol`. */
export function buildSummaryRequests(
  tab: TabState,
  scoreCol = FINAL_COL,
): sheets_v4.Schema$Request[] {
  const sheetId = tab.sheetId;
  return [
    {
      updateCells: {
        range: { sheetId, startColumnIndex: 0, endColumnIndex: 4 },
        fields: "userEnteredValue",
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        // Header as plain cells, the formula's rows spill from A2 (blank
        // when Results has no teams).
        rows: [
          {
            values: [
              "Rank",
              "Team",
              RESULTS_HEADER[scoreCol]!,
              "Super likes",
            ].map((h) => cellData(h)),
          },
          { values: [cellData({ formula: summaryFormula(scoreCol) })] },
        ],
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
  sheets: ResultsSheetsClient,
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
  sheets: ResultsSheetsClient,
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
  /** Teams written: the top TOP_N overall plus the top TOP_N by adventure. */
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
  if (!resultsSheetWritesEnabled()) {
    throw new Error(
      "Writing the results sheet: not written (sheet writes off; set " +
        "JUDGING_RESULTS_SHEET_WRITES=1 or SHEET_WRITES=1 to write)",
    );
  }

  const [allResults, sheets] = await Promise.all([
    loadTeamResults(),
    getResultsSheetsClient(),
  ]);
  const results = topTeams(allResults);
  const teamIds = new Set(results.map((r) => r.team.id));
  const tabs = await ensureTabs(sheets, spreadsheetId);
  const legacy = tabs.get(LEGACY_COMPLETENESS_TAB);
  const oldTabs = LEGACY_TABS.flatMap((t) => tabs.get(t) ?? []);

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
    ...oldTabs.map((t) => ({ deleteSheet: { sheetId: t.sheetId } })),
    ...buildResultsRequests({
      resultsTab: tabs.get(RESULTS_TAB)!,
      results: allResults,
      scores,
      include: teamIds,
    }),
    ...buildSummaryRequests(tabs.get(SUMMARY_TAB)!, FINAL_COL),
    ...buildSummaryRequests(tabs.get(ADVENTURE_TAB)!, ADVENTURE_FINAL_COL),
  ];
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return {
    teams: results.length,
    totalTeams: allResults.length,
    marks: results.reduce((n, r) => n + r.regular.count + r.sponsored.count, 0),
    scoresKept: [...scores.keys()].filter((id) => teamIds.has(id)).length,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}
