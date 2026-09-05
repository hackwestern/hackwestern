/**
 * The cheat-check bodies, extracted from `~/server/api/routers/cheat-check.ts`
 * so they can run without a tRPC session.
 *
 * The router procedures are thin wrappers over these (they keep the cache
 * lookup and the `fromCache` return shape); the automated sweep worker at
 * `/api/cheat-check/sweep` calls them directly, attributing results to
 * `SYSTEM_USER_ID`.
 *
 * Mirrors the plain-function style of `./approval.ts`: ids in, the singleton
 * `db` imported directly, no `ctx`.
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  applications,
  dayOfRegistrations,
  hackerCheckResults,
  hackerCheckType,
  teamCheckResults,
  teamCheckType,
  teams,
  users,
} from "~/server/db/schema";
import { env } from "~/env";
import {
  fetchAllCommits,
  fetchContributors,
  parseGithubUrl,
} from "~/utils/github";

const AGE_THRESHOLD = 18;

export type HackerCheckType = (typeof hackerCheckType.enumValues)[number];
export type TeamCheckType = (typeof teamCheckType.enumValues)[number];

/**
 * The user row that automated sweeps attribute their results to. `checkedByUserId`
 * is NOT NULL with an FK to `users`, and a sweep has no organizer behind it.
 */
export const SYSTEM_USER_ID = "system";

/**
 * Idempotently ensures the actor row that automated sweeps attribute results to.
 *
 * The row has no `password` and no `account`, so it cannot be logged into. It is
 * also not a member of any team, so `runHackerChecksBulk` (which is scoped to
 * team members) never picks it up.
 */
export async function ensureSystemUser(): Promise<void> {
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      name: "Automated Cheat Check",
      email: "system@hackwestern.com",
      type: "organizer",
    })
    .onConflictDoNothing();
}

export async function upsertHackerResult(
  userId: string,
  checkType: HackerCheckType,
  passed: boolean,
  details: Record<string, unknown>,
  checkedByUserId: string,
) {
  const [result] = await db
    .insert(hackerCheckResults)
    .values({ userId, checkType, passed, details, checkedByUserId })
    .onConflictDoUpdate({
      target: [hackerCheckResults.userId, hackerCheckResults.checkType],
      set: { passed, details, checkedByUserId, checkedAt: new Date() },
    })
    .returning();

  return result!;
}

export async function upsertTeamResult(
  teamId: string,
  checkType: TeamCheckType,
  passed: boolean,
  details: Record<string, unknown>,
  checkedByUserId: string,
) {
  const [result] = await db
    .insert(teamCheckResults)
    .values({ teamId, checkType, passed, details, checkedByUserId })
    .onConflictDoUpdate({
      target: [teamCheckResults.teamId, teamCheckResults.checkType],
      set: { passed, details, checkedByUserId, checkedAt: new Date() },
    })
    .returning();

  return result!;
}

/**
 * Multi-row variant of `upsertHackerResult`, for the sweep's bulk pass. One
 * statement instead of N round-trips; `excluded.*` pulls the new values through
 * the conflict clause.
 */
async function upsertHackerResultsBulk(
  values: {
    userId: string;
    checkType: HackerCheckType;
    passed: boolean;
    details: Record<string, unknown>;
    checkedByUserId: string;
  }[],
) {
  if (values.length === 0) return [];

  return db
    .insert(hackerCheckResults)
    .values(values)
    .onConflictDoUpdate({
      target: [hackerCheckResults.userId, hackerCheckResults.checkType],
      set: {
        passed: sql`excluded.passed`,
        details: sql`excluded.details`,
        checkedByUserId: sql`excluded.checked_by_user_id`,
        checkedAt: new Date(),
      },
    })
    .returning();
}

// ---------------------------------------------------------------------------
// Per-check runners
// ---------------------------------------------------------------------------

/**
 * Checks that the hacker is old enough to compete.
 */
export async function runIsOfAge(userId: string, actorUserId: string) {
  const application = await db.query.applications.findFirst({
    where: eq(applications.userId, userId),
    columns: { age: true },
  });

  if (!application) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Application not found",
    });
  }

  const passed = application.age !== null && application.age >= AGE_THRESHOLD;
  const details = { age: application.age, threshold: AGE_THRESHOLD };

  return upsertHackerResult(userId, "IS_OF_AGE", passed, details, actorUserId);
}

