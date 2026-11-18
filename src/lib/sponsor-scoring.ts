/**
 * Sponsor judging rules, shared by the sponsor's Judging page
 * (/sponsors/[uuid]/picks), the sponsorScoring router and the organizer
 * "Sponsor judging" tab. Dependency-free, so client and server agree.
 *
 * Flow: a sponsor scores teams 1-10 and saves some to their shortlist, then
 * ranks the shortlist and submits exactly SPONSOR_FINAL_TOP teams.
 */
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "~/lib/sponsor-picks";

/**
 * How many ranked teams a sponsor submits. Exactly this many, no more, no
 * fewer. Jazz can raise it to at most SPONSOR_FINAL_TOP_LIMIT. It must also
 * stay inside Lucas's sheet limits (MIN/MAX_SPONSOR_PICKS), because the
 * submission is written to his judging sheet too (guarded by a test).
 */
export const SPONSOR_FINAL_TOP = 5;
export const SPONSOR_FINAL_TOP_LIMIT = 10;

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
export const NOTE_MAX = 280;

/**
 * Whether sponsors can still review and submit. `closesAt` comes from the
 * optional SPONSOR_JUDGING_CLOSES_AT env var on the server; null (unset)
 * means judging never closes.
 */
export function judgingOpen(now: Date, closesAt: Date | null) {
  return closesAt === null || now.getTime() < closesAt.getTime();
}

/** Whether the final size is valid for both this flow and Lucas's sheet. */
export function finalTopIsValid(top: number) {
  return (
    Number.isInteger(top) &&
    top >= 1 &&
    top <= SPONSOR_FINAL_TOP_LIMIT &&
    top >= MIN_SPONSOR_PICKS &&
    top <= MAX_SPONSOR_PICKS
  );
}

export function isValidScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isInteger(score) &&
    score >= SCORE_MIN &&
    score <= SCORE_MAX
  );
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
 * Why a submitted ranking is refused, or null when it's fine: exactly
 * `top` ids, no repeats, and every id on the sponsor's shortlist.
 */
export function rankingError(
  teamIds: readonly string[],
  shortlisted: ReadonlySet<string>,
  top = SPONSOR_FINAL_TOP,
): RankingError | null {
  if (teamIds.length !== top) return "wrongCount";
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
