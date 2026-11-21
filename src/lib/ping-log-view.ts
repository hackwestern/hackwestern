/**
 * How the Ping Logs page reads its rows: which bucket a ping is in (problem,
 * upcoming, sent), where it came from, search, filters, sorting and the
 * health summary. Pure, so it's tested without a DB or Slack.
 */

import type { PingEntry } from "~/lib/ping-log";

/** Why someone can't get run-of-show DMs, or "ok" (same as the server's Reach). */
export type PingReach = "ok" | "noContact" | "noSlack";

/** What an organizer wants to know about a ping, in one word. */
export type PingBucket = "problem" | "upcoming" | "sent" | "off";

/** Where a ping came from: the "From" chips. */
export const PING_SOURCES = [
  "organizer",
  "team",
  "mentor",
  "volunteer",
  "judge",
  "coffee",
  "presentation",
  "help",
  "task",
  "marketing",
] as const;
export type PingSource = (typeof PING_SOURCES)[number];

/** The "Show" chips. "focus" is the default: what's next and what's wrong. */
export const PING_VIEWS = [
  "focus",
  "problem",
  "upcoming",
  "sent",
  "all",
] as const;
export type PingView = (typeof PING_VIEWS)[number];

/** The default view leaves out problems older than this (they're in Problems). */
export const FOCUS_PAST_MS = 6 * 60 * 60_000;

export type PingRow = PingEntry & {
  /** Stable across refreshes, so an open row stays open. */
  id: string;
  bucket: PingBucket;
  sources: PingSource[];
  /** Lower-cased, accent-free text the search looks in. */
  haystack: string;
};

export type PingSort = {
  key: "time" | "to" | "status";
  dir: "asc" | "desc";
};

/** Lower case, no accents: "Zoë" matches "zoe". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const AUTO_PING_ROLES: [string, PingSource][] = [
  ["mentor", "mentor"],
  ["volunteer", "volunteer"],
  ["judge", "judge"],
];

/** A run-of-show ping to "#Events" is a team channel post, not a DM. */
export function sourcesOf(entry: PingEntry): PingSource[] {
  if (entry.kind === "organizer")
    return [entry.to.startsWith("#") ? "team" : "organizer"];
  if (entry.kind === "autoPing") {
    const role = normalize(entry.group ?? "");
    return AUTO_PING_ROLES.filter(([word]) => role.includes(word)).map(
      ([, source]) => source,
    );
  }
  return [entry.kind];
}

function bucketOf(entry: PingEntry, now: number): PingBucket {
  if (entry.tone === "problem") return "problem";
  if (entry.status.endsWith(".cancelled")) return "off";
  return +entry.at > now ? "upcoming" : "sent";
}

/**
 * Log entries as page rows. A run-of-show ping to someone who can't be
 * reached is a problem even when its time has passed: the log counts a past
 * ping as sent, but that person never got it ("organizer.missed"), and
 * won't get the next ones ("organizer.unreachable").
 */
