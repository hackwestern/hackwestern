import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const loginRouter = createTRPCRouter({
  reset: protectedProcedure.mutation(({ ctx }) => {
    // TODO: handler body
  }),
});
