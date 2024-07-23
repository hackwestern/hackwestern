import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { reviews, users } from "~/server/db/schema";
import { db } from "~/server/db";
import { reviewSaveSchema, reviewSubmitSchema } from "~/schemas/review";
import { eq } from "drizzle-orm";

export const reviewsRouter = createTRPCRouter({
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
            target: reviews.applicantUserId,
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
    .input(reviewSaveSchema)
    .mutation(async({ input, ctx }) => {
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
        await db
        .insert(reviews)
        .values({
          ...reviewData,
          reviewerUserId: userId,
          applicantUserId: reviewData.applicantUserId,
          referral: true,
        })
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
});
