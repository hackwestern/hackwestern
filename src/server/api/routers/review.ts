import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, reviews, users } from "~/server/db/schema";
import { db } from "~/server/db";
import { z } from "zod";
import {
  reviewSaveSchema,
  reviewSubmitSchema,
  referApplicantSchema,
} from "~/schemas/review";
import {
  asc,
  eq,
  lt,
  sql,
  count,
  and,
  or,
  isNull,
  ne,
  desc,
  notInArray,
} from "drizzle-orm";

const REQUIRED_REVIEWS = 2;

export const reviewRouter = createTRPCRouter({
  save: protectedProcedure
    .input(reviewSaveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const reviewer = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (!reviewer || reviewer.type !== "organizer") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not authorized to submit reviews",
          });
        }

        const reviewData = input;
        const isCompleteReview =
          reviewSubmitSchema.safeParse(reviewData).success;

        await db
          .insert(reviews)
          .values({
            ...reviewData,
            reviewerUserId: userId,
            applicantUserId: reviewData.applicantUserId,
            completed: isCompleteReview ? true : false,
          })
          .onConflictDoUpdate({
            target: [reviews.applicantUserId, reviews.reviewerUserId],
            set: {
              ...reviewData,
              updatedAt: new Date(),
              reviewerUserId: userId,
              completed: isCompleteReview ? true : false,
            },
          })
          .returning();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save review: " + JSON.stringify(error),
        });
      }
    }),

  referApplicant: protectedProcedure
    .input(referApplicantSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const reviewer = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (!reviewer || reviewer.type !== "organizer") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not authorized to modify reviews",
          });
        }

        const applicantData = input;
        await db.insert(reviews).values({
          ...applicantData,
          reviewerUserId: userId,
          applicantUserId: applicantData.applicantUserId,
          referral: true,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save referral: " + JSON.stringify(error),
        });
      }
    }),

    referApplicantByEmail : protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const reviewer = await db.query.users.findFirst({
          where: eq(users.email, "org@hackwestern.com"),
        });
        if (!reviewer || reviewer.type !== "organizer") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not authorized to submit reviews",
          });
        }

        const applicant = await db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (!applicant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No user found with the provided email.",
          });
        }

        const application = await db.query.applications.findFirst({
          where: eq(applications.userId, applicant.id),
        });

        if (!application) {
          await db.insert(applications).values({
            userId: applicant.id, // Associate the application with the applicant
            // You can add any default values needed for the application fields
            // For example, if there are fields like status, createdAt, etc.
            status: "PENDING_REVIEW", // Set a default status or any other field as required
            createdAt: new Date(), // Set the current date as created date
            // Add other necessary fields here
          });
        }

        await db.insert(reviews).values({
          reviewerUserId: reviewer.id,
          applicantUserId: applicant.id,
          originalityRating: 100,
          technicalityRating: 100,
          passionRating: 100,
          comments: "referral",
          completed: true,
          referral: true,
        })
      } catch (error) {
        if(typeof error == typeof TRPCError){
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create referral review: " + JSON.stringify(error),
        });
      }
    }),


  getAllRefferals: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const reviewer = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!reviewer || reviewer.type !== "organizer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not authorized to view reviews",
      });
    }

    return db.query.reviews.findMany({
      where: eq(reviews.referral, true),
      columns: {
        applicantUserId: true,
      },
      with: {
        application: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
        applicant: {
          columns: {
            email: true,
          }
        }
      },
    });  
  }),

  getByOrganizer: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const reviewer = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!reviewer || reviewer.type !== "organizer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not authorized to view reviews",
      });
    }

    return db.query.reviews.findMany({
      with: {
        applicant: {
          columns: {
            id: true,
            email: true,
          },
        },
        application: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      where: eq(reviews.reviewerUserId, userId),
    });
  }),

  //TODO: Write unit tests for this router path
  getNextId: protectedProcedure
    .input(
      z.object({
        skipId: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Remove expired reviews from the review table
        // This is a SQL string because drizzle doesn't have USING (drizzle bad)
        await db.execute(
          sql`DELETE FROM hw11_review USING hw11_application AS app WHERE applicant_user_id = app.user_id AND NOW() - app.updated_at::timestamp > INTERVAL '24 hours' AND completed != TRUE;`,
        );

        // Put applications with expired reviews back on the queue
        await db
          .update(applications)
          .set({ status: "PENDING_REVIEW" })
          .where(
            sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt}::timestamp < now() - interval '2 hours'`,
          );

        // If reviewer has a review in progress, return that and not skipping current
        if (!input.skipId) {
          const reviewInProgress = (
            await db
              .select()
              .from(reviews)
              .where(
                and(
                  eq(reviews.reviewerUserId, ctx.session.user.id),
                  eq(reviews.completed, false),
                ),
              )
              .limit(1)
          )[0];

          if (reviewInProgress) {
            return reviewInProgress.applicantUserId;
          }
        }

        const alreadyReviewedByReviewer = db
          .select({ data: reviews.applicantUserId })
          .from(reviews)
          .where(
            and(
              eq(reviews.reviewerUserId, ctx.session.user.id),
              eq(reviews.completed, true),
            ),
          );

        // Select first application that has not received the required number of reviews and has not been referred, and not matching the one to skip
        const appAwaitingReviews = await db
          .select({
            userId: applications.userId,
            reviewCount: count(reviews.applicantUserId).mapWith(Number),
          })
          .from(applications)
          .leftJoin(reviews, eq(applications.userId, reviews.applicantUserId))
          .where(
            and(
              eq(applications.status, "PENDING_REVIEW"),
              or(ne(reviews.referral, true), isNull(reviews.referral)),
              ne(applications.userId, input.skipId ?? ""),
              // Don't review applications that have already been reviewed by the reviewer
              notInArray(applications.userId, alreadyReviewedByReviewer),
            ),
          )
          .groupBy(applications.userId)
          .having(({ reviewCount }) => lt(reviewCount, REQUIRED_REVIEWS))
          // order by random
          .orderBy(asc(sql`RANDOM()`))
          .limit(1);

        const appAwaitingReview = appAwaitingReviews[0];

        // If there are no applications awaiting review, return
        if (!appAwaitingReview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "There are no applications matching this query.",
          });
        }

        // Update the application status to in_review
        await db
          .update(applications)
          .set({ status: "IN_REVIEW" })
          .where(eq(applications.userId, appAwaitingReview.userId));

        // console.log("updated application status to IN_REVIEW")

        return appAwaitingReview?.userId;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch application: " + JSON.stringify(error),
        });
      }
    }),

  getById: protectedProcedure
    .input(
      z.object({
        applicantId: z.string().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        if (!input.applicantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing userId",
          });
        }

        const reviewerId = ctx.session.user.id;
        const user = await db.query.users.findFirst({
          where: eq(users.id, reviewerId),
        });

        if (user?.type !== "organizer") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not authorized to view reviews",
          });
        }

        await db
          .insert(reviews)
          .values({
            reviewerUserId: reviewerId,
            applicantUserId: input.applicantId,
          })
          .onConflictDoNothing();

        return await db.query.reviews.findFirst({
          where: and(
            eq(reviews.applicantUserId, input.applicantId),
            eq(reviews.reviewerUserId, reviewerId),
          ),
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch application: " + JSON.stringify(error),
        });
      }
    }),

  getReviewCounts: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const reviewer = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!reviewer || reviewer.type !== "organizer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User is not authorized to view reviews",
        });
      }

      const reviewCounts = await db
        .select({
          reviewerId: reviews.reviewerUserId,
          reviewerName: users.name,
          reviewCount: count(reviews.reviewerUserId).mapWith(Number),
        })
        .from(reviews)
        .innerJoin(
          users,
          and(
            eq(reviews.reviewerUserId, users.id),
            eq(reviews.completed, true),
          ),
        )
        .groupBy(reviews.reviewerUserId, users.name)
        .orderBy(desc(count(reviews.reviewerUserId)));

      return reviewCounts;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch review counts: " + JSON.stringify(error),
      });
    }
  }),
});
