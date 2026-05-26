import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  applications,
  dayOfRegistrations,
  hackerCheckResults,
  teamCheckResults,
  teams,
  type hackerCheckType,
  type teamCheckType,
} from "~/server/db/schema";
import { env } from "~/env";
import {
  LARGE_COMMIT_THRESHOLD,
  fetchAllCommits,
  fetchCommitStats,
  fetchContributors,
  parseGithubUrl,
} from "~/utils/github";

const AGE_THRESHOLD = 18;

type HackerCheckType = (typeof hackerCheckType.enumValues)[number];
type TeamCheckType = (typeof teamCheckType.enumValues)[number];

async function upsertHackerResult(
  userId: string,
  checkType: HackerCheckType,
  passed: boolean,
  details: Record<string, unknown>,
  checkedByUserId: string,
) {
  await db
    .delete(hackerCheckResults)
    .where(
      and(
        eq(hackerCheckResults.userId, userId),
        eq(hackerCheckResults.checkType, checkType),
      ),
    );

  const [result] = await db
    .insert(hackerCheckResults)
    .values({ userId, checkType, passed, details, checkedByUserId })
    .returning();

  return result!;
}

async function upsertTeamResult(
  teamId: string,
  checkType: TeamCheckType,
  passed: boolean,
  details: Record<string, unknown>,
  checkedByUserId: string,
) {
  await db
    .delete(teamCheckResults)
    .where(
      and(
        eq(teamCheckResults.teamId, teamId),
        eq(teamCheckResults.checkType, checkType),
      ),
    );

  const [result] = await db
    .insert(teamCheckResults)
    .values({ teamId, checkType, passed, details, checkedByUserId })
    .returning();

  return result!;
}

const userIdInput = z.object({ userId: z.string() });

