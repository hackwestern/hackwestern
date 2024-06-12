import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { check } from "prettier";

// Save schema
const applicationSaveSchema = createInsertSchema(applications)
  .omit({
    createdAt: true,
    updatedAt: true,
    status: true,
  })
  .required({ userId: true });

// Helper function to check word count within a range
const checkWordCount = (value: string, min: number, max: number) => {
  const words = value.split(" ");
  return words.length < max && words.length > min;
}

// Submission schema with data validation
const applicationSubmitSchema = createInsertSchema(applications, {
  agreeCodeOfConduct: z.literal(true),
  agreeShareWithMLH: z.literal(true),
  agreeWillBe18: z.literal(true),
  age: (schema) => schema.age.min(18),
  resumeLink: (schema) => schema.resumeLink.url(),
  otherLink: (schema) => schema.otherLink.url(),
  question1: (schema) => schema.question1.refine((value) => checkWordCount(value, 30, 150)),
  question2: (schema) => schema.question2.refine((value) => checkWordCount(value, 30, 150)),
  question3: (schema) => schema.question3.refine((value) => checkWordCount(value, 30, 150)),
})

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const application = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.userId, userId))
        .limit(1);

      if (!application.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      return application[0];
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch application: " + JSON.stringify(error),
      });
    }
  }),

  save: protectedProcedure
    .input(applicationSaveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.session.user.id;
        const applicationData = input;
        const isCompleteApplication = applicationSubmitSchema.safeParse(applicationData).success;

        const savedApplication = await ctx.db
          .insert(applications)
          .values({ 
            ...applicationData, 
            githubLink: `https://github.com/${applicationData.githubLink}`,
            linkedInLink: `https://linkedin.com/in/${applicationData.linkedInLink}`,
            userId, 
            status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS"
          })
          .onConflictDoUpdate({
            target: applications.userId,
            set: { ...applicationData, updatedAt: new Date(), status: isCompleteApplication ? "PENDING_REVIEW" : "IN_PROGRESS"},
          })
          .returning();
        return savedApplication[0];
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save application: " + JSON.stringify(error),
        });
      }
    }),
});
