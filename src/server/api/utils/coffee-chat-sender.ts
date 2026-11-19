/**
 * Who may press Send on the organizer coffee chat board: only Noah Medland,
 * or someone whose HW Contacts "Same view as" names him (docs/decisions.md
 * 2026-11-19, Q1-Q11 and "Jazz sees Noah's view"). He's matched the way "My
 * sponsors" matches organizers: the signed-in user's email against the HW
 * Contacts tab's "Login email" column (case-insensitive), on the row named
 * Noah Medland. The emails live only in the private sheet, never in the
 * repo. If the tab can't be read, or Noah's row has no login email, nobody
 * can send.
 */
import { viewRowOf } from "~/lib/sponsor-organizer";
import {
  normalizePersonName,
  parseHwContacts,
} from "~/server/api/utils/sponsor-hw-contacts";
import {
  HW_CONTACTS_TAB,
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
 * The login emails that may send, from HW Contacts rows (A1 down): Noah's
 * first, then every row whose "Same view as" names Noah (one level, see
 * viewRowOf). Null when there's no Noah row or it has no login email, so
 * nobody can send. The header row is found by its "Name" cell in the first
 * three rows, so moving columns doesn't break it. Pure, for tests.
 */
export function senderLoginEmails(
  rows: readonly (readonly unknown[])[],
): string[] | null {
  const contacts = parseHwContacts(rows);
  const want = normalizePersonName(COFFEE_SENDER_NAME);
  const noah = contacts.findIndex((c) => normalizePersonName(c.name) === want);
  if (noah === -1) return null;
  const email = (i: number) => {
    const e = normEmail(contacts[i]!.loginEmail);
    return e.includes("@") ? e : null;
  };
  const noahEmail = email(noah);
  if (!noahEmail) return null;
  const out = [noahEmail];
  contacts.forEach((_, i) => {
    const e = email(i);
    if (i !== noah && e && !out.includes(e) && viewRowOf(i, contacts) === noah) {
      out.push(e);
    }
  });
  return out;
}

/**
 * The login emails that may send (Noah's first), null (no Noah email in
 * the sheet), or "unreadable" when the sheet can't be read. A single email
 * string is accepted too.
 */
type SenderEmail = string | readonly string[] | null;

/** The check for a signed-in email against the senders' login emails. */
export function senderCheckOf(
  userEmail: string | null | undefined,
  sender: SenderEmail,
): SenderCheck {
  if (sender === "unreadable") return { canSend: false, reason: "sheetUnreadable" };
  const allowed = typeof sender === "string" ? [sender] : (sender ?? []);
  if (!allowed.length) return { canSend: false, reason: "noLoginEmail" };
  return userEmail && allowed.includes(normEmail(userEmail))
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
    return senderLoginEmails(res.data.values ?? []);
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
