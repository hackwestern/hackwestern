import { TRPCError } from "@trpc/server";
import { google, type sheets_v4 } from "googleapis";
import { eq, count } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { sponsorJudgingSponsors, teams, users } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";

// Sponsor judging Google Sheet. Layout: tab "Judging", header in row 2
// ("Sponsor Name" | "Chosen Teams (Id)"), data from row 3 down. Column A
// holds the sponsor name (matching the master sheet spelling), column B
// holds that sponsor's chosen team ids as a comma-separated list. Sponsors
// only ever see their UUID (private URL); it never appears in the sheet.
const SHEET_TAB = "Judging";
const HEADER_ROW = 2;

export const SPONSOR_INFO_TAB = "sponsor info";

export const SPONSOR_STATUS_VALUES = [
  "Not arrived",
  "Checked in",
  "Booth set up",
  "Workshop live",
  "Left",
] as const;

export type SponsorStatus = (typeof SPONSOR_STATUS_VALUES)[number];

export function normalizeSponsorStatus(val: string | undefined): SponsorStatus {
  if (!val) return "Not arrived";
  const clean = val.trim().toLowerCase();
  for (const status of SPONSOR_STATUS_VALUES) {
    if (status.toLowerCase() === clean) return status;
  }
  return "Not arrived";
}

export function normalizeRoomNumber(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "TBD";
}

export function normalizeBoothLocation(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "TBD";
}

export function normalizeHwContact(val: string | undefined): string {
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : "—";
}

// HW team contacts, copied once into the judging spreadsheet. This tab is
// the source of truth — edit names/phones here manually; nothing syncs
// from the external sheet. Layout: header row 1 (Name | Phone Number),
// data from row 2. Used for the HW Contact dropdown on the sponsor info
// tab and for phone lookup on the sponsor portal.
const HW_CONTACTS_TAB = "HW Contacts";

