import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import {
  cell,
  findTabTitle,
  getSheetsClient,
} from "~/server/api/utils/sponsor-sheets";
import { env } from "~/env";
import { admittedStatuses } from "~/lib/admission";
import { db } from "~/server/db";
import { applications, reviews, users } from "~/server/db/schema";

/** How many interested hackers a sponsor sees, best application first. */
export const INTERESTED_HACKER_LIMIT = 40;

export type InterestRow = {
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
  const tabName = await findTabTitle(sheets, spreadsheetId, "form responses 1");
  if (!tabName) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: 'Interest form tab "Form responses 1" was not found',
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

/** One completed review of an applicant, keyed by the applicant's email. */
export type ScoredReview = {
  email: string;
  originalityRating: number | null;
  technicalityRating: number | null;
  passionRating: number | null;
};

/** An interest form row that made the sponsor's list, best first. */
export type RankedInterestRow = {
  /** Lowercased; server-side only, never sent to sponsors. */
  email: string;
  name: string;
  resumeUrl: string;
  extraLink: string;
  /** Where the hacker put this sponsor on the form (1-3). */
  pick: number;
};

/**
 * Hackers who put the sponsor in their top 3 on the interest form and have
 * at least one completed review, by average review score (ties by name),
 * capped at `limit` (null for no cap). One row per email (the first form
 * response wins). Pass only admitted hackers' reviews, so the cap counts
 * admitted hackers. With prioritizePick, include unreviewed respondents and
 * order by sponsor preference before review score.
 */
export function rankInterestRows(
  interestRows: readonly InterestRow[],
  scoredReviews: readonly ScoredReview[],
  limit: number | null = INTERESTED_HACKER_LIMIT,
  prioritizePick = false,
): RankedInterestRow[] {
  const interestedEmails = new Set(interestRows.map((row) => row.email));
  const scores = new Map<string, number>();
  const reviewCounts = new Map<string, number>();
  for (const row of scoredReviews) {
    const email = row.email.trim().toLowerCase();
    if (!interestedEmails.has(email)) continue;
    scores.set(
      email,
      (scores.get(email) ?? 0) +
        (row.originalityRating ?? 0) +
        (row.technicalityRating ?? 0) +
        (row.passionRating ?? 0),
    );
    reviewCounts.set(email, (reviewCounts.get(email) ?? 0) + 1);
  }

  const firstByEmail = new Map<string, InterestRow>();
  for (const row of interestRows) {
    if (!firstByEmail.has(row.email)) firstByEmail.set(row.email, row);
  }

  const ranked = [...firstByEmail.values()]
    .flatMap((row) =>
      row.rank !== null &&
      row.rank <= 3 &&
      (prioritizePick || scores.has(row.email))
        ? [
            {
              email: row.email,
              name: row.name.trim(),
              resumeUrl: row.resumeUrl,
              extraLink: row.extraLink,
              pick: row.rank,
              score:
                (scores.get(row.email) ?? 0) /
                (reviewCounts.get(row.email) ?? 1),
            },
          ]
        : [],
    )
    .sort(
      (a, b) =>
        (prioritizePick ? a.pick - b.pick : 0) ||
        b.score - a.score ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .map(({ score: _score, ...row }) => row);
  return limit === null ? ranked : ranked.slice(0, limit);
}

/**
 * Completed reviews of admitted hackers (accepted or confirmed, per
 * src/lib/admission.ts), with each applicant's email.
 */
export async function fetchAdmittedScoredReviews(
  now = Date.now(),
): Promise<ScoredReview[]> {
  return db
    .select({
      email: users.email,
      originalityRating: reviews.originalityRating,
      technicalityRating: reviews.technicalityRating,
      passionRating: reviews.passionRating,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .innerJoin(reviews, eq(reviews.applicantUserId, applications.userId))
    .where(
      and(
        eq(reviews.completed, true),
        inArray(applications.status, [...admittedStatuses(now)]),
      ),
    );
}

/**
 * The sponsor's interested admitted hackers from the interest form, best
 * first, capped at `limit` (null for no cap) after leaving out anyone not
 * admitted. Throws when the form isn't configured or can't be read.
 */
export async function fetchRankedInterestRows(
  sponsorName: string,
  {
    limit = INTERESTED_HACKER_LIMIT,
    now = Date.now(),
    prioritizePick = false,
  }: { limit?: number | null; now?: number; prioritizePick?: boolean } = {},
): Promise<RankedInterestRow[]> {
  const [interestRows, scoredReviews] = await Promise.all([
    fetchHackerInterestRows(sponsorName),
    fetchAdmittedScoredReviews(now),
  ]);
  return rankInterestRows(interestRows, scoredReviews, limit, prioritizePick);
}
