import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import z from "zod";
import { db } from "~/server/db";
import { teams, users } from "~/server/db/schema";
import { count, eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export const teamsRouter = createTRPCRouter({
  createTeam: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await db.query.users.findFirst({
        columns: { teamId: true },
        where: eq(users.id, ctx.session.user.id),
      });
      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      if (team.teamId != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This user it already a part of a team, leave their current team to create a new one",
        });
      }
      if (!input.name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A team name is required to create a team",
        });
      }

      const id = randomBytes(3).toString("hex");

      await db.insert(teams).values({
        id: id,
        name: input.name,
      });
      await db
        .update(users)
        .set({ teamId: id })
        .where(eq(users.id, ctx.session.user.id));

      return {
        teamId: id,
      };
    }),
  joinTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentTeam = await db.query.users.findFirst({
        columns: { teamId: true },
        where: eq(users.id, ctx.session.user.id),
      });
      if (!currentTeam) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      if (currentTeam.teamId != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This user it already a part of a team, leave their current team to join a new one",
        });
      }
      if (!input.teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No specified teamId",
        });
      }
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, input.teamId),
      });
      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team does not exist",
        });
      }
      const [teamSize] = await db
        .select({ value: count() })
        .from(users)
        .where(eq(users.teamId, input.teamId));
      const size = teamSize?.value ?? 100;

      if (size >= 4) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team is full (max 4)",
        });
      }
      await db
        .update(users)
        .set({ teamId: input.teamId })
        .where(eq(users.id, ctx.session.user.id));

      return { success: true };
    }),
  leaveTeam: protectedProcedure.query(async ({ ctx }) => {
    const currentTeam = await db.query.users.findFirst({
      columns: { teamId: true },
      where: eq(users.id, ctx.session.user.id),
    });
    if (!currentTeam) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    if (!currentTeam.teamId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot leave team because user is not in a team",
      });
    }
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.id, ctx.session.user.id));

    const [teamSize] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.teamId, currentTeam.teamId));
    if (teamSize?.value == 0) {
      await db.delete(teams).where(eq(teams.id, currentTeam.teamId));
    }

    return { success: true };
  }),
  deleteTeam: protectedProcedure.query(async ({ ctx }) => {
    const currentTeam = await db.query.users.findFirst({
      columns: { teamId: true },
      where: eq(users.id, ctx.session.user.id),
    });
    if (!currentTeam) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    if (!currentTeam.teamId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete team because user is not in a team",
      });
    }
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.teamId, currentTeam.teamId));

    await db.delete(teams).where(eq(teams.id, currentTeam.teamId));

    return {
      success: true,
    };
  }),
});
