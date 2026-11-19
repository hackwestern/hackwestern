import { createCachedLoader } from "~/server/api/utils/run-of-show-sheet";
import {
  HW_CONTACTS_TAB,
  cell,
  getSheetsClient,
  getSpreadsheetId,
  type SheetsClient,
} from "~/server/api/utils/sponsor-sheets";

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

/**
 * How long an HW Contacts read is reused. My sponsors polls every 15 s per
 * organizer and the portal's Help reads phones on open, so without this
 * every poll was a sheet read.
 */
export const HW_CONTACTS_CACHE_MS = 90_000;

/** A cached read's value, and whether it's the last good one after a failure. */
export type LastGood<T> = { value: T; stale: boolean };

/**
 * A TTL-cached sheet read (createCachedLoader) that keeps the last good
 * value when a read fails, instead of returning nothing. Null only when no
 * read has ever worked. After a failure it waits a TTL before trying again,
 * so a broken sheet isn't hit on every poll either.
 */
export function createLastGoodLoader<T>(
  label: string,
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): { get: () => Promise<LastGood<T> | null>; clear: () => void } {
  const cache = createCachedLoader(load, ttlMs, now);
  let lastGood: { value: T } | null = null;
  let failedUntil = 0;
  return {
    async get() {
      if (now() < failedUntil) {
        return lastGood ? { value: lastGood.value, stale: true } : null;
      }
      try {
        const value = await cache.get();
        lastGood = { value };
        return { value, stale: false };
      } catch (error) {
        console.warn(`Could not read ${label}:`, error);
        failedUntil = now() + ttlMs;
        return lastGood ? { value: lastGood.value, stale: true } : null;
      }
    },
    clear() {
      cache.clear();
      lastGood = null;
      failedUntil = 0;
    },
  };
}

/** One read of HW Contacts' Name and Phone columns. Throws if it fails. */
async function readHwContactPhones(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
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
  return map;
}

export const hwContactPhonesCache = createLastGoodLoader(
  "HW contacts tab (phones)",
  readHwContactPhones,
  HW_CONTACTS_CACHE_MS,
);

/**
 * Every HW team member's phone number, keyed by normalized name. Read from
 * the "HW Contacts" tab of the judging spreadsheet (source of truth),
 * cached for HW_CONTACTS_CACHE_MS. A failed read keeps the last good map;
 * empty only if the tab has never been read, so the portal can still
 * render (it shows "Number not available").
 */
export async function fetchHwContactPhones(): Promise<Map<string, string>> {
  return (await hwContactPhonesCache.get())?.value ?? new Map();
}

/**
 * Display names from the "HW Contacts" tab, in sheet order, for the HW
 * Contact dropdown on the sponsor info tab.
 */
export async function fetchHwContactNames(
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

/** One HW Contacts row: name, phone and the person's sign-in email. */
export type HwContact = { name: string; phone: string; loginEmail: string };

/**
 * Pick the Name, Phone and "Login email" columns from HW Contacts' header
 * row (any order). Null when the row isn't a header.
 */
export function hwContactColumns(
  header: readonly unknown[],
): { name: number; phone: number; loginEmail: number } | null {
  const cells = header.map((c) =>
    String(c ?? "")
      .trim()
      .toLowerCase(),
  );
  const name = cells.indexOf("name");
  if (name === -1) return null;
  return {
    name,
    phone: cells.findIndex((c) => c.includes("phone")),
    loginEmail: cells.findIndex(
      (c) => c.includes("login") && c.includes("email"),
    ),
  };
}

/** HW Contacts rows from sheet values (header within the first 3 rows). */
export function parseHwContacts(
  rows: readonly (readonly unknown[])[],
): HwContact[] {
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const cols = hwContactColumns(rows[i] ?? []);
    if (!cols) continue;
    const at = (row: readonly unknown[], idx: number) =>
      idx === -1
        ? ""
        : String(row[idx] ?? "")
            .replace(/\p{Cf}/gu, "")
            .trim();
    return rows
      .slice(i + 1)
      .map((row) => ({
        name: at(row, cols.name).replace(/\s+/g, " "),
        phone: normalizePhoneNumber(at(row, cols.phone)),
        loginEmail: at(row, cols.loginEmail),
      }))
      .filter((c) => c.name && c.name.toLowerCase() !== "name");
  }
  return [];
}

/** One read of every HW Contacts row. Throws if it fails. */
async function readHwContacts(): Promise<HwContact[]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${HW_CONTACTS_TAB}!A:F`,
  });
  return parseHwContacts(res.data.values ?? []);
}

export const hwContactsCache = createLastGoodLoader(
  "HW contacts tab",
  readHwContacts,
  HW_CONTACTS_CACHE_MS,
);

/**
 * Every HW Contacts row with its "Login email" (the sign-in email that
 * matches an organizer to the sponsors they lead, decisions 2026-11-19),
 * cached for HW_CONTACTS_CACHE_MS. The emails and phones live only in the
 * private sheet. A failed read keeps the last good rows (stale: true); null
 * when the tab has never been read, so the page can say so instead of
 * quietly showing All sponsors.
 */
export function fetchHwContacts(): Promise<LastGood<HwContact[]> | null> {
  return hwContactsCache.get();
}
