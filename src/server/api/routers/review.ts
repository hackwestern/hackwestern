import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
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
import type { InferSelectModel } from "drizzle-orm";

const REQUIRED_REVIEWS = 2;


export const createEmptyReview = (reviewerUserId: string, applicantUserId: string) => {
  return {
    applicantUserId,
    reviewerUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    originalityRating: 0,
    technicalityRating: 0,
    passionRating: 0,
    comments: null,
    completed: false,
    referral: false,
  } as InferSelectModel<typeof reviews>;
}

export const reviewRouter = createTRPCRouter({
  save: protectedOrganizerProcedure
    .input(reviewSaveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const reviewData = input;
        const applicantId = reviewData.applicantUserId;

        const isEmpty =
          (reviewData.originalityRating == 0) &&
          (reviewData.technicalityRating == 0) &&
          (reviewData.passionRating == 0) &&
          (!reviewData.comments || reviewData.comments.trim() == '');

        // We never want to save an empty review, so if a user resets the rating to empty, we need to delete the existing record too
        if (isEmpty) {
          await db
            .delete(reviews)
            .where(
              and(
                eq(reviews.applicantUserId, applicantId),
                eq(reviews.reviewerUserId, userId)
              )
            );
          return;
        }

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

  referApplicant: protectedOrganizerProcedure
    .input(referApplicantSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;

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

  getByOrganizer: protectedOrganizerProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

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

  // TODO: Write unit tests for this router path
  getNextId: protectedOrganizerProcedure
    .input(
      z.object({
        skipId: z.string().nullish(), // used if a reviewer is currently reviewing something (stored as a search param on the client side)
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
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

        // all the userIds of the applicants the reviewer already reviewed
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
          .orderBy(
            asc(count(reviews.applicantUserId).mapWith(Number)), sql`RANDOM()`,
            sql`RANDOM()`                               // randomize among equal counts
          )
          .limit(1);

        const appAwaitingReview = appAwaitingReviews[0];

        // If there are no applications awaiting review, return
        if (!appAwaitingReview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "There are no applications matching this query.",
          });
        }

        return appAwaitingReview?.userId;
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
    .query(async ({ input, ctx }) => {
      try {
        if (!input.applicantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing userId",
          });
        }

        const reviewerId = ctx.session.user.id;

        const existingReview = await db.query.reviews.findFirst({
          where: and(
            eq(reviews.applicantUserId, input.applicantId),
            eq(reviews.reviewerUserId, reviewerId),
          ),
        });

        // If no review exists, return an empty review that conforms to the schema
        if (!existingReview) {
          return createEmptyReview(reviewerId, input.applicantId);
        }

        return existingReview;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch application: " + JSON.stringify(error),
        });
      }
    }),

  getReviewCounts: protectedOrganizerProcedure.query(async () => {
    try {
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
