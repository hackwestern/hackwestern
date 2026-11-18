import { describe, expect, test } from "vitest";

import {
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
  });
});