/** Lowercased name with invisible chars / extra spaces removed. */
export function normalizePersonName(val: string): string {
  return val
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Phone for display: invisible chars stripped, formatting kept as typed. */
export function normalizePhoneNumber(val: string): string {
  return val
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve an HW contact string (e.g. "Noah Medland", "Noah", or
 * "Noah / Daniel") to phone number(s) from the contacts sheet. Matching is
 * forgiving: full name first, then a unique first-name hit (the sheet has a
 * mix of "First Last" and first-name-only rows).
 */
export function lookupHwContactPhones(
  hwContact: string,
  phoneByName: Map<string, string>,
): string[] {
  const query = normalizePersonName(hwContact);
  if (!query || query === "—" || query === "-") return [];

  // Index first name → phones for the fallback pass.
  const byFirstName = new Map<string, string[]>();
  for (const [name, phone] of phoneByName) {
    const first = name.split(" ")[0];
    if (!first || !phone) continue;
    const list = byFirstName.get(first) ?? [];
    list.push(phone);
    byFirstName.set(first, list);
  }

  const people = query
    .split(/\s*(?:,|\/|&|\+|\band\b)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const phones: string[] = [];
  const seen = new Set<string>();

  const push = (phone: string | undefined) => {
    if (!phone || seen.has(phone)) return;
    seen.add(phone);
    phones.push(phone);
  };

  for (const person of people) {
    const exact = phoneByName.get(person);
    if (exact) {
      push(exact);
      continue;
    }

    const tokens = person.split(" ");
    const first = tokens[0]!;
    const last = tokens[tokens.length - 1];
    const candidates = byFirstName.get(first) ?? [];

    if (tokens.length >= 2 && last && last !== first) {
      // "Jessica Wang": prefer a sheet row whose name ends with the same
      // last name, so we never pair the wrong Jessica.
      const fullNames = [...phoneByName.entries()].filter(
        ([name]) =>
          name.split(" ")[0] === first && name.split(" ").slice(-1)[0] === last,
      );
      if (fullNames.length === 1) {
        push(fullNames[0]![1]);
        continue;
      }
    }

    // First-name-only query, or a unique first-name row (e.g. sheet has
    // only "William" so "William Jiang" still resolves).
    if (candidates.length === 1) {
      push(candidates[0]);
    } else if (tokens.length === 1 && phoneByName.has(person)) {
      push(phoneByName.get(person));
    }
  }

  return phones;
}

const SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SheetsClient = ReturnType<typeof google.sheets>;

async function getSheetsClient() {
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

function getSpreadsheetId(): string {
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
export interface MasterSponsorRow {
  name: string;
  tier: string;
  amount: string;
  companyContact: string;
  hwContact: string;
  notes: string;
}

const MASTER_HEADER_LABEL = "company name";

function cell(row: string[] | undefined, index: number): string {
  return String(row?.[index] ?? "").trim();
}

async function fetchMasterSponsors(): Promise<MasterSponsorRow[]> {
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
async function fetchMasterSponsorNames(): Promise<string[]> {
  return (await fetchMasterSponsors()).map((sponsor) => sponsor.name);
}

async function fetchColumnA(
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
async function fetchAllChosenTeams(
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
function findSponsorRows(columnA: string[], sponsorName: string): number[] {
  const rows: number[] = [];
  columnA.forEach((value, i) => {
    if (i + 1 > HEADER_ROW && value === sponsorName) rows.push(i + 1);
  });
  return rows;
}

/**
 * Numeric sheetId for the judging tab, needed for deleteDimension requests.
 */
async function getJudgingSheetId(
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

function parseTeamIds(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(/[,\n]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

async function findSponsorInfoTabTitle(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string | null> {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const found = meta.data.sheets?.find(
      (s) => s.properties?.title?.trim().toLowerCase() === "sponsor info",
    );
    return found?.properties?.title ?? null;
  } catch {
    return null;
  }
}

async function ensureSponsorInfoTab(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const found = meta.data.sheets?.find(
    (s) => s.properties?.title?.trim().toLowerCase() === "sponsor info",
  );

  let tabName = found?.properties?.title;
  let sheetId = found?.properties?.sheetId ?? null;

  if (!tabName) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SPONSOR_INFO_TAB,
              },
            },
          },
        ],
      },
    });

    const newProps = addRes.data.replies?.[0]?.addSheet?.properties;
    tabName = newProps?.title ?? SPONSOR_INFO_TAB;
    sheetId = newProps?.sheetId ?? null;

    // Header row with 5 columns: Sponsor Name, Status, Judging Room Number, Booth Location, HW Contact
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1:E1`,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [
          [
            "Sponsor Name",
            "Status",
            "Judging Room Number",
            "Booth Location",
            "HW Contact",
          ],
        ],
      },
    });
  }

  // Ensure dropdown data validation:
  // - Column B (Status): Not arrived, Checked in, Booth set up, Workshop live, Left
  // - Column E (HW Contact): names from the "HW Contacts" tab
  if (sheetId !== null) {
    const hwContactNames = await fetchHwContactNames(sheets, spreadsheetId);
    try {
      const requests: sheets_v4.Schema$Request[] = [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1, // row 2 down
              startColumnIndex: 1, // Column B (A=0, B=1)
              endColumnIndex: 2,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: SPONSOR_STATUS_VALUES.map((val) => ({
                  userEnteredValue: val,
                })),
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
      ];

      if (hwContactNames.length > 0) {
        requests.push({
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1, // row 2 down
              startColumnIndex: 4, // Column E (HW Contact)
              endColumnIndex: 5,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: hwContactNames.map((name) => ({
                  userEnteredValue: name,
                })),
              },
              strict: false,
              showCustomUi: true,
            },
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    } catch (e) {
      console.warn("Could not apply dropdown validation to sheet:", e);
    }
  }

  return tabName;
}

export interface SponsorInfoRecord {
  status: SponsorStatus;
  roomNumber: string;
  boothLocation: string;
  hwContact: string;
}

async function fetchAllSponsorInfo(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<Map<string, SponsorInfoRecord>> {
  const map = new Map<string, SponsorInfoRecord>();
  try {
    const tabName = await findSponsorInfoTabTitle(sheets, spreadsheetId);
    if (!tabName) return map;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:E`,
    });

    const rows = res.data.values ?? [];
    if (rows.length === 0) return map;

    let nameCol = 0;
    let statusCol = 1;
    let roomCol = 2;
    let boothCol = 3;
    let hwContactCol = 4;

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
        row.forEach((c, idx) => {
          const str = String(c).trim().toLowerCase();
          if (str.includes("sponsor") || str.includes("company")) nameCol = idx;
          else if (str.includes("status")) statusCol = idx;
          else if (str.includes("room")) roomCol = idx;
          else if (str.includes("booth")) boothCol = idx;
          else if (str.includes("contact") || str.includes("hw"))
            hwContactCol = idx;
        });
        break;
      }
    }

    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      const name = cell(row, nameCol);
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
          status: normalizeSponsorStatus(cell(row, statusCol)),
          roomNumber: normalizeRoomNumber(cell(row, roomCol)),
          boothLocation: normalizeBoothLocation(cell(row, boothCol)),
          hwContact: normalizeHwContact(cell(row, hwContactCol)),
        });
      }
    }
  } catch (error) {
    console.warn("Could not read sponsor info tab:", error);
  }
  return map;
}

