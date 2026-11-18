import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { getOpsOverview, syncOpsPings } from "~/server/api/utils/ops-pings";

/**
 * Ops pings (organizer run of show -> Slack DMs), organizer-only. The page
 * reads `overview`; "Refresh from sheet" runs `sync` and waits for it.
 */
export const opsPingsRouter = createTRPCRouter({
  overview: protectedOrganizerProcedure.query(() => getOpsOverview()),

  sync: protectedOrganizerProcedure.mutation(async () => {
    const result = await syncOpsPings();
    if (result.ok || result.reason !== "error") return result;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't schedule ops pings",
    });
  }),
});
