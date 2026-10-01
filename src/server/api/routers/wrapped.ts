/**
 * Organizer-facing data pulls for HackWestern Wrapped.
 *
 * Triggered by hand after the event: one pull covers both external sources,
 * and everything derived from them is computed on read.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { createTRPCRouter, protectedOrganizerProcedure } from "../trpc";
import { requireHackWindow } from "../utils/hack-window";
import { db } from "~/server/db";
import { applications, teams, users } from "~/server/db/schema";
import {
  type GithubCommit,
  commitsInWindow,
  fetchAllCommits,
  parseGithubUrl,
} from "~/utils/github";
import { getGithubUsername } from "~/utils/urls";
import { DevpostScrapeError, fetchDevpostTechStack } from "~/utils/devpost";

const EVENT_TIME_ZONE = "America/Toronto";

/** Night owl runs 11pm to 5am local */
const NIGHT_START_HOUR = 23;
const NIGHT_END_HOUR = 5;

const WRAPPED_CONCURRENCY = 4;

async function withConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        await task(items[cursor++]!);
      }
    })(),
  );
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Team-level Devpost and Github data pulls
// ---------------------------------------------------------------------------

/** Scrapes the team's DevPost page and stores the technologies on the team row. */
export async function pullTeamTechStack(
  teamId: string,
  devpostUrl?: string | null,
): Promise<string[]> {
  let url = devpostUrl;

  if (!url) {
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      columns: { devpostUrl: true },
    });

    if (!team) {
      throw new DevpostScrapeError(`Team ${teamId} not found`);
    }
    url = team.devpostUrl;
  }

  if (!url) {
    throw new DevpostScrapeError(`Team ${teamId} has no DevPost URL`);
  }

  const techStack = await fetchDevpostTechStack(url);

  await db.update(teams).set({ techStack }).where(eq(teams.id, teamId));

  return techStack;
}

async function pullTeamCommitLog(
  teamId: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { githubUrl: true, commitLog: true },
  });

  if (!team) throw new Error(`Team ${teamId} not found`);

  // The commit log should already be populated by the cheat check runner, so running with force=False will return the cached result
  if (!opts.force && team.commitLog) return team.commitLog.length;

  if (!team.githubUrl) throw new Error(`Team ${teamId} has no GitHub URL`);

  const parsed = parseGithubUrl(team.githubUrl);
  if (!parsed) {
    throw new Error(`Could not parse GitHub URL for team ${teamId}`);
  }

  const { hackStart, hackEnd } = requireHackWindow();

  const window = { since: hackStart, until: hackEnd };

  const commitLog = commitsInWindow(
    await fetchAllCommits(parsed.owner, parsed.repo, window),
    window,
  );

  await db.update(teams).set({ commitLog }).where(eq(teams.id, teamId));

  return commitLog.length;
}

type TeamPullResult = {
  teamId: string;
  techStack: string[] | null;
  techStackError: string | null;
  commits: number | null;
  commitsError: string | null;
};

async function pullTeamWrapped(
  teamId: string,
  opts: { force?: boolean } = {},
): Promise<TeamPullResult> {
  const [tech, commits] = await Promise.allSettled([
    pullTeamTechStack(teamId),
    pullTeamCommitLog(teamId, opts),
  ]);

  return {
    teamId,
    techStack: tech.status === "fulfilled" ? tech.value : null,
    techStackError: tech.status === "rejected" ? String(tech.reason) : null,
    commits: commits.status === "fulfilled" ? commits.value : null,
    commitsError: commits.status === "rejected" ? String(commits.reason) : null,
  };
}

// ---------------------------------------------------------------------------
// Hacker-level Github commit data
// ---------------------------------------------------------------------------

type CommitHourBucket = {
  start: Date;
  hour: number;
  commits: GithubCommit[];
};

const hourFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClockHour(date: Date, timeZone: string): number {
  let formatter = hourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
    });
    hourFormatters.set(timeZone, formatter);
  }
  return Number(formatter.format(date));
}

function commitsByAuthor(
  commits: GithubCommit[],
  username: string,
): GithubCommit[] {
  const handle = username.toLowerCase();
  return commits.filter((commit) =>
    commit.author
      ? commit.author.login.toLowerCase() === handle
      : commit.commit.author.name.toLowerCase() === handle,
  );
}

/** Groups commits into one bucket per absolute hour across `[since, until]`. */
function bucketCommitsByHour(
  commits: GithubCommit[],
  opts: { since: Date; until: Date; timeZone: string },
): CommitHourBucket[] {
  const HOUR_MS = 3_600_000;
  const sinceMs = opts.since.getTime();
  const untilMs = opts.until.getTime();

  const buckets: CommitHourBucket[] = [];
  const byStart = new Map<number, CommitHourBucket>();

  for (
    let t = Math.floor(sinceMs / HOUR_MS) * HOUR_MS;
    t <= untilMs;
    t += HOUR_MS
  ) {
    const bucket: CommitHourBucket = {
      start: new Date(t),
      hour: wallClockHour(new Date(t), opts.timeZone),
      commits: [],
    };
    buckets.push(bucket);
    byStart.set(t, bucket);
  }

  for (const commit of commits) {
    const at = new Date(commit.commit.author.date).getTime();
    if (Number.isNaN(at) || at < sinceMs || at > untilMs) continue;
    byStart.get(Math.floor(at / HOUR_MS) * HOUR_MS)?.commits.push(commit);
  }

  return buckets;
}

