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
import { GITHUB_URL, LINKEDIN_URL, DEVPOST_URL } from "~/utils/urls";
import { eq, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { z as zv4 } from "zod/v4";
import { type CanvasPaths } from "~/types/canvas";

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure
    .meta({
      openapi: { method: "GET", path: "/api/application/get" },
    })
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
                "yearOfStudy",
                "major",
                "attendedBefore",
                "numOfHackathons",
                // Essays
                "question1",
                "question2",
                "question3",
                // Links
                "resumeLink",
                "devpostLink",
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
                // RSVP
                "shirtSize",
                "dietaryRestrictions",
                "dietaryRestrictionsOther",
                "emergencyContactName",
                "emergencyContactRelationship",
                "emergencyContactPhoneNumber",
                "transportationMethod",
              ] as const),
            )
            .optional(),
        })
        .optional(),
    )
    .output(
      z
        .object({
          userId: z.string().optional(),
          createdAt: z.date().optional(),
          updatedAt: z.date().optional(),
          status: z.string().optional(),
          avatarColour: z.string().optional(),
          avatarFace: z.number().optional(),
          avatarLeftHand: z.number().optional(),
          avatarRightHand: z.number().optional(),
          avatarHat: z.number().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          age: z.number().optional(),
          phoneNumber: z.string().optional(),
          countryOfResidence: z.string().optional(),
          school: z.string().optional(),
          levelOfStudy: z.string().optional(),
          major: z.string().optional(),
          attendedBefore: z.boolean().optional(),
          numOfHackathons: z.string().optional(),
          question1: z.string().optional(),
          question2: z.string().optional(),
          question3: z.string().optional(),
          resumeLink: z.string().optional(),
          githubLink: z.string().optional(),
          linkedInLink: z.string().optional(),
          otherLink: z.string().optional(),
          agreeCodeOfConduct: z.boolean().optional(),
          agreeShareWithSponsors: z.boolean().optional(),
          agreeShareWithMLH: z.boolean().optional(),
          agreeEmailsFromMLH: z.boolean().optional(),
          agreeWillBe18: z.boolean().optional(),
          underrepGroup: z.string().optional(),
          gender: z.string().optional(),
          ethnicity: z.string().optional(),
          sexualOrientation: z.string().optional(),
          canvasData: z.any().optional(),
        })
        .nullable(),
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
                  devpostLink:
                    application?.devpostLink?.substring(DEVPOST_URL.length) ??
                    null,
                  githubLink:
                    application?.githubLink?.substring(GITHUB_URL.length) ??
                    null,
                  linkedInLink:
                    application?.linkedInLink?.substring(LINKEDIN_URL.length) ??
                    null,
                } as typeof application;
              }

              // fields were specified: only transform if those keys exist in the selection
              const selected = application;
              if (
                input.fields.includes("githubLink") &&
                "githubLink" in selected
              ) {
                selected.githubLink = selected.githubLink?.substring(
                  GITHUB_URL.length,
                );
              }
              if (
                input.fields.includes("linkedInLink") &&
                "linkedInLink" in selected
              ) {
                selected.linkedInLink = selected.linkedInLink?.substring(
                  LINKEDIN_URL.length,
                );
              }
              if (
                input.fields.includes("devpostLink") &&
                "devpostLink" in selected
              ) {
                selected.devpostLink = selected.devpostLink?.substring(
                  DEVPOST_URL.length,
                );
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
    .meta({
      openapi: { method: "GET", path: "/api/application/getById" },
    })
    .input(
      z.object({
        applicantId: z.string().nullish(),
      }),
    )
    .output(
      z.object({
        userId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        status: z.string(),
        avatarColour: z.string().nullable(),
        avatarFace: z.number().nullable(),
        avatarLeftHand: z.number().nullable(),
        avatarRightHand: z.number().nullable(),
        avatarHat: z.number().nullable(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        age: z.number().nullable(),
        phoneNumber: z.string().nullable(),
        countryOfResidence: z.string().nullable(),
        school: z.string().nullable(),
        levelOfStudy: z.string().nullable(),
        major: z.string().nullable(),
        attendedBefore: z.boolean().nullable(),
        numOfHackathons: z.string().nullable(),
        question1: z.string().nullable(),
        question2: z.string().nullable(),
        question3: z.string().nullable(),
        resumeLink: z.string().nullable(),
        githubLink: z.string().nullable(),
        linkedInLink: z.string().nullable(),
        otherLink: z.string().nullable(),
        agreeCodeOfConduct: z.boolean().nullable(),
        agreeShareWithSponsors: z.boolean().nullable(),
        agreeShareWithMLH: z.boolean().nullable(),
        agreeEmailsFromMLH: z.boolean().nullable(),
        agreeWillBe18: z.boolean().nullable(),
        underrepGroup: z.string().nullable(),
        gender: z.string().nullable(),
        ethnicity: z.string().nullable(),
        sexualOrientation: z.string().nullable(),
        canvasData: z.any().nullable(),
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

  getAllApplicants: protectedOrganizerProcedure
    .meta({
      openapi: { method: "GET", path: "/api/application/getAllApplicants" },
    })
    .input(zv4.object({}))
    .output(
      zv4.array(
        zv4.object({
          userId: zv4.string(),
          name: zv4.string(),
          email: zv4.string(),
        }),
      ),
    )
    .query(async () => {
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
    .meta({
      openapi: { method: "POST", path: "/api/application/save" },
    })
    .input(applicationSaveSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const { canvasData, ...restData } = input;

        const dataToInsert = {
          ...restData,
          userId,
          // Coerce null → "" to satisfy the NOT NULL DB constraint
          devpostLink: restData.devpostLink ?? "",
          githubLink: restData.githubLink ?? "",
          linkedInLink: restData.linkedInLink ?? "",

          dietaryRestrictionsOther: restData.dietaryRestrictionsOther ?? null,
        };

        // Only include canvasData if it was actually provided
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

        if (Object.prototype.hasOwnProperty.call(input, "devpostLink")) {
          dataToInsert.devpostLink = restData.devpostLink
            ? `${DEVPOST_URL}${restData.devpostLink}`
            : "";
        }

        if (Object.prototype.hasOwnProperty.call(input, "githubLink")) {
          dataToInsert.githubLink = restData.githubLink
            ? `${GITHUB_URL}${restData.githubLink}`
            : "";
        }

        if (Object.prototype.hasOwnProperty.call(input, "linkedInLink")) {
          dataToInsert.linkedInLink = restData.linkedInLink
            ? `${LINKEDIN_URL}${restData.linkedInLink}`
            : "";
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

  submit: protectedProcedure
    .meta({
      openapi: { method: "POST", path: "/api/application/submit" },
    })
    .output(z.void())
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

      // These are mandatory fields
      if (
        !application.devpostLink ||
        !application.githubLink ||
        !application.linkedInLink
      ) {
        const missing = [
          !application.devpostLink && "Devpost link",
          !application.githubLink && "GitHub link",
          !application.linkedInLink && "LinkedIn link",
        ].filter(Boolean);

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Missing required fields: ${missing.join(", ")}`,
        });
      }

      const normalized = {
        ...application,
        devpostLink: application.devpostLink.replace(DEVPOST_URL, ""),
        githubLink: application.githubLink.replace(GITHUB_URL, ""),
        linkedInLink: application.linkedInLink.replace(LINKEDIN_URL, ""),
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

  getAppStats: protectedOrganizerProcedure
    .meta({
      openapi: { method: "GET", path: "/api/application/getAppStats" },
    })
    .output(
      z.array(
        z.object({
          status: z.string(),
          count: z.number(),
        }),
      ),
    )
    .query(async ({}) => {
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

  bulkUpdateStatusByEmails: protectedOrganizerProcedure
    .meta({
      openapi: { method: "POST", path: "/api/application/bulkUpdateStatus" },
    })
    .input(
      z.object({
        emails: z.array(z.string().email()).min(1),
        status: z.enum([
          "IN_PROGRESS",
          "PENDING_REVIEW",
          "IN_REVIEW",
          "ACCEPTED",
          "REJECTED",
          "WAITLISTED",
          "DECLINED",
        ] as const),
      }),
    )
    .output(
      z.object({
        matched: z.number(),
        updated: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const { emails, status } = input;
      try {
        const result = await db.transaction(async (tx) => {
          const userRows = await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.email, emails));

          const userIds = userRows.map((r) => r.id);
          if (userIds.length === 0) {
            return { matched: 0, updated: 0 };
          }

          const updateRes = await tx
            .update(applications)
            .set({ status, updatedAt: new Date() })
            .where(inArray(applications.userId, userIds));

          // drizzle's update may not always expose rowCount across drivers; fall back to querying actual count
          let updatedCount = userIds.length;
          if (
            updateRes &&
            typeof updateRes === "object" &&
            "rowCount" in updateRes &&
            typeof (updateRes as { rowCount?: unknown }).rowCount === "number"
          ) {
            updatedCount = (updateRes as { rowCount: number }).rowCount;
          } else {
            // Query the actual count of applications for these users
            const countResult = await tx
              .select({ count: count() })
              .from(applications)
              .where(inArray(applications.userId, userIds));
            updatedCount = countResult[0]?.count ?? 0;
          }
          return { matched: userIds.length, updated: updatedCount };
        });
        return result;
      } catch (err: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to bulk update status: " + String(err),
        });
      }
    }),
});
