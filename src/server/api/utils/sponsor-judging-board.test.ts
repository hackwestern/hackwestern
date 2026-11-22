import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";

import {
  buildJudgingBoard,
  MIN_SPONSOR_PICKS,
} from "~/lib/sponsor-judging-rooms";
import { SPONSOR_FINAL_MIN } from "~/lib/sponsor-scoring";
import {
  clearJudgingSheetCache,
  judgingSheet,
} from "~/server/api/utils/sponsor-judging-board";
import {
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
} from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import { sponsorFinalPicks, sponsorJudgingSponsors } from "~/server/db/schema";

// No Google Sheets here: the Sponsor Info read is stubbed, and the deleted
// "Judging" tab must not be read at all.
vi.mock("~/server/api/utils/sponsor-sheets", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/sponsor-sheets")
  >()),
  getSheetsClient: vi.fn(async () => ({})),
  getSpreadsheetId: vi.fn(() => "sheet"),
  fetchAllSponsorInfo: vi.fn(),
  fetchAllChosenTeams: vi.fn(),
}));
const info = vi.mocked(fetchAllSponsorInfo);
const chosen = vi.mocked(fetchAllChosenTeams);

beforeEach(() => {
  clearJudgingSheetCache();
  info.mockReset().mockResolvedValue(new Map());
  chosen.mockReset();
});

async function sponsor(name: string) {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `${name} ${faker.string.alphanumeric(8)}` })
    .returning();
  return row!;
}

describe("Run-of-show Sponsor track judging panel picks", () => {
  test("the top 3 is the minimum", () => {
    expect(MIN_SPONSOR_PICKS).toBe(SPONSOR_FINAL_MIN);
    expect(MIN_SPONSOR_PICKS).toBe(3);
  });

  test("counts saved picks from the database, not the Judging tab", async () => {
    const done = await sponsor("Scotiabank");
    const waiting = await sponsor("QNX");
    await db.insert(sponsorFinalPicks).values({
      sponsorId: done.id,
      teamIds: ["a", "b", "c", "d", "e"],
      submittedAt: new Date(),
    });

    const sheet = await judgingSheet();
    expect(chosen).not.toHaveBeenCalled();
    expect(sheet?.pickCount(done.name)).toBe(5);
    // Registered but not submitted: 0, not unknown.
    expect(sheet?.pickCount(waiting.name)).toBe(0);

    const board = buildJudgingBoard({
      sponsors: [done, waiting],
      items: [],
      sheet,
    });
    const by = (id: string) => board.rows.find((r) => r.sponsorId === id);
    expect(by(done.id)).toMatchObject({ picks: 5, tooFewPicks: false });
    expect(by(waiting.id)).toMatchObject({
      picks: 0,
      tooFewPicks: true,
      status: "missing-room",
    });
  });
});
