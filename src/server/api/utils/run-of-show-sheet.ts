import { google } from "googleapis";
import { env } from "~/env";

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
