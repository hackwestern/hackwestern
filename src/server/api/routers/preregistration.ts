import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { createInsertSchema } from "drizzle-zod";
import { preregistrations } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";

const preregistrationCreateSchema = createInsertSchema(preregistrations).omit({
  createdAt: true,
  id: true,
});

export const preregistrationRouter = createTRPCRouter({
  create: publicProcedure
    .input(preregistrationCreateSchema)
    .mutation(async ({ input }) => {
      try {
        const existingPreregistration =
          await db.query.preregistrations.findFirst({
            where: ({ email }, { eq }) => eq(email, input.email),
          });

        if (!!existingPreregistration) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Pre-registration with that email already exists.",
          });
        }

        const createdPreregistration = await db
          .insert(preregistrations)
          .values(input)
          .returning();

        return createdPreregistration[0];
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Failed to create preregistration" + JSON.stringify(error),
            });
      }
    }),
});
