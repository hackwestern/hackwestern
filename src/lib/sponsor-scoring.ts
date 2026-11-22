/**
 * Sponsor judging rules, shared by the sponsor's Judging page
 * (/sponsors/[uuid]/picks), the sponsorScoring router and the organizer
 * "Sponsor judging" tab. Dependency-free, so client and server agree.
 *
 * Flow: a sponsor's reps each score teams 1-10 in half points (one login,
 * "Who's judging?"), the sponsor saves some to their shortlist, then ranks
 * the teams that presented and submits three to five ranked picks.
 */

/**
 * Minimum and maximum final picks. The Sponsor Judging sheet reserves a
 * column for each possible place.
 */
export const SPONSOR_FINAL_MIN = 3;
export const SPONSOR_FINAL_TOP = 5;
export const SPONSOR_FINAL_TOP_LIMIT = 10;

/** Fewest picks a sponsor submits: SPONSOR_FINAL_MIN, or all of them when fewer can be ranked. */
export const minPicks = (top: number) => Math.min(SPONSOR_FINAL_MIN, top);

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
/** Scores go in half points (Holia's judging UX): 1, 1.5 ... 10. */
export const SCORE_STEP = 0.5;
/** sponsor_team_score stores halves (2-20) so the column stays an integer. */
export const HALVES_MIN = SCORE_MIN * 2;
export const HALVES_MAX = SCORE_MAX * 2;
/** Two reps this far apart on one team get a "talk it through" flag. */
export const DISAGREEMENT_GAP = 3;
export const NOTE_MAX = 280;
export const JUDGE_NAME_MAX = 80;

/** Every score a rep can give, low to high: 1, 1.5, 2 ... 10. */
export const SCORE_VALUES: readonly number[] = Array.from(
  { length: HALVES_MAX - HALVES_MIN + 1 },
  (_, i) => (HALVES_MIN + i) / 2,
);

/**
 * Whether sponsors can still review and submit. `closesAt` comes from the
 * optional SPONSOR_JUDGING_CLOSES_AT env var on the server; null (unset)
 * means judging never closes.
 */
export function judgingOpen(now: Date, closesAt: Date | null) {
  return closesAt === null || now.getTime() < closesAt.getTime();
}

/** Whether the final size is valid: a whole number from 1 to the limit. */
export function finalTopIsValid(top: number) {
  return Number.isInteger(top) && top >= 1 && top <= SPONSOR_FINAL_TOP_LIMIT;
}

/** A score from 1 to 10 in half points (8.5 yes, 8.25 no). */
export function isValidScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isInteger(score * 2) &&
    score >= SCORE_MIN &&
    score <= SCORE_MAX
  );
}

/** A stored score_halves value (2-20, whole). */
export function isValidHalves(halves: unknown): halves is number {
  return (
    typeof halves === "number" &&
    Number.isInteger(halves) &&
    halves >= HALVES_MIN &&
    halves <= HALVES_MAX
  );
}

/** 8.5 -> 17. Throws on a score that isn't a half point from 1 to 10. */
export function scoreToHalves(score: number) {
  if (!isValidScore(score)) throw new RangeError(`Bad score ${String(score)}`);
  return Math.round(score * 2);
}

/** 17 -> 8.5. */
export function halvesToScore(halves: number) {
  return halves / 2;
}

/** `score` moved by `delta` half points, kept inside 1-10. */
export function stepScore(score: number | null, delta: number) {
  const start = score ?? (SCORE_MIN + SCORE_MAX) / 2;
  const next = start + delta * SCORE_STEP;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, next));
}

/** "8.5", "9" (no trailing ".0"). */
export function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** Judge names are compared cleaned (cleanJudgeName), ignoring case. */
export function judgeKey(name: string) {
  return cleanJudgeName(name).toLowerCase();
}

/**
 * A judge name as stored: zero-width characters (pasted from chat apps)
 * removed, trimmed, spaces collapsed. "" when nothing is left.
 */
