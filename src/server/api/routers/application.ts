import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";

const applicationSaveSchema = createInsertSchema(applications, {
  age: (schema) => schema.age.min(18),
  })
  .omit({
    createdAt: true,
    updatedAt: true,
    status: true,
  })
  .required({ userId: true });

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
        const savedApplication = await ctx.db
          .insert(applications)
          .values({ ...applicationData, userId })
          .onConflictDoUpdate({
            target: applications.userId,
            set: { ...applicationData, updatedAt: new Date() },
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
