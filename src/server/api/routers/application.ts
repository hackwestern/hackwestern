import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const applicationRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => {
    // TODO: finish body
  }),

  save: protectedProcedure.mutation(({ ctx }) => {
    // TODO: handler body
  }),
});
