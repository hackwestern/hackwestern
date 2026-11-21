import { describe, expect, test } from "vitest";

import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { applications, reviews } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import {
  fetchAdmittedScoredReviews,
  INTERESTED_HACKER_LIMIT,
  rankInterestRows,
  type InterestRow,
  type ScoredReview,
} from "~/server/api/utils/hacker-interest";

const row = (
  email: string,
  rank: number | null,
  name = email.split("@")[0]!,
): InterestRow => ({
  email,
  name,
  resumeUrl: `https://files.example.com/${name}.pdf`,
  extraLink: "",
  rank,
});

const review = (email: string, total: number): ScoredReview => ({
  email,
  originalityRating: total,
  technicalityRating: 0,
  passionRating: 0,
});

describe("rankInterestRows", () => {
  test("orders by average review score, ties by name", () => {
    const ranked = rankInterestRows(
      [row("b@x.ca", 1), row("a@x.ca", 2), row("c@x.ca", 3)],
      [
        review("b@x.ca", 4),
        review("b@x.ca", 2), // average 3
        review("a@x.ca", 3), // average 3, wins the tie on name
        review("c@x.ca", 5),
      ],
    );
    expect(ranked.map((r) => r.email)).toEqual(["c@x.ca", "a@x.ca", "b@x.ca"]);
    expect(ranked.map((r) => r.pick)).toEqual([3, 2, 1]);
  });

  test("keeps only top-3 picks with a completed review", () => {
    const ranked = rankInterestRows(
      [
        row("top@x.ca", 3),
        row("fourth@x.ca", 4),
        row("unranked@x.ca", null),
        row("unreviewed@x.ca", 1),
      ],
      [
        review("top@x.ca", 1),
        review("fourth@x.ca", 9),
        review("unranked@x.ca", 9),
      ],
    );
    expect(ranked.map((r) => r.email)).toEqual(["top@x.ca"]);
  });

  test("can prioritize sponsor picks, including those without a completed review", () => {
    const ranked = rankInterestRows(
      [row("third@x.ca", 3), row("first@x.ca", 1), row("second@x.ca", 2)],
      [review("third@x.ca", 9), review("second@x.ca", 5)],
      null,
      true,
    );
    expect(ranked.map((r) => r.email)).toEqual([
      "first@x.ca",
      "second@x.ca",
      "third@x.ca",
    ]);
  });

  test("matches review emails case-insensitively and dedupes form rows", () => {
    const ranked = rankInterestRows(
      [row("dup@x.ca", 1, "First"), row("dup@x.ca", 2, "Second")],
      [review("  DUP@x.ca ", 4)],
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ name: "First", pick: 1 });
  });

  test(`caps the list at ${INTERESTED_HACKER_LIMIT}`, () => {
    const rows = Array.from({ length: 55 }, (_, i) => row(`h${i}@x.ca`, 1));
    const reviews = rows.map((r, i) => review(r.email, i));
    const ranked = rankInterestRows(rows, reviews);
    expect(ranked).toHaveLength(INTERESTED_HACKER_LIMIT);
    expect(ranked[0]!.email).toBe("h54@x.ca");
    expect(rankInterestRows(rows, reviews, null)).toHaveLength(55);
  });
});

describe("fetchAdmittedScoredReviews", () => {
  async function applicant(status: "CONFIRMED" | "DECLINED") {
    const session = await mockSession(db);
    await db.insert(applications).values({
      ...ApplicationSeeder.createRandomWithoutUser(),
      userId: session.user.id,
      status,
    });
    return session.user;
  }

  test("only admitted applicants' completed reviews count", async () => {
    const reviewer = (await mockSession(db)).user;
    const admitted = await applicant("CONFIRMED");
    const declined = await applicant("DECLINED");
    await db.insert(reviews).values(
      [admitted, declined].map((a) => ({
        reviewerUserId: reviewer.id,
        applicantUserId: a.id,
        originalityRating: 5,
        completed: true,
      })),
    );

    const emails = (await fetchAdmittedScoredReviews()).map((r) => r.email);
    expect(emails).toContain(admitted.email);
    expect(emails).not.toContain(declined.email);
  });
});
