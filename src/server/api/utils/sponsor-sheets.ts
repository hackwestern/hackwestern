import { TRPCError } from "@trpc/server";
import { google } from "googleapis";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { normalizeCoffeeChatMinutes } from "~/lib/coffee-chats";
import { SPONSOR_STATUS_VALUES, type SponsorStatus } from "~/lib/sponsor-status";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";

// Sponsor judging Google Sheet. Layout: tab "Judging", header in row 2
// ("Sponsor Name" | "Chosen Teams (Id)"), data from row 3 down. Column A
// holds the sponsor name (matching the master sheet spelling), column B
// holds that sponsor's chosen team ids as a comma-separated list. Sponsors
// only ever see their UUID (private URL); it never appears in the sheet.
export const SHEET_TAB = "Judging";
const HEADER_ROW = 2;

// HW team contacts, copied once into the judging spreadsheet. This tab is
// the source of truth — edit names/phones here manually; nothing syncs
// from the external sheet. Layout: header row 1 (Name | Phone Number),
// data from row 2. Used for the HW Contact dropdown on the sponsor info
// tab and for phone lookup on the sponsor portal.
export const HW_CONTACTS_TAB = "HW Contacts";


function normalizeSponsorStatus(val: string | undefined): SponsorStatus {
  if (!val) return "Not arrived";
  const clean = val.trim().toLowerCase();
  for (const status of SPONSOR_STATUS_VALUES) {
    if (status.toLowerCase() === clean) return status;
  }
  return "Not arrived";
}

function normalizeRoomNumber(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "TBD";
}

function normalizeBoothLocation(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "TBD";
}

function normalizeHwContact(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "—";
}

/** Optional free-text cell (e.g. workshop fields). Empty stays empty — no TBD. */
export function normalizeOptionalText(val: string | undefined): string {
  return String(val ?? "")
    .replace(/\p{Cf}/gu, "")
    .trim();
}

const SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SheetsClient = ReturnType<typeof google.sheets>;

export async function getSheetsClient() {
  const email = env.SPONSOR_SHEETS_CLIENT_EMAIL;
  const key = env.SPONSOR_SHEETS_PRIVATE_KEY?.trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "SPONSOR_SHEETS_CLIENT_EMAIL / SPONSOR_SHEETS_PRIVATE_KEY are not configured",
    });
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [SPREADSHEETS_SCOPE],
  });
  await auth.authorize();

  return google.sheets({ version: "v4", auth });
}

export function getSpreadsheetId(): string {
  const spreadsheetId = env.SPONSOR_JUDGING_SHEET;
  if (!spreadsheetId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "SPONSOR_JUDGING_SHEET env variable is not set",
    });
  }
  return spreadsheetId;
}

/**
 * One acquired-sponsor row from the master sheet. Layout of the master
 * spreadsheet ("HW 13 Sponsors" tab): a goal/progress block on rows 1-9,
 * a header row (`Company Name | Tier | Amount $$ | Company Contact | HW
 * Contact | Notes`), then one row per acquired sponsor. The header row is
 * found by scanning for "Company Name" in column A rather than hardcoding its
 * row number, since the block moves as organizers edit the sheet.
 */
interface MasterSponsorRow {
  name: string;
  tier: string;
  amount: string;
  companyContact: string;
  hwContact: string;
  notes: string;
}

const MASTER_HEADER_LABEL = "company name";

export function cell(row: string[] | undefined, index: number): string {
  return String(row?.[index] ?? "").trim();
}

