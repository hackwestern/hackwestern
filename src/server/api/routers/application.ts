import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { applications, users } from "~/server/db/schema";
import { db } from "~/server/db";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { env } from "~/env";
import { normalizeAuthEmail } from "~/server/subscribers";
import { applicationSubmittedTemplate } from "./email-templates";
import {
  applicationSaveSchema,
  applicationSubmitSchema,
} from "~/schemas/application";
import {
  normalizeTravel,
  rsvpRespondSchema,
  rsvpTravelSaveSchema,
  rsvpTravelSubmitSchema,
} from "~/schemas/rsvp";
import { isPastRsvpDeadline } from "~/lib/date";
import { GITHUB_URL, LINKEDIN_URL, DEVPOST_URL } from "~/utils/urls";
import { and, eq, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { type CanvasPaths } from "~/types/canvas";
import { isPastDeadline } from "~/lib/date";

// /apply redirects once the deadline passes, but that only runs on page load.
// Checking here also stops a tab left open past the deadline, or a direct API
// call, from saving or submitting.
function assertApplicationsOpen() {
  if (isPastDeadline()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Applications are closed.",
    });
  }
}

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
                // Realm + horse companion
                "realm",
                "horseId",
                "horseFirstName",
                "horseLastName",
                // Basics
                "firstName",
                "lastName",
                "age",
                "phoneNumber",
                "countryOfResidence",
                // Info
                "school",
                "schoolOther",
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
                "travelReimbursement",
                "travelFrom",
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
      assertApplicationsOpen();
      // The forms lock once an application is submitted, but a direct API
      // call could still rewrite it, so refuse here too.
      const existing = await db.query.applications.findFirst({
        where: (schema, { eq }) => eq(schema.userId, ctx.session.user.id),
        columns: { status: true },
      });
      if (existing && existing.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Submitted applications can't be changed.",
        });
      }
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

        // "Other" only saves once the school is named, so an unnamed pick
        // leaves the school blank instead of a nameless "Other"
        if (restData.school === "Other" && !restData.schoolOther?.trim()) {
          dataToInsert.school = null;
          dataToInsert.schoolOther = null;
        }

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
              // honestly im pretty lost on why this works
              //
              // Only touch columns the client actually sent. dataToInsert
              // defaults missing links to "" and dietaryRestrictionsOther to
              // null for the INSERT path, so spreading it here used to let
              // one step's autosave (e.g. logistics) wipe another step's
              // columns (e.g. links) on every conflict update.
              ...Object.fromEntries(
                Object.keys(restData).map((key) => [
                  key,
                  (dataToInsert as Record<string, unknown>)[key],
                ]),
              ),

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

  // RSVP travel step. save() closes at the deadline, so this has its own
  // mutation, open to accepted and confirmed hackers until RSVP closes.
  saveTravel: protectedProcedure
    .input(rsvpTravelSaveSchema)
    .mutation(async ({ ctx, input }) => {
      const application = await db.query.applications.findFirst({
        columns: { status: true },
        where: eq(applications.userId, ctx.session.user.id),
      });

      if (
        application?.status !== "ACCEPTED" &&
        application?.status !== "CONFIRMED"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only accepted hackers can RSVP.",
        });
      }
      if (isPastRsvpDeadline()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "RSVP is closed.",
        });
      }

      await db
        .update(applications)
        .set({ ...normalizeTravel(input), updatedAt: new Date() })
        .where(eq(applications.userId, ctx.session.user.id));
    }),

  // RSVP. Yes: ACCEPTED -> CONFIRMED, before the RSVP deadline, with the
  // travel step complete and the enrollment attestation; the travel answer
  // sent with it is saved in the same update. No: ACCEPTED or CONFIRMED ->
  // DECLINED, which can't be undone (there's no waitlist to hand the spot
  // back from), and stays possible after the deadline so a confirmed hacker
  // can still free their spot.
  rsvp: protectedProcedure
    .input(rsvpRespondSchema)
    .mutation(async ({ ctx, input }) => {
      const application = await db.query.applications.findFirst({
        columns: {
          status: true,
          transportationMethod: true,
          travelReimbursement: true,
          travelFrom: true,
        },
        where: eq(applications.userId, ctx.session.user.id),
      });

      if (input.attending) {
        if (application?.status !== "ACCEPTED") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only accepted hackers can confirm a spot.",
          });
        }
        if (isPastRsvpDeadline()) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "RSVP is closed.",
          });
        }
        if (!input.enrolled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Confirm you're enrolled in a college or university program.",
          });
        }
        // The answer on screen when Confirm was clicked, else what's saved.
        const travel = rsvpTravelSubmitSchema.safeParse(
          input.travel ? normalizeTravel(input.travel) : application,
        );
        if (!travel.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              travel.error.issues[0]?.message ?? "Finish the travel questions.",
          });
        }
      } else if (
        application?.status !== "ACCEPTED" &&
        application?.status !== "CONFIRMED"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "There's no spot to decline.",
        });
      }

      const from = input.attending
        ? (["ACCEPTED"] as const)
        : (["ACCEPTED", "CONFIRMED"] as const);
      const status: "CONFIRMED" | "DECLINED" = input.attending
        ? "CONFIRMED"
        : "DECLINED";

      // Conditional on the current status, so a double click or two tabs
      // can't flip a decline back to confirmed.
      const updated = await db
        .update(applications)
        .set({
          status,
          updatedAt: new Date(),
          ...(input.attending && {
            ...(input.travel && normalizeTravel(input.travel)),
            enrollmentConfirmedAt: new Date(),
          }),
        })
        .where(
          and(
            eq(applications.userId, ctx.session.user.id),
            inArray(applications.status, [...from]),
          ),
        )
        .returning({ status: applications.status });

      if (updated.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Your RSVP changed in another tab. Refresh and try again.",
        });
      }
      return { status };
    }),

  submit: protectedProcedure.mutation(async ({ ctx }) => {
    assertApplicationsOpen();
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
        // Applicants see this message, so the field details go to the log.
        console.error(
          "Incomplete application submitted:",
          JSON.stringify(parseResult.error.format()),
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Your application isn't complete yet. Check each step and try again.",
        });
      }

      // Update status only
      await db
        .update(applications)
        .set({ status: "PENDING_REVIEW", updatedAt: new Date() })
        .where(eq(applications.userId, userId));

      // Send an application-received confirmation. Don't fail the submission if
      // the email bounces — the application is already saved as PENDING_REVIEW.
      const applicant = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        columns: { email: true, name: true },
      });
      if (applicant?.email) {
        const { error: emailError } = await sendViaMailjet(
          {
            from: "Hack Western Team <hello@hackwestern.com>",
            to: applicant.email,
            subject: "We've received your Hack Western 13 application!",
            html: applicationSubmittedTemplate(applicant.name ?? undefined),
          },
          { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
        );
        if (emailError) {
          console.error(
            "Error sending application confirmation email:",
            emailError,
          );
        }
      }
    } catch (error) {
      throw error instanceof TRPCError
        ? error
        : new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit application: " + JSON.stringify(error),
          });
    }
  }),

  bulkUpdateStatusByEmails: protectedOrganizerProcedure
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
    .mutation(async ({ input }) => {
      const { emails, status } = input;
      try {
        // Stored emails are canonical (trim+lowercase). A decision CSV with any
        // other casing would otherwise silently skip those rows — and a skipped
        // row here is a person who never hears their decision.
        const canonical = emails.map(normalizeAuthEmail);
        const result = await db.transaction(async (tx) => {
          const userRows = await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.email, canonical));

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
