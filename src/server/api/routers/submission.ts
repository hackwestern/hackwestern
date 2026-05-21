import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { teams, users } from "~/server/db/schema";

export const submissionRouter = createTRPCRouter({
  /**
   * Submit a team's GitHub repo and DevPost project URL.
   * Any team member can call this; updating is allowed until the deadline.
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

      const [updated] = await db
        .update(teams)
        .set({
          devpostUrl: input.devpostUrl,
          githubUrl: input.githubUrl,
          submissionStatus: "submitted",
          submittedAt: new Date(),
        })
        .where(eq(teams.id, user.teamId))
        .returning();

      return updated;
    }),

  /**
   * Returns the calling user's team submission fields, or null if not on a team.
   */
  getMySubmission: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { teamId: true },
    });

    if (!user?.teamId) return null;

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, user.teamId),
      columns: {
        id: true,
        name: true,
        devpostUrl: true,
        githubUrl: true,
        submissionStatus: true,
        submittedAt: true,
        tracks: true,
      },
    });

    return team ?? null;
  }),

  /**
   * Returns all teams with their submission info. Organizer only.
   */
  getAll: protectedOrganizerProcedure.query(async () => {
    return db.query.teams.findMany({
      columns: {
        id: true,
        name: true,
        devpostUrl: true,
        githubUrl: true,
        submissionStatus: true,
        submittedAt: true,
        tracks: true,
      },
      with: {
        members: { columns: { id: true, name: true, email: true } },
      },
    });
  }),

  /**
   * Returns submission info for a specific team. Organizer only.
   */
  getByTeam: protectedOrganizerProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
        columns: {
          id: true,
          name: true,
          devpostUrl: true,
          githubUrl: true,
          submissionStatus: true,
          submittedAt: true,
          tracks: true,
        },
        with: {
          members: { columns: { id: true, name: true, email: true } },
        },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      return team;
    }),
});
