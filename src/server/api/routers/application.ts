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
import { type CanvasPaths } from "~/types/canvas";

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure
    .input(
      z
        .object({
          // Optional list of application columns to fetch; if omitted, fetch all as before
          fields: z
            .array(
              z.enum([
                "userId",
                "createdAt",
                "updatedAt",
                "status",
                // Avatar
                "avatarColour",
                "avatarFace",
                "avatarLeftHand",
                "avatarRightHand",
                "avatarHat",
                // Basics
                "firstName",
                "lastName",
                "age",
                "phoneNumber",
                "countryOfResidence",
                // Info
                "school",
                "levelOfStudy",
                "major",
                "attendedBefore",
                "numOfHackathons",
                // Essays
                "question1",
                "question2",
                "question3",
                // Links
                "resumeLink",
                "githubLink",
                "linkedInLink",
                "otherLink",
                // Agreements
                "agreeCodeOfConduct",
                "agreeShareWithSponsors",
                "agreeShareWithMLH",
                "agreeEmailsFromMLH",
                "agreeWillBe18",
                // Optional demographics
                "underrepGroup",
                "gender",
                "ethnicity",
                "sexualOrientation",
                // Canvas
                "canvasData",
              ] as const),
            )
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const application = await (async () => {
          // if specific fields were requested, build a Drizzle columns map to select only those
          const fields = input?.fields;
          if (fields && fields.length > 0) {
            const columns = Object.fromEntries(
              fields.map((f) => [f, true]),
            ) as Record<string, true>;
            return db.query.applications.findFirst({
              columns,
              where: (schema, { eq }) => eq(schema.userId, userId),
            }) as Partial<typeof applications.$inferSelect>;
          }

          // default: fetch all columns (existing behavior)
          return db.query.applications.findFirst({
            where: (schema, { eq }) => eq(schema.userId, userId),
          });
        })();

        // When selecting a subset of fields, normalize only those link fields if present
        const modifiedApplication = application
          ? (() => {
              // If no specific fields were requested, preserve prior full-shape behavior
              if (!input?.fields || input.fields.length === 0) {
                return {
                  ...application,
                  githubLink: application?.githubLink?.substring(19) ?? null,
                  linkedInLink:
                    application?.linkedInLink?.substring(24) ?? null,
                } as typeof application;
              }

              // fields were specified: only transform if those keys exist in the selection
              const selected = application;
              if (
                input.fields.includes("githubLink") &&
                "githubLink" in selected
              ) {
                selected.githubLink =
                  selected.githubLink?.substring(19) ?? null;
              }
              if (
                input.fields.includes("linkedInLink") &&
                "linkedInLink" in selected
              ) {
                selected.linkedInLink =
                  selected.linkedInLink?.substring(24) ?? null;
              }
              return selected;
            })()
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

        const dataToInsert = {
          ...restData,
          userId,
        };

        // Only include these 3 specially formatted fields if they were actually provided
        if (Object.prototype.hasOwnProperty.call(input, "canvasData")) {
          (dataToInsert as typeof input).canvasData =
            canvasData === null
              ? undefined
              : (canvasData as
                  | {
                      paths: CanvasPaths;
                      timestamp: number;
                      version: string;
                    }
                  | undefined);
        }

        if (Object.prototype.hasOwnProperty.call(input, "githubLink")) {
          dataToInsert.githubLink = restData.githubLink
            ? `${GITHUB_URL}${restData.githubLink}`
            : null;
        }

        if (Object.prototype.hasOwnProperty.call(input, "linkedInLink")) {
          dataToInsert.linkedInLink = restData.linkedInLink
            ? `${LINKEDIN_URL}${restData.linkedInLink}`
            : null;
        }

        await db
          .insert(applications)
          .values(dataToInsert)
          .onConflictDoUpdate({
            target: applications.userId,
            set: {
              ...dataToInsert,
              updatedAt: new Date(),
            },
          });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save application: " + JSON.stringify(error),
        });
      }
    }),

  submit: protectedProcedure.mutation(async ({ ctx }) => {
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
          message:
            "Application is not complete: " +
            JSON.stringify(parseResult.error.format()),
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
