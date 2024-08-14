import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications, reviews } from "~/server/db/schema";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm"

import { db } from "~/server/db";
import { count } from "console";

const REQUIRED_REVIEWS = 2;
const REVIEW_TIMEOUT = 24;

export const reviewRequestRouter = createTRPCRouter({
    get: protectedProcedure
        .input(z.object({}))
        .mutation(async ( {ctx} ) => {
        try {
            console.log("starting mutation...");

            // Remove expired reviews from the review table
            await db.execute(sql`DELETE FROM hw11_review USING hw11_application AS app WHERE applicant_user_id = app.user_id AND app.updated_at < NOW() - INTERVAL '24 hours';`);
            // await db
            //     .delete(reviews)
            //     .where(sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`);

            console.log("deleted");

            // Put applications with expired reviews back on the queue
            await db.execute(sql`UPDATE hw11_application SET status = 'PENDING_REVIEW' WHERE status = 'IN_REVIEW' AND updated_at < NOW() - INTERVAL '24 hours'`);
            // await db
            //     .update(applications)
            //     .set({ status: "PENDING_REVIEW" })
            //     .where(sql`${applications.status}='IN_REVIEW' and ${applications.updatedAt} < now() - interval '${REVIEW_TIMEOUT} hours'`);
            
            console.log("updated");

            // If reviewer has a review in progress, return that
            const reviewInProgress = (await db
                .select()
                .from(reviews)
                .where(sql`${reviews.reviewerUserId}=${ctx.session.user.id}`)
                .limit(1))[0]
            
            

            if (reviewInProgress) {
                console.log("fetched review in progress")
                const applicationInReview = await db
                    .select()
                    .from(applications)
                    .where(sql`${applications.userId}=${reviewInProgress.applicantUserId}`)
                console.log("fetched application being reviewed")
                return { reviewInProgress, applicationInReview }
            } else {
                console.log("no review in progress")
            }

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
            console.log("fetched new application to review")
        
            // If there are no applications awaiting review, return
            if (!appToReview) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "There are no applications matching this query."
                })
            }

            // Create a new review
            const newReview = await db
            .insert(reviews)
            .values({
                reviewerUserId: ctx.session.user.id,
                applicantUserId: appToReview.userId,
            })
            .returning();
            
            console.log(`created new review for user ${ctx.session.user.id}`)

            // Update the application status to in_review
            await db
                .update(applications)
                .set({ status: "IN_REVIEW" })
                .where(eq(applications.userId, appToReview.userId));
        
            console.log("updated application status to IN_REVIEW")

            return {newReview, appToReview};
            
        } catch (error) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch application: " + JSON.stringify(error),
              });
        }
    })
})