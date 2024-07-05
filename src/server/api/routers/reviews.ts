import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { reviews } from "~/server/db/schema";
import { db } from "~/server/db";
import { reviewSaveSchema, reviewSubmitSchema } from "~/schemas/review";

export const reviewsRouter = createTRPCRouter({
  save: protectedProcedure
    .input(reviewSaveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
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
});
