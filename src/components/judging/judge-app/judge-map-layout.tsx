/**
 * Where each table sits on the floor map. PLACEHOLDER: a plain grid of 5 rows
 * by 13 tables, numbered 1 to 65 along each row. Replace VENUE_TABLES with the
 * real positions (same x/y units) when the venue layout is known; the map
 * draws whatever is listed here.
 */
export interface VenueTable {
  /** Table number, as printed on the table and in the team QR code. */
  n: number;
  /** Top-left corner, in map units. */
  x: number;
  y: number;
}

export const TABLE_W = 30;
export const TABLE_H = 20;

const COLS = 13;
const ROWS = 5;
const GAP_X = 10;
const GAP_Y = 16;
const MARGIN = 10;

export const VENUE_WIDTH = MARGIN * 2 + COLS * TABLE_W + (COLS - 1) * GAP_X;
export const VENUE_HEIGHT = MARGIN * 2 + ROWS * TABLE_H + (ROWS - 1) * GAP_Y;

export const VENUE_TABLES: VenueTable[] = Array.from(
  { length: COLS * ROWS },
  (_, i) => ({
    n: i + 1,
    x: MARGIN + (i % COLS) * (TABLE_W + GAP_X),
    y: MARGIN + Math.floor(i / COLS) * (TABLE_H + GAP_Y),
  }),
);
