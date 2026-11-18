import { describe, expect, it } from "vitest";
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "./sponsor-picks";
import { ORGANIZER_TABS, parseOrganizerLocation } from "./sponsor-organizer";
import {
  SPONSOR_FINAL_TOP,
  browseTeams,
  finalTopIsValid,
  formatAverage,
  formatSubmittedTime,
  initialRanking,
  isValidScore,
  judgingOpen,
  moveItem,
  rankingError,
  reconcileRanking,
  sponsorProgress,
  tallyTeams,
  type TeamReview,
} from "./sponsor-scoring";

const review = (teamId: string, patch: Partial<TeamReview> = {}) => ({
  teamId,
  score: null,
  shortlisted: false,
  note: null,
  ...patch,
});

describe("SPONSOR_FINAL_TOP", () => {
  it("is exactly 5 and fits Lucas's sheet limits", () => {
    expect(SPONSOR_FINAL_TOP).toBe(5);
    expect(finalTopIsValid(SPONSOR_FINAL_TOP)).toBe(true);
    expect(SPONSOR_FINAL_TOP).toBeGreaterThanOrEqual(MIN_SPONSOR_PICKS);
    expect(SPONSOR_FINAL_TOP).toBeLessThanOrEqual(MAX_SPONSOR_PICKS);
  });

  it("allows up to 10, never more, and never below the sheet minimum", () => {
    expect(finalTopIsValid(10)).toBe(true);
    expect(finalTopIsValid(11)).toBe(false);
    expect(finalTopIsValid(MIN_SPONSOR_PICKS - 1)).toBe(false);
    expect(finalTopIsValid(5.5)).toBe(false);
  });
});

describe("isValidScore", () => {
  it("takes whole numbers 1-10 only", () => {
    expect([1, 5, 10].every(isValidScore)).toBe(true);
    for (const bad of [0, 11, -1, 5.5, NaN, "7", null, undefined]) {
      expect(isValidScore(bad)).toBe(false);
    }
  });
});

describe("judgingOpen", () => {
  it("is always open with no deadline, closed after one", () => {
    expect(judgingOpen(new Date(), null)).toBe(true);
    const at = new Date("2026-11-23T12:00:00Z");
    expect(judgingOpen(new Date("2026-11-23T11:59:00Z"), at)).toBe(true);
    expect(judgingOpen(at, at)).toBe(false);
  });
});

describe("rankingError", () => {
  const shortlist = new Set(["a", "b", "c", "d", "e", "f"]);

  it("accepts exactly five shortlisted, distinct teams", () => {
    expect(rankingError(["a", "b", "c", "d", "e"], shortlist)).toBeNull();
  });

  it("refuses the wrong count", () => {
    expect(rankingError(["a", "b", "c", "d"], shortlist)).toBe("wrongCount");
    expect(rankingError(["a", "b", "c", "d", "e", "f"], shortlist)).toBe(
      "wrongCount",
    );
    expect(rankingError([], shortlist)).toBe("wrongCount");
  });

  it("refuses duplicates", () => {
    expect(rankingError(["a", "a", "b", "c", "d"], shortlist)).toBe(
      "duplicate",
    );
  });

  it("refuses teams not on the shortlist", () => {
    expect(rankingError(["a", "b", "c", "d", "z"], shortlist)).toBe(
      "notShortlisted",
    );
  });

  it("follows a configured size", () => {
    expect(rankingError(["a", "b", "c"], shortlist, 3)).toBeNull();
  });
});

