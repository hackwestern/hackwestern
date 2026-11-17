import { TRPCError } from "@trpc/server";
import { type sheets_v4 } from "googleapis";

import {
  COFFEE_CHAT_ROOMS,
  COFFEE_CHAT_SLOTS,
  COFFEE_CHAT_TAB,
  coffeeChatColorFor,
  coffeeChatSlotKeyOf,
  formatCoffeeChatTime,
  hexColorToRgb01,
  parseCoffeeChatGrid,
  type CoffeeChatBooking,
  type CoffeeChatCellChange,
} from "~/lib/coffee-chats";
import {
  findTabTitle,
  type SheetsClient,
} from "~/server/api/utils/sponsor-sheets";

/**
 * Coffee chats tab ("Coffee Chats"): the visual booking grid with rooms
 * across the top and time running down. Column A holds every 15-minute
 * slot start from 10:00 to 15:45, the header row holds the three room
 * labels in B-D, and one cell per room × slot holds that booking's sponsor
 * name shaded with their palette color, so organizers can see booking
 * progress at a glance. Sponsors only write through their private UUID —
 * the sheet stores just their name.
 */
const COFFEE_CHAT_HEADER_BG: sheets_v4.Schema$Color = {
  red: 0.949,
  green: 0.957,
  blue: 0.965,
};

const COFFEE_CHAT_HEADER_TEXT: sheets_v4.Schema$Color = {
  red: 0.216,
  green: 0.253,
  blue: 0.318,
};

const COFFEE_CHAT_WHITE: sheets_v4.Schema$Color = { red: 1, green: 1, blue: 1 };

function findCoffeeChatTabTitle(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string | null> {
  return findTabTitle(sheets, spreadsheetId, COFFEE_CHAT_TAB.toLowerCase());
}

/**
 * Cell data for one slot in the grid: cleared, or a shaded booking cell
 * showing the sponsor name.
 */
function coffeeChatGridCell(
  sponsor: string | undefined,
): sheets_v4.Schema$CellData {
  if (!sponsor) {
    // Values must still be written so updateCells clears stale names.
    return { userEnteredValue: { stringValue: "" } };
  }
  return {
    userEnteredValue: { stringValue: sponsor },
    userEnteredFormat: {
      backgroundColor: hexColorToRgb01(coffeeChatColorFor(sponsor)),
      textFormat: { bold: true, foregroundColor: COFFEE_CHAT_WHITE },
    },
  };
}

/**
 * Header styling shared by the corner cell, room labels across the top,
 * and the time labels down column A.
 */
function headerCell(label: string): sheets_v4.Schema$CellData {
  return {
    userEnteredValue: { stringValue: label },
    userEnteredFormat: {
      backgroundColor: COFFEE_CHAT_HEADER_BG,
      textFormat: { bold: true, foregroundColor: COFFEE_CHAT_HEADER_TEXT },
    },
  };
}

/** Slot start label in column A (styled like the header row). */
function timeLabelCell(time: string): sheets_v4.Schema$CellData {
  return headerCell(time);
}

/** Build the 25-row × 4-column grid (header + one row per time slot). */
function buildCoffeeChatGridRows(
  bookings: readonly CoffeeChatBooking[],
): sheets_v4.Schema$RowData[] {
  const bySlot = new Map<string, string>();
  for (const booking of bookings) {
    bySlot.set(coffeeChatSlotKeyOf(booking), booking.sponsor);
  }

  // Header row: corner label + the three room labels across the top.
  const headerRow: sheets_v4.Schema$RowData = {
    values: [
      headerCell("Time"),
      ...COFFEE_CHAT_ROOMS.map((room) => headerCell(room.label)),
    ],
  };

  // One row per slot start time (spelled "3:00 PM" for readability),
  // rooms across.
  const timeRows: sheets_v4.Schema$RowData[] = COFFEE_CHAT_SLOTS.map(
    (time) => ({
      values: [
        timeLabelCell(formatCoffeeChatTime(time)),
        ...COFFEE_CHAT_ROOMS.map((room) =>
          coffeeChatGridCell(
            bySlot.get(coffeeChatSlotKeyOf({ room: room.id, time })),
          ),
        ),
      ],
    }),
  );

  return [headerRow, ...timeRows];
}

/**
 * Read the Coffee Chats grid; missing tab or malformed content parses to
 * "everything free" rather than breaking the sponsor portal.
 */
export async function fetchCoffeeChatGrid(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<CoffeeChatBooking[]> {
  try {
    const tabName = await findCoffeeChatTabTitle(sheets, spreadsheetId);
    if (!tabName) return [];

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // Room columns B-D across the top; times stack down column A.
      range: `'${tabName}'!A1:D`,
    });
    const rows = (res.data.values ?? []).map((row) =>
      (row ?? []).map((value) => (value == null ? undefined : String(value))),
    );
    return parseCoffeeChatGrid(rows);
  } catch (error) {
    console.warn("Could not read coffee chats tab:", error);
    return [];
  }
}

