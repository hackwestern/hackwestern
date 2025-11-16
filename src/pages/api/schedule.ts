import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "~/env";
import type { DaySchedule, ScheduleEvent, ParsedScheduleEvent } from "~/types/schedule";

// Google Sheets API v4 configuration
const SPREADSHEET_ID = "1_dZgkfkhmR-LdqvAplInEOxZJGu7gSsE9FlAiWD64Bk";
const SHEET_NAME = "Sheet1";
const RANGE = "A:I";

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

function parseEventText(text: string): { title: string; location: string } | null {
  if (!text || text.trim() === "") return null;

  const lines = text.split("\n").map((line) => line.trim());
  const title = lines[0] ?? "";

  const locationLine = lines.find((line) =>
    line.toLowerCase().startsWith("location:")
  );

  const location = locationLine
    ? locationLine.replace(/location:\s*/i, "").trim()
    : "";

  return { title, location };
}

function parseScheduleEvent(event: ScheduleEvent): ParsedScheduleEvent {
  return {
    time: event["Time (EST)"],
    bigEvent: parseEventText(event["Big Event"]) ?? undefined,
    sponsorWorkshop: parseEventText(event["Sponsor Workshop"]) ?? undefined,
    otherWorkshop: parseEventText(event["Other Workshop"]) ?? undefined,
    activities1: parseEventText(event["Activities #1"]) ?? undefined,
    activities2: parseEventText(event["Activities #2"]) ?? undefined,
    food: parseEventText(event.Food) ?? undefined,
    sponsorBooth: parseEventText(event["Spon Booth"]) ?? undefined,
    other: parseEventText(event.Other) ?? undefined,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DaySchedule[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = env.GOOGLE_SHEETS_API_KEY;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=true&ranges=${SHEET_NAME}!${RANGE}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule data: ${response.statusText}`);
    }

    const sheetsData = (await response.json()) as GoogleSheetsResponse;
    const sheet = sheetsData.sheets[0];
    if (!sheet?.data?.[0]?.rowData) {
      throw new Error("No data found in sheet");
    }

    const rowData = sheet.data[0].rowData;
    const merges = sheet.merges ?? [];

    // Create a map of merged cells
    const mergeMap = new Map<string, { value: string; endRow: number }>();
    for (const merge of merges) {
      const value = rowData[merge.startRowIndex]?.values[merge.startColumnIndex];
      const cellValue = value?.formattedValue ?? value?.effectiveValue?.stringValue ?? "";

      for (let row = merge.startRowIndex; row < merge.endRowIndex; row++) {
        for (let col = merge.startColumnIndex; col < merge.endColumnIndex; col++) {
          mergeMap.set(`${row},${col}`, {
            value: cellValue,
            endRow: merge.endRowIndex - 1,
          });
        }
      }
    }

    // Parse rows into ScheduleEvent objects
    const events: ScheduleEvent[] = [];

    // Skip header row (index 0)
    for (let rowIndex = 1; rowIndex < rowData.length; rowIndex++) {
      const row = rowData[rowIndex];
      if (!row?.values) continue;

      const getCellValue = (colIndex: number): string => {
        const mergeInfo = mergeMap.get(`${rowIndex},${colIndex}`);
        if (mergeInfo) {
          return mergeInfo.value;
        }

        const cell = row.values[colIndex];
        return cell?.formattedValue ?? cell?.effectiveValue?.stringValue ?? "";
      };

      const event: ScheduleEvent = {
        "Time (EST)": getCellValue(0),
        "Big Event": getCellValue(1),
        "Sponsor Workshop": getCellValue(2),
        "Other Workshop": getCellValue(3),
        "Activities #1": getCellValue(4),
        "Activities #2": getCellValue(5),
        "Food": getCellValue(6),
        "Spon Booth": getCellValue(7),
        "Other": getCellValue(8),
      };

      events.push(event);
    }

    // Split data by day headers
    const days: DaySchedule[] = [];
    let currentDay: DaySchedule | null = null;

    for (const event of events) {
      const bigEvent = event["Big Event"];

      if (
        bigEvent &&
        (bigEvent.includes("Friday") ||
          bigEvent.includes("Saturday") ||
          bigEvent.includes("Sunday")) &&
        !event["Time (EST)"]
      ) {
        if (currentDay) {
          days.push(currentDay);
        }

        let dayName = "Friday";
        if (bigEvent.includes("Saturday")) dayName = "Saturday";
        if (bigEvent.includes("Sunday")) dayName = "Sunday";

        currentDay = {
          day: dayName,
          events: [],
        };
      } else if (currentDay && event["Time (EST)"]) {
        const parsed = parseScheduleEvent(event);
        currentDay.events.push(parsed);
      }
    }

    if (currentDay) {
      days.push(currentDay);
    }

    return res.status(200).json(days);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return res.status(500).json({ error: "Failed to fetch schedule data" });
  }
}
