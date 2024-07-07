import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, reviews, users } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm"

import { db } from "~/server/db";
import { drizzle } from "drizzle-orm/postgres-js";
import { count } from "console";

const REQUIRED_REVIEWS = 2;
const REVIEW_TIMEOUT = 24;

export const reviewRequestRouter = createTRPCRouter({
    get: protectedProcedure
        .input(z.object({}))
        .mutation(async ( {ctx} ) => {
        try {
            // Put applications with expired reviews back on the queue
            await db
                .update(applications)
                .set({ status: "PENDING_REVIEW" })
                .where(sql`${applications.status}='in_review' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`);

            // Remove expired reviews from the review table
            await db
                .delete(reviews)
                .where(sql`${applications.status}='in_review' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`);

            // Find applications awaiting review
            const applicationsAwaitingReview = await db
                .select()
                .from(applications)
                .where(sql`${applications.status}='pending_review'`)
                .groupBy(applications.userId)
                .orderBy(asc(applications.updatedAt));

            // If there are no applications awaiting review, return
            if (applicationsAwaitingReview.length < 1) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "There are no applications matching this query."
                })
            }

            // Create a review for the first application that has not received the required number of reviews
            for (const app of applicationsAwaitingReview) {
                const matchingReviews = await db
                    .select()
                    .from(reviews)
                    .where(eq(reviews.applicantUserId, app.userId))

                // If the application has received the required number of reviews, continue
                if (matchingReviews.length >= REQUIRED_REVIEWS) {
                    continue;
                }

                // Create a new review
                const newReview = await db
                    .insert(reviews)
                    .values({
                        reviewerUserId: ctx.session.user.id,
                        applicantUserId: app.userId,
                    })
                    .returning();
                
                // Update the application status to in_review
                await db
                    .update(applications)
                    .set({ status: "IN_REVIEW" })
                    .where(eq(applications.userId, app.userId));

                return newReview;
            }
        } catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch application: " + JSON.stringify(error),
              });
        }
    })
})