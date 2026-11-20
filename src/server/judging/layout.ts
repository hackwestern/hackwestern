/**
 * Pure layout math for the judging room: where a table sits on the snake grid,
 * and how the snake is cut into judge sections. No database access, so it can
 * be unit tested on its own. See docs/judging-engine.md.
 */

export const DEFAULT_SETTINGS = {
  tableCount: 70,
  rows: 5,
  judgesPerTable: 3,
} as const;

export type LayoutSettings = {
  tableCount: number;
  rows: number;
  judgesPerTable: number;
};

/** Tables per row: ceil(tableCount / rows), at least 1. */
export function tablesPerRow(
  settings: Pick<LayoutSettings, "tableCount" | "rows">,
) {
  return Math.max(
    1,
    Math.ceil(settings.tableCount / Math.max(1, settings.rows)),
  );
}

/**
 * Grid position of table `number` (1-based) on the snake: row 0 runs left to
 * right, row 1 right to left, and so on. `row` and `col` are 0-based.
 */
export function snakePosition(number: number, perRow: number) {
  const i = number - 1;
  const row = Math.floor(i / perRow);
  const idx = i % perRow;
  const col = row % 2 === 0 ? idx : perRow - 1 - idx;
  return { row, col };
}

/**
 * Pick which of `tables` (in snake order) get a second seat so `teams` teams
 * fit at most 2 per table. Nothing is split until there are more teams than
 * tables; the split tables are spread evenly along the snake. Returns null if
 * the teams don't fit even with every table split.
 */
export function tablesToSplit<T>(tables: readonly T[], teams: number) {
  const splits = Math.max(0, teams - tables.length);
  if (splits > tables.length) return null;
  // Table i is split when floor(i * splits / tables) steps up, which spaces
  // the splits as evenly as whole tables allow.
  return tables.filter(
    (_, i) =>
      Math.floor(((i + 1) * splits) / tables.length) >
      Math.floor((i * splits) / tables.length),
  );
}

export class LayoutError extends Error {}

/**
 * Cut the snake into one consecutive section per judge so that every table is
 * covered by exactly `perTable` different judges.
 *
 * The snake (tables in number order) is laid out `perTable` times end to end,
 * giving `S = tables * perTable` slots, and judge `k` of `J` takes slots
 * `floor(k*S/J)` up to `floor((k+1)*S/J)`. Each judge's run is at most
 * ceil(S/J) <= tables long (because J >= perTable), so no judge gets a table
 * twice, and each table's `perTable` slots land with different judges. A run
 * that crosses the end of a pass wraps from the last table back to the first.
 *
 * `tables` and `judges` must already be in order (snake order, and the order
 * judges were added). Returns each judge's tables in walking order; judges
 * beyond the number of slots get an empty section.
 */
export function buildSections<TTable, TJudge>(
  tables: readonly TTable[],
  judges: readonly TJudge[],
  perTable: number,
): { judge: TJudge; tables: TTable[] }[] {
  if (tables.length === 0) {
    throw new LayoutError("There are no active tables to assign.");
  }
  if (perTable < 1) {
    throw new LayoutError("Each table needs at least one judge.");
  }
  if (judges.length < perTable) {
    throw new LayoutError(
      `Each table needs ${perTable} different judges, but there ${
        judges.length === 1
          ? "is only 1 judge"
          : `are only ${judges.length} judges`
      }.`,
    );
  }

  const slots = tables.length * perTable;
  const count = judges.length;
  return judges.map((judge, k) => {
    const start = Math.floor((k * slots) / count);
    const end = Math.floor(((k + 1) * slots) / count);
    const section: TTable[] = [];
    for (let s = start; s < end; s++) {
      section.push(tables[s % tables.length]!);
    }
    return { judge, tables: section };
  });
}