// Pass forceRerun to each cheat check to skip the cached result and force re-evaluation.
export const cheatCheckRouter = createTRPCRouter({
  isOfAge: protectedOrganizerProcedure
    .input(userIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.hackerCheckResults.findFirst({
          where: and(
            eq(hackerCheckResults.userId, input.userId),
            eq(hackerCheckResults.checkType, "IS_OF_AGE"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const application = await db.query.applications.findFirst({
        where: eq(applications.userId, input.userId),
        columns: { age: true },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const passed =
        application.age !== null && application.age >= AGE_THRESHOLD;
      const details = { age: application.age, threshold: AGE_THRESHOLD };

      const result = await upsertHackerResult(
        input.userId,
        "IS_OF_AGE",
        passed,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that the hacker was physically checked in at the event.
   */
  isRegistered: protectedOrganizerProcedure
    .input(userIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.hackerCheckResults.findFirst({
          where: and(
            eq(hackerCheckResults.userId, input.userId),
            eq(hackerCheckResults.checkType, "IS_REGISTERED"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const dayOf = await db.query.dayOfRegistrations.findFirst({
        where: eq(dayOfRegistrations.userId, input.userId),
        columns: { signedInAt: true },
      });

      const passed = !!dayOf?.signedInAt;
      const details = { signedInAt: dayOf?.signedInAt ?? null };

      const result = await upsertHackerResult(
        input.userId,
        "IS_REGISTERED",
        passed,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Runs all hacker checks for a user and returns them together.
   * Designed so the frontend can call this for every team member concurrently.
   */
  runAllHackerChecks: protectedOrganizerProcedure
    .input(userIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      const organizerId = ctx.session.user.id;

      if (!input.forceRerun) {
        const cached = await db.query.hackerCheckResults.findMany({
          where: eq(hackerCheckResults.userId, input.userId),
        });
        if (cached.length === 2) return { results: cached, fromCache: true };
      }

      const [application, dayOf] = await Promise.all([
        db.query.applications.findFirst({
          where: eq(applications.userId, input.userId),
          columns: { age: true },
        }),
        db.query.dayOfRegistrations.findFirst({
          where: eq(dayOfRegistrations.userId, input.userId),
          columns: { signedInAt: true },
        }),
      ]);

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const [ageResult, registeredResult] = await Promise.all([
        upsertHackerResult(
          input.userId,
          "IS_OF_AGE",
          application.age !== null && application.age >= AGE_THRESHOLD,
          { age: application.age, threshold: AGE_THRESHOLD },
          organizerId,
        ),
        upsertHackerResult(
          input.userId,
          "IS_REGISTERED",
          !!dayOf?.signedInAt,
          { signedInAt: dayOf?.signedInAt ?? null },
          organizerId,
        ),
      ]);

      return {
        results: [ageResult, registeredResult],
        fromCache: false,
      };
    }),

  // -------------------------------------------------------------------------
  // Github/Devpost checks — per team
  // -------------------------------------------------------------------------

  /**
   * Checks that the first and last commits on the team's GitHub repo fall within
   * the allotted hacking window.
   */
  commitWithinAllottedTime: protectedOrganizerProcedure
    .input(
      z.object({ teamId: z.string(), forceRerun: z.boolean().default(false) }),
    )
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.teamCheckResults.findFirst({
          where: and(
            eq(teamCheckResults.teamId, input.teamId),
            eq(teamCheckResults.checkType, "COMMIT_WITHIN_ALLOTTED_TIME"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const submission = await requireSubmission(input.teamId);
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

      const result = await upsertTeamResult(
        input.teamId,
        "COMMIT_WITHIN_ALLOTTED_TIME",
        violations.length === 0,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that Github contributors matches the Github usernames submitted by the team.
   */
  onlyTeamMemberCommits: protectedOrganizerProcedure
    .input(
      z.object({ teamId: z.string(), forceRerun: z.boolean().default(false) }),
    )
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.teamCheckResults.findFirst({
          where: and(
            eq(teamCheckResults.teamId, input.teamId),
            eq(teamCheckResults.checkType, "ONLY_TEAM_MEMBER_COMMITS"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const submission = await requireSubmission(input.teamId);
      const parsed = parseGithubUrl(submission.githubUrl);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not parse GitHub URL",
        });
      }

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
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

      const result = await upsertTeamResult(
        input.teamId,
        "ONLY_TEAM_MEMBER_COMMITS",
        unregistered.length === 0,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Flags a suspiciously large first commit within T+6 hours of start of the hack window.
   */
  largeFirstCommit: protectedOrganizerProcedure
    .input(
      z.object({ teamId: z.string(), forceRerun: z.boolean().default(false) }),
    )
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.teamCheckResults.findFirst({
          where: and(
            eq(teamCheckResults.teamId, input.teamId),
            eq(teamCheckResults.checkType, "LARGE_FIRST_COMMIT"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const submission = await requireSubmission(input.teamId);
      const parsed = parseGithubUrl(submission.githubUrl);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not parse GitHub URL",
        });
      }

      const window = requireHackWindow();
      const commits = await fetchAllCommits(parsed.owner, parsed.repo);

      const sixHoursAfterStart = new Date(
        window.hackStart.getTime() + 6 * 60 * 60 * 1000,
      );
      const commitsWithinWindow = commits
        .filter((c) => {
          const date = new Date(c.commit.author.date);
          return date >= window.hackStart && date <= sixHoursAfterStart;
        })
        .sort(
          (a, b) =>
            new Date(a.commit.author.date).getTime() -
            new Date(b.commit.author.date).getTime(),
        );

      let firstCommitStats: {
        additions: number;
        deletions: number;
        total: number;
      } | null = null;
      let passed = true;

      if (commitsWithinWindow[0]) {
        firstCommitStats = await fetchCommitStats(
          parsed.owner,
          parsed.repo,
          commitsWithinWindow[0].sha,
        );
        passed = firstCommitStats.additions <= LARGE_COMMIT_THRESHOLD;
      }

      const details = {
        firstCommitSha: commitsWithinWindow[0]?.sha ?? null,
        firstCommitDate: commitsWithinWindow[0]?.commit.author.date ?? null,
        firstCommitStats,
        largeCommitThreshold: LARGE_COMMIT_THRESHOLD,
      };

      const result = await upsertTeamResult(
        input.teamId,
        "LARGE_FIRST_COMMIT",
        passed,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that the people listed on DevPost match the team registered on HackWestern.
   */
  devPostMembersAreRegistered: protectedOrganizerProcedure
    .input(
      z.object({ teamId: z.string(), forceRerun: z.boolean().default(false) }),
    )
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await db.query.teamCheckResults.findFirst({
          where: and(
            eq(teamCheckResults.teamId, input.teamId),
            eq(teamCheckResults.checkType, "DEVPOST_MEMBERS_REGISTERED"),
          ),
        });
        if (cached) return { ...cached, fromCache: true };
      }

      const submission = await requireSubmission(input.teamId);

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
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

      const result = await upsertTeamResult(
        input.teamId,
        "DEVPOST_MEMBERS_REGISTERED",
        unmatched.length === 0,
        details,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  // -------------------------------------------------------------------------
  // Batch helpers
  // -------------------------------------------------------------------------

  /**
   * Returns all cached check results for a team.
   * The frontend calls this on page load; it never triggers re-runs.
   */
  getCachedTeamResults: protectedOrganizerProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      return db.query.teamCheckResults.findMany({
        where: eq(teamCheckResults.teamId, input.teamId),
      });
    }),

  /**
   * Returns all cached check results for a hacker.
   */
  getCachedHackerResults: protectedOrganizerProcedure
    .input(userIdInput)
    .query(async ({ input }) => {
      return db.query.hackerCheckResults.findMany({
        where: eq(hackerCheckResults.userId, input.userId),
      });
    }),

  /**
   * Returns all cached results for every team (for the overview table).
   * Groups results by teamId.
   */
  getAllCachedTeamResults: protectedOrganizerProcedure.query(async () => {
    const allTeams = await db.query.teams.findMany({
      with: {
        checkResults: true,
        members: { columns: { id: true, name: true, email: true } },
      },
    });

    return allTeams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      submission:
        team.devpostUrl && team.githubUrl
          ? {
              devpostUrl: team.devpostUrl,
              githubUrl: team.githubUrl,
              submittedAt: team.submittedAt,
            }
          : null,
      members: team.members,
      checks: team.checkResults,
    }));
  }),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireHackWindow() {
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

async function requireSubmission(teamId: string) {
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
async function getDevpostCollaboratorUsernames(
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
