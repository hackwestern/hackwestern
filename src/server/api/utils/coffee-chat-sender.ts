/**
 * Who may press Send on the organizer coffee chat board: only Noah Medland
 * (docs/decisions.md 2026-11-19, Q1-Q11). He's matched the way "My sponsors"
 * matches organizers: the signed-in user's email against the HW Contacts tab's
 * "Login email" column (case-insensitive), on the row named Noah Medland.
 * The email lives only in the private sheet, never in the repo. If the tab
 * can't be read, or that row has no login email, nobody can send.
 */
import { normalizePersonName } from "~/server/api/utils/sponsor-hw-contacts";
import {
  HW_CONTACTS_TAB,
  cell,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";

/** The one person who sends the confirmed schedule (HW Contacts "Name"). */
export const COFFEE_SENDER_NAME = "Noah Medland";

/**
 * Can this user send? `reason` says why not: "notSender" (signed in as
 * someone else), "noLoginEmail" (Noah's row or its Login email is missing),
 * "sheetUnreadable" (HW Contacts couldn't be read).
 */
export type SenderCheck =
  | { canSend: true; reason: null }
  | { canSend: false; reason: "notSender" | "noLoginEmail" | "sheetUnreadable" };

const normEmail = (v: string) => v.replace(/\p{Cf}/gu, "").trim().toLowerCase();

/**
 * The sender's login email from HW Contacts rows (A1 down), or null. The
 * header row is found by its "Name" and "Login email" cells in the first
 * three rows, so moving columns doesn't break it. Pure, for tests.
 */
export function senderLoginEmail(rows: readonly (readonly unknown[])[]): string | null {
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const head = (rows[i] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
    const nameCol = head.indexOf("name");
    const emailCol = head.indexOf("login email");
    if (nameCol === -1 || emailCol === -1) continue;
    const want = normalizePersonName(COFFEE_SENDER_NAME);
    for (const row of rows.slice(i + 1)) {
      const r = row.map((c) => String(c ?? ""));
      if (normalizePersonName(cell(r, nameCol)) !== want) continue;
      const email = normEmail(cell(r, emailCol));
      return email.includes("@") ? email : null;
    }
    return null;
  }
  return null;
}

/**
 * Noah's login email from HW Contacts: an email, null (none in the sheet),
 * or "unreadable" when the sheet can't be read. ("unreadable" is a plain
 * string, so the type is just string | null.)
 */
type SenderEmail = string | null;

/** The check for a signed-in email against the sender's login email. */
export function senderCheckOf(
  userEmail: string | null | undefined,
  sender: SenderEmail,
): SenderCheck {
  if (sender === "unreadable") return { canSend: false, reason: "sheetUnreadable" };
  if (!sender) return { canSend: false, reason: "noLoginEmail" };
  return userEmail && normEmail(userEmail) === sender
    ? { canSend: true, reason: null }
    : { canSend: false, reason: "notSender" };
}

async function readSenderEmail(): Promise<SenderEmail> {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${HW_CONTACTS_TAB}'!A1:Z`,
    });
    return senderLoginEmail(res.data.values ?? []);
  } catch (error) {
    console.error("coffee chat send: HW Contacts read failed", error);
    return "unreadable";
  }
}

// The board polls every 15 s per organizer: cache the read so the sheet
// isn't hit that often. Send itself always reads fresh.
const CACHE_MS = 60_000;
const FAIL_CACHE_MS = 15_000;
let cached: { at: number; value: SenderEmail } | null = null;

/**
 * May this user press Send? `fresh` skips the cache (Send itself uses it,
 * so a change in the sheet takes effect right away).
 */
export async function checkCoffeeSender(
  userEmail: string | null | undefined,
  opts: { fresh?: boolean } = {},
): Promise<SenderCheck> {
  const now = Date.now();
  const ttl = cached?.value === "unreadable" ? FAIL_CACHE_MS : CACHE_MS;
  if (opts.fresh === true || !cached || now - cached.at > ttl) {
    cached = { at: now, value: await readSenderEmail() };
  }
  return senderCheckOf(userEmail, cached.value);
}
