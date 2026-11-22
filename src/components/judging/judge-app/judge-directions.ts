import { TABLE_COUNT, spotGrid } from "~/components/judging/map/map-data";

/**
 * Row and column of a table on the map's snake grid, counted from the top
 * left as the map is drawn upright. Row 1 runs left to right, row 2 right to left, and so on (see
 * spotGrid in map-data.ts).
 */
const gridOf = spotGrid;

export type WalkHint = "Walk left" | "Walk right" | "Walk down" | "Walk up";

/**
 * The one-word direction from the table the judge just left to the next one,
 * with left and right as on the map (upright, not rotated). Judges follow the
 * snake, so it is normally left, right or down. `from` is null for the first
 * team, which starts from table 1. Null when there is nowhere to walk or a
 * table isn't on the map.
 */
export function walkHint(from: number | null, to: number): WalkHint | null {
  const valid = (n: number) =>
    Number.isInteger(n) && n >= 1 && n <= TABLE_COUNT;
  const start = from ?? 1;
  if (!valid(start) || !valid(to) || start === to) return null;

  const a = gridOf(start);
  const b = gridOf(to);
  if (b.row > a.row) return "Walk down";
  if (b.row < a.row) return "Walk up";
  return b.col > a.col ? "Walk right" : "Walk left";
}
