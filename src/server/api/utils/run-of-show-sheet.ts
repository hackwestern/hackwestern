import { google, type sheets_v4 } from "googleapis";
import { env } from "~/env";
import {
  parseCoffeeChatsTab,
  parseRunOfShowTab,
  type ParsedRunOfShow,
  type SheetGrid,
  type SheetMerge,
} from "~/server/api/utils/run-of-show-parse";

/**
 * The run-of-show Google Sheet is the single source of truth for sponsor
 * schedules and rooms (docs/decisions.md, 2026-11-14). The site only reads it,
 * so this client asks for read-only access.
 *
 * Login: RUN_OF_SHOW_SHEETS_* if set, otherwise the sponsor judging service
 * account (SPONSOR_SHEETS_*). Whichever is used, the sheet must be shared with
 * that account's email as Viewer.
 */
const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

/** Undo .env escaping: surrounding quotes and literal "\n" line breaks. */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  return raw
    ?.trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\n/g, "\n");
}

export function runOfShowCredentials(): { email: string; key: string } {
  const ownEmail = env.RUN_OF_SHOW_SHEETS_CLIENT_EMAIL;
  const ownKey = normalizePrivateKey(env.RUN_OF_SHOW_SHEETS_PRIVATE_KEY);
  if (ownEmail && ownKey) return { email: ownEmail, key: ownKey };

  const email = env.SPONSOR_SHEETS_CLIENT_EMAIL;
  const key = normalizePrivateKey(env.SPONSOR_SHEETS_PRIVATE_KEY);
  if (email && key) return { email, key };

  throw new Error(
    "Run-of-show sheet login is not configured: set RUN_OF_SHOW_SHEETS_CLIENT_EMAIL and RUN_OF_SHOW_SHEETS_PRIVATE_KEY",
  );
}

export function runOfShowSpreadsheetId(): string {
  const id = env.RUN_OF_SHOW_SHEET;
  if (!id) throw new Error("RUN_OF_SHOW_SHEET is not set");
  return id;
}

/** Link organizers use to edit the sheet (never shown to sponsors). */
export function runOfShowSheetUrl(): string | null {
  const id = env.RUN_OF_SHOW_SHEET;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

export async function getRunOfShowSheetsClient() {
  const { email, key } = runOfShowCredentials();
  const auth = new google.auth.JWT({ email, key, scopes: [READONLY_SCOPE] });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export const RUN_OF_SHOW_TAB = "RUN OF SHOW";
export const COFFEE_CHATS_TAB = "Coffee Chats";

/** One read of the sheet, parsed. Sponsor names are matched per request. */
export type RunOfShowSnapshot = ParsedRunOfShow & { readAt: string };

type SheetData = sheets_v4.Schema$Sheet;

function gridOf(sheet: SheetData | undefined): SheetGrid {
  const grid: SheetGrid = [];
  for (const data of sheet?.data ?? []) {
    const startRow = data.startRow ?? 0;
    const startCol = data.startColumn ?? 0;
    (data.rowData ?? []).forEach((row, i) => {
      const out = (grid[startRow + i] ??= []);
      (row.values ?? []).forEach((value, j) => {
        out[startCol + j] = value.formattedValue ?? "";
      });
    });
  }
  return Array.from(grid, (row) => Array.from(row ?? [], (c) => c ?? ""));
}

function mergesOf(sheet: SheetData | undefined): SheetMerge[] {
  return (sheet?.merges ?? []).map((m) => ({
    startRow: m.startRowIndex ?? 0,
    endRow: m.endRowIndex ?? 0,
    startCol: m.startColumnIndex ?? 0,
    endCol: m.endColumnIndex ?? 0,
  }));
}

/** Read both tabs (cells + merges) in one request and parse them. Uncached. */
export async function fetchRunOfShow(): Promise<RunOfShowSnapshot> {
  const sheets = await getRunOfShowSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: runOfShowSpreadsheetId(),
    ranges: [`'${RUN_OF_SHOW_TAB}'!A1:J200`, `'${COFFEE_CHATS_TAB}'!A1:Z100`],
    fields:
      "sheets(properties(title),merges,data(startRow,startColumn,rowData(values(formattedValue))))",
  });
  const byTitle = (title: string) => {
    const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
    if (!sheet) throw new Error(`Run-of-show sheet has no "${title}" tab`);
    return sheet;
  };
  const ros = byTitle(RUN_OF_SHOW_TAB);
  const { items, tasks } = parseRunOfShowTab(gridOf(ros), mergesOf(ros));
  const coffeeChats = parseCoffeeChatsTab(gridOf(byTitle(COFFEE_CHATS_TAB)));
  return { readAt: new Date().toISOString(), items, tasks, coffeeChats };
}

export const RUN_OF_SHOW_CACHE_MS = 60_000;

/**
 * Wrap a loader in a TTL cache: one value for `ttlMs`, and callers during a
 * load share the same promise. A failed load is not cached.
 */
export function createCachedLoader<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): { get: () => Promise<T>; clear: () => void } {
  let cached: { value: T; expiresAt: number } | null = null;
  let inFlight: Promise<T> | null = null;
  return {
    get() {
      if (cached && now() < cached.expiresAt) return Promise.resolve(cached.value);
      inFlight ??= load()
        .then((value) => {
          cached = { value, expiresAt: now() + ttlMs };
          return value;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    clear() {
      cached = null;
    },
  };
}

const runOfShowCache = createCachedLoader(fetchRunOfShow, RUN_OF_SHOW_CACHE_MS);

/** The parsed sheet, re-read at most once a minute. */
export function getRunOfShow(): Promise<RunOfShowSnapshot> {
  return runOfShowCache.get();
}
