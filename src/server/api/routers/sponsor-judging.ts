import { TRPCError } from "@trpc/server";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";
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
      const picks = await fetchAllChosenTeams(sheets, spreadsheetId);

      const registeredByName = new Map(
        registered.map((row) => [row.name, row]),
      );

      const sponsors = master.map((sponsor) => ({
        name: sponsor.name,
        tier: sponsor.tier,
        amount: sponsor.amount,
        companyContact: sponsor.companyContact,
        hwContact: sponsor.hwContact,
        notes: sponsor.notes,
        sponsorId: registeredByName.get(sponsor.name)?.id ?? null,
        teamIds: picks.get(sponsor.name) ?? [],
        onMasterSheet: true,
      }));

      const masterNames = new Set(master.map((sponsor) => sponsor.name));
      for (const row of registered) {
        if (masterNames.has(row.name)) continue;
        sponsors.push({
          name: row.name,
          tier: "",
          amount: "",
          companyContact: "",
          hwContact: "",
          notes: "Registered but missing from the master sheet",
          sponsorId: row.id,
          teamIds: picks.get(row.name) ?? [],
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
});