type HackerCommitStats = {
  githubUsername: string | null;
  /** False if the hacker's Github username was not found in the team's submitted Github usernames. */
  matchedTeamRoster: boolean;
  commits: number;
  teamCommits: number;
  nightOwlCommits: number;
  peakHour: number | null;
  hourHistogram: number[];
};

/** Collects all commits authored by an user and buckets into hourly stats. */
function deriveHackerGithubStats(
  commitLog: GithubCommit[],
  handle: string | null,
  roster: string[] | null,
  window: { since: Date; until: Date },
): HackerCommitStats {
  const normalized = handle?.trim() ?? "";
  const matchedTeamRoster =
    normalized.length > 0 &&
    (roster ?? []).some(
      (entry) =>
        getGithubUsername(entry).toLowerCase() === normalized.toLowerCase(),
    );

  const hourHistogram = Array.from({ length: 24 }, () => 0);
  const hackerCommits = normalized
    ? commitsByAuthor(commitLog, normalized)
    : [];

  for (const bucket of bucketCommitsByHour(hackerCommits, {
    ...window,
    timeZone: EVENT_TIME_ZONE,
  })) {
    hourHistogram[bucket.hour]! += bucket.commits.length;
  }

  const nightOwlCommits = hourHistogram.reduce(
    (sum, count, hour) =>
      hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR ? sum + count : sum,
    0,
  );

  const busiest = Math.max(...hourHistogram);

  return {
    githubUsername: normalized || null,
    matchedTeamRoster,
    commits: hackerCommits.length,
    teamCommits: commitLog.length,
    nightOwlCommits,
    peakHour: busiest === 0 ? null : hourHistogram.indexOf(busiest),
    hourHistogram,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const wrappedRouter = createTRPCRouter({
  /** Pulls one team's DevPost tags and Github commit log */
  pullTeam: protectedOrganizerProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await pullTeamWrapped(input.teamId);

      // Nothing landed at all — almost always a bad team id, which beats
      // handing an organizer a row of nulls to interpret.
      if (result.techStackError && result.commitsError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${result.techStackError}; ${result.commitsError}`,
        });
      }

      return result;
    }),

  /** Bulk pulls Devpost tags and Github commit log for all teams; failures come back per team rather than ending the run. */
  pullAll: protectedOrganizerProcedure
    .input(
      z
        .object({
          force: z.boolean().default(false),
          submittedOnly: z.boolean().default(true),
        })
        .default({ force: false, submittedOnly: true }),
    )
    .mutation(async ({ input }) => {
      const { force, submittedOnly } = input;

      const candidates = await db.query.teams.findMany({
        where: and(
          or(isNotNull(teams.devpostUrl), isNotNull(teams.githubUrl)),
          submittedOnly ? ne(teams.submissionStatus, "draft") : undefined,
        ),
        columns: {
          id: true,
          devpostUrl: true,
          githubUrl: true,
          techStack: true,
          commitLog: true,
        },
      });

      const skipped: string[] = [];
      const pending = candidates.filter((team) => {
        const skipTechStack = team.techStack !== null || !team.devpostUrl;
        const skipCommits = team.commitLog !== null || !team.githubUrl;
        if (!force && skipTechStack && skipCommits) {
          skipped.push(team.id);
          return false;
        }
        return true;
      });

      const pulled: TeamPullResult[] = [];
      await withConcurrency(pending, WRAPPED_CONCURRENCY, async (team) => {
        pulled.push(await pullTeamWrapped(team.id, { force }));
      });

      return {
        pulledCount: pulled.length,
        skippedCount: skipped.length,
        techStackFailures: pulled.filter((p) => p.techStackError).length,
        commitFailures: pulled.filter((p) => p.commitsError).length,
        pulled,
        skipped,
      };
    }),

  /** Derives a hacker's commit stats from their team's commit log; run after pullTeam or pullAll */
  hackerCommitStats: protectedOrganizerProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          commitLog: teams.commitLog,
          roster: teams.memberGithubUsernames,
          githubLink: applications.githubLink,
        })
        .from(users)
        .innerJoin(teams, eq(users.teamId, teams.id))
        .leftJoin(applications, eq(applications.userId, users.id))
        .where(eq(users.id, input.userId));

      if (!row?.commitLog) return null;

      const { hackStart, hackEnd } = requireHackWindow();

      return deriveHackerGithubStats(
        row.commitLog,
        row.githubLink ? getGithubUsername(row.githubLink) : null,
        row.roster,
        { since: hackStart, until: hackEnd },
      );
    }),
});
