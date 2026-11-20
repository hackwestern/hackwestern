import { env } from "~/env";

// Events' public "Hack Western 13 Schedule" sheet, read by the venue
// broadcast display (/broadcast). Same sheet and range as /api/schedule.
const SPREADSHEET_ID = "1JRfqib3Mqp2iriKS3rxZBbQyGpZovkagBwEEbcopJCM";
const SHEET_NAME = "hackwestern-schedule-v2";
const RANGE = "A:L";
// Only cell text and merges; without this the response includes every
// cell's formatting (about 19 MB).
const FIELDS = "sheets(data(rowData(values(formattedValue))),merges)";

interface GoogleSheetsCell {
  formattedValue?: string;
}

interface GoogleSheetsMerge {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}

interface GoogleSheetsResponse {
  sheets: Array<{
    data: Array<{
      rowData?: Array<{
        values?: GoogleSheetsCell[];
      }>;
    }>;
    merges?: GoogleSheetsMerge[];
  }>;
}

export async function fetchScheduleSheet() {
  const range = encodeURIComponent(`'${SHEET_NAME}'!${RANGE}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=true&ranges=${range}&fields=${encodeURIComponent(FIELDS)}&key=${env.GOOGLE_SHEETS_API_KEY}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule data: ${response.statusText}`);
  }

  const sheetsData = (await response.json()) as GoogleSheetsResponse;
  const sheet = sheetsData.sheets[0];
  const rowData = sheet?.data?.[0]?.rowData;
  if (!rowData) {
    throw new Error("No data found in sheet");
  }

  return { rowData, merges: sheet.merges ?? [] };
}

export function cellText(cell: GoogleSheetsCell | undefined): string {
  return cell?.formattedValue ?? "";
}
