import { describe, expect, it } from "vitest";
import { ORGANIZER_TABS, parseOrganizerLocation } from "./sponsor-organizer";
import {
  SCORE_VALUES,
  SPONSOR_FINAL_TOP,
  aggregateScores,
  browseTeams,
  finalTopIsValid,
  formatAverage,
  formatScore,
  formatSubmittedTime,
  halvesToScore,
  initialRanking,
  isValidHalves,
  isValidScore,
  judgeKey,
  matchTeamByLink,
  scoreToHalves,
  splitJudges,
  splitTeams,
  stepScore,
  teamIdAndLink,
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
  it("is a ranked top 3 (1st, 2nd, 3rd; Jazz 2026-11-19)", () => {
    expect(SPONSOR_FINAL_TOP).toBe(3);
    expect(finalTopIsValid(SPONSOR_FINAL_TOP)).toBe(true);
  });

  it("allows 1 to 10 whole teams, never more", () => {
    expect(finalTopIsValid(1)).toBe(true);
    expect(finalTopIsValid(10)).toBe(true);
    expect(finalTopIsValid(11)).toBe(false);
    expect(finalTopIsValid(0)).toBe(false);
    expect(finalTopIsValid(2.5)).toBe(false);
  });
});

describe("half-point scores", () => {
  it("takes 1-10 in half points only", () => {
    expect([1, 1.5, 5, 8.5, 10].every(isValidScore)).toBe(true);
    for (const bad of [0, 0.5, 10.5, 11, -1, 5.25, NaN, "7", null, undefined]) {
      expect(isValidScore(bad)).toBe(false);
    }
  });

  it("lists every value 1, 1.5 ... 10", () => {
    expect(SCORE_VALUES).toHaveLength(19);
    expect(SCORE_VALUES[0]).toBe(1);
    expect(SCORE_VALUES[1]).toBe(1.5);
    expect(SCORE_VALUES.at(-1)).toBe(10);
  });

  it("stores halves 2-20 and reads them back", () => {
    expect(scoreToHalves(8.5)).toBe(17);
    expect(scoreToHalves(1)).toBe(2);
    expect(scoreToHalves(10)).toBe(20);
    expect(halvesToScore(17)).toBe(8.5);
    expect(() => scoreToHalves(8.25)).toThrow();
    expect([2, 11, 20].every(isValidHalves)).toBe(true);
    expect([1, 21, 7.5].some(isValidHalves)).toBe(false);
  });

  it("steps by 0.5 inside 1-10; an unscored step starts in the middle", () => {
    expect(stepScore(8, 1)).toBe(8.5);
    expect(stepScore(8, -1)).toBe(7.5);
    expect(stepScore(10, 1)).toBe(10);
    expect(stepScore(1, -1)).toBe(1);
    expect(stepScore(null, 0)).toBe(5.5);
  });

  it("formats without a trailing .0", () => {
    expect(formatScore(9)).toBe("9");
    expect(formatScore(8.5)).toBe("8.5");
  });
});

describe("aggregateScores (several reps)", () => {
  it("keeps who gave each score, averages, and flags a 3-point gap", () => {
    const agg = aggregateScores([
      { teamId: "t1", judge: "Dana W.", score: 9 },
      { teamId: "t1", judge: "Marcus O.", score: 5 },
      { teamId: "t2", judge: "Dana W.", score: 7 },
      { teamId: "t2", judge: "Priya S.", score: 8.5 },
    ]);
    expect(agg.get("t1")).toEqual({
      byJudge: [
        { judge: "Dana W.", score: 9 },
        { judge: "Marcus O.", score: 5 },
      ],
      average: 7,
      disagreement: {
        high: { judge: "Dana W.", score: 9 },
        low: { judge: "Marcus O.", score: 5 },
      },
    });
    expect(agg.get("t2")).toMatchObject({ average: 7.75, disagreement: null });
    expect(agg.has("t3")).toBe(false);
  });

  it("flags exactly 3 apart, not 2.5", () => {
    const at = (a: number, b: number) =>
      aggregateScores([
        { teamId: "t", judge: "A", score: a },
        { teamId: "t", judge: "B", score: b },
      ]).get("t")!.disagreement;
    expect(at(8, 5)).not.toBeNull();
    expect(at(8, 5.5)).toBeNull();
  });

  it("counts a rep once whatever the name's case or spacing", () => {
    const agg = aggregateScores([
      { teamId: "t", judge: "Dana W.", score: 9 },
      { teamId: "t", judge: " dana  w. ", score: 6 },
    ]);
    expect(agg.get("t")!.byJudge).toHaveLength(1);
    expect(agg.get("t")!.average).toBe(6);
  });
});

