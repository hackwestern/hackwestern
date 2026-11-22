/**
 * Table layout, tracks and placeholder data for the room map.
 *
 * One team per physical table. A "table" in this file (and in the database)
 * is a physical table, so there are 70 of them, numbered 1 to 70.
 *
 * PLACEHOLDER: 70 tables in a 5 x 14 grid, snaked (row 1 left to right,
 * row 2 right to left, and so on), split into five tracks by table range.
 * Replace MAP_TABLES, TRACKS and the team names with Kevin's table setup when
 * it is final. The map draws whatever is listed here, so nothing else changes.
 */
/** Width of one table on the map. */
export const TABLE_W = 30;
export const TABLE_H = 20;
export const GAP_X = 10;
export const GAP_Y = 22;
export const MARGIN = 12;

export const MAP_COLS = 14;
export const MAP_ROWS = 5;
export const SPOTS_PER_TABLE = 1;
/** Physical tables in the room. */
export const PHYSICAL_TABLE_COUNT = MAP_COLS * MAP_ROWS;
/** Team seats in the room (one per table), numbered 1 to this. */
export const TABLE_COUNT = PHYSICAL_TABLE_COUNT * SPOTS_PER_TABLE;

/** Judges every table needs. Organizers see "n of 3" per table. */
export const JUDGES_PER_TABLE = 3;

export interface MapTrack {
  id: string;
  name: string;
  /** One letter, printed on the table in the door copy so it works in black and white. */
  code: string;
  /** First and last table number of the block, inclusive. */
  from: number;
  to: number;
  /** Tailwind token classes for the table fill and outline on the map. */
  fill: string;
  stroke: string;
}

export interface MapTable {
  /** Table number, as printed on the table. */
  n: number;
  /** Top-left corner, in map units. */
  x: number;
  y: number;
  trackId?: string;
}

/** Placeholder tracks. Needs a categorical colour set in the design tokens. */
export const TRACKS: MapTrack[] = [
  {
    id: "a",
    name: "General",
    code: "A",
    from: 1,
    to: 28,
    fill: "fill-blue-1",
    stroke: "stroke-blue-4",
  },
  {
    id: "b",
    name: "Track B",
    code: "B",
    from: 29,
    to: 42,
    fill: "fill-blue-3",
    stroke: "stroke-blue-6",
  },
  {
    id: "c",
    name: "Track C",
    code: "C",
    from: 43,
    to: 54,
    fill: "fill-gray-1",
    stroke: "stroke-gray-4",
  },
  {
    id: "d",
    name: "Track D",
    code: "D",
    from: 55,
    to: 62,
    fill: "fill-gray-2",
    stroke: "stroke-gray-5",
  },
  {
    id: "e",
    name: "Track E",
    code: "E",
    from: 63,
    to: 70,
    fill: "fill-dashboard-bg-highlight",
    stroke: "stroke-dashboard-action-primary",
  },
];

export const trackOf = (tracks: MapTrack[], n: number) =>
  tracks.find((t) => n >= t.from && n <= t.to);

/**
 * Where table n sits on the snake grid: its row, and its column counted from
 * the left (0 to MAP_COLS - 1).
 */
export function spotGrid(n: number) {
  const i = n - 1;
  const p = Math.floor(i / SPOTS_PER_TABLE);
  const half = i % SPOTS_PER_TABLE;
  const row = Math.floor(p / MAP_COLS);
  const idx = p % MAP_COLS;
  const reversed = row % 2 === 1;
  const col = reversed ? MAP_COLS - 1 - idx : idx;
  const side = reversed ? SPOTS_PER_TABLE - 1 - half : half;
  return { row, col: col * SPOTS_PER_TABLE + side };
}

/** Top-left corner of table n on the snake grid. */
export function snakePosition(n: number) {
  const { row, col } = spotGrid(n);
  const pair = Math.floor(col / SPOTS_PER_TABLE);
  const side = col % SPOTS_PER_TABLE;
  return {
    x: MARGIN + pair * (TABLE_W * SPOTS_PER_TABLE + GAP_X) + side * TABLE_W,
    y: MARGIN + row * (TABLE_H + GAP_Y),
  };
}

export function buildTables(tracks: MapTrack[] = TRACKS): MapTable[] {
  return Array.from({ length: TABLE_COUNT }, (_, i) => {
    const n = i + 1;
    return { n, ...snakePosition(n), trackId: trackOf(tracks, n)?.id };
  });
}

export const MAP_TABLES: MapTable[] = buildTables();

/** Size of the drawing, from whatever tables are listed. */
export function mapBounds(tables: MapTable[]) {
  const width = Math.max(0, ...tables.map((t) => t.x)) + TABLE_W + MARGIN;
  const height = Math.max(0, ...tables.map((t) => t.y)) + TABLE_H + MARGIN;
  return { width, height };
}

const FIRST = [
  "Pixel",
  "Cloud",
  "Byte",
  "Maple",
  "Signal",
  "Lumen",
  "Orbit",
  "Copper",
  "Nimbus",
  "Delta",
];
const SECOND = [
  "Pirates",
  "Labs",
  "Garden",
  "Forge",
  "Studio",
  "Works",
  "Lane",
  "Club",
  "Press",
  "Crew",
];

/** Placeholder team names by table, until teams come from the database. */
export const PLACEHOLDER_TEAMS: Record<number, string> = Object.fromEntries(
  Array.from({ length: TABLE_COUNT }, (_, i) => [
    i + 1,
    `${FIRST[i % FIRST.length]} ${SECOND[Math.floor(i / FIRST.length) % SECOND.length]}`,
  ]),
);

/** Placeholder: how many judges have scored each table (organizer view). */
export const PLACEHOLDER_JUDGES_SCORED: Record<number, number> =
  Object.fromEntries(
    Array.from({ length: TABLE_COUNT }, (_, i) => [
      i + 1,
      (i * 7) % (JUDGES_PER_TABLE + 1),
    ]),
  );