/**
 * Every HW team member's phone number, keyed by normalized name. Read from
 * the "HW Contacts" tab of the judging spreadsheet (source of truth);
 * empty map if the tab is missing so the portal can still render.
 */
async function fetchHwContactPhones(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${HW_CONTACTS_TAB}!A:B`,
    });

    const rows = res.data.values ?? [];
    let nameCol = 0;
    let phoneCol = 1;
    let dataStartIndex = 0;

    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      const row = rows[i] ?? [];
      const hasHeader = row.some((c) => {
        const str = String(c).trim().toLowerCase();
        return str === "name" || str.includes("phone");
      });
      if (hasHeader) {
        dataStartIndex = i + 1;
        row.forEach((c, idx) => {
          const str = String(c).trim().toLowerCase();
          if (str === "name") nameCol = idx;
          else if (str.includes("phone")) phoneCol = idx;
        });
        break;
      }
    }

    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      const name = normalizePersonName(cell(row, nameCol));
      const phone = normalizePhoneNumber(cell(row, phoneCol));
      // Skip rows with no usable phone (letters-only placeholders etc).
      if (!name || !phone || !/\d/.test(phone)) continue;
      if (name === "name") continue;
      if (!map.has(name)) map.set(name, phone);
    }
  } catch (error) {
    console.warn("Could not read HW contacts tab:", error);
  }
  return map;
}

/**
 * Display names from the "HW Contacts" tab, in sheet order, for the HW
 * Contact dropdown on the sponsor info tab.
 */
async function fetchHwContactNames(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string[]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${HW_CONTACTS_TAB}!A2:A`,
    });
    return (res.data.values ?? [])
      .map((row) =>
        String(row[0] ?? "")
          .replace(/\p{Cf}/gu, "")
          .trim(),
      )
      .filter((name) => name.length > 0 && name.toLowerCase() !== "name");
  } catch {
    return [];
  }
}

/**
 * Resolve a sponsor UUID or name to its registered name. UUIDs must exist in
 * the sponsor_judging_sponsor table; names are used as-is (organizers may
 * look up picks before a mapping row exists).
 */
