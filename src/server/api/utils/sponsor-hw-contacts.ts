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
 * Every HW team member's phone number, keyed by normalized name. Read from
 * the "HW Contacts" tab of the judging spreadsheet (source of truth);
 * empty map if the tab is missing so the portal can still render.
 */
export async function fetchHwContactPhones(): Promise<Map<string, string>> {
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