describe("splitJudges / splitTeams", () => {
  it("splits between the reps plus me, in runs, extra teams to the first", () => {
    const judges = splitJudges(["Dana W.", "Marcus O."], [], "Leo T.");
    expect(judges).toEqual(["Dana W.", "Marcus O.", "Leo T."]);
    const runs = splitTeams(["a", "b", "c", "d", "e", "f", "g"], judges);
    expect(runs.get(judgeKey("Dana W."))).toEqual(["a", "b", "c"]);
    expect(runs.get(judgeKey("Marcus O."))).toEqual(["d", "e"]);
    expect(runs.get(judgeKey("leo t."))).toEqual(["f", "g"]);
  });

  it("doesn't add me twice; with no reps listed, uses who has scored", () => {
    expect(splitJudges(["Dana W."], [], "dana w.")).toEqual(["Dana W."]);
    expect(splitJudges([], ["Priya", "Ann"], "Zed")).toEqual([
      "Ann",
      "Priya",
      "Zed",
    ]);
    expect(splitTeams(["a"], [])).toEqual(new Map());
  });
});

describe("matchTeamByLink (digital top 3)", () => {
  const teams = [
    { id: "a1c3e5f70912", devpostUrl: "https://devpost.com/software/cool-app" },
    { id: "b2", devpostUrl: "https://devpost.com/software/other/" },
    { id: "c3", devpostUrl: null },
  ];

  it("matches a pasted Devpost link however it's written", () => {
    for (const link of [
      "https://devpost.com/software/cool-app",
      "devpost.com/software/cool-app",
      "www.devpost.com/software/Cool-App/",
      "http://devpost.com/software/cool-app?ref=share#top",
    ]) {
      expect(matchTeamByLink(link, teams)?.id).toBe("a1c3e5f70912");
    }
    expect(matchTeamByLink("devpost.com/software/other", teams)?.id).toBe("b2");
  });

  it("matches a team ID too, and nothing else", () => {
    expect(matchTeamByLink("C3", teams)?.id).toBe("c3");
    expect(matchTeamByLink("devpost.com/software/nope", teams)).toBeNull();
    expect(matchTeamByLink("devpost.com", teams)).toBeNull();
    expect(matchTeamByLink("   ", teams)).toBeNull();
  });

  it("shows a team as ID + Devpost link", () => {
    expect(
      teamIdAndLink("a1c3e5f70912", "https://devpost.com/software/cool-app/"),
    ).toBe("a1c3e5f70912 · devpost.com/software/cool-app");
    expect(teamIdAndLink("c3", null)).toBe("c3");
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

  it("accepts exactly three shortlisted, distinct teams", () => {
    expect(rankingError(["a", "b", "c"], shortlist)).toBeNull();
  });

  it("refuses the wrong count", () => {
    expect(rankingError(["a", "b"], shortlist)).toBe("wrongCount");
    expect(rankingError(["a", "b", "c", "d", "e"], shortlist)).toBe(
      "wrongCount",
    );
    expect(rankingError([], shortlist)).toBe("wrongCount");
  });

  it("refuses duplicates", () => {
    expect(rankingError(["a", "a", "b"], shortlist)).toBe("duplicate");
  });

  it("refuses teams not on the shortlist", () => {
    expect(rankingError(["a", "b", "z"], shortlist)).toBe("notShortlisted");
  });

  it("follows a configured size", () => {
    expect(rankingError(["a", "b", "c", "d", "e"], shortlist, 5)).toBeNull();
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
