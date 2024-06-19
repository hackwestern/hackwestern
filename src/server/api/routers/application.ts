import { TRPCError } from "@trpc/server";

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
      const application = await db.query.applications.findFirst({
        where: (schema, { eq }) => eq(schema.userId, userId),
      });

      const modifiedApplication = application
        ? {
            ...application,
            githubLink: application?.githubLink?.substring(19),
            linkedInLink: application?.linkedInLink?.substring(24),
          }
        : undefined;

      return modifiedApplication;
    } catch (error) {
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
            githubLink: `https://github.com/${applicationData.githubLink}`,
            linkedInLink: `https://linkedin.com/in/${applicationData.linkedInLink}`,
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
