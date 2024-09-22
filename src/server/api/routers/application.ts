import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, users } from "~/server/db/schema";
import { db } from "~/server/db";
import {
  applicationSaveSchema,
  applicationSubmitSchema,
} from "~/schemas/application";
import { GITHUB_URL, LINKEDIN_URL } from "~/utils/urls";
import { eq } from "drizzle-orm";

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
            githubLink: application?.githubLink?.substring(19) ?? null,
            linkedInLink: application?.linkedInLink?.substring(24) ?? null,
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

  getAllApplicants: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (user?.type !== "organizer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User is not authorized to get all applicants",
        });
      }

      const applicants = await db
        .select({
          userId: applications.userId,
          firstName: applications.firstName,
          lastName: applications.lastName,
          email: users.email,
        })
        .from(applications)
        .innerJoin(users, eq(users.id, applications.userId))
        .where(eq(applications.status, "PENDING_REVIEW"));

      return applicants.map((ap) => ({
        userId: ap.userId,
        name: `${ap.firstName ?? ""} ${ap.lastName ?? ""}`,
        email: ap.email,
      }));
    } catch (error) {
      throw error instanceof TRPCError
        ? error
        : new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch applicants: " + JSON.stringify(error),
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
            githubLink: `${GITHUB_URL}${applicationData.githubLink}`,
            linkedInLink: `${LINKEDIN_URL}${applicationData.linkedInLink}`,
            userId,
            status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS",
          })
          .onConflictDoUpdate({
            target: applications.userId,
            set: {
              ...applicationData,
              updatedAt: new Date(),
              githubLink: `${GITHUB_URL}${applicationData.githubLink}`,
              linkedInLink: `${LINKEDIN_URL}${applicationData.linkedInLink}`,
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
