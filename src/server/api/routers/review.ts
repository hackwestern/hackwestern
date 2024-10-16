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
import { asc, eq, lt, sql, count, and, not, or, isNull } from "drizzle-orm";

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

  //TODO: Write unit tests for this router path
  get: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    try {
      // Remove expired reviews from the review table
      // This is a SQL string because drizzle doesn't have USING (drizzle bad)
      await db.execute(
        sql`DELETE FROM hw11_review USING hw11_application AS app WHERE applicant_user_id = app.user_id AND app.updated_at < NOW() - INTERVAL '24 hours';`,
      );

      // console.log("deleted");

      // Put applications with expired reviews back on the queue
      await db
        .update(applications)
        .set({ status: "PENDING_REVIEW" })
        .where(
          sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt} < now() - interval '24 hours'`,
        );

      // console.log("updated");

      // If reviewer has a review in progress, return that
      const reviewInProgress = (
        await db
          .select()
          .from(reviews)
          .where(sql`${reviews.reviewerUserId}=${ctx.session.user.id}`)
          .limit(1)
      )[0];

      if (reviewInProgress) {
        // console.log("fetched review in progress")
        const applicationInReview = await db
          .select()
          .from(applications)
          .where(
            sql`${applications.userId}=${reviewInProgress.applicantUserId}`,
          );
        // console.log("fetched application being reviewed")
        return { reviewInProgress, applicationInReview };
      } else {
        // console.log("no review in progress")
      }

      // Select first application that has not received the required number of reviews and has not been referred
      const appAwaitingReview = (
        await db
          .select({
            userId: applications.userId,
            reviewCount: count(reviews.applicantUserId).mapWith(Number),
          })
          .from(applications)
          .leftJoin(reviews, eq(applications.userId, reviews.applicantUserId))
          .where(
            and(
              eq(applications.status, "PENDING_REVIEW"),
              or(not(eq(reviews.referral, true)), isNull(reviews.referral)),
            ),
          )
          .groupBy(applications.userId)
          .having(({ reviewCount }) => lt(reviewCount, REQUIRED_REVIEWS))
          .orderBy(asc(applications.updatedAt))
          .limit(1)
      )[0];

      // If there are no applications awaiting review, return
      if (!appAwaitingReview) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There are no applications matching this query.",
        });
      }

      const appToReview = (
        await db
          .select()
          .from(applications)
          .where(sql`${applications.userId} = ${appAwaitingReview?.userId}`)
      )[0];

      // Create a new review
      const newReview = await db
        .insert(reviews)
        .values({
          reviewerUserId: ctx.session.user.id,
          applicantUserId: appToReview!.userId,
        })
        .returning();

      // console.log(`created new review for user ${ctx.session.user.id}`)

      // Update the application status to in_review
      await db
        .update(applications)
        .set({ status: "IN_REVIEW" })
        .where(eq(applications.userId, appToReview!.userId));

      // console.log("updated application status to IN_REVIEW")

      return { newReview, appToReview };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application: " + JSON.stringify(error),
      });
    }
  }),
});
