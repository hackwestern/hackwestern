import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { applications } from "~/server/db/schema";
import { createInsertSchema } from "drizzle-zod";

const applicationSaveSchema = createInsertSchema(applications)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .required({ id: true, userId: true });

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => {
    // TODO: finish body
  }),

  save: protectedProcedure
    .input(applicationSaveSchema)
    .mutation(({ input, ctx }) => {
      // TODO: handler body
    }),
});
