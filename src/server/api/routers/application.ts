import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
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

  getAllApplicants: protectedOrganizerProcedure.query(async () => {
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
        const { canvasData, ...restData } = input;

        // Type the canvasData properly for JSONB
        const typedCanvasData =
          canvasData === null
            ? undefined
            : (canvasData as
                | {
                    paths: Array<Array<{ x: number; y: number }>>;
                    timestamp: number;
                    version: string;
                  }
                | undefined);

        const dataToSave = {
          ...restData,
          canvasData: typedCanvasData,
          githubLink: restData.githubLink
            ? `${GITHUB_URL}${restData.githubLink}`
            : null,
          linkedInLink: restData.linkedInLink
            ? `${LINKEDIN_URL}${restData.linkedInLink}`
            : null,
          userId,
        } as const;

        await db
          .insert(applications)
          .values(dataToSave)
          .onConflictDoUpdate({
            target: applications.userId,
            set: {
              ...restData,
              canvasData: typedCanvasData,
              updatedAt: new Date(),
              githubLink: restData.githubLink
                ? `${GITHUB_URL}${restData.githubLink}`
                : null,
              linkedInLink: restData.linkedInLink
                ? `${LINKEDIN_URL}${restData.linkedInLink}`
                : null,
              // Do not change status on save. Submission should explicitly change status.
            },
          });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save application: " + JSON.stringify(error),
        });
      }
    }),

  submit: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const userId = ctx.session.user.id;

        // Fetch existing application for the user
        const application = await db.query.applications.findFirst({
          where: (schema, { eq }) => eq(schema.userId, userId),
        });

        if (!application) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No application found to submit",
          });
        }

        // Transform stored links to the shape expected by the submit schema
        const normalized = {
          ...application,
          // strip configured prefixes if present so schema preprocessing matches tests
          githubLink: application.githubLink
            ? application.githubLink.replace(GITHUB_URL, "")
            : undefined,
          linkedInLink: application.linkedInLink
            ? application.linkedInLink.replace(LINKEDIN_URL, "")
            : undefined,
        };

        // Validate the existing application against the submission schema
        const parseResult = applicationSubmitSchema.safeParse(normalized);
        if (!parseResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Application is not complete: " + JSON.stringify(parseResult.error.format()),
          });
        }

        // Update status only
        await db
          .update(applications)
          .set({ status: "PENDING_REVIEW", updatedAt: new Date() })
          .where(eq(applications.userId, userId));
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to submit application: " + JSON.stringify(error),
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
