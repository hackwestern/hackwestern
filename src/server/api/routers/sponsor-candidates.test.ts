import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import type * as HackerInterest from "~/server/api/utils/hacker-interest";
import {
  fetchRankedInterestRows,
  type RankedInterestRow,
} from "~/server/api/utils/hacker-interest";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  sponsorInterests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";

// The interest form ranking reads a Google Sheet; stand it in here.
vi.mock("~/server/api/utils/hacker-interest", async (importOriginal) => ({
  ...(await importOriginal<typeof HackerInterest>()),
  fetchRankedInterestRows: vi.fn(),
}));
const formRanking = vi.mocked(fetchRankedInterestRows);

const anon = createCaller(createInnerTRPCContext({ session: null }));

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}

/** Submitted chatting preferences with 4 seats: opens the shortlist. */
async function withSeats(sponsorId: string) {
  await db
    .insert(coffeeChatPrefs)
    .values({ sponsorId, hackersPerChat: 1, submittedAt: new Date() });
  const [rep] = await db
    .insert(coffeeChatReps)
    .values({ sponsorId, name: "Dana", phone: "5195550142", isPrimary: true, chatsWanted: 4 })
    .returning();
  await db.insert(coffeeChatRepSessions).values({ repId: rep!.id, sessionId: "10" });
}

async function hacker(
  share: boolean,
  rankedSponsorId?: string,
  status: "CONFIRMED" | "DECLINED" = "CONFIRMED",
) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    agreeShareWithSponsors: share,
    firstName: share ? "Shared" : "Private",
    lastName: "Hacker",
  });
  if (rankedSponsorId) {
    await db
      .insert(sponsorInterests)
      .values({ userId: session.user.id, sponsorId: rankedSponsorId, rank: 1 });
  }
  return { id: session.user.id, email: session.user.email! };
}

const formRow = (email: string, pick = 1): RankedInterestRow => ({
  // The sheet's case doesn't matter.
  email: email.toUpperCase(),
  name: "Form Name",
  resumeUrl: "https://drive.example.com/resume",
  extraLink: "",
  pick,
});

beforeEach(() => {
  formRanking.mockReset();
  formRanking.mockRejectedValue(new Error("HACKER_INTEREST_FORM is not set"));
});

describe("candidates from the interest form", () => {
  test("lists form candidates by user id in ranking order, with no emails", async () => {
    const mine = await sponsor();
    const first = await hacker(false);
    const second = await hacker(true);
    formRanking.mockResolvedValue([
      formRow(first.email, 2),
      formRow(second.email, 1),
    ]);

    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.source).toBe("interestForm");
    expect(res.showSource).toBe(false);
    expect(res.hackers.map((h) => [h.userId, h.rank, h.pick])).toEqual([
      [first.id, 1, 2],
      [second.id, 2, 1],
    ]);
    expect(res.hackers[0]).toMatchObject({ name: "Private", shared: false });
    expect(res.hackers[1]).toMatchObject({
      name: "Shared Hacker",
      shared: true,
    });
    const json = JSON.stringify(res);
    expect(json).not.toContain(first.email);
    expect(json).not.toContain(second.email);
  });

  test("form candidates and sharing hackers found by search can be shortlisted", async () => {
    const mine = await sponsor();
    await withSeats(mine.id);
    const candidate = await hacker(false);
    // Ranked the sponsor in the app, but isn't on the form list.
    const inAppOnly = await hacker(true, mine.id);
    formRanking.mockResolvedValue([formRow(candidate.email)]);

    // A form candidate can be shortlisted even without app consent (the
    // form is their consent); anyone else needs to share with sponsors.
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: candidate.id });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: inAppOnly.id });

    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(
      res.hackers.filter((h) => h.shortlisted).map((h) => h.userId),
    ).toEqual([candidate.id, inAppOnly.id]);

    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const forSponsor = await organizer.sponsorShortlist.forSponsor({
      sponsorId: mine.id,
    });
    expect(forSponsor.hackers.map((h) => h.userId)).toEqual([
      candidate.id,
      inAppOnly.id,
    ]);
  });

  test("drops hackers who aren't admitted, then cuts to 40", async () => {
    const mine = await sponsor();
    const declined = await Promise.all(
      Array.from({ length: 5 }, () => hacker(true, undefined, "DECLINED")),
    );
    const admitted = await Promise.all(
      Array.from({ length: 42 }, () => hacker(true)),
    );
    formRanking.mockResolvedValue([
      ...declined.map((h) => formRow(h.email)),
      formRow("no-account@example.com"),
      ...admitted.map((h) => formRow(h.email)),
    ]);

    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers).toHaveLength(40);
    expect(res.hackers.map((h) => h.userId)).toEqual(
      admitted.slice(0, 40).map((h) => h.id),
    );
    expect(res.hackers.map((h) => h.rank)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: declined[0]!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("falls back to the in-app ranking when the form can't be read", async () => {
    const mine = await sponsor();
    const inApp = await hacker(true, mine.id);

    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.source).toBe("inAppRanking");
    expect(res.hackers.map((h) => [h.userId, h.rank])).toEqual([[inApp.id, 1]]);
    // Sponsors aren't told; a logged-in organizer is.
    expect(res.showSource).toBe(false);
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const asOrganizer = await organizer.sponsorShortlist.list({
      sponsor: mine.id,
    });
    expect(asOrganizer.showSource).toBe(true);
  });
});
