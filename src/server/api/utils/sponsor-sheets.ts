import { TRPCError } from "@trpc/server";
import {
  runOfShowCredentials,
  runOfShowSpreadsheetId,
  sheetWritesEnabled,
} from "~/server/api/utils/run-of-show-sheet";
import { google } from "googleapis";
import { eq } from "drizzle-orm";

import { normalizeCoffeeChatMinutes } from "~/lib/coffee-chats";
import {
  SPONSOR_STATUS_VALUES,
  type SponsorStatus,
} from "~/lib/sponsor-status";
import { normalizeSponsorTrack, type TrackValue } from "~/lib/sponsor-track";
import { db } from "~/server/db";
import { isMissingRangeError } from "~/server/api/utils/run-of-show-sheet";
import { sponsorJudgingSponsors } from "~/server/db/schema";

// Sponsor judging Google Sheet. Layout: tab "Judging", header in row 2
// ("Sponsor Name" | "Chosen Teams (Id)"), data from row 3 down. Column A
// holds the sponsor name (matching the Sponsor Day-Of spelling), column B
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
const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SheetsClient = ReturnType<typeof google.sheets>;

/**
 * The sponsor tabs (Judging, sponsor info, HW Contacts, Coffee Chat Room
 * Grid) live in the Spon Team RUN OF SHOW sheet since Lucas's judging sheet
 * was merged into it (Jazz, 2026-11-18), so this uses the run-of-show login
 * (falling back to the sponsor login). That account needs Editor on the
 * sheet: shortlists, sponsor info and the room grid are written here.
 */
export async function getSheetsClient() {
  let creds: { email: string; key: string };
  try {
    creds = runOfShowCredentials();
  } catch (e) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.key,
    // Outside production (and in tests) the client is read-only, so a
    // write (shortlist, sponsor info, room grid) fails instead of landing
    // on the live sheet (sheetWritesEnabled).
    scopes: [sheetWritesEnabled() ? SPREADSHEETS_SCOPE : READONLY_SCOPE],
  });
  await auth.authorize();

  return google.sheets({ version: "v4", auth });
}

