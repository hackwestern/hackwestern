import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { isAdmittedStatus } from "~/lib/admission";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  applications,
  sponsorInterests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

/**
 * A hacker's ranking of the sponsors they'd like to meet (T09).
 *
 * Sponsors are addressed by name here, never by id: a sponsor's id is the
 * secret in their private portal link, so it must not reach hackers.
 */

const MAX_RANKED = 50;

async function sponsorList() {
  return db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors)
    .orderBy(asc(sponsorJudgingSponsors.name));
}

async function applicationOf(userId: string) {
  return db.query.applications.findFirst({
    where: eq(applications.userId, userId),
    columns: { status: true, agreeShareWithSponsors: true },
  });
}

export const sponsorInterestRouter = createTRPCRouter({
  /** Sponsor names (A-Z) and the hacker's own ranking, top pick first. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [sponsors, mine, application] = await Promise.all([
      sponsorList(),
      db
        .select({ name: sponsorJudgingSponsors.name })
        .from(sponsorInterests)
        .innerJoin(
          sponsorJudgingSponsors,
          eq(sponsorInterests.sponsorId, sponsorJudgingSponsors.id),
        )
        .where(eq(sponsorInterests.userId, userId))
        .orderBy(asc(sponsorInterests.rank)),
      applicationOf(userId),
    ]);
    return {
      canRank: isAdmittedStatus(application?.status),
      sharesWithSponsors: application?.agreeShareWithSponsors ?? false,
      sponsors: sponsors.map((s) => s.name),
      ranking: mine.map((r) => r.name),
    };
  }),

  /** Replaces the hacker's own ranking. An empty list clears it. */
  save: protectedProcedure
    .input(
      z.object({
        ranking: z.array(z.string().trim().min(1).max(255)).max(MAX_RANKED),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const application = await applicationOf(userId);
      if (!isAdmittedStatus(application?.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admitted hackers can rank sponsors",
        });
      }

      if (new Set(input.ranking).size !== input.ranking.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Each sponsor can appear once",
        });
      }
      const idByName = new Map(
        (await sponsorList()).map((s) => [s.name, s.id]),
      );
      const sponsorIds = input.ranking.map((name) => idByName.get(name));
      if (sponsorIds.some((id) => id === undefined)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown sponsor",
        });
      }

      await db.transaction(async (tx) => {
        // Two saves at once (double tap, two tabs) would otherwise both
        // delete, then both insert, and collide on (user_id, rank). Locking
        // the hacker's application row runs them one after the other; the
        // last one wins.
        await tx
          .select({ userId: applications.userId })
          .from(applications)
          .where(eq(applications.userId, userId))
          .for("update");
        await tx
          .delete(sponsorInterests)
          .where(eq(sponsorInterests.userId, userId));
        if (sponsorIds.length > 0) {
          await tx.insert(sponsorInterests).values(
            sponsorIds.map((sponsorId, i) => ({
              userId,
              sponsorId: sponsorId!,
              rank: i + 1,
            })),
          );
        }
      });
      return { ranking: input.ranking };
    }),
});
