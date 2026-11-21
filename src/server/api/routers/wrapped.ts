/**
 * Organizer-facing data pulls for HackWestern Wrapped.
 *
 * Triggered by hand after the event: one pull fetches each team's Github
 * commits, and everything derived from them is computed on read.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
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
// Team-level Github data pulls
// ---------------------------------------------------------------------------

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
  commits: number | null;
  commitsError: string | null;
};

async function pullTeamWrapped(
  teamId: string,
  opts: { force?: boolean } = {},
): Promise<TeamPullResult> {
  try {
    const commits = await pullTeamCommitLog(teamId, opts);
    return { teamId, commits, commitsError: null };
  } catch (err) {
    return { teamId, commits: null, commitsError: String(err) };
  }
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
  /** Pulls one team's Github commit log */
  pullTeam: protectedOrganizerProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await pullTeamWrapped(input.teamId);

      if (result.commitsError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.commitsError,
        });
      }

      return result;
    }),

  /** Bulk pulls the Github commit log for all teams; failures come back per team rather than ending the run. */
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
          isNotNull(teams.githubUrl),
          submittedOnly ? ne(teams.submissionStatus, "draft") : undefined,
        ),
        columns: {
          id: true,
          commitLog: true,
        },
      });

      const skipped: string[] = [];
      const pending = candidates.filter((team) => {
        if (!force && team.commitLog !== null) {
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