export function getSpreadsheetId(): string {
  // One source of truth: the Spon Team RUN OF SHOW sheet. Lucas's old
  // judging sheet (SPONSOR_JUDGING_SHEET) is no longer read.
  try {
    return runOfShowSpreadsheetId();
  } catch (e) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * One sponsor row from the "Sponsor Day-Of" tab of the Spon Team sheet (the
 * one sheet, RUN_OF_SHOW_SHEET). Tier, amount and company contact aren't on
 * that sheet, so they come back empty and show as blanks.
 */
interface SheetSponsorRow {
  name: string;
  tier: string;
  amount: string;
  companyContact: string;
  hwContact: string;
  notes: string;
  /**
   * The "Custom API / Prize Track" checkbox: true when ticked, false when
   * not, null when the tab has no such column.
   */
  hasPrizeTrack: boolean | null;
}

/** Newest name first; the tab was "Contract Breakdown" before 2026-11-19. */
const SPONSOR_LIST_TAB_NAMES = ["sponsor day-of", "contract breakdown"];
const SPONSOR_LIST_HEADER = "sponsor name";

export function cell(row: string[] | undefined, index: number): string {
  return String(row?.[index] ?? "").trim();
}

/** Header text compared loosely: invisible characters, case and spaces. */
function headerKey(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\p{Cf}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Sponsor Day-Of header names the app reads, each with the names it had
 * before (Sponsor Status merged into Sponsor Day-Of on 2026-11-19). Exact
 * matches only: the tab also has contract checkboxes such as "Dedicated
 * Workshop" and "Coffee Chats & Interviews" that a "contains" match would
 * mistake for the workshop or coffee chat columns.
 */
const DAY_OF_HEADERS = {
  name: ["sponsor name"],
  format: ["in person / digital"],
  hwLead: ["hw lead", "hw contact"],
  status: ["status"],
  booth: ["booth location"],
  workshopLocation: ["workshop room", "workshop location"],
  workshopTime: ["workshop time"],
  judgingRoom: ["judging room", "judging room number"],
  track: ["team track filter", "sponsor track"],
  prizeTrack: ["custom api / prize track", "prize track"],
  /** Checkbox: the sponsor came to the Friday coffee chat workshop. */
  ccWorkshop: ["at cc workshop"],
  maxMinutes: ["coffee chat max minutes"],
  notes: ["to do / mismatches"],
  /** Sponsorship tier ("Gold"), for the portal's welcome line. Optional. */
  tier: ["tier", "sponsor tier", "sponsorship tier"],
} as const;

export type SponsorDayOfColumns = Record<keyof typeof DAY_OF_HEADERS, number>;

/** Column index of each Sponsor Day-Of field by header name; -1 = missing. */
export function parseSponsorDayOfColumns(
  headerRow: readonly unknown[],
): SponsorDayOfColumns {
  const keys = headerRow.map(headerKey);
  const find = (names: readonly string[]) =>
    keys.findIndex((k) => k !== "" && names.includes(k));
  return Object.fromEntries(
    Object.entries(DAY_OF_HEADERS).map(([field, names]) => [
      field,
      find(names),
    ]),
  ) as SponsorDayOfColumns;
}

/** A checkbox cell as the API returns it ("TRUE" / "FALSE"). */
export function isTicked(value: string): boolean {
  return /^(true|yes|y|x|✓|✔)$/i.test(value.trim());
}

/**
 * The Sponsor Day-Of tab: its title, all rows, the header row index (column
 * A "Sponsor Name") and the sponsor rows under it (up to the first blank
 * name). Null when the tab or its header row is missing.
 */
export interface SponsorDayOfTab {
  tab: string;
  rows: string[][];
  headerIndex: number;
  cols: SponsorDayOfColumns;
}

export function parseSponsorDayOfRows(
  tab: string,
  rows: string[][],
): SponsorDayOfTab | null {
  const headerIndex = rows.findIndex(
    (row) => cell(row, 0).toLowerCase() === SPONSOR_LIST_HEADER,
  );
  if (headerIndex === -1) return null;
  return {
    tab,
    rows,
    headerIndex,
    cols: parseSponsorDayOfColumns(rows[headerIndex] ?? []),
  };
}

/**
 * The sponsor rows of a Sponsor Day-Of read with their 1-based sheet row
 * numbers, in sheet order: from under the header to the first blank name
 * (the footer rows below are not sponsors). Duplicate names keep the first.
 */
export function sponsorDayOfRows(
  dayOf: SponsorDayOfTab,
): { name: string; row: string[]; sheetRow: number }[] {
  const out: { name: string; row: string[]; sheetRow: number }[] = [];
  const seen = new Set<string>();
  for (let i = dayOf.headerIndex + 1; i < dayOf.rows.length; i++) {
    const row = dayOf.rows[i] ?? [];
    const name = cell(row, 0);
    if (!name) break;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, row, sheetRow: i + 1 });
  }
  return out;
}