export function cleanJudgeName(name: string) {
  return name
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export type TeamReview = {
  teamId: string;
  score: number | null;
  shortlisted: boolean;
  note: string | null;
};

export type RankingError =
  | "wrongCount"
  | "duplicate"
  | "notShortlisted"
  | "closed";

/**
 * Why a submitted ranking is refused, or null when it's fine: between the minimum and
 * `top` ids, no repeats, and every id on the sponsor's shortlist.
 */
export function rankingError(
  teamIds: readonly string[],
  shortlisted: ReadonlySet<string>,
  top = SPONSOR_FINAL_TOP,
): RankingError | null {
  if (teamIds.length < minPicks(top) || teamIds.length > top) {
    return "wrongCount";
  }
  if (new Set(teamIds).size !== teamIds.length) return "duplicate";
  if (teamIds.some((id) => !shortlisted.has(id))) return "notShortlisted";
  return null;
}

/** `list` with the item at `index` moved by `delta` (clamped), new array. */
export function moveItem<T>(list: readonly T[], index: number, delta: number) {
  const to = Math.max(0, Math.min(list.length - 1, index + delta));
  if (index < 0 || index >= list.length || to === index) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Starting order for the shortlist step: the last submission's order for
 * teams still shortlisted, then the rest by score (best first, unscored
 * last), then name.
 */
export function initialRanking(
  shortlist: readonly { id: string; name: string; score: number | null }[],
  submitted: readonly string[],
): string[] {
  const ids = new Set(shortlist.map((t) => t.id));
  const head = submitted.filter((id) => ids.has(id));
  const placed = new Set(head);
  const rest = shortlist
    .filter((t) => !placed.has(t.id))
    .sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name),
    )
    .map((t) => t.id);
  return [...head, ...rest];
}

/** Keep `order` in step with the shortlist: drop removed, append new. */
export function reconcileRanking(
  order: readonly string[],
  shortlistIds: readonly string[],
): string[] {
  const ids = new Set(shortlistIds);
  const kept = order.filter((id) => ids.has(id));
  const seen = new Set(kept);
  return [...kept, ...shortlistIds.filter((id) => !seen.has(id))];
}

export const BROWSE_FILTERS = [
  "all",
  "scored",
  "shortlisted",
  "unreviewed",
] as const;
export type BrowseFilter = (typeof BROWSE_FILTERS)[number];

