import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { submissions, teams, users } from "~/server/db/schema";

export const submissionRouter = createTRPCRouter({
  /**
   * Submit a team's GitHub repo and DevPost project URL.
   * Any team member can call this; it upserts so re-submissions are allowed until close.
   */
  submit: protectedProcedure
    .input(
      z.object({
        devpostUrl: z
          .string()
          .url()
          .refine((u) => u.includes("devpost.com"), {
            message: "Must be a DevPost URL",
          }),
        githubUrl: z
          .string()
          .url()
          .refine((u) => u.includes("github.com"), {
            message: "Must be a GitHub URL",
          }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { teamId: true },
      });

      if (!user?.teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must be on a team before submitting",
        });
      }

      const existing = await db.query.submissions.findFirst({
        where: eq(submissions.teamId, user.teamId),
      });

      if (existing) {
        const [updated] = await db
          .update(submissions)
          .set({
            devpostUrl: input.devpostUrl,
            githubUrl: input.githubUrl,
            submittedAt: new Date(),
            submittedByUserId: userId,
          })
          .where(eq(submissions.teamId, user.teamId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(submissions)
        .values({
          teamId: user.teamId,
          devpostUrl: input.devpostUrl,
          githubUrl: input.githubUrl,
          submittedByUserId: userId,
        })
        .returning();

      return created;
    }),

  /**
   * Returns the calling user's team submission, or null if none exists yet.
   */
  getMySubmission: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { teamId: true },
    });

    if (!user?.teamId) return null;

    return db.query.submissions.findFirst({
      where: eq(submissions.teamId, user.teamId),
    });
  }),

  /**
   * Returns all team submissions. Organizer only.
   */
  getAll: protectedOrganizerProcedure.query(async () => {
    return db.query.submissions.findMany({
      with: {
        team: { columns: { id: true, name: true } },
        submittedBy: { columns: { id: true, name: true, email: true } },
      },
    });
  }),

  /**
   * Returns the submission for a specific team. Organizer only.
   */
  getByTeam: protectedOrganizerProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
        columns: { id: true },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      return db.query.submissions.findFirst({
        where: eq(submissions.teamId, input.teamId),
        with: {
          team: { columns: { id: true, name: true } },
          submittedBy: { columns: { id: true, name: true, email: true } },
        },
      });
    }),
});
