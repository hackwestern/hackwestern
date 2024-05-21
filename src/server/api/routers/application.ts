import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications } from "~/server/db/schema";

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => {
    const userId = ctx.session.user.id;
    ctx.db.select().from(applications).where(eq(applications.userId, userId)).limit(1)
      .then((application) => {
        if (!application.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Application not found",
          });
        }
        return application[0];
      }).catch((error) => {
        if (error instanceof TRPCError && error.code === "NOT_FOUND") {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch application: " + JSON.stringify(error),
        });
      });
  }),

  save: protectedProcedure.mutation(({ ctx }) => {
    // TODO: handler body
  }),
});
