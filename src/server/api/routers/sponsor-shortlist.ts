import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  sponsorShortlist,
  type ShortlistedHacker,
} from "~/server/api/utils/sponsor-shortlist";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";

/**
 * Read-only "Interested hackers" list for a sponsor's private page (T11).
 * The sponsor's UUID is the credential, as on their other portal pages.
 * Coffee chats are offered by scanning badges (docs/decisions.md,
 * 2026-11-15), so nothing here writes.
 */
export const sponsorShortlistRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(
      async ({
        input,
      }): Promise<{ sponsorName: string; hackers: ShortlistedHacker[] }> => {
        const sponsor = await db.query.sponsorJudgingSponsors.findFirst({
          where: eq(sponsorJudgingSponsors.id, input.sponsor.toLowerCase()),
          columns: { id: true, name: true },
        });
        if (!sponsor) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Unknown sponsor id",
          });
        }
        return {
          sponsorName: sponsor.name,
          hackers: await sponsorShortlist(sponsor.id),
        };
      },
    ),
});
