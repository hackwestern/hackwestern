import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications } from "~/server/db/schema";
import { db } from "~/server/db";
import {
  applicationSaveSchema,
  applicationSubmitSchema,
} from "~/schemas/application";

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const application = await db
        .select()
        .from(applications)
        .where(eq(applications.userId, userId))
        .limit(1);

      if (!application.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      return application[0];
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application: " + JSON.stringify(error),
      });
    }
  }),

  save: protectedProcedure
    .input(applicationSaveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const applicationData = input;
        const isCompleteApplication =
          applicationSubmitSchema.safeParse(applicationData).success;

        await db
          .insert(applications)
          .values({
            ...applicationData,
            githubLink: !applicationData.githubLink?.startsWith(
              "https://github.com",
            )
              ? `https://github.com/${applicationData.githubLink}`
              : undefined,
            linkedInLink: !applicationData.linkedInLink?.startsWith(
              "https://github.com",
            )
              ? `https://linkedin.com/in/${applicationData.linkedInLink}`
              : undefined,
            userId,
            status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS",
          })
          .onConflictDoUpdate({
            target: applications.userId,
            set: {
              ...applicationData,
              updatedAt: new Date(),
              githubLink: `https://github.com/${applicationData.githubLink}`,
              linkedInLink: `https://linkedin.com/in/${applicationData.linkedInLink}`,
              status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS",
            },
          });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save application: " + JSON.stringify(error),
        });
      }
    }),
});