export async function fetchMasterSponsors(): Promise<MasterSponsorRow[]> {
  const spreadsheetId = env.SPONSOR_MASTER_SHEET;
  if (!spreadsheetId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "SPONSOR_MASTER_SHEET env variable is not set",
    });
  }

  const sheets = await getSheetsClient();
  const tab = env.SPONSOR_MASTER_SHEET_TAB ?? "HW 13 Sponsors";
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:F`,
  });

  const rows = res.data.values ?? [];
  const headerIndex = rows.findIndex(
    (row) => cell(row, 0).toLowerCase() === MASTER_HEADER_LABEL,
  );
  if (headerIndex === -1) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `No "${MASTER_HEADER_LABEL}" header found in column A of tab "${tab}"`,
    });
  }

  const sponsors: MasterSponsorRow[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const name = cell(row, 0);
    // Stop at the end of the acquired-sponsors block (blank name), and skip
    // any duplicate name so the private-link list stays one row per sponsor.
    if (!name) break;
    if (seen.has(name)) continue;
    seen.add(name);
    sponsors.push({
      name,
      tier: cell(row, 1),
      amount: cell(row, 2),
      companyContact: cell(row, 3),
      hwContact: cell(row, 4),
      notes: cell(row, 5),
    });
  }
  return sponsors;
}

/**
 * Sponsor names from the master sponsor sheet, in sheet order. This is the
 * source of truth for which sponsors get a private judging link.
 */
export async function fetchMasterSponsorNames(): Promise<string[]> {
  return (await fetchMasterSponsors()).map((sponsor) => sponsor.name);
}

export async function fetchColumnA(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A1:A`,
  });
  return (res.data.values ?? []).map((row) => String(row[0] ?? "").trim());
}

/**
 * Every sponsor's picks in one request: column A (name) -> column B (team
 * ids). On duplicate names the first row wins, matching getChosenTeams.
 */
export async function fetchAllChosenTeams(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<Map<string, string[]>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A${HEADER_ROW + 1}:B`,
  });

  const picks = new Map<string, string[]>();
  for (const row of res.data.values ?? []) {
    const name = cell(row, 0);
    if (!name || picks.has(name)) continue;
    picks.set(name, parseTeamIds(cell(row, 1)));
  }
  return picks;
}

/**
 * 1-based row numbers below the header where column A equals sponsorName.
 */
export function findSponsorRows(
  columnA: string[],
  sponsorName: string,
): number[] {
  const rows: number[] = [];
  columnA.forEach((value, i) => {
    if (i + 1 > HEADER_ROW && value === sponsorName) rows.push(i + 1);
  });
  return rows;
}

/**
 * Numeric sheetId for the judging tab, needed for deleteDimension requests.
 */
export async function getJudgingSheetId(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<number> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const properties = res.data.sheets?.find(
    (sheet) => sheet.properties?.title === SHEET_TAB,
  )?.properties;
  if (properties?.sheetId === undefined || properties.sheetId === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Sheet tab "${SHEET_TAB}" not found in spreadsheet`,
    });
  }
  return properties.sheetId;
}

