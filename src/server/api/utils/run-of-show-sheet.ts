import { google, type sheets_v4 } from "googleapis";
import { env } from "~/env";
import {
  parseCeremoniesTab,
  parseCoffeeChatsTab,
  parseRunOfShowTab,
  parseWorkshopsTab,
  type ParsedRunOfShow,
  type SheetGrid,
  type SheetMerge,
} from "~/server/api/utils/run-of-show-parse";
import {
  parseSponAvailability,
  runOfShowColumns,
} from "~/server/api/utils/spon-availability-parse";
import type { SponAvailability } from "~/lib/spon-availability";
import { TASK_PINGS_ENABLED } from "~/lib/task-pings";

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

/**
 * Whether this server may write to the Google Sheets. The service account
 * is Editor on the live run-of-show sheet, so only production writes, or a
 * dev server started with SHEET_WRITES=1. Never under Vitest, whatever the
 * env says: a test that needs a write mocks this function and the network.
 */
export function sheetWritesEnabled(): boolean {
  if (process.env.VITEST) return false;
  return env.NODE_ENV === "production" || env.SHEET_WRITES === "1";
}

/**
 * Throw before any Sheets write call when sheetWritesEnabled() is false.
 * The read-only scope on getSheetsClient is a second line of defence, not
 * the gate: every util that calls values.update / values.append /
 * values.clear / batchUpdate checks this (or sheetWritesEnabled) first.
 */
export function assertSheetWritesEnabled(what: string): void {
  if (!sheetWritesEnabled()) {
    throw new Error(
      `${what}: not written (sheet writes off; set SHEET_WRITES=1 to write)`,
    );
  }
}

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
// "Coffee Chats" was merged into "Coffee Chat Setup" on 2026-11-19 (same
// header names in row 1, plus Status and sponsor contact columns).
export const COFFEE_CHATS_TAB = "Coffee Chat Setup";
export const CEREMONIES_TAB = "Opening + Closing Ceremonies";
export const WORKSHOPS_TAB = "Workshops";

/**
 * One read of the sheet, parsed. Sponsor names are matched per request.
 * `availability` is the sponsor team's own, for organizers only.
 */
export type RunOfShowSnapshot = ParsedRunOfShow & {
  readAt: string;
  availability: SponAvailability;
};

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

/**
 * Read every tab (cells + merges) in one request and parse them. Uncached.
 * RUN OF SHOW and Coffee Chat Setup are required; the ceremonies and workshops
 * tabs are optional (missing or unreadable -> empty lists).
 */
const REQUIRED_RANGES = [
  `'${RUN_OF_SHOW_TAB}'!A1:X200`,
  `'${COFFEE_CHATS_TAB}'!A1:Z100`,
];
const OPTIONAL_RANGES = [
  `'${CEREMONIES_TAB}'!A1:J100`,
  `'${WORKSHOPS_TAB}'!A1:J100`,
];
const SHEET_FIELDS =
  "sheets(properties(title),merges,data(startRow,startColumn,rowData(values(formattedValue))))";

/** The Sheets API rejects the whole request when a range names a missing tab. */
export function isMissingRangeError(error: unknown): boolean {
  const e = error as { code?: unknown; status?: unknown; message?: unknown };
  const status = e?.code ?? e?.status;
  return (
    (status === 400 || status === "400") &&
    /unable to parse range/i.test(String(e?.message ?? ""))
  );
}

export async function fetchRunOfShow(): Promise<RunOfShowSnapshot> {
  const sheets = await getRunOfShowSheetsClient();
  const read = (ranges: string[]) =>
    sheets.spreadsheets.get({
      spreadsheetId: runOfShowSpreadsheetId(),
      ranges,
      fields: SHEET_FIELDS,
    });
  // One request normally. If an optional tab was renamed or deleted, read
  // just the required tabs; their own absence still fails below.
  const res = await read([...REQUIRED_RANGES, ...OPTIONAL_RANGES]).catch(
    (error: unknown) => {
      if (!isMissingRangeError(error)) throw error;
      return read(REQUIRED_RANGES);
    },
  );
  const find = (title: string) =>
    res.data.sheets?.find((s) => s.properties?.title === title);
  const byTitle = (title: string) => {
    const sheet = find(title);
    if (!sheet) throw new Error(`Run-of-show sheet has no "${title}" tab`);
    return sheet;
  };
  const ros = byTitle(RUN_OF_SHOW_TAB);
  const rosGrid = gridOf(ros);
  const main = runOfShowColumns(rosGrid, mergesOf(ros));
  const { items, tasks } = parseRunOfShowTab(main.grid, main.merges);
  const coffeeChats = parseCoffeeChatsTab(gridOf(byTitle(COFFEE_CHATS_TAB)));
  const ceremonies = parseCeremoniesTab(gridOf(find(CEREMONIES_TAB)));
  const workshops = parseWorkshopsTab(gridOf(find(WORKSHOPS_TAB)));
  return {
    readAt: new Date().toISOString(),
    items,
    tasks,
    coffeeChats,
    ceremonies,
    workshops,
    availability: parseSponAvailability(rosGrid),
  };
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
      if (cached && now() < cached.expiresAt)
        return Promise.resolve(cached.value);
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

/**
 * After a fresh read, keep the task reminders in step with the sheet (T49).
 * Not awaited, so the request never waits; skipped when Slack isn't set up
 * or task pings are switched off (TASK_PINGS_ENABLED).
 * Imported lazily: task-reminders imports this module.
 */
function afterRunOfShowFetch(snapshot: RunOfShowSnapshot): void {
  if (!TASK_PINGS_ENABLED || !env.SLACK_BOT_TOKEN) return;
  void import("~/server/api/utils/task-reminders")
    .then((m) => m.maybeAutoSyncTaskReminders(snapshot))
    .catch((error: unknown) =>
      console.error("task reminders: automatic sync failed", error),
    );
}

const runOfShowCache = createCachedLoader(async () => {
  const snapshot = await fetchRunOfShow();
  afterRunOfShowFetch(snapshot);
  return snapshot;
}, RUN_OF_SHOW_CACHE_MS);

/** The parsed sheet, re-read at most once a minute. */
export function getRunOfShow(): Promise<RunOfShowSnapshot> {
  return runOfShowCache.get();
}