async function resolveSponsorName(sponsor: string): Promise<string> {
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

export const sponsorJudgingRouter = createTRPCRouter({
  /**
   * Get public sponsor portal info for /sponsors/[id]. Public.
   * Resolves the sponsor UUID to its name, then loads their HW contact
   * from the master sheet and their room number and booth location
   * from the "sponsor info" tab. The HW contact name is matched against
   * the HW contacts sheet to attach a phone number when one is listed.
   * Does NOT expose amount or status.
   */
  getSponsorPortalInfo: publicProcedure
    .input(z.object({ sponsor: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const [master, sheets, spreadsheetId] = await Promise.all([
          fetchMasterSponsors(),
          getSheetsClient(),
          Promise.resolve(getSpreadsheetId()),
        ]);

        const [sponsorInfoMap, picksMap, contactPhones] = await Promise.all([
          fetchAllSponsorInfo(sheets, spreadsheetId),
          fetchAllChosenTeams(sheets, spreadsheetId),
          fetchHwContactPhones(),
        ]);

        const masterRow = master.find(
          (m) => m.name.toLowerCase() === sponsorName.toLowerCase(),
        );

        const info = sponsorInfoMap.get(sponsorName.toLowerCase());
        const picks = picksMap.get(sponsorName) ?? [];
        // Prefer the sponsor info tab (authoritative per-event assignment);
        // fall back to the master sheet when the tab has no name yet.
        const hwContact =
          info?.hwContact && info.hwContact !== "—"
            ? info.hwContact
            : (masterRow?.hwContact ?? "—") || "—";
        const hwContactPhones = lookupHwContactPhones(hwContact, contactPhones);

        return {
          sponsorName,
          hwContact,
          hwContactPhone: hwContactPhones[0] ?? null,
          companyContact: masterRow?.companyContact ?? "—",
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          picksCount: picks.length,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load sponsor portal information",
        });
      }
    }),

  /**
   * Get the team ids a sponsor has selected. Public. Accepts either a sponsor
   * UUID (private URL) or a sponsor name; both resolve to the name, which is
   * matched against column A of the sheet. Returns the parsed team id list
   * from column B (empty list if the sponsor has no row or no picks yet).
   */
  getChosenTeams: publicProcedure
    .input(z.object({ sponsor: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [rowNumber] = findSponsorRows(columnA, sponsorName);
        if (!rowNumber) {
          return { sponsorName, teamIds: [] as string[] };
        }

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SHEET_TAB}!B${rowNumber}`,
        });
        const cell = (res.data.values?.[0]?.[0] ?? "") as string;

        return { sponsorName, teamIds: parseTeamIds(cell) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch sponsor's chosen teams",
        });
      }
    }),

  /**
   * Replace a sponsor's chosen teams. Public. Takes only the sponsor UUID
   * (the private URL identifier); the resolved name is what gets written to
   * the sheet. Overwrites column B on the sponsor's existing row, or appends
   * a new row (name + team ids) if the sponsor isn't in the sheet yet. An
   * empty teamIds list clears the sponsor's picks.
   */
  setChosenTeams: publicProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        teamIds: z.array(z.string().min(1)),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsorId);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [existingRow] = findSponsorRows(columnA, sponsorName);

        const cellValue = input.teamIds.join(", ");

        if (existingRow) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TAB}!B${existingRow}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[cellValue]],
            },
          });
          return { sponsorName, teamIds: input.teamIds };
        }

        // No row yet. The append below races with any other first write for
        // the same sponsor: both can see "no row" and both append, leaving a
        // duplicate row that would silently shadow picks. Re-read column A
        // afterwards and collapse any extra rows onto the first one.
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${SHEET_TAB}!A:B`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            majorDimension: "ROWS",
            values: [[sponsorName, cellValue]],
          },
        });

        const rowsAfterAppend = findSponsorRows(
          await fetchColumnA(sheets, spreadsheetId),
          sponsorName,
        );
        const [canonicalRow, ...duplicates] = rowsAfterAppend;
        if (canonicalRow && duplicates.length > 0) {
          const sheetId = await getJudgingSheetId(sheets, spreadsheetId);
          // Delete highest row numbers first so earlier indices stay valid.
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [...duplicates]
                .sort((a, b) => b - a)
                .map((rowNumber) => ({
                  deleteDimension: {
                    range: {
                      sheetId,
                      dimension: "ROWS",
                      startIndex: rowNumber - 1,
                      endIndex: rowNumber,
                    },
                  },
                })),
            },
          });
          // The surviving row may hold the other writer's picks; assert ours.
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TAB}!B${canonicalRow}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[cellValue]],
            },
          });
        }

        return { sponsorName, teamIds: input.teamIds };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor's chosen teams",
        });
      }
    }),

  /**
   * Register a sponsor and get their private UUID. Organizer-only. The name
   * must match the master sheet's "Company Name" spelling, since that is what
   * the judging sheet is keyed on.
   */
  registerSponsor: protectedOrganizerProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const existing = await db.query.sponsorJudgingSponsors.findFirst({
        where: eq(sponsorJudgingSponsors.name, name),
      });
      if (existing) {
        return existing;
      }
      const [row] = await db
        .insert(sponsorJudgingSponsors)
        .values({ name })
        .returning();
      return row;
    }),

  /**
   * List all registered sponsor UUIDs and names. Organizer-only.
   */
  listSponsors: protectedOrganizerProcedure.query(async () => {
    return db.query.sponsorJudgingSponsors.findMany();
  }),

  /**
   * Full sponsor board for organizers: every acquired sponsor from the master
   * sheet (tier, amount, contacts, notes), joined with their private-link UUID
   * and their current picks from the judging sheet. Sponsors that are
   * registered but no longer on the master sheet are appended with an empty
   * tier so typos stay visible instead of silently disappearing. Organizer-only.
   */
  getSponsors: protectedOrganizerProcedure.query(async () => {
    try {
      const [master, registered, sheets, spreadsheetId] = await Promise.all([
        fetchMasterSponsors(),
        db.query.sponsorJudgingSponsors.findMany(),
        getSheetsClient(),
        Promise.resolve(getSpreadsheetId()),
      ]);
      const [picks, sponsorInfoMap] = await Promise.all([
        fetchAllChosenTeams(sheets, spreadsheetId),
        fetchAllSponsorInfo(sheets, spreadsheetId),
      ]);

      const registeredByName = new Map(
        registered.map((row) => [row.name, row]),
      );

      const sponsors = master.map((sponsor) => {
        const info = sponsorInfoMap.get(sponsor.name.toLowerCase());
        const hwContact =
          info?.hwContact && info.hwContact !== "—"
            ? info.hwContact
            : sponsor.hwContact || "—";

        return {
          name: sponsor.name,
          tier: sponsor.tier,
          amount: sponsor.amount,
          companyContact: sponsor.companyContact,
          hwContact,
          notes: sponsor.notes,
          sponsorId: registeredByName.get(sponsor.name)?.id ?? null,
          teamIds: picks.get(sponsor.name) ?? [],
          status: info?.status ?? "Not arrived",
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          onMasterSheet: true,
        };
      });

      const masterNames = new Set(master.map((sponsor) => sponsor.name));
      for (const row of registered) {
        if (masterNames.has(row.name)) continue;
        const info = sponsorInfoMap.get(row.name.toLowerCase());
        const hwContact =
          info?.hwContact && info.hwContact !== "—" ? info.hwContact : "—";
        sponsors.push({
          name: row.name,
          tier: "",
          amount: "",
          companyContact: "",
          hwContact,
          notes: "Registered but missing from the master sheet",
          sponsorId: row.id,
          teamIds: picks.get(row.name) ?? [],
          status: info?.status ?? "Not arrived",
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          onMasterSheet: false,
        });
      }

      return sponsors;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load sponsors",
      });
    }
  }),

  /**
   * Set a sponsor's status in the "sponsor info" tab.
   * Organizer-only.
   */
  setSponsorStatus: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorName: z.string().min(1),
        status: z.enum(SPONSOR_STATUS_VALUES),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        const tab = await ensureSponsorInfoTab(sheets, spreadsheetId);

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tab}'!A1:C`,
        });

        const rows = res.data.values ?? [];
        const target = input.sponsorName.trim().toLowerCase();
        let targetRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const name = cell(rows[i], 0);
          const lower = name.toLowerCase();
          if (
            lower === target &&
            lower !== "sponsor name" &&
            lower !== "company name"
          ) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tab}'!B${targetRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[input.status]],
            },
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${tab}'!A:E`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              majorDimension: "ROWS",
              values: [[input.sponsorName, input.status, "TBD", "TBD", "—"]],
            },
          });
        }

        return { sponsorName: input.sponsorName, status: input.status };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor status in spreadsheet",
        });
      }
    }),

  /**
   * Set a sponsor's judging room number in the "sponsor info" tab.
   * Organizer-only.
   */
  setSponsorRoomNumber: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorName: z.string().min(1),
        roomNumber: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        const tab = await ensureSponsorInfoTab(sheets, spreadsheetId);

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tab}'!A1:C`,
        });

        const rows = res.data.values ?? [];
        const target = input.sponsorName.trim().toLowerCase();
        let targetRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const name = cell(rows[i], 0);
          const lower = name.toLowerCase();
          if (
            lower === target &&
            lower !== "sponsor name" &&
            lower !== "company name"
          ) {
            targetRowIndex = i + 1;
            break;
          }
        }

        const roomVal = normalizeRoomNumber(input.roomNumber);

        if (targetRowIndex > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tab}'!C${targetRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[roomVal]],
            },
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${tab}'!A:C`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              majorDimension: "ROWS",
              values: [[input.sponsorName, "Not arrived", roomVal]],
            },
          });
        }

        return { sponsorName: input.sponsorName, roomNumber: roomVal };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor room number in spreadsheet",
        });
      }
    }),

  /**
   * Register every sponsor from the master sponsor sheet that isn't in the
   * judging table yet. Organizer-only; run this whenever the sponsor roster
   * changes (before judging opens, plus late additions). Returns the full
   * list of sponsors in master-sheet order with their private UUIDs, so the
   * caller can build each sponsor's judging link.
   */
  syncSponsors: protectedOrganizerProcedure.mutation(async () => {
    const names = await fetchMasterSponsorNames();
    if (names.length === 0) return [];

    await db
      .insert(sponsorJudgingSponsors)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing({ target: sponsorJudgingSponsors.name })
      .returning();

    const rows = await db.query.sponsorJudgingSponsors.findMany();
    const byName = new Map(rows.map((row) => [row.name, row]));

    return names.map((name) => {
      const row = byName.get(name);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sponsor "${name}" vanished during sync`,
        });
      }
      return { id: row.id, name, createdAt: row.createdAt };
    });
  }),

  /**
   * List all teams from the teams table. Public (used by the sponsor picks
   * page). Returns each team's id, name, and member count. No track
   * filtering — that will be added later.
   */
  listAllTeams: publicProcedure.query(async () => {
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        memberCount: count(users.id),
      })
      .from(teams)
      .leftJoin(users, eq(users.teamId, teams.id))
      .groupBy(teams.id, teams.name)
      .orderBy(teams.name);

    return allTeams.map((team) => ({
      id: team.id,
      name: team.name,
      members:
        team.memberCount === 1 ? "1 member" : `${team.memberCount} members`,
    }));
  }),
});
