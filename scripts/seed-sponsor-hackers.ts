/**
 * Seed local data for the sponsor hacker-interest page.
 *
 * Usage:
 *   npm run seed:sponsor-hackers
 *   npm run seed:sponsor-hackers -- --tab "Hacker Interest Test"
 *
 * The duplicated Google Sheets tab must be configured for the app with:
 *   HACKER_INTEREST_FORM_TAB="Hacker Interest Test"
 */
import { eq, inArray } from "drizzle-orm";

import { env } from "~/env";
import { conn, db } from "~/server/db";
import {
  applications,
  reviews,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import { getSheetsClient } from "~/server/api/utils/sponsor-sheets";

const SOURCE_TAB = "Form responses 1";
const DEFAULT_TAB = "Hacker Interest Test";
const SEED_EMAIL_DOMAIN = "sponsor-hackers.hackwestern.test";
const HACKER_COUNT = 150;

type SeedHacker = {
  name: string;
  score: [number, number, number];
  rank: number;
};

const hackers: SeedHacker[] = Array.from(
  { length: HACKER_COUNT },
  (_, index) => {
    const rank = (index % 6) + 1;
    const baseScore = 70 + ((index * 17) % 31);
    return {
      name: `Test Hacker ${String(index + 1).padStart(3, "0")}`,
      score: [
        baseScore,
        Math.max(1, baseScore - (index % 5)),
        Math.max(1, baseScore - ((index + 2) % 5)),
      ],
      rank,
    };
  },
);

function parseArgs(argv: string[]): { tab: string } {
  let tab = DEFAULT_TAB;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--tab") {
      const value = argv[++i];
      if (!value?.trim()) throw new Error("--tab requires a value");
      tab = value.trim();
    } else {
      throw new Error(`Unknown flag: ${flag}`);
    }
  }
  return { tab };
}

function quoteTab(tab: string): string {
  return `'${tab.replaceAll("'", "''")}'`;
}

function columnLetter(columnNumber: number): string {
  let n = columnNumber;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function sponsorNameFromHeader(header: string): string | null {
  return header.match(/\[([^\]]+)\]\s*$/)?.[1]?.trim() ?? null;
}

async function ensureInterestTab(
  tab: string,
): Promise<{ sponsorNames: string[] }> {
  const spreadsheetId = env.HACKER_INTEREST_FORM;
  if (!spreadsheetId) {
    throw new Error("HACKER_INTEREST_FORM is not configured.");
  }

  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)",
  });
  const source = metadata.data.sheets?.find(
    (sheet) =>
      sheet.properties?.title?.trim().toLowerCase() ===
      SOURCE_TAB.toLowerCase(),
  );
  const sourceProperties = source?.properties;
  const sourceSheetId = sourceProperties?.sheetId;
  if (!sourceProperties) {
    throw new Error(`Source tab "${SOURCE_TAB}" was not found.`);
  }
  if (sourceSheetId === undefined || sourceSheetId === null) {
    throw new Error(`Source tab "${SOURCE_TAB}" was not found.`);
  }

  const sourceTabName = sourceProperties.title ?? SOURCE_TAB;
  const sourceHeaderResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteTab(sourceTabName)}!1:1`,
  });
  const headers = (sourceHeaderResponse.data.values?.[0] ?? []).map(String);
  const sponsorNames = headers.flatMap((header) => {
    const sponsorName = sponsorNameFromHeader(header);
    return sponsorName ? [sponsorName] : [];
  });
  if (sponsorNames.length === 0) {
    throw new Error(`No sponsor columns found in "${SOURCE_TAB}".`);
  }

  const existing = metadata.data.sheets?.find(
    (sheet) =>
      sheet.properties?.title?.trim().toLowerCase() === tab.toLowerCase(),
  );
  const requests: Array<
    | { deleteSheet: { sheetId: number } }
    | {
        duplicateSheet: {
          sourceSheetId: number;
          newSheetName: string;
        };
      }
  > = [];
  const existingSheetId = existing?.properties?.sheetId;
  if (existingSheetId !== undefined && existingSheetId !== null) {
    requests.push({
      deleteSheet: { sheetId: existingSheetId },
    });
  }
  requests.push({
    duplicateSheet: {
      sourceSheetId,
      newSheetName: tab,
    },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  const rows = hackers.map((hacker, index) => {
    const row = Array.from({ length: headers.length }, () => "");
    const email = `${hacker.name.toLowerCase().replaceAll(" ", ".")}@${SEED_EMAIL_DOMAIN}`;
    const setColumn = (
      predicate: (header: string) => boolean,
      value: string,
    ) => {
      const column = headers.findIndex((header) =>
        predicate(header.toLowerCase()),
      );
      if (column >= 0) row[column] = value;
    };

    setColumn(
      (header) => header === "timestamp",
      `11/16/2026 10:${String(index % 60).padStart(2, "0")}:00`,
    );
    setColumn((header) => header === "email address", email);
    setColumn((header) => header === "full name", hacker.name);
    setColumn(
      (header) => header.includes("resume"),
      `https://example.com/resumes/${encodeURIComponent(hacker.name)}.pdf`,
    );
    setColumn(
      (header) => header.includes("link") && !header.includes("resume"),
      index % 2 === 0
        ? `https://example.com/portfolio/${encodeURIComponent(hacker.name)}`
        : "",
    );

    headers.forEach((header, column) => {
      if (sponsorNameFromHeader(header)) {
        row[column] = String(((index + column) % 6) + 1);
      }
    });
    return row;
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteTab(tab)}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteTab(tab)}!A1:${columnLetter(headers.length)}${rows.length + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      majorDimension: "ROWS",
      values: [headers, ...rows],
    },
  });

  return { sponsorNames };
}