/**
 * Replace the entire grid (used when the tab is brand new): header with
 * every slot label, three labelled room rows, and the current bookings.
 */
export async function writeCoffeeChatGridFull(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetId: number,
  bookings: readonly CoffeeChatBooking[],
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
            fields: "*",
            rows: buildCoffeeChatGridRows(bookings),
          },
        },
      ],
    },
  });
}

/**
 * Write only the cells that differ. Keeps concurrent sponsors' saves from
 * clobbering each other and preserves organizer-drawn cells that aren't
 * bookable slots.
 */
export async function writeCoffeeChatGridDiff(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetId: number,
  changes: readonly CoffeeChatCellChange[],
): Promise<void> {
  if (changes.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: changes.map(({ roomIndex, slotIndex, sponsor }) => ({
        updateCells: {
          start: {
            sheetId,
            // Header row is 0; slot times run down from row 1.
            rowIndex: 1 + slotIndex,
            // Time label column is 0; rooms run across from column 1.
            columnIndex: 1 + roomIndex,
          },
          fields: "userEnteredValue,userEnteredFormat",
          rows: [{ values: [coffeeChatGridCell(sponsor || undefined)] }],
        },
      })),
    },
  });
}

/**
 * Make sure the Coffee Chats tab exists with the canonical grid shape
 * (frozen header/label, sized columns). Returns whether the tab is new or
 * unused, which tells the caller to seed the full grid layout.
 */
export async function ensureCoffeeChatTab(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<{ sheetId: number; created: boolean }> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const found = meta.data.sheets?.find(
    (s) =>
      s.properties?.title?.trim().toLowerCase() ===
      COFFEE_CHAT_TAB.toLowerCase(),
  );

  let sheetId = found?.properties?.sheetId ?? null;
  let created = false;

  if (sheetId === null) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: COFFEE_CHAT_TAB } } }],
      },
    });
    sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    created = true;
  } else {
    // A tab that exists but was never seeded (created by hand?) still needs
    // its header row. Empty means column B (first room label) is missing.
    try {
      const head = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${found!.properties!.title}'!A1:B1`,
      });
      created = !head.data.values?.[0]?.[1];
    } catch {
      created = true;
    }
  }

  if (sheetId === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Could not find or create the "${COFFEE_CHAT_TAB}" tab`,
    });
  }

  // Freeze the header row + time label column and size the grid columns
  // (narrow time column, wider room columns so names fit). Only worth
  // running right after creation/seeding.
  if (created) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 },
                },
                fields:
                  "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
              },
            },
            {
              updateDimensionProperties: {
                properties: { pixelSize: 70 },
                fields: "pixelSize",
                range: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: 1,
                },
              },
            },
            {
              updateDimensionProperties: {
                properties: { pixelSize: 160 },
                fields: "pixelSize",
                range: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: 1,
                  endIndex: 1 + COFFEE_CHAT_ROOMS.length,
                },
              },
            },
          ],
        },
      });
    } catch (e) {
      console.warn("Could not format coffee chats tab:", e);
    }
  }

  return { sheetId, created };
}
