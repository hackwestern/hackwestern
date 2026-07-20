import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import z from "zod";
import { db } from "~/server/db";
import { teams, trackEnum, users } from "~/server/db/schema";
import { count, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { createInsertSchema } from "drizzle-zod";

const teamsSaveSchema = createInsertSchema(teams, {
  name: z.string().optional(),
  memberDevpostUsernames: z.array(z.string()),
  memberGithubUsernames: z.array(z.string()),
  tracks: z.array(z.enum(trackEnum.enumValues)),
}).omit({
  id: true,
  submissionStatus: true,
  submittedAt: true,
  createdAt: true,
});

const teamsSubmitSchema = z.object({
  name: z.string(),
  devpostUrl: z.string(),
  githubUrl: z.string(),
  tracks: z.array(z.enum(trackEnum.enumValues)).nullable(),
  memberGithubUsernames: z.array(z.string()),
  memberDevpostUsernames: z.array(z.string()),
});

const assertValidTeam = async (ctx: { session: { user: { id: string } } }) => {
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
      message: "Cannot process request because user is not in a team",
    });
  }
  return currentTeam.teamId;
};
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

      await db.transaction(async (tx) => {
        await tx.insert(teams).values({
          id: id,
          name: input.name,
        });
        await tx
          .update(users)
          .set({ teamId: id })
          .where(eq(users.id, ctx.session.user.id));
      });

      return {
        teamId: id,
      };
    }),
  joinTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
  leaveTeam: protectedProcedure.mutation(async ({ ctx }) => {
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
    const teamId = currentTeam.teamId;
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ teamId: null })
        .where(eq(users.id, ctx.session.user.id));

      const [teamSize] = await tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.teamId, teamId));
      if (teamSize?.value == 0) {
        await tx.delete(teams).where(eq(teams.id, teamId));
      }
    });

    return { success: true };
  }),
  deleteTeam: protectedProcedure.mutation(async ({ ctx }) => {
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
    const teamId = currentTeam.teamId;
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ teamId: null })
        .where(eq(users.teamId, teamId));

      await tx.delete(teams).where(eq(teams.id, teamId));
    });

    return {
      success: true,
    };
  }),
  saveProject: protectedProcedure
    .input(teamsSaveSchema)
    .mutation(async ({ ctx, input }) => {
      const teamId = await assertValidTeam(ctx);

      await db
        .update(teams)
        .set({ ...input })
        .where(eq(teams.id, teamId));
      return {
        success: true,
      };
    }),
  submitProject: protectedProcedure.mutation(async ({ ctx }) => {
    const teamId = await assertValidTeam(ctx);

    // This is the hard coded date
    const finalSubmitDate = new Date();
    finalSubmitDate.setDate(finalSubmitDate.getDate() + 1);

    const time = new Date();

    const submitStatus = time > finalSubmitDate ? "late" : "submitted";

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    const parseRes = teamsSubmitSchema.safeParse(team);
    if (!parseRes.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Missing required fields: " + JSON.stringify(parseRes.error.format()),
      });
    }
    const [teamSize] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.teamId, teamId));
    const size = teamSize?.value ?? 100;

    if (
      team?.memberDevpostUsernames?.length != size ||
      team?.memberGithubUsernames?.length != size
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Devpost Usernames or Github Username not complete, must be present for every team member",
      });
    }
    await db
      .update(teams)
      .set({ submittedAt: time, submissionStatus: submitStatus })
      .where(eq(teams.id, teamId));
    return { success: true };
  }),
});
