// src/server/api/utils/results-sheet-client.ts
//
// The judging results export's own Google Sheets login, separate from the
// sponsor / run-of-show client (getSheetsClient in sponsor-sheets.ts), so the
// results sheet can be written without opening up writes to those sheets.
//
// Credentials: JUDGING_RESULTS_CLIENT_EMAIL + _PRIVATE_KEY, or, when
// those aren't set, the SPONSOR_SHEETS_* service account. Whichever is used
// must be an Editor on JUDGING_RESULTS_SHEET.
import { google, type sheets_v4 } from "googleapis";

import { env } from "~/env";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";

export type ResultsSheetsClient = sheets_v4.Sheets;

/** Undo .env escaping: surrounding quotes and literal "\n" line breaks. */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  return raw
    ?.trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\n/g, "\n");
}

/** Stray spaces or quotes (e.g. pasted from the key's JSON file). */
const normalizeEmail = (raw: string | undefined) =>
  raw?.trim().replace(/^"+|"+$/g, "") ?? "";

/** The service account the results export signs in as. */
export function resultsSheetCredentials(): { email: string; key: string } {
  const ownEmail = normalizeEmail(env.JUDGING_RESULTS_CLIENT_EMAIL);
  const ownKey = normalizePrivateKey(env.JUDGING_RESULTS_PRIVATE_KEY);
  if (ownEmail && ownKey) return { email: ownEmail, key: ownKey };

  const email = normalizeEmail(env.SPONSOR_SHEETS_CLIENT_EMAIL);
  const key = normalizePrivateKey(env.SPONSOR_SHEETS_PRIVATE_KEY);
  if (email && key) return { email, key };

  throw new Error(
    "Results sheet login is not configured: set JUDGING_RESULTS_CLIENT_EMAIL and JUDGING_RESULTS_PRIVATE_KEY",
  );
}

/**
 * Whether this server may write the results sheet: wherever sheet writes are
 * on in general (production, or SHEET_WRITES=1), or with
 * JUDGING_RESULTS_SHEET_WRITES=1, which turns on this sheet alone.
 * SHEET_WRITES=0 turns it off everywhere; never in tests.
 */
export function resultsSheetWritesEnabled(): boolean {
  if (process.env.VITEST) return false;
  if (env.SHEET_WRITES === "0") return false;
  return sheetWritesEnabled() || env.JUDGING_RESULTS_SHEET_WRITES === "1";
}

/**
 * A Sheets client for the results sheet. Read-write only when
 * resultsSheetWritesEnabled(); otherwise read-only, so a write fails at
 * Google instead of landing on the sheet.
 */
export async function getResultsSheetsClient(): Promise<ResultsSheetsClient> {
  const { email, key } = resultsSheetCredentials();
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      resultsSheetWritesEnabled()
        ? "https://www.googleapis.com/auth/spreadsheets"
        : "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}