/** Read the Sponsor Day-Of tab (falls back to "Contract Breakdown"). */
export async function fetchSponsorDayOfTab(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<SponsorDayOfTab | null> {
  let tab: string | null = null;
  for (const name of SPONSOR_LIST_TAB_NAMES) {
    tab = await findTabTitle(sheets, spreadsheetId, name);
    if (tab) break;
  }
  if (!tab) return null;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:AF`,
  });
  return parseSponsorDayOfRows(
    tab,
    (res.data.values ?? []).map((row) => row.map((c) => String(c ?? ""))),
  );
}

/**
 * Every sponsor on the Sponsor Day-Of tab, in sheet order. The header row is
 * the first row whose column A is "Sponsor Name"; "HW lead" and the
 * "To do / mismatches" column are found by header name. The list ends at the
 * first blank name, so the footer rows under it are not sponsors.
 */
export async function fetchSheetSponsors(): Promise<SheetSponsorRow[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const dayOf = await fetchSponsorDayOfTab(sheets, spreadsheetId);
  if (!dayOf) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        'No "Sponsor Day-Of" tab with a "Sponsor Name" header in column A in the Spon Team sheet',
    });
  }
  return sheetSponsorsFromDayOf(dayOf);
}

/** The sponsor list from a Sponsor Day-Of read (pure, for tests). */
export function sheetSponsorsFromDayOf(
  dayOf: SponsorDayOfTab,
): SheetSponsorRow[] {
  const { hwLead, notes, prizeTrack } = dayOf.cols;
  return sponsorDayOfRows(dayOf).map(({ name, row }) => ({
    name,
    tier: "",
    amount: "",
    companyContact: "",
    hwContact: hwLead === -1 ? "" : cell(row, hwLead),
    notes: notes === -1 ? "" : cell(row, notes),
    hasPrizeTrack: prizeTrack === -1 ? null : isTicked(cell(row, prizeTrack)),
  }));
}

/**
 * Sponsor names from the Sponsor Day-Of tab, in sheet order. This is the
 * source of truth for which sponsors get a private judging link.
 */
export async function fetchSheetSponsorNames(): Promise<string[]> {
  return (await fetchSheetSponsors()).map((sponsor) => sponsor.name);
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
  // The "Judging" tab was deleted on 2026-11-19 (picks move to the database
  // and the Sponsor Judging tab). Without it there are simply no picks yet;
  // don't fail the whole sponsor list, portal or judging board over it.
  const res = await sheets.spreadsheets.values
    .get({
      spreadsheetId,
      range: `${SHEET_TAB}!A${HEADER_ROW + 1}:B`,
    })
    .catch((error: unknown) => {
      if (isMissingRangeError(error)) return null;
      throw error;
    });
  if (!res) return new Map();

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
  /** Sponsor Day-Of's "Tier" column ("Gold"); empty when there's none. */
  tier: string;
  roomNumber: string;
  boothLocation: string;
  hwContact: string;
  /** Empty string when the sponsor has no workshop listed. */
  workshopLocation: string;
  /** Empty string when the sponsor has no workshop listed. */
  workshopTime: string;
  /** Coffee-chat allowance in minutes; 0 = no coffee chats. */
  maxCoffeeChatMinutes: number;
  /**
   * Judging track the sponsor shortlists teams from ("Sponsor Track"
   * column). Null when the cell is empty or unrecognized — the sponsor
   * then sees every submitted team.
   */
  track: TrackValue | null;
  /**
   * Sponsor Day-Of's "Custom API / Prize Track" checkbox. Null when it isn't
   * known (the old Sponsor Status tab, or no such column).
   */
  hasPrizeTrack: boolean | null;
  /**
   * Sponsor Day-Of's "At CC workshop" checkbox (came to the Friday coffee
   * chat workshop). Null when the tab has no such column.
   */
  atCcWorkshop: boolean | null;
}

const warned = new Set<string>();

/** console.warn a message the first time it comes up in this process. */
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * Every sponsor's info from a Sponsor Day-Of read, keyed by lowercased name.
 * Null when the tab has no "Status" column yet (the sheet before the
 * 2026-11-19 merge), so the caller can fall back to the old tab.
 */
/** "Gold Sponsor" -> "Gold"; placeholders ("-", "N/A", "TBD", "Sponsor") -> "". */
export function normalizeTier(raw: string): string {
  const tier = raw.trim().replace(/\s*sponsors?$/i, "").trim();
  return /^(|-+|—|n\/?a|tbd|none)$/i.test(tier) ? "" : tier;
}

export function sponsorInfoFromDayOf(
  dayOf: SponsorDayOfTab,
): Map<string, SponsorInfoRecord> | null {
  const c = dayOf.cols;
  if (c.status === -1) {
    warnOnce(
      `sponsor info: "${dayOf.tab}" has no "Status" column; reading the old Sponsor Status tab instead`,
    );
    return null;
  }
  if (c.booth === -1) {
    warnOnce(
      `sponsor info: "${dayOf.tab}" has no "Booth location" column; every booth reads as blank`,
    );
  }
  if (c.judgingRoom === -1) {
    warnOnce(
      `sponsor info: "${dayOf.tab}" has no "Judging room" column; every judging room reads as blank`,
    );
  }
  if (c.ccWorkshop === -1) {
    warnOnce(
      `sponsor info: "${dayOf.tab}" has no "At CC workshop" column; coffee chat workshop attendance can't be read or saved`,
    );
  }
  const at = (row: string[], col: number) => (col === -1 ? "" : cell(row, col));
  const map = new Map<string, SponsorInfoRecord>();
  for (const { name, row } of sponsorDayOfRows(dayOf)) {
    const key = name.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      status: normalizeSponsorStatus(at(row, c.status)),
      tier: normalizeTier(at(row, c.tier)),
      roomNumber: normalizeRoomNumber(at(row, c.judgingRoom)),
      boothLocation: normalizeBoothLocation(at(row, c.booth)),
      hwContact: normalizeHwContact(at(row, c.hwLead)),
      workshopLocation: normalizeOptionalText(at(row, c.workshopLocation)),
      workshopTime: normalizeOptionalText(at(row, c.workshopTime)),
      maxCoffeeChatMinutes: normalizeCoffeeChatMinutes(at(row, c.maxMinutes)),
      track: normalizeSponsorTrack(at(row, c.track)),
      hasPrizeTrack:
        c.prizeTrack === -1 ? null : isTicked(at(row, c.prizeTrack)),
      atCcWorkshop:
        c.ccWorkshop === -1 ? null : isTicked(at(row, c.ccWorkshop)),
    });
  }
  return map;
}

