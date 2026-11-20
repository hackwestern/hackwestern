/**
 * Pure layout math for the judging room: where a table sits on the snake grid,
 * and how the snake is cut into judge sections. No database access, so it can
 * be unit tested on its own. See docs/judging-engine.md.
 */

export const DEFAULT_SETTINGS = {
  tableCount: 70,
  rows: 5,
  judgesPerSeat: 3,
} as const;

export type LayoutSettings = {
  tableCount: number;
  rows: number;
  judgesPerSeat: number;
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
 * A seat's name on screen: "4" when its table has one seat, "4 (seat 1)" or
 * "4 (seat 2)" when the table is split.
 */
export function seatName(
  seat: { tableNumber: number; seat: number },
  split: boolean,
) {
  return split
    ? `${seat.tableNumber} (seat ${seat.seat})`
    : `${seat.tableNumber}`;
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
 * Cut the snake into one consecutive section per judge so that every seat is
 * covered by exactly `perSeat` different judges.
 *
 * The snake (seats in table number order, seat 1 then seat 2) is laid out
 * `perSeat` times end to end, giving `S = seats * perSeat` slots, and judge
 * `k` of `J` takes slots `floor(k*S/J)` up to `floor((k+1)*S/J)`. Each judge's
 * run is at most ceil(S/J) <= seats long (because J >= perSeat), so no judge
 * gets a seat twice, and each seat's `perSeat` slots land with different
 * judges. A run that crosses the end of a pass wraps from the last seat back
 * to the first.
 *
 * `seats` and `judges` must already be in order (snake order, and the order
 * judges were added). Returns each judge's seats in walking order; judges
 * beyond the number of slots get an empty section.
 */
export function buildSections<TSeat, TJudge>(
  seats: readonly TSeat[],
  judges: readonly TJudge[],
  perSeat: number,
): { judge: TJudge; seats: TSeat[] }[] {
  if (seats.length === 0) {
    throw new LayoutError("There are no active seats to assign.");
  }
  if (perSeat < 1) {
    throw new LayoutError("Each seat needs at least one judge.");
  }
  if (judges.length < perSeat) {
    throw new LayoutError(
      `Each seat needs ${perSeat} different judges, but there ${
        judges.length === 1
          ? "is only 1 judge"
          : `are only ${judges.length} judges`
      }.`,
    );
  }

  const slots = seats.length * perSeat;
  const count = judges.length;
  return judges.map((judge, k) => {
    const start = Math.floor((k * slots) / count);
    const end = Math.floor(((k + 1) * slots) / count);
    const section: TSeat[] = [];
    for (let s = start; s < end; s++) {
      section.push(seats[s % seats.length]!);
    }
    return { judge, seats: section };
  });
}