/**
 * Checks that the hacker was physically checked in at the event.
 */
export async function runIsRegistered(userId: string, actorUserId: string) {
  const dayOf = await db.query.dayOfRegistrations.findFirst({
    where: eq(dayOfRegistrations.userId, userId),
    columns: { signedInAt: true },
  });

  const passed = !!dayOf?.signedInAt;
  const details = { signedInAt: dayOf?.signedInAt ?? null };

  return upsertHackerResult(
    userId,
    "IS_REGISTERED",
    passed,
    details,
    actorUserId,
  );
}

/**
 * Checks that the first and last commits on the team's GitHub repo fall within
 * the allotted hacking window.
 */
export async function runCommitWithinAllottedTime(
  teamId: string,
  actorUserId: string,
) {
  const submission = await requireSubmission(teamId);
  const parsed = parseGithubUrl(submission.githubUrl);
  if (!parsed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not parse GitHub URL",
    });
  }

  const window = requireHackWindow();

  const commits = await fetchAllCommits(parsed.owner, parsed.repo);
  const violations = commits.filter((c) => {
    const date = new Date(c.commit.author.date);
    return date < window.hackStart || date > window.hackEnd;
  });

  // Sort all commits chronologically to find true first/last
  const sorted = [...commits].sort(
    (a, b) =>
      new Date(a.commit.author.date).getTime() -
      new Date(b.commit.author.date).getTime(),
  );

  const details = {
    hackStart: window.hackStart.toISOString(),
    hackEnd: window.hackEnd.toISOString(),
    totalCommits: commits.length,
    firstCommit: sorted[0]
      ? {
          sha: sorted[0].sha,
          date: sorted[0].commit.author.date,
          author: sorted[0].commit.author.name,
        }
      : null,
    lastCommit: sorted.at(-1)
      ? {
          sha: sorted.at(-1)!.sha,
          date: sorted.at(-1)!.commit.author.date,
          author: sorted.at(-1)!.commit.author.name,
        }
      : null,
    violations: violations.map((c) => ({
      sha: c.sha,
      date: c.commit.author.date,
      author: c.commit.author.name,
      message: c.commit.message.split("\n")[0],
    })),
  };

  return upsertTeamResult(
    teamId,
    "COMMIT_WITHIN_ALLOTTED_TIME",
    violations.length === 0,
    details,
    actorUserId,
  );
}

/**
 * Checks that Github contributors matches the Github usernames submitted by the team.
 */
export async function runOnlyTeamMemberCommits(
  teamId: string,
  actorUserId: string,
) {
  const submission = await requireSubmission(teamId);
  const parsed = parseGithubUrl(submission.githubUrl);
  if (!parsed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not parse GitHub URL",
    });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { memberGithubUsernames: true },
  });

  const registeredLogins = new Set(
    (team?.memberGithubUsernames ?? []).map((u) => u.toLowerCase()),
  );

  const contributors = await fetchContributors(parsed.owner, parsed.repo);

  const unregistered = contributors.filter(
    (c) => !registeredLogins.has(c.login.toLowerCase()),
  );

  const details = {
    registeredGithubLogins: [...registeredLogins],
    unregisteredContributors: unregistered.map((c) => ({
      login: c.login,
      contributions: c.contributions,
    })),
  };

  return upsertTeamResult(
    teamId,
    "ONLY_TEAM_MEMBER_COMMITS",
    unregistered.length === 0,
    details,
    actorUserId,
  );
}

/**
 * Checks that the people listed on DevPost match the team registered on HackWestern.
 */
