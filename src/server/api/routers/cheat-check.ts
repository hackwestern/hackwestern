import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  hackerCheckResults,
  hackerCheckType,
  teamCheckResults,
  teamCheckType,
} from "~/server/db/schema";
import {
  findCachedHackerResult,
  findCachedTeamResult,
  hasAllHackerChecks,
  runAllTeamChecks,
  runCommitWithinAllottedTime,
  runDevpostMembersRegistered,
  runIsOfAge,
  runIsRegistered,
  runOnlyTeamMemberCommits,
} from "~/server/api/utils/cheat-check-runners";
import {
  createSweep,
  getSweepStatus,
  kickWorker,
  resumeSweep,
} from "~/server/api/utils/cheat-check-sweep";

const userIdInput = z.object({ userId: z.string() });
const teamIdInput = z.object({ teamId: z.string() });

// Pass forceRerun to each cheat check to skip the cached result and force re-evaluation.
export const cheatCheckRouter = createTRPCRouter({
  isOfAge: protectedOrganizerProcedure
    .input(userIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await findCachedHackerResult(input.userId, "IS_OF_AGE");
        if (cached) return { ...cached, fromCache: true };
      }

      const result = await runIsOfAge(input.userId, ctx.session.user.id);
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that the hacker was physically checked in at the event.
   */
  isRegistered: protectedOrganizerProcedure
    .input(userIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await findCachedHackerResult(
          input.userId,
          "IS_REGISTERED",
        );
        if (cached) return { ...cached, fromCache: true };
      }

      const result = await runIsRegistered(input.userId, ctx.session.user.id);
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
        if (hasAllHackerChecks(cached)) {
          return { results: cached, fromCache: true };
        }
      }

      const [ageResult, registeredResult] = await Promise.all([
        runIsOfAge(input.userId, organizerId),
        runIsRegistered(input.userId, organizerId),
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
    .input(teamIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await findCachedTeamResult(
          input.teamId,
          "COMMIT_WITHIN_ALLOTTED_TIME",
        );
        if (cached) return { ...cached, fromCache: true };
      }

      const result = await runCommitWithinAllottedTime(
        input.teamId,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that Github contributors matches the Github usernames submitted by the team.
   */
  onlyTeamMemberCommits: protectedOrganizerProcedure
    .input(teamIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await findCachedTeamResult(
          input.teamId,
          "ONLY_TEAM_MEMBER_COMMITS",
        );
        if (cached) return { ...cached, fromCache: true };
      }

      const result = await runOnlyTeamMemberCommits(
        input.teamId,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Checks that the people listed on DevPost match the team registered on HackWestern.
   */
  devPostMembersAreRegistered: protectedOrganizerProcedure
    .input(teamIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      if (!input.forceRerun) {
        const cached = await findCachedTeamResult(
          input.teamId,
          "DEVPOST_MEMBERS_REGISTERED",
        );
        if (cached) return { ...cached, fromCache: true };
      }

      const result = await runDevpostMembersRegistered(
        input.teamId,
        ctx.session.user.id,
      );
      return { ...result, fromCache: false };
    }),

  /**
   * Runs every team check for one team and returns them together — the
   * synchronous counterpart to a sweep, for when an organizer wants one team
   * looked at now rather than waiting for the queue to drain.
   *
   * One failing check (a deleted repo, a DevPost 404) does not discard the
   * others — `failures` carries the messages for the ones that threw.
   */
  runAllTeamChecks: protectedOrganizerProcedure
    .input(teamIdInput.extend({ forceRerun: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const { results, failures, skipped } = await runAllTeamChecks(
        input.teamId,
        ctx.session.user.id,
        { forceRerun: input.forceRerun },
      );

      return {
        results,
        skipped,
        failures: failures.map((f) =>
          f instanceof Error ? f.message : String(f),
        ),
      };
    }),

  // -------------------------------------------------------------------------
  // Batch helpers
  // -------------------------------------------------------------------------

  /**
   * Returns all cached check results for a team.
   * The frontend calls this on page load; it never triggers re-runs.
   */
  getCachedTeamResults: protectedOrganizerProcedure
    .input(teamIdInput)
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
   * Manually override the result of a hacker check and/or add a note.
   * Set manualOverride to null to clear a previous override.
   */
  overrideHackerCheck: protectedOrganizerProcedure
    .input(
      userIdInput.extend({
        checkType: z.enum(hackerCheckType.enumValues),
        manualOverride: z.boolean().nullable(),
        notes: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db
        .update(hackerCheckResults)
        .set({ manualOverride: input.manualOverride, notes: input.notes })
        .where(
          and(
            eq(hackerCheckResults.userId, input.userId),
            eq(hackerCheckResults.checkType, input.checkType),
          ),
        )
        .returning();

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No check result found for this user and check type",
        });
      }

      return result;
    }),

  /**
   * Manually override the result of a team check and/or add a note.
   * Set manualOverride to null to clear a previous override.
   */
  overrideTeamCheck: protectedOrganizerProcedure
    .input(
      z.object({
        teamId: z.string(),
        checkType: z.enum(teamCheckType.enumValues),
        manualOverride: z.boolean().nullable(),
        notes: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db
        .update(teamCheckResults)
        .set({ manualOverride: input.manualOverride, notes: input.notes })
        .where(
          and(
            eq(teamCheckResults.teamId, input.teamId),
            eq(teamCheckResults.checkType, input.checkType),
          ),
        )
        .returning();

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No check result found for this team and check type",
        });
      }

      return result;
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

  // -------------------------------------------------------------------------
  // Automated sweeps
  // -------------------------------------------------------------------------

  /**
   * Progress of the running sweep, or of the most recent one if none is running.
   * `stalled` means the worker has gone quiet and the sweep needs resuming.
   */
  getSweepStatus: protectedOrganizerProcedure.query(async () => {
    return getSweepStatus();
  }),

  /**
   * Re-kick a stalled or rate-limited sweep: clears the rate-limit stamp, puts
   * items abandoned by a dead worker back in the queue, and starts a new worker.
   */
  resumeSweep: protectedOrganizerProcedure.mutation(async () => {
    return resumeSweep();
  }),

  /**
   * Start a full sweep by hand, without waiting for the judging queue to drain.
   * Pass forceRerun to re-check teams that already have cached results.
   */
  startSweep: protectedOrganizerProcedure
    .input(
      z.object({ forceRerun: z.boolean().default(false) }).default({
        forceRerun: false,
      }),
    )
    .mutation(async ({ input }) => {
      const sweep = await createSweep("manual", {
        forceRerun: input.forceRerun,
      });

      if (!sweep) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A cheat check sweep is already running",
        });
      }

      if (sweep.status === "running") await kickWorker();
      return sweep;
    }),
});
