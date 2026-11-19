import { type SponsorStatus } from "~/lib/sponsor-status";
import {
  SPONSOR_INFO_TAB_NAMES,
  fetchSponsorDayOfTab,
  sponsorDayOfRows,
  type SheetsClient,
  type SponsorDayOfTab,
} from "~/server/api/utils/sponsor-sheets";

// Sponsor Status was merged into Sponsor Day-Of on 2026-11-19: status,
// booth, workshop room and time, judging room and track filter are Sponsor
// Day-Of columns now, found by header name. The old tab is no longer
// written (or created).
export { SPONSOR_INFO_TAB_NAMES };

/** 1-based column number -> A1-notation letters (1 -> "A", 27 -> "AA"). */
export function columnLetter(columnNumber: number): string {
  let n = columnNumber;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * The A1 cell holding a sponsor's Status on Sponsor Day-Of, matched by name
 * (case and outer spaces ignored); "no-column" when the tab has no Status
 * column, "not-found" when the sponsor has no row.
 */
export function sponsorStatusCell(
  dayOf: SponsorDayOfTab,
  sponsorName: string,
): SponsorStatusWrite {
  if (dayOf.cols.status === -1) return { ok: false, reason: "no-column" };
  const target = sponsorName.trim().toLowerCase();
  const hit = sponsorDayOfRows(dayOf).find(
    (r) => r.name.toLowerCase() === target,
  );
  if (!hit) return { ok: false, reason: "not-found" };
  const range = `'${dayOf.tab.replace(/'/g, "''")}'!${columnLetter(dayOf.cols.status + 1)}${hit.sheetRow}`;
  return { ok: true, range };
}

export type SponsorStatusWrite =
  | { ok: true; range: string }
  | { ok: false; reason: "no-tab" | "no-column" | "not-found" };

/**
 * Write a sponsor's Status into its Sponsor Day-Of row. Never adds a row:
 * Sponsor Day-Of is the sponsor list, so a sponsor missing from it is
 * "not-found". The client decides whether the write can land
 * (getSheetsClient is read-only unless sheetWritesEnabled()).
 */
export async function writeSponsorStatus(
  sheets: SheetsClient,
  spreadsheetId: string,
  sponsorName: string,
  status: SponsorStatus,
): Promise<SponsorStatusWrite> {
  const dayOf = await fetchSponsorDayOfTab(sheets, spreadsheetId);
  if (!dayOf) return { ok: false, reason: "no-tab" };
  const target = sponsorStatusCell(dayOf, sponsorName);
  if (!target.ok) return target;
  const { range } = target;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { majorDimension: "ROWS", values: [[status]] },
  });
  return { ok: true, range };
}