async function seedDatabase(
  sponsorNames: string[],
): Promise<Map<string, string>> {
  if (!env.DATABASE_URL.includes("localhost")) {
    throw new Error(
      "This seed script may only run against a localhost database.",
    );
  }

  const reviewerId = crypto.randomUUID();
  const sponsorIds = new Map(
    sponsorNames.map((sponsorName) => [sponsorName, crypto.randomUUID()]),
  );
  const hackerIds = hackers.map(() => crypto.randomUUID());
  const seedEmails = hackers.map(
    (hacker) =>
      `${hacker.name.toLowerCase().replaceAll(" ", ".")}@${SEED_EMAIL_DOMAIN}`,
  );

  await db.transaction(async (tx) => {
    const oldUsers = await tx.query.users.findMany({
      where: inArray(users.email, [
        ...seedEmails,
        `reviewer@${SEED_EMAIL_DOMAIN}`,
      ]),
      columns: { id: true },
    });
    const oldUserIds = oldUsers.map((user) => user.id);
    if (oldUserIds.length > 0) {
      await tx
        .delete(reviews)
        .where(inArray(reviews.applicantUserId, oldUserIds));
      await tx
        .delete(reviews)
        .where(inArray(reviews.reviewerUserId, oldUserIds));
      await tx
        .delete(applications)
        .where(inArray(applications.userId, oldUserIds));
      await tx.delete(users).where(inArray(users.id, oldUserIds));
    }

    await tx
      .delete(sponsorJudgingSponsors)
      .where(inArray(sponsorJudgingSponsors.name, sponsorNames));

    await tx.insert(sponsorJudgingSponsors).values(
      sponsorNames.map((name) => ({
        id: sponsorIds.get(name)!,
        name,
      })),
    );

    await tx.insert(users).values([
      {
        id: reviewerId,
        name: "Sponsor Hacker Seed Reviewer",
        email: `reviewer@${SEED_EMAIL_DOMAIN}`,
        emailVerified: new Date(),
        type: "organizer",
      },
      ...hackers.map((hacker, index) => ({
        id: hackerIds[index]!,
        name: hacker.name,
        email: seedEmails[index]!,
        emailVerified: new Date(),
        type: "hacker" as const,
      })),
    ]);

    await tx.insert(applications).values(
      hackers.map((hacker, index) => ({
        userId: hackerIds[index]!,
        status: "CONFIRMED" as const,
        firstName: hacker.name.split(" ")[0]!,
        lastName: hacker.name.split(" ").slice(1).join(" "),
        agreeCodeOfConduct: true,
        agreeShareWithSponsors: true,
        agreeShareWithMLH: true,
        agreeEmailsFromMLH: true,
        agreeWillBe18: true,
        githubLink: `https://github.com/seed-${index}`,
        linkedInLink: `https://linkedin.com/in/seed-${index}`,
        devpostLink: `https://devpost.com/seed-${index}`,
        resumeLink: `https://example.com/resumes/${encodeURIComponent(hacker.name)}.pdf`,
        otherLink: `https://example.com/portfolio/${encodeURIComponent(hacker.name)}`,
        transportationMethod: "None" as const,
        travelReimbursement: false,
        enrollmentConfirmedAt: new Date(),
      })),
    );

    await tx.insert(reviews).values(
      hackers.map((hacker, index) => ({
        reviewerUserId: reviewerId,
        applicantUserId: hackerIds[index]!,
        originalityRating: hacker.score[0],
        technicalityRating: hacker.score[1],
        passionRating: hacker.score[2],
        comments: "Seeded sponsor-interest test review.",
        completed: true,
        referral: false,
      })),
    );
  });

  return sponsorIds;
}

async function main() {
  const { tab } = parseArgs(process.argv.slice(2));
  const { sponsorNames } = await ensureInterestTab(tab);
  const sponsorIds = await seedDatabase(sponsorNames);

  console.log(
    `Seeded ${hackers.length} hackers for ${sponsorNames.length} sponsors.`,
  );
  for (const sponsorName of sponsorNames) {
    const sponsorId = sponsorIds.get(sponsorName);
    console.log(`${sponsorName}: /sponsors/${sponsorId}/hackers`);
  }
  console.log(`Set HACKER_INTEREST_FORM_TAB="${tab}" before starting the app.`);
}

try {
  await main();
} finally {
  await conn.end();
}
