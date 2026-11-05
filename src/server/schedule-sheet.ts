import { env } from "~/env";

// Events' live "Hack Western 13 Schedule" sheet. Read by the live site
// schedule (/api/schedule) and the venue broadcast display (/broadcast).
const SPREADSHEET_ID = "1JRfqib3Mqp2iriKS3rxZBbQyGpZovkagBwEEbcopJCM";
const SHEET_NAME = "hackwestern-schedule-v2";
const RANGE = "A:J";

interface GoogleSheetsCell {
  formattedValue?: string;
  effectiveValue?: {
    stringValue?: string;
    numberValue?: number;
  };
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
      rowData: Array<{
        values: GoogleSheetsCell[];
      }>;
    }>;
    merges?: GoogleSheetsMerge[];
  }>;
}

export async function fetchScheduleSheet() {
  const range = encodeURIComponent(`'${SHEET_NAME}'!${RANGE}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=true&ranges=${range}&key=${env.GOOGLE_SHEETS_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule data: ${response.statusText}`);
  }

  const sheetsData = (await response.json()) as GoogleSheetsResponse;
  const sheet = sheetsData.sheets[0];
  if (!sheet?.data?.[0]?.rowData) {
    throw new Error("No data found in sheet");
  }

  return { rowData: sheet.data[0].rowData, merges: sheet.merges ?? [] };
}

export function cellText(cell: GoogleSheetsCell | undefined): string {
  return cell?.formattedValue ?? cell?.effectiveValue?.stringValue ?? "";
}
