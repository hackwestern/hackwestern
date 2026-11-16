import { TRPCError } from "@trpc/server";

import {
  cell,
  findTabTitle,
  getSheetsClient,
} from "~/server/api/utils/sponsor-sheets";
import { env } from "~/env";

type InterestRow = {
  email: string;
  name: string;
  resumeUrl: string;
  extraLink: string;
  rank: number | null;
};

function normalized(value: string): string {
  return value
    .replace(/\p{Cf}/gu, "")
    .trim()
    .toLowerCase();
}

function columnIndex(
  headers: readonly string[],
  predicate: (header: string) => boolean,
): number {
  return headers.findIndex((header) => predicate(normalized(header)));
}

function sponsorInterestColumn(
  headers: readonly string[],
  sponsorName: string,
): number {
  const sponsor = normalized(sponsorName);
  return headers.findIndex((header) => {
    const value = normalized(header);
    const bracketed = value.match(/\[([^\]]+)\]\s*$/)?.[1];
    return (
      Boolean(bracketed && normalized(bracketed) === sponsor) ||
      (value.includes("interested") && value.includes(sponsor))
    );
  });
}

function parseRank(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const rank = Number(match[0]);
  return Number.isFinite(rank) ? rank : null;
}

export async function fetchHackerInterestRows(
  sponsorName: string,
): Promise<InterestRow[]> {
  const spreadsheetId = env.HACKER_INTEREST_FORM;
  if (!spreadsheetId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "HACKER_INTEREST_FORM env variable is not set",
    });
  }

  const sheets = await getSheetsClient();
  const configuredTab = env.HACKER_INTEREST_FORM_TAB ?? "Form responses 1";
  const tabName = await findTabTitle(
    sheets,
    spreadsheetId,
    configuredTab.trim().toLowerCase(),
  );
  if (!tabName) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Interest form tab "${configuredTab}" was not found`,
    });
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName.replaceAll("'", "''")}'!A1:Z`,
  });
  const rows = response.data.values ?? [];
  const headers = (rows[0] ?? []).map(String);
  const emailCol = columnIndex(headers, (header) => header === "email address");
  const nameCol = columnIndex(headers, (header) => header === "full name");
  const resumeCol = columnIndex(headers, (header) => header.includes("resume"));
  const extraLinkCol = columnIndex(
    headers,
    (header) => header.includes("link") && !header.includes("resume"),
  );
  const interestCol = sponsorInterestColumn(headers, sponsorName);

  if (emailCol < 0 || nameCol < 0 || resumeCol < 0 || interestCol < 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Interest form is missing a required column for ${sponsorName}`,
    });
  }

  return rows.slice(1).flatMap((row): InterestRow[] => {
    const interest = cell(row, interestCol);
    const email = normalized(cell(row, emailCol));
    const name = cell(row, nameCol);
    if (!interest || !email || !name) return [];

    return [
      {
        email,
        name,
        resumeUrl: cell(row, resumeCol),
        extraLink: extraLinkCol >= 0 ? cell(row, extraLinkCol) : "",
        rank: parseRank(interest),
      },
    ];
  });
}