export async function runDevpostMembersRegistered(
  teamId: string,
  actorUserId: string,
) {
  const submission = await requireSubmission(teamId);

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { memberDevpostUsernames: true },
  });

  const registeredDevpostUsernames = new Set(
    (team?.memberDevpostUsernames ?? []).map((u) => u.toLowerCase()),
  );

  const devpostCollaborators = await getDevpostCollaboratorUsernames(
    submission.devpostUrl,
  );

  const unmatched = devpostCollaborators.filter(
    (u) => !registeredDevpostUsernames.has(u.toLowerCase()),
  );

  const details = {
    devpostCollaborators,
    registeredDevpostUsernames: [...registeredDevpostUsernames],
    unmatchedCollaborators: unmatched,
  };

  return upsertTeamResult(
    teamId,
    "DEVPOST_MEMBERS_REGISTERED",
    unmatched.length === 0,
    details,
    actorUserId,
  );
}

// ---------------------------------------------------------------------------
// Aggregators
// ---------------------------------------------------------------------------

const TEAM_CHECK_RUNNERS: Record<
  TeamCheckType,
  (teamId: string, actorUserId: string) => Promise<unknown>
> = {
  COMMIT_WITHIN_ALLOTTED_TIME: runCommitWithinAllottedTime,
  ONLY_TEAM_MEMBER_COMMITS: runOnlyTeamMemberCommits,
  DEVPOST_MEMBERS_REGISTERED: runDevpostMembersRegistered,
};

export interface RunAllTeamChecksResult {
  results: (typeof teamCheckResults.$inferSelect)[];
  /** The rejection reasons, one per check that threw. Empty on a clean run. */
  failures: unknown[];
  /** Check types skipped because a cached result already existed. */
  skipped: TeamCheckType[];
}

/**
 * Runs every team check for one team.
 *
 * The three checks are independent network calls, so they run under
 * `Promise.allSettled` — a deleted repo or a 404 on DevPost fails its own check
 * without discarding the other two. Unless `forceRerun` is set, check types that
 * already have a cached result are skipped (a sweep is not meant to re-scrape
 * work an organizer already did by hand).
 */
export async function runAllTeamChecks(
  teamId: string,
  actorUserId: string,
  opts: { forceRerun?: boolean } = {},
): Promise<RunAllTeamChecksResult> {
  const cached = opts.forceRerun
    ? new Set<TeamCheckType>()
    : await getCachedTeamCheckTypes(teamId);

  const pending = teamCheckType.enumValues.filter((t) => !cached.has(t));
  const settled = await Promise.allSettled(
    pending.map((checkType) =>
      TEAM_CHECK_RUNNERS[checkType](teamId, actorUserId),
    ),
  );

  const results: (typeof teamCheckResults.$inferSelect)[] = [];
  const failures: unknown[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value as typeof teamCheckResults.$inferSelect);
    } else {
      failures.push(outcome.reason);
    }
  }

  return { results, failures, skipped: [...cached] };
}

/**
 * Runs both hacker checks for many users at once.
 *
 * Unlike the per-user path these are pure DB reads, so the whole set collapses
 * into one join plus one multi-row upsert per check type. Users with no
 * `application` row are skipped rather than thrown on — one member without an
 * application must not abort a sweep.
 */
export async function runHackerChecksBulk(
  userIds: string[],
  actorUserId: string,
  opts: { forceRerun?: boolean } = {},
): Promise<{ upserted: number; skipped: number }> {
  if (userIds.length === 0) return { upserted: 0, skipped: 0 };

  const rows = await db
    .select({
      userId: users.id,
      age: applications.age,
      signedInAt: dayOfRegistrations.signedInAt,
      hasApplication: applications.userId,
    })
    .from(users)
    .leftJoin(applications, eq(applications.userId, users.id))
    .leftJoin(dayOfRegistrations, eq(dayOfRegistrations.userId, users.id))
    .where(inArray(users.id, userIds));

  const cached = opts.forceRerun
    ? new Set<string>()
    : await getCachedHackerCheckKeys(userIds);

  const values: Parameters<typeof upsertHackerResultsBulk>[0] = [];
  let skipped = 0;

  for (const row of rows) {
    // `IS_OF_AGE` reads `applications.age`; without an application there is
    // nothing to check, so the user drops out of this pass entirely.
    if (row.hasApplication === null) {
      skipped++;
      continue;
    }

    if (!cached.has(`${row.userId}:IS_OF_AGE`)) {
      values.push({
        userId: row.userId,
        checkType: "IS_OF_AGE",
        passed: row.age !== null && row.age >= AGE_THRESHOLD,
        details: { age: row.age, threshold: AGE_THRESHOLD },
        checkedByUserId: actorUserId,
      });
    }

    if (!cached.has(`${row.userId}:IS_REGISTERED`)) {
      values.push({
        userId: row.userId,
        checkType: "IS_REGISTERED",
        passed: !!row.signedInAt,
        details: { signedInAt: row.signedInAt ?? null },
        checkedByUserId: actorUserId,
      });
    }
  }

  const upserted = await upsertHackerResultsBulk(values);
  return { upserted: upserted.length, skipped };
}

