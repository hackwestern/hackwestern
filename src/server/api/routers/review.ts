import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, reviews } from "~/server/db/schema";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { count } from "console";

const REQUIRED_REVIEWS = 2;
const REVIEW_TIMEOUT = 24;

export const reviewRequestRouter = createTRPCRouter({
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
