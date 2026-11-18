import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { sponsorJudgingSponsors, teams } from "~/server/db/schema";
import {
  fetchSponsorTrack,
  writeChosenTeams,
} from "~/server/api/utils/sponsor-judging-teams";

// The sheet is the only outside call: the sponsor's track and Lucas's picks
// column. Team eligibility itself runs against the test database.
vi.mock("~/server/api/utils/sponsor-judging-teams", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/sponsor-judging-teams")
  >()),
  fetchSponsorTrack: vi.fn(),
  writeChosenTeams: vi.fn(),
}));
const track = vi.mocked(fetchSponsorTrack);
const writeSheet = vi.mocked(writeChosenTeams);

// Sponsors aren't logged in: their private UUID is the credential.
const anon = createCaller(createInnerTRPCContext({ session: null }));

beforeEach(() => {
  track.mockReset().mockResolvedValue(null);
  writeSheet.mockReset().mockResolvedValue(undefined);
});

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}

async function team(
  status: "draft" | "submitted" | "late" = "submitted",
  tracks: ("General" | "Best Domain")[] = ["General"],
) {
  const id = faker.string.alphanumeric(12);
  await db.insert(teams).values({
    id,
    name: `Team ${faker.string.alphanumeric(8)}`,
    joinCode: faker.string.alphanumeric(6),
    submissionStatus: status,
    tracks,
    devpostUrl: `https://devpost.com/software/${id}`,
  });
  return id;
}

async function shortlistFive(sponsorId: string) {
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const id = await team();
    await anon.sponsorScoring.review({
      sponsor: sponsorId,
      teamId: id,
      shortlisted: true,
      score: 10 - i,
    });
    ids.push(id);
  }
  return ids;
}

