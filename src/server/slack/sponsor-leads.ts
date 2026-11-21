import { env } from "~/env";
import { contactRowsNamed } from "~/lib/sponsor-organizer";
import { sponsorNameKey } from "~/lib/sponsor-prize-tracks";
import {
  fetchHwContacts,
  type HwContact,
} from "~/server/api/utils/sponsor-hw-contacts";
import {
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
  type SponsorInfoRecord,
} from "~/server/api/utils/sponsor-sheets";

/**
 * Shared by the two Slack features for a sponsor's HW lead: the change feed
 * (sponsor-lead-feed.ts) and the action-item pings (sponsor-lead-pings.ts).
 * The lead is Sponsor Day-Of's "HW lead" cell, matched to HW Contacts rows
 * the way My sponsors matches it (contactRowsNamed), and DM'd at that
 * row's "Login email". docs/decisions.md 2026-11-21.
 */

/** "live" sends, "dry" logs what would be sent, "off" does nothing. */
export type LeadSlackMode = "off" | "dry" | "live";

/** "1"/"live" -> live, "dry"/"dry-run" -> dry, anything else -> off. */
export function parseLeadSlackMode(raw: string | undefined): LeadSlackMode {
  const v = raw?.trim().toLowerCase();
  if (v === "1" || v === "live") return "live";
  if (v === "dry" || v === "dry-run") return "dry";
  return "off";
}

/** SPONSOR_LEAD_FEED; always off in tests (they pass deps instead). */
export function feedMode(): LeadSlackMode {
  if (process.env.VITEST) return "off";
  return parseLeadSlackMode(
    process.env.SPONSOR_LEAD_FEED ?? env.SPONSOR_LEAD_FEED,
  );
}

/** SPONSOR_LEAD_PINGS; always off in tests (they pass deps instead). */
export function pingsMode(): LeadSlackMode {
  if (process.env.VITEST) return "off";
  return parseLeadSlackMode(
    process.env.SPONSOR_LEAD_PINGS ?? env.SPONSOR_LEAD_PINGS,
  );
}

/** One HW lead to DM: their HW Contacts row, name and sign-in email. */
export type LeadTarget = { row: number; name: string; email: string };

/**
 * The HW Contacts rows a sponsor's "HW lead" cell names ("Noah / Daniel"
 * is two), with the row's Login email. A row without an email can't be
 * DM'd and is left out (it shows in `unmatched` callers report).
 */
export function leadsFor(
  hwLeadCell: string | null | undefined,
  contacts: readonly HwContact[],
): LeadTarget[] {
  const rows = contactRowsNamed(
    hwLeadCell,
    contacts.map((c) => c.name),
  );
  return [...rows]
    .sort((a, b) => a - b)
    .flatMap((row) => {
      const c = contacts[row];
      const email = c?.loginEmail.trim();
      return c && email ? [{ row, name: c.name, email }] : [];
    });
}

/**
 * The signed-in organizer's own HW Contacts row (Login email,
 * case-insensitive), ignoring "Same view as": someone sharing Noah's view
 * who changes Noah's sponsor is not Noah. Null when nobody matches.
 */
export function ownContactRow(
  email: string | null | undefined,
  contacts: readonly Pick<HwContact, "loginEmail" | "name">[],
): number | null {
  const want = (email ?? "").trim().toLowerCase();
  if (!want) return null;
  const i = contacts.findIndex(
    (c) => c.loginEmail.trim().toLowerCase() === want && c.name.trim(),
  );
  return i === -1 ? null : i;
}

/** A name's first word, for "(by Caroline)". */
export const firstName = (name: string | null | undefined) =>
  (name ?? "").trim().split(/\s+/)[0] ?? "";

export type LeadDirectory = {
  contacts: HwContact[];
  /** Sponsor Day-Of info by sponsorNameKey (loose: "QNX (BlackBerry)" = "QNX"). */
  info: Map<string, SponsorInfoRecord>;
};

/** A sponsor's Sponsor Day-Of row by its registered name, matched loosely. */
export function infoOf(
  dir: Pick<LeadDirectory, "info">,
  sponsorName: string,
): SponsorInfoRecord | null {
  return dir.info.get(sponsorNameKey(sponsorName)) ?? null;
}

/**
 * HW Contacts and Sponsor Day-Of, both cached reads. Null when either
 * can't be read: callers then do nothing (never guess a recipient, never
 * cancel pings over a sheet hiccup).
 */
export async function loadLeadDirectory(): Promise<LeadDirectory | null> {
  try {
    const [contacts, info] = await Promise.all([
      fetchHwContacts(),
      getSheetsClient().then((sheets) =>
        fetchAllSponsorInfo(sheets, getSpreadsheetId(), { strict: true }),
      ),
    ]);
    if (!contacts || info.size === 0) return null;
    const byKey = new Map<string, SponsorInfoRecord>();
    for (const [name, record] of info) {
      const key = sponsorNameKey(name);
      if (!byKey.has(key)) byKey.set(key, record);
    }
    return { contacts: contacts.value, info: byKey };
  } catch (error) {
    console.error(
      "sponsor lead slack: couldn't read HW Contacts or Sponsor Day-Of:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
