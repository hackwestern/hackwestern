import { describe, expect, test } from "vitest";

import {
  LayoutError,
  buildSections,
  snakePosition,
  tablesPerRow,
} from "~/server/judging/layout";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** How many times each table appears across all sections, and with whom. */
function coverage(sections: { judge: number; tables: number[] }[]) {
  const byTable = new Map<number, number[]>();
  for (const s of sections) {
    for (const t of s.tables) {
      byTable.set(t, [...(byTable.get(t) ?? []), s.judge]);
    }
  }
  return byTable;
}

describe("snake grid", () => {
  test("70 tables in 5 rows is 14 per row, numbered along a snake", () => {
    const perRow = tablesPerRow({ tableCount: 70, rows: 5 });
    expect(perRow).toBe(14);
    expect(snakePosition(1, perRow)).toEqual({ row: 0, col: 0 });
    expect(snakePosition(14, perRow)).toEqual({ row: 0, col: 13 });
    // Row 2 runs right to left: 15 sits under 14, 28 under 1.
    expect(snakePosition(15, perRow)).toEqual({ row: 1, col: 13 });
    expect(snakePosition(28, perRow)).toEqual({ row: 1, col: 0 });
    expect(snakePosition(29, perRow)).toEqual({ row: 2, col: 0 });
    expect(snakePosition(70, perRow)).toEqual({ row: 4, col: 13 });
  });

  test("the layout adapts to the row count", () => {
    expect(tablesPerRow({ tableCount: 70, rows: 7 })).toBe(10);
    expect(tablesPerRow({ tableCount: 70, rows: 4 })).toBe(18);
    // Walking 1..n never jumps more than one cell.
    const perRow = tablesPerRow({ tableCount: 70, rows: 7 });
    for (let n = 1; n < 70; n++) {
      const a = snakePosition(n, perRow);
      const b = snakePosition(n + 1, perRow);
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });
});

describe("buildSections", () => {
  test("70 tables and 35 judges: 6 tables each, every table judged 3 times", () => {
    const sections = buildSections(range(70), range(35), 3);
    expect(sections.every((s) => s.tables.length === 6)).toBe(true);

    expect(sections[0]?.tables).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sections[1]?.tables).toEqual([7, 8, 9, 10, 11, 12]);
    // Judge 12's run wraps from the end of the snake back to table 1.
    expect(sections[11]?.tables).toEqual([67, 68, 69, 70, 1, 2]);
    expect(sections[12]?.tables).toEqual([3, 4, 5, 6, 7, 8]);
    expect(sections[34]?.tables).toEqual([65, 66, 67, 68, 69, 70]);

    const byTable = coverage(sections);
    expect(byTable.size).toBe(70);
    for (const judgesHere of byTable.values()) {
      expect(judgesHere).toHaveLength(3);
      expect(new Set(judgesHere).size).toBe(3);
    }
    expect(byTable.get(1)).toEqual([1, 12, 24]);
  });

  test("uneven counts split as evenly as possible and still cover 3 each", () => {
    const sections = buildSections(range(70), range(31), 3);
    const sizes = new Set(sections.map((s) => s.tables.length));
    expect([...sizes].sort()).toEqual([6, 7]);
    for (const judgesHere of coverage(sections).values()) {
      expect(new Set(judgesHere).size).toBe(3);
    }
  });

  test("fewer judges means longer sections", () => {
    const sections = buildSections(range(70), range(14), 3);
    expect(sections.every((s) => s.tables.length === 15)).toBe(true);
    for (const judgesHere of coverage(sections).values()) {
      expect(new Set(judgesHere).size).toBe(3);
    }
  });

  test("no judge ever gets the same table twice, at any judge count", () => {
    for (let judges = 3; judges <= 80; judges++) {
      for (const s of buildSections(range(70), range(judges), 3)) {
        expect(new Set(s.tables).size).toBe(s.tables.length);
      }
    }
  });

  test("with exactly 3 judges, each judges every table", () => {
    const sections = buildSections(range(10), range(3), 3);
    for (const s of sections) {
      expect([...s.tables].sort((a, b) => a - b)).toEqual(range(10));
    }
  });

  test("more judges than visits leaves the extras with nothing", () => {
    const sections = buildSections(range(2), range(10), 3);
    expect(sections.filter((s) => s.tables.length === 0)).toHaveLength(4);
    for (const judgesHere of coverage(sections).values()) {
      expect(new Set(judgesHere).size).toBe(3);
    }
  });

  test("refuses when a table can't get 3 different judges", () => {
    expect(() => buildSections(range(70), range(2), 3)).toThrow(LayoutError);
    expect(() => buildSections([], range(5), 3)).toThrow(LayoutError);
  });
});