export function parseTeamIds(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(/[,\n]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export interface SponsorInfoRecord {
  status: SponsorStatus;
  roomNumber: string;
  boothLocation: string;
  hwContact: string;
  /** Empty string when the sponsor has no workshop listed. */
  workshopLocation: string;
  /** Empty string when the sponsor has no workshop listed. */
  workshopTime: string;
  /** Coffee-chat allowance in minutes; 0 = no coffee chats. */
  maxCoffeeChatMinutes: number;
}

/**
 * Map sponsor-info header labels to column indexes. Defaults match the
 * canonical A–H layout when a header is missing.
 */
export function parseSponsorInfoColumns(headerRow: readonly unknown[]): {
  nameCol: number;
  statusCol: number;
  roomCol: number;
  boothCol: number;
  hwContactCol: number;
  workshopLocationCol: number;
  workshopTimeCol: number;
  maxMinutesCol: number;
} {
  let nameCol = 0;
  let statusCol = 1;
  let roomCol = 2;
  let boothCol = 3;
  let hwContactCol = 4;
  let workshopLocationCol = 5;
  let workshopTimeCol = 6;
  let maxMinutesCol = 7;

  headerRow.forEach((raw, idx) => {
    const str = String(raw ?? "")
      .replace(/\p{Cf}/gu, "")
      .trim()
      .toLowerCase();
    if (!str) return;
    if (str.includes("sponsor") || str.includes("company")) nameCol = idx;
    else if (str.includes("status")) statusCol = idx;
    else if (str.includes("room")) roomCol = idx;
    else if (str.includes("booth")) boothCol = idx;
    else if (str.includes("workshop") && str.includes("time"))
      workshopTimeCol = idx;
    else if (str.includes("workshop")) workshopLocationCol = idx;
    else if (str.includes("coffee") || str.includes("minutes"))
      maxMinutesCol = idx;
    else if (str.includes("contact") || str.includes("hw")) hwContactCol = idx;
  });

  return {
    nameCol,
    statusCol,
    roomCol,
    boothCol,
    hwContactCol,
    workshopLocationCol,
    workshopTimeCol,
    maxMinutesCol,
  };
}

/**
 * Shared tab lookup: case-insensitive title match against the spreadsheet.
 * Returns the actual title (tab names can differ in case) or null.
 */
export async function findTabTitle(
  sheets: SheetsClient,
  spreadsheetId: string,
  titleLower: string,
): Promise<string | null> {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const found = meta.data.sheets?.find(
      (s) => s.properties?.title?.trim().toLowerCase() === titleLower,
    );
    return found?.properties?.title ?? null;
  } catch {
    return null;
  }
}

function findSponsorInfoTabTitle(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string | null> {
  return findTabTitle(sheets, spreadsheetId, "sponsor info");
}

export async function fetchAllSponsorInfo(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<Map<string, SponsorInfoRecord>> {
  const map = new Map<string, SponsorInfoRecord>();
  try {
    const tabName = await findSponsorInfoTabTitle(sheets, spreadsheetId);
    if (!tabName) return map;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:L`,
    });

    const rows = res.data.values ?? [];
    if (rows.length === 0) return map;

    let cols = parseSponsorInfoColumns([]);

    let dataStartIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      const row = rows[i] ?? [];
      const hasHeader = row.some((c) => {
        const str = String(c).trim().toLowerCase();
        return (
          str === "sponsor name" ||
          str === "company name" ||
          str === "status" ||
          str === "booth location"
        );
      });
      if (hasHeader) {
        dataStartIndex = i + 1;
        cols = parseSponsorInfoColumns(row);
        break;
      }
    }

    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      const name = cell(row, cols.nameCol);
      if (!name) continue;

      const lower = name.toLowerCase();
      if (
        lower === "sponsor name" ||
        lower === "company name" ||
        lower === "sponsor"
      ) {
        continue;
      }

      if (!map.has(lower)) {
        map.set(lower, {
          status: normalizeSponsorStatus(cell(row, cols.statusCol)),
          roomNumber: normalizeRoomNumber(cell(row, cols.roomCol)),
          boothLocation: normalizeBoothLocation(cell(row, cols.boothCol)),
          hwContact: normalizeHwContact(cell(row, cols.hwContactCol)),
          workshopLocation: normalizeOptionalText(
            cell(row, cols.workshopLocationCol),
          ),
          workshopTime: normalizeOptionalText(cell(row, cols.workshopTimeCol)),
          maxCoffeeChatMinutes: normalizeCoffeeChatMinutes(
            cell(row, cols.maxMinutesCol),
          ),
        });
      }
    }
  } catch (error) {
    console.warn("Could not read sponsor info tab:", error);
  }
  return map;
}

/**
 * Resolve a sponsor UUID or name to its registered name. UUIDs must exist in
 * the sponsor_judging_sponsor table; names are used as-is (organizers may
 * look up picks before a mapping row exists).
 */
export async function resolveSponsorName(sponsor: string): Promise<string> {
  if (!uuidRegex.test(sponsor)) {
    return sponsor.trim();
  }

  const row = await db.query.sponsorJudgingSponsors.findFirst({
    where: eq(sponsorJudgingSponsors.id, sponsor.toLowerCase()),
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Unknown sponsor id",
    });
  }
  return row.name;
}