export function buildRows(
  entries: PingEntry[],
  options: { now: number; reach?: ReadonlyMap<string, PingReach> },
): PingRow[] {
  const seen = new Map<string, number>();
  return entries.map((raw) => {
    let entry = raw;
    const reach = options.reach?.get(raw.to) ?? "ok";
    if (raw.kind === "organizer" && reach !== "ok") {
      const missed = raw.status === "organizer.sent";
      entry = {
        ...raw,
        status: `organizer.${missed ? "missed" : "unreachable"}.${reach}`,
        tone: "problem",
      };
    }
    const base = `${entry.kind}|${entry.to}|${+entry.at}|${entry.about}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return {
      ...entry,
      id: n ? `${base}|${n}` : base,
      bucket: bucketOf(entry, options.now),
      sources: sourcesOf(entry),
      haystack: normalize(`${entry.to} ${entry.group ?? ""} ${entry.about}`),
    };
  });
}

/**
 * Every word typed has to be in the person's name, their role, or the ping's
 * title. The message body isn't searched: it names other people, so looking
 * someone up would also list pings they didn't get.
 */
export function matchesSearch(row: PingRow, search: string): boolean {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return words.every((w) => row.haystack.includes(w));
}

export function matchesView(row: PingRow, view: PingView, now: number) {
  if (view === "all") return true;
  if (view !== "focus") return row.bucket === view;
  if (row.bucket === "upcoming") return true;
  return row.bucket === "problem" && +row.at > now - FOCUS_PAST_MS;
}

export function matchesSource(row: PingRow, source: PingSource | "all") {
  return source === "all" || row.sources.includes(source);
}

export type PingFilter = {
  search: string;
  view: PingView;
  source: PingSource | "all";
};

export function filterRows(
  rows: PingRow[],
  filter: PingFilter,
  now: number,
): PingRow[] {
  return rows.filter(
    (r) =>
      matchesSource(r, filter.source) &&
      matchesView(r, filter.view, now) &&
      matchesSearch(r, filter.search),
  );
}

/**
 * The number on each chip: how many rows it would show with the search and
 * the other row of chips left as they are.
 */
export function chipCounts(rows: PingRow[], filter: PingFilter, now: number) {
  const found = rows.filter((r) => matchesSearch(r, filter.search));
  const inSource = found.filter((r) => matchesSource(r, filter.source));
  const inView = found.filter((r) => matchesView(r, filter.view, now));
  const views = Object.fromEntries(
    PING_VIEWS.map((v) => [
      v,
      inSource.filter((r) => matchesView(r, v, now)).length,
    ]),
  ) as Record<PingView, number>;
  const sources = Object.fromEntries(
    PING_SOURCES.map((s) => [
      s,
      inView.filter((r) => matchesSource(r, s)).length,
    ]),
  ) as Record<PingSource, number>;
  return { views, sources, allSources: inView.length };
}

const BUCKET_ORDER: Record<PingBucket, number> = {
  problem: 0,
  upcoming: 1,
  sent: 2,
  off: 3,
};

/**
 * The default order, top to bottom: problems (ones still to come first,
 * soonest first, then past ones newest first), then upcoming pings soonest
 * first, then what's been sent newest first, then cancelled ones.
 */
function defaultCompare(now: number) {
  return (a: PingRow, b: PingRow) => {
    const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
    if (byBucket) return byBucket;
    const aAhead = +a.at > now;
    const bAhead = +b.at > now;
    if (aAhead !== bAhead) return aAhead ? -1 : 1;
    const byTime = aAhead ? +a.at - +b.at : +b.at - +a.at;
    return byTime || a.to.localeCompare(b.to);
  };
}

/** `sort` null is the default order; otherwise one column, either way. */
export function sortRows(
  rows: PingRow[],
  sort: PingSort | null,
  now: number,
): PingRow[] {
  const fallback = defaultCompare(now);
  if (!sort) return [...rows].sort(fallback);
  const flip = sort.dir === "asc" ? 1 : -1;
  const compare = (a: PingRow, b: PingRow) => {
    if (sort.key === "time") return +a.at - +b.at;
    if (sort.key === "to")
      return normalize(a.to).localeCompare(normalize(b.to));
    return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
  };
  return [...rows].sort((a, b) => compare(a, b) * flip || fallback(a, b));
}

/** Pressing a column: first press sorts by it, the next flips, a third clears. */
export function nextSort(
  current: PingSort | null,
  key: PingSort["key"],
): PingSort | null {
  // Newest first is the useful first press for time; A to Z for the rest.
  const first = key === "time" ? "desc" : "asc";
  if (current?.key !== key) return { key, dir: first };
  if (current.dir === first)
    return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

/** Rows in order, cut into runs that share a bucket (for section headings). */
export function groupByBucket(
  rows: PingRow[],
): { bucket: PingBucket; rows: PingRow[] }[] {
  const groups: { bucket: PingBucket; rows: PingRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last?.bucket === row.bucket) last.rows.push(row);
    else groups.push({ bucket: row.bucket, rows: [row] });
  }
  return groups;
}

/** Whole minutes from now: positive is ahead, negative is ago. */
export function minutesAway(at: Date, now: number): number {
  return Math.round((+at - now) / 60_000);
}

export type PersonSummary = {
  name: string;
  reach: PingReach;
  received: number;
  missed: number;
  upcoming: number;
  atRisk: number;
};

/** The three health answers: who can't be reached, who missed one, what's not queued. */
export function healthSummary(everyone: PersonSummary[]) {
  // Team channels ("#Events") always get their posts; count people only.
  const people = everyone.filter((p) => !p.name.startsWith("#"));
  const unreachable = people.filter((p) => p.reach !== "ok");
  const missed = people.filter((p) => p.missed > 0);
  return {
    people: people.length,
    unreachable,
    missed,
    missedTotal: missed.reduce((n, p) => n + p.missed, 0),
    atRisk: people.reduce((n, p) => n + p.atRisk, 0),
  };
}

/** Who can't be reached, by name, for buildRows. */
export function reachMap(
  everyone: Pick<PersonSummary, "name" | "reach">[],
): Map<string, PingReach> {
  return new Map(everyone.map((p) => [p.name, p.reach]));
}