describe("sponsorScoring.get", () => {
  test("unknown sponsor is NOT_FOUND, bad id BAD_REQUEST", async () => {
    await expect(
      anon.sponsorScoring.get({ sponsor: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      anon.sponsorScoring.get({ sponsor: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("lists only submitted teams in the sponsor's track", async () => {
    const s = await sponsor();
    const inTrack = await team("late", ["Best Domain"]);
    const otherTrack = await team("submitted", ["General"]);
    const draft = await team("draft", ["Best Domain"]);
    track.mockResolvedValue("Best Domain");

    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    const ids = res.teams.map((t) => t.id);
    expect(ids).toContain(inTrack);
    expect(ids).not.toContain(otherTrack);
    expect(ids).not.toContain(draft);
    expect(res.finalTop).toBe(5);
    expect(res.final).toBeNull();
  });
});

describe("sponsorScoring.review", () => {
  test("score must be a whole number 1-10", async () => {
    const s = await sponsor();
    const t = await team();
    for (const score of [0, 11, 5.5, -3]) {
      await expect(
        anon.sponsorScoring.review({ sponsor: s.id, teamId: t, score }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    for (const score of [1, 10]) {
      await expect(
        anon.sponsorScoring.review({ sponsor: s.id, teamId: t, score }),
      ).resolves.toMatchObject({ score });
    }
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: t, score: null }),
    ).resolves.toMatchObject({ score: null });
  });

  test("shortlist toggles on and off without touching the score", async () => {
    const s = await sponsor();
    const t = await team();
    await anon.sponsorScoring.review({ sponsor: s.id, teamId: t, score: 7 });
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        shortlisted: true,
      }),
    ).resolves.toMatchObject({ score: 7, shortlisted: true });
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        shortlisted: false,
      }),
    ).resolves.toMatchObject({ score: 7, shortlisted: false });
  });

  test("notes are trimmed, blank clears, and capped", async () => {
    const s = await sponsor();
    const t = await team();
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: t, note: "  Neat " }),
    ).resolves.toMatchObject({ note: "Neat" });
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: t, note: "   " }),
    ).resolves.toMatchObject({ note: null });
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        note: "x".repeat(281),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("can't review a draft team or one outside the track", async () => {
    const s = await sponsor();
    const draft = await team("draft");
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: draft, score: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const general = await team("submitted", ["General"]);
    track.mockResolvedValue("Best Domain");
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: general, score: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("one sponsor's reviews never show for another", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const t = await team();
    await anon.sponsorScoring.review({
      sponsor: a.id,
      teamId: t,
      score: 9,
      shortlisted: true,
      note: "secret",
    });
    const res = await anon.sponsorScoring.get({ sponsor: b.id });
    expect(res.reviews.find((r) => r.teamId === t)).toBeUndefined();
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});

describe("sponsorScoring.submit", () => {
  test("saves exactly five shortlisted teams and writes the sheet", async () => {
    const s = await sponsor();
    const ids = await shortlistFive(s.id);
    const ranked = [...ids].reverse();
    const res = await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ranked,
    });
    expect(res).toMatchObject({ teamIds: ranked, sheetSynced: true });
    expect(writeSheet).toHaveBeenCalledWith(s.name, ranked);
    const after = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(after.final).toMatchObject({ teamIds: ranked, sheetSynced: true });
  });

  test("refuses the wrong count, duplicates and unshortlisted teams", async () => {
    const s = await sponsor();
    const ids = await shortlistFive(s.id);
    const extra = await team();
    const cases = [
      ids.slice(0, 4),
      [...ids, extra],
      [ids[0]!, ids[0]!, ids[1]!, ids[2]!, ids[3]!],
      [...ids.slice(0, 4), extra],
    ];
    for (const teamIds of cases) {
      await expect(
        anon.sponsorScoring.submit({ sponsor: s.id, teamIds }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(writeSheet).not.toHaveBeenCalled();
  });

  test("another sponsor's shortlist doesn't count, and isn't touched", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const aIds = await shortlistFive(a.id);
    await expect(
      anon.sponsorScoring.submit({ sponsor: b.id, teamIds: aIds }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await anon.sponsorScoring.get({ sponsor: a.id })).final).toBeNull();
  });

  test("a team that stopped being eligible can't be submitted", async () => {
    const s = await sponsor();
    const ids = await shortlistFive(s.id);
    track.mockResolvedValue("Best Domain");
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("still counts if the sheet write fails; resubmit replaces", async () => {
    const s = await sponsor();
    const ids = await shortlistFive(s.id);
    writeSheet.mockRejectedValueOnce(new Error("sheets down"));
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids }),
    ).resolves.toMatchObject({ sheetSynced: false });
    expect(
      (await anon.sponsorScoring.get({ sponsor: s.id })).final,
    ).toMatchObject({ teamIds: ids, sheetSynced: false });

    const reranked = [ids[4]!, ...ids.slice(0, 4)];
    await anon.sponsorScoring.submit({ sponsor: s.id, teamIds: reranked });
    expect(
      (await anon.sponsorScoring.get({ sponsor: s.id })).final,
    ).toMatchObject({ teamIds: reranked, sheetSynced: true });
  });
});

describe("sponsorScoring.overview", () => {
  test("organizers only", async () => {
    await expect(anon.sponsorScoring.overview()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(hacker.sponsorScoring.overview()).rejects.toBeTruthy();
  });

  test("shows each sponsor's ranking and tallies teams", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const a = await sponsor();
    const b = await sponsor();
    const ids = await shortlistFive(a.id);
    await anon.sponsorScoring.submit({ sponsor: a.id, teamIds: ids });
    await anon.sponsorScoring.review({
      sponsor: b.id,
      teamId: ids[0]!,
      score: 4,
    });

    const res = await organizer.sponsorScoring.overview();
    const sa = res.sponsors.find((s) => s.sponsorId === a.id)!;
    expect(sa).toMatchObject({ scored: 5, shortlisted: 5 });
    expect(sa.final?.teams.map((t) => t.teamId)).toEqual(ids);
    expect(sa.final?.teams[0]).toMatchObject({ score: 10 });
    expect(sa.final?.teams[0]?.devpostUrl).toContain("devpost.com");
    expect(res.sponsors.find((s) => s.sponsorId === b.id)).toMatchObject({
      scored: 1,
      shortlisted: 0,
      final: null,
    });
    const first = res.teams.find((t) => t.teamId === ids[0]);
    expect(first).toMatchObject({
      topSponsors: [a.name],
      averageScore: 7,
      scoreCount: 2,
      bestRank: 1,
    });
  });
});
