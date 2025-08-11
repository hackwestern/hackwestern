import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedOrganizerProcedure, protectedProcedure } from "~/server/api/trpc";
import { applications, users } from "~/server/db/schema";
import { db } from "~/server/db";
import {
  applicationSaveSchema,
  applicationSubmitSchema,
} from "~/schemas/application";
import { GITHUB_URL, LINKEDIN_URL } from "~/utils/urls";
import { eq, count } from "drizzle-orm";
import { z } from "zod";

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
        : null;

      return modifiedApplication;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application: " + JSON.stringify(error),
      });
    }
  }),

  getById: protectedOrganizerProcedure
    .input(
      z.object({
        applicantId: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      try {
        if (!input.applicantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing userId",
          });
        }

        const application = await db.query.applications.findFirst({
          where: eq(applications.userId, input.applicantId),
        });

        if (!application) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Application not found",
          });
        }

        return application;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch application: " + JSON.stringify(error),
        });
      }
    }),

  getAllApplicants: protectedOrganizerProcedure.query(async ({ ctx }) => {
    try {
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
            githubLink: applicationData.githubLink
              ? `${GITHUB_URL}${applicationData.githubLink}`
              : null,
            linkedInLink: applicationData.linkedInLink
              ? `${LINKEDIN_URL}${applicationData.linkedInLink}`
              : null,
            userId,
            status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS",
          })
          .onConflictDoUpdate({
            target: applications.userId,
            set: {
              ...applicationData,
              updatedAt: new Date(),
              githubLink: applicationData.githubLink
                ? `${GITHUB_URL}${applicationData.githubLink}`
                : null,
              linkedInLink: applicationData.linkedInLink
                ? `${LINKEDIN_URL}${applicationData.linkedInLink}`
                : null,
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

  getAppStats: protectedOrganizerProcedure.query(async ({}) => {
    try {
      const applicationStats = await db
        .select({
          status: applications.status,
          count: count(applications.userId),
        })
        .from(applications)
        .groupBy(applications.status);

      return applicationStats;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application stats: " + JSON.stringify(error),
      });
    }
  }),
});
