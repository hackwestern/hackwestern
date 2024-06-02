// import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const preregistrationRouter = createTRPCRouter({
  create: protectedProcedure.mutation(({ ctx }) => {
    void ctx; // TODO: delete me
    // TODO: finish body
  }),
});
