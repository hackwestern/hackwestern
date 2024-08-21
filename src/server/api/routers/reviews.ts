import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, reviews, users } from "~/server/db/schema";
import { db } from "~/server/db";
import {
  reviewSaveSchema,
  reviewSubmitSchema,
  referApplicantSchema,
} from "~/schemas/review";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

const REQUIRED_REVIEWS = 2;
const REVIEW_TIMEOUT = 24;

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
      columns: {
        reviewerUserId: false,
      },
      with: {
        applicant: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      where: eq(reviews.reviewerUserId, userId),
    });
  }),

  get: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    try {
      // Put applications with expired reviews back on the queue
      await db
        .update(applications)
        .set({ status: "PENDING_REVIEW" })
        .where(
          sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`,
        );

      // Remove expired reviews from the review table
      await db
        .delete(reviews)
        .where(
          sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`,
        );

      // Select first application that has not received the required number of reviews and has not been referred
      const applicationsAwaitingReview = await db
        .select()
        .from(applications)
        .where(sql`${applications.status}='PENDING_REVIEW'`)
        .groupBy(applications.userId)
        .having(
          sql`count(${reviews.applicantUserId}) < ${REQUIRED_REVIEWS} and ${reviews.referral} is not true`,
        )
        .orderBy(asc(applications.updatedAt))
        .limit(1);

      const appToReview = applicationsAwaitingReview[0];

      // If there are no applications awaiting review, return
      if (!appToReview) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There are no applications matching this query.",
        });
      }

      // Create a new review
      const newReview = await db
        .insert(reviews)
        .values({
          reviewerUserId: ctx.session.user.id,
          applicantUserId: appToReview.userId,
        })
        .returning();

      // Update the application status to in_review
      await db
        .update(applications)
        .set({ status: "IN_REVIEW" })
        .where(eq(applications.userId, appToReview.userId));

      return { newReview, appToReview };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application: " + JSON.stringify(error),
      });
    }
  }),
});