describe("moveItem", () => {
  it("moves up and down and clamps at the ends", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 5)).toEqual(["a", "b", "c"]);
  });

  it("never mutates the input", () => {
    const list = ["a", "b"];
    moveItem(list, 0, 1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("initialRanking / reconcileRanking", () => {
  const shortlist = [
    { id: "a", name: "Alpha", score: 6 },
    { id: "b", name: "Beta", score: 9 },
    { id: "c", name: "Gamma", score: null },
    { id: "d", name: "Delta", score: 9 },
  ];

  it("starts from the last submission, then score, then name", () => {
    expect(initialRanking(shortlist, ["c", "gone"])).toEqual([
      "c",
      "b",
      "d",
      "a",
    ]);
  });

  it("drops removed teams and appends new ones", () => {
    expect(reconcileRanking(["c", "b", "a"], ["a", "b", "e"])).toEqual([
      "b",
      "a",
      "e",
    ]);
  });
});

describe("browseTeams", () => {
  const teams = [
    { id: "1", name: "Zebra", members: ["Ann"], tracks: ["General"] },
    { id: "2", name: "Apple", members: ["Bo"], tracks: ["Best Domain"] },
    { id: "3", name: "Mango", members: ["Cy"], tracks: [] },
    { id: "4", name: "Kiwi", members: [], tracks: [] },
  ];
  const reviews = new Map([
    ["1", review("1", { score: 4 })],
    ["2", review("2", { shortlisted: true })],
    ["3", review("3", { score: 9, shortlisted: true })],
    ["4", review("4", { note: "  " })],
  ]);
  const ids = (list: { id: string }[]) => list.map((t) => t.id);
  const opts = { query: "", filter: "all" as const, sort: "name" as const };

  it("sorts by name, or by score with unscored last", () => {
    expect(ids(browseTeams(teams, reviews, opts))).toEqual([
      "2",
      "4",
      "3",
      "1",
    ]);
    expect(
      ids(browseTeams(teams, reviews, { ...opts, sort: "score" })),
    ).toEqual(["3", "1", "2", "4"]);
  });

  it("filters scored, shortlisted and not reviewed", () => {
    expect(
      ids(browseTeams(teams, reviews, { ...opts, filter: "scored" })),
    ).toEqual(["3", "1"]);
    expect(
      ids(browseTeams(teams, reviews, { ...opts, filter: "shortlisted" })),
    ).toEqual(["2", "3"]);
    // A blank note doesn't count as a review.
    expect(
      ids(browseTeams(teams, reviews, { ...opts, filter: "unreviewed" })),
    ).toEqual(["4"]);
  });

  it("searches name, members and tracks", () => {
    expect(ids(browseTeams(teams, reviews, { ...opts, query: "bo" }))).toEqual([
      "2",
    ]);
    expect(
      ids(browseTeams(teams, reviews, { ...opts, query: " GENERAL " })),
    ).toEqual(["1"]);
  });
});

describe("tallyTeams (organizer aggregation)", () => {
  const at = new Date("2026-11-23T15:42:00Z");
  const sponsors = [
    {
      sponsorId: "s1",
      name: "RBC",
      reviews: [review("t1", { score: 8 }), review("t2", { score: 6 })],
      final: { teamIds: ["t2", "t1", "t3", "t4", "t5"], submittedAt: at },
    },
    {
      sponsorId: "s2",
      name: "Cohere",
      reviews: [review("t1", { score: 10 }), review("t9", { score: 3 })],
      final: { teamIds: ["t1", "t6", "t7", "t8", "t3"], submittedAt: at },
    },
    { sponsorId: "s3", name: "QNX", reviews: [review("t2")], final: null },
  ];

  it("ranks by top-list count, then average score, then best rank", () => {
    const tallies = tallyTeams(sponsors);
    expect(tallies.slice(0, 3).map((t) => t.teamId)).toEqual([
      "t1",
      "t3",
      "t2",
    ]);
    expect(tallies[0]).toMatchObject({
      teamId: "t1",
      topSponsors: ["Cohere", "RBC"],
      averageScore: 9,
      scoreCount: 2,
      bestRank: 1,
    });
    expect(tallies.find((t) => t.teamId === "t2")).toMatchObject({
      topSponsors: ["RBC"],
      averageScore: 6,
      bestRank: 1,
    });
  });

  it("includes scored teams nobody picked, and skips untouched ones", () => {
    const tallies = tallyTeams(sponsors);
    expect(tallies.at(-1)).toMatchObject({
      teamId: "t9",
      topSponsors: [],
      averageScore: 3,
      bestRank: null,
    });
    expect(tallies).toHaveLength(9);
  });

  it("counts per-sponsor progress", () => {
    expect(sponsorProgress(sponsors[0]!.reviews)).toEqual({
      scored: 2,
      shortlisted: 0,
    });
  });

  it("formats averages", () => {
    expect(formatAverage(null)).toBeNull();
    expect(formatAverage(9)).toBe("9");
    expect(formatAverage(22 / 3)).toBe("7.3");
  });
});

describe("formatSubmittedTime", () => {
  it("shows Eastern clock time", () => {
    expect(formatSubmittedTime(new Date("2026-11-22T15:42:00Z"))).toBe(
      "10:42 AM",
    );
  });
});

describe("organizer tab", () => {
  it("sits after Coffee chats and opens from ?tab=judging", () => {
    expect(ORGANIZER_TABS.indexOf("judging")).toBe(
      ORGANIZER_TABS.indexOf("coffee") + 1,
    );
    expect(parseOrganizerLocation({ tab: "judging" }).tab).toBe("judging");
  });
});