// ---------------------------------------------------------------------------
// Cache lookups
// ---------------------------------------------------------------------------

/** The team check types that already have a stored result for this team. */
export async function getCachedTeamCheckTypes(
  teamId: string,
): Promise<Set<TeamCheckType>> {
  const rows = await db
    .select({ checkType: teamCheckResults.checkType })
    .from(teamCheckResults)
    .where(eq(teamCheckResults.teamId, teamId));

  return new Set(rows.map((r) => r.checkType));
}

/** The hacker check types that already have a stored result, keyed `userId:checkType`. */
async function getCachedHackerCheckKeys(
  userIds: string[],
): Promise<Set<string>> {
  const rows = await db
    .select({
      userId: hackerCheckResults.userId,
      checkType: hackerCheckResults.checkType,
    })
    .from(hackerCheckResults)
    .where(inArray(hackerCheckResults.userId, userIds));

  return new Set(rows.map((r) => `${r.userId}:${r.checkType}`));
}

/**
 * Whether `rows` cover every hacker check type.
 *
 * Takes the rows rather than a userId so the caller can decide from results it
 * has already fetched — the cached path would otherwise read
 * `hacker_check_result` twice for the same user.
 */
export function hasAllHackerChecks(
  rows: { checkType: HackerCheckType }[],
): boolean {
  const present = new Set(rows.map((r) => r.checkType));
  return hackerCheckType.enumValues.every((t) => present.has(t));
}

/** A single cached hacker check result, or undefined. */
export function findCachedHackerResult(
  userId: string,
  checkType: HackerCheckType,
) {
  return db.query.hackerCheckResults.findFirst({
    where: and(
      eq(hackerCheckResults.userId, userId),
      eq(hackerCheckResults.checkType, checkType),
    ),
  });
}

/** A single cached team check result, or undefined. */
export function findCachedTeamResult(teamId: string, checkType: TeamCheckType) {
  return db.query.teamCheckResults.findFirst({
    where: and(
      eq(teamCheckResults.teamId, teamId),
      eq(teamCheckResults.checkType, checkType),
    ),
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function requireHackWindow() {
  if (!env.HACK_START || !env.HACK_END) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "HACK_START and HACK_END environment variables must be set before running commit checks",
    });
  }
  return {
    hackStart: new Date(env.HACK_START),
    hackEnd: new Date(env.HACK_END),
  };
}

export async function requireSubmission(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: {
      id: true,
      devpostUrl: true,
      githubUrl: true,
      submissionStatus: true,
    },
  });

  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
  }

  if (!team.githubUrl || !team.devpostUrl) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This team has not submitted yet",
    });
  }

  return { ...team, githubUrl: team.githubUrl, devpostUrl: team.devpostUrl };
}

/** Scrapes the DevPost project page and returns the collaborator usernames from href attributes. */
export async function getDevpostCollaboratorUsernames(
  devpostUrl: string,
): Promise<string[]> {
  const res = await fetch(devpostUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; HackWesternCheatCheck/1.0; +https://hackwestern.com)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `DevPost fetch failed with status ${res.status}`,
    });
  }

  const html = await res.text();
  const blockMatch = html.match(
    /<ul[^>]+id="collaborators"[^>]*>([\s\S]*?)<\/ul>/,
  );
  if (!blockMatch?.[1]) return [];

  const block = blockMatch[1];
  const usernames: string[] = [];
  const hrefRegex = /href="\/([^/"?\s]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(block)) !== null) {
    if (match[1]) usernames.push(match[1]);
  }

  return usernames;
}