/**
 * Map sponsor-info header labels to column indexes. Defaults match the
 * canonical A–I layout when a header is missing.
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
  trackCol: number;
} {
  let nameCol = 0;
  let statusCol = 1;
  let roomCol = 2;
  let boothCol = 3;
  let hwContactCol = 4;
  let workshopLocationCol = 5;
  let workshopTimeCol = 6;
  let maxMinutesCol = 7;
  let trackCol = 8;

  headerRow.forEach((raw, idx) => {
    const str = String(raw ?? "")
      .replace(/\p{Cf}/gu, "")
      .trim()
      .toLowerCase();
    if (!str) return;
    // "Sponsor Track" also contains "sponsor", so the track check must come
    // first or it would steal the name column.
    if (str.includes("track")) trackCol = idx;
    else if (str.includes("sponsor") || str.includes("company")) nameCol = idx;
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
    trackCol,
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

/**
 * The old sponsor info tab's title, newest first: "sponsor info", then
 * "live sponsor info", then "Sponsor Status" (2026-11-19). Read only when
 * Sponsor Day-Of has no "Status" column yet; the merged sheet renamed it
 * "(old) Sponsor Status" and hid it, so it is never read there.
 */
export const SPONSOR_INFO_TAB_NAMES = [
  "sponsor status",
  "live sponsor info",
  "sponsor info",
];

async function findSponsorInfoTabTitle(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string | null> {
  for (const name of SPONSOR_INFO_TAB_NAMES) {
    const title = await findTabTitle(sheets, spreadsheetId, name);
    if (title) return title;
  }
  return null;
}

export async function fetchAllSponsorInfo(
  sheets: SheetsClient,
  spreadsheetId: string,
  /** Rethrow read errors instead of returning an empty map. */
  { strict = false }: { strict?: boolean } = {},
): Promise<Map<string, SponsorInfoRecord>> {
  const map = new Map<string, SponsorInfoRecord>();
  try {
    // Sponsor Day-Of holds these columns since 2026-11-19. Until a sheet has
    // them (no "Status" column there), read the old Sponsor Status tab.
    const dayOf = await fetchSponsorDayOfTab(sheets, spreadsheetId);
    const fromDayOf = dayOf ? sponsorInfoFromDayOf(dayOf) : null;
    if (fromDayOf) return fromDayOf;

    const tabName = await findSponsorInfoTabTitle(sheets, spreadsheetId);
    if (!tabName) {
      warnOnce(
        `sponsor info: no Sponsor Day-Of "Status" column and no old tab (${SPONSOR_INFO_TAB_NAMES.join(", ")}); every sponsor reads with no status, booth or judging room`,
      );
      return map;
    }

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
          tier: "",
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
          track: normalizeSponsorTrack(cell(row, cols.trackCol)),
          hasPrizeTrack: null,
          atCcWorkshop: null,
        });
      }
    }
  } catch (error) {
    if (strict) throw error;
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