export const BROWSE_SORTS = ["name", "score"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

type Browsable = {
  id: string;
  name: string;
  members: readonly string[];
  tracks: readonly string[];
};

/** A team counts as reviewed once it has a score, a note or is shortlisted. */
export function isReviewed(review: TeamReview | undefined) {
  return Boolean(
    review &&
      (review.score !== null || review.shortlisted || review.note?.trim()),
  );
}

/** Search, filter and sort the browse list. Never mutates `teams`. */
export function browseTeams<T extends Browsable>(
  teams: readonly T[],
  reviews: ReadonlyMap<string, TeamReview>,
  {
    query,
    filter,
    sort,
  }: { query: string; filter: BrowseFilter; sort: BrowseSort },
): T[] {
  const q = query.trim().toLowerCase();
  const out = teams.filter((team) => {
    const review = reviews.get(team.id);
    if (filter === "scored" && review?.score == null) return false;
    if (filter === "shortlisted" && !review?.shortlisted) return false;
    if (filter === "unreviewed" && isReviewed(review)) return false;
    if (!q) return true;
    return `${team.name} ${team.members.join(" ")} ${team.tracks.join(" ")}`
      .toLowerCase()
      .includes(q);
  });
  return out.sort((a, b) => {
    if (sort === "score") {
      const sa = reviews.get(a.id)?.score ?? 0;
      const sb = reviews.get(b.id)?.score ?? 0;
      if (sa !== sb) return sb - sa;
    }
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Organizer aggregation
// ---------------------------------------------------------------------------

export type SponsorJudgingInput = {
  sponsorId: string;
  name: string;
  reviews: readonly TeamReview[];
  final: { teamIds: readonly string[]; submittedAt: Date } | null;
};

export type TeamTally = {
  teamId: string;
  /** Sponsors that put the team in their submitted top list. */
  topSponsors: string[];
  /** Mean of every sponsor score for the team, or null with none. */
  averageScore: number | null;
  scoreCount: number;
  /** Best (lowest) rank any sponsor gave it, 1-based, or null. */
  bestRank: number | null;
};

/**
 * Teams ranked by how many sponsors put them in a submitted top list, then
 * average score, then best rank. Teams with neither a pick nor a score are
 * left out.
 */
export function tallyTeams(sponsors: readonly SponsorJudgingInput[]) {
  const byTeam = new Map<
    string,
    { top: string[]; scores: number[]; bestRank: number | null }
  >();
  const entry = (teamId: string) => {
    let e = byTeam.get(teamId);
    if (!e) {
      e = { top: [], scores: [], bestRank: null };
      byTeam.set(teamId, e);
    }
    return e;
  };
  for (const s of sponsors) {
    for (const r of s.reviews) {
      if (r.score !== null) entry(r.teamId).scores.push(r.score);
    }
    s.final?.teamIds.forEach((teamId, i) => {
      const e = entry(teamId);
      if (!e.top.includes(s.name)) e.top.push(s.name);
      e.bestRank = e.bestRank === null ? i + 1 : Math.min(e.bestRank, i + 1);
    });
  }
  const tallies: TeamTally[] = [...byTeam.entries()].map(([teamId, e]) => ({
    teamId,
    topSponsors: e.top.sort((a, b) => a.localeCompare(b)),
    averageScore:
      e.scores.length > 0
        ? e.scores.reduce((sum, n) => sum + n, 0) / e.scores.length
        : null,
    scoreCount: e.scores.length,
    bestRank: e.bestRank,
  }));
  return tallies.sort(
    (a, b) =>
      b.topSponsors.length - a.topSponsors.length ||
      (b.averageScore ?? 0) - (a.averageScore ?? 0) ||
      (a.bestRank ?? Infinity) - (b.bestRank ?? Infinity) ||
      a.teamId.localeCompare(b.teamId),
  );
}

/** Per-sponsor counts for the organizer cards. */
export function sponsorProgress(reviews: readonly TeamReview[]) {
  return {
    scored: reviews.filter((r) => r.score !== null).length,
    shortlisted: reviews.filter((r) => r.shortlisted).length,
  };
}

/** "7.3", or null. One decimal, trailing ".0" kept off for whole numbers. */
export function formatAverage(avg: number | null) {
  if (avg === null) return null;
  const rounded = Math.round(avg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "10:42 AM" in Eastern time (the event's clock), for "Submitted …". */
export function formatSubmittedTime(at: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Toronto",
  })
    .format(new Date(at))
    .replace(/ /g, " ");
}

// ---------------------------------------------------------------------------
// Several reps on one login: per-rep scores, the team average, disagreement
// ---------------------------------------------------------------------------

/** One rep's score for one team (sponsor_team_score, as a 1-10 number). */
export type JudgeScore = { teamId: string; judge: string; score: number };

export type TeamScores = {
  /** Each rep's score, highest first, then by name. */
  byJudge: { judge: string; score: number }[];
  /** Mean of the reps' scores, unrounded. */
  average: number;
  /** Highest and lowest scores when they're DISAGREEMENT_GAP or more apart. */
  disagreement: {
    high: { judge: string; score: number };
    low: { judge: string; score: number };
  } | null;
};

/**
 * Every team's scores from all reps: who gave what, the average, and a
 * disagreement flag when two reps are DISAGREEMENT_GAP or more apart. Teams
 * with no score are absent. A rep counts once per team (the last row wins
 * if a name repeats with different spacing or case).
 */
export function aggregateScores(
  scores: readonly JudgeScore[],
): Map<string, TeamScores> {
  const byTeam = new Map<
    string,
    Map<string, { judge: string; score: number }>
  >();
  for (const s of scores) {
    const judges =
      byTeam.get(s.teamId) ??
      new Map<string, { judge: string; score: number }>();
    judges.set(judgeKey(s.judge), {
      judge: cleanJudgeName(s.judge),
      score: s.score,
    });
    byTeam.set(s.teamId, judges);
  }
  const out = new Map<string, TeamScores>();
  for (const [teamId, judges] of byTeam) {
    const byJudge = [...judges.values()].sort(
      (a, b) => b.score - a.score || a.judge.localeCompare(b.judge),
    );
    const average =
      byJudge.reduce((sum, j) => sum + j.score, 0) / byJudge.length;
    const high = byJudge[0]!;
    const low = byJudge[byJudge.length - 1]!;
    out.set(teamId, {
      byJudge,
      average,
      disagreement:
        high.score - low.score >= DISAGREEMENT_GAP ? { high, low } : null,
    });
  }
  return out;
}

/**
 * Who the list is split between: the sponsor's reps (in their order), plus
 * this judge if they aren't one of them. With no reps listed, everyone who
 * has scored so far plus this judge, by name. Names deduped by judgeKey.
 */
export function splitJudges(
  reps: readonly string[],
  scorers: readonly string[],
  me: string | null,
): string[] {
  const base =
    reps.length > 0
      ? [...reps]
      : [...scorers].sort((a, b) => a.localeCompare(b));
  const names = me ? [...base, me] : base;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = judgeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleanJudgeName(name));
  }
  return out;
}

/**
 * Split `teamIds` (already in walking order, e.g. by table) evenly between
 * `judges` in runs, so each rep covers one part of the room. Earlier judges
 * get the extra team when it doesn't divide evenly. Keyed by judgeKey.
 */
export function splitTeams(
  teamIds: readonly string[],
  judges: readonly string[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (judges.length === 0) return out;
  const base = Math.floor(teamIds.length / judges.length);
  const extra = teamIds.length % judges.length;
  let at = 0;
  judges.forEach((judge, i) => {
    const size = base + (i < extra ? 1 : 0);
    out.set(judgeKey(judge), teamIds.slice(at, at + size));
    at += size;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Digital sponsors: the spon team enters 1st-5th by Devpost link
// ---------------------------------------------------------------------------

/**
 * A Devpost link reduced to compare: host without "www.", path without a
 * trailing slash, lowercased, no query or hash. "" when it isn't a link.
 * Accepts links pasted without "https://".
 */
export function devpostKey(link: string) {
  const raw = link.trim();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return path ? `${host}${path}` : "";
  } catch {
    return "";
  }
}

type LinkedTeam = { id: string; devpostUrl: string | null };

/** Teams matching a pasted Devpost link or team ID (an ID wins outright). */
function linkMatches<T extends LinkedTeam>(
  input: string,
  teams: readonly T[],
): T[] {
  const text = input.trim();
  if (!text) return [];
  const byId = teams.find((t) => t.id.toLowerCase() === text.toLowerCase());
  if (byId) return [byId];
  const key = devpostKey(text);
  if (!key) return [];
  return teams.filter((t) => t.devpostUrl && devpostKey(t.devpostUrl) === key);
}

/**
 * The team a pasted Devpost link (or team ID) points to, among `teams`
 * (the sponsor's track's submitted teams), or null when none matches, or
 * when several teams share that link (linkIsAmbiguous; paste the ID).
 */
export function matchTeamByLink<T extends LinkedTeam>(
  input: string,
  teams: readonly T[],
): T | null {
  const found = linkMatches(input, teams);
  return found.length === 1 ? found[0]! : null;
}

/** Whether a pasted link matches more than one team (so it matches none). */
export function linkIsAmbiguous(
  input: string,
  teams: readonly LinkedTeam[],
): boolean {
  return linkMatches(input, teams).length > 1;
}

/** A link without its scheme or trailing slash: "devpost.com/software/x". */
export function bareLink(url: string | null | undefined): string {
  return (
    url
      ?.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "") ?? ""
  );
}

/** "a1c3e5f70912 · devpost.com/software/x": how judging shows a team. */
export function teamIdAndLink(teamId: string, devpostUrl: string | null) {
  const link = bareLink(devpostUrl);
  return link ? `${teamId} · ${link}` : teamId;
}
