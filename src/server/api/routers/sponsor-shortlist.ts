import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { COFFEE_CHAT_SHORTLIST_SIZE } from "~/lib/coffee-chat-requests";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  safeProfileUrl,
  sponsorCandidates,
  type CandidateSource,
  type SponsorCandidate,
} from "~/server/api/utils/sponsor-shortlist";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorShortlists,
  teams,
  users,
} from "~/server/db/schema";

/** A hacker on the sponsor's candidate list, with their shortlist state. */
export type InterestedHacker = SponsorCandidate & { shortlisted: boolean };

/**
 * Who the sponsor is chatting with, keyed by chat id. Full name, team and
 * links only when the hacker agreed to share with sponsors; otherwise the
 * first name alone (as the scan card shows).
 */
export type ChatPartner = {
  chatId: string;
  name: string;
  shared: boolean;
  team: string | null;
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
};

const sponsorInput = z.string().uuid();
const userIdInput = z.string().trim().min(1).max(255);

async function findSponsor(id: string) {
  const sponsor = await db.query.sponsorJudgingSponsors.findFirst({
    where: eq(sponsorJudgingSponsors.id, id.toLowerCase()),
    columns: { id: true, name: true },
  });
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Unknown sponsor id" });
  }
  return sponsor;
}

/** User ids on this sponsor's shortlist, oldest first. */
async function shortlistedIds(sponsorId: string) {
  const rows = await db
    .select({ userId: sponsorShortlists.userId })
    .from(sponsorShortlists)
    .where(eq(sponsorShortlists.sponsorId, sponsorId))
    .orderBy(asc(sponsorShortlists.createdAt));
  return rows.map((r) => r.userId);
}

/** Whether the logged-in viewer (if any) is an organizer. */
async function isOrganizer(userId: string | undefined) {
  if (!userId) return false;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { type: true },
  });
  return user?.type === "organizer";
}

/**
 * The sponsor's candidates (T10) and coffee chat shortlist (T45), on
 * /sponsors/[uuid]/coffee-chats. The sponsor's UUID is the credential, as
 * on their other portal pages. Candidates come from the hacker interest
 * form ranking (top 40), or the in-app ranking when the form can't be read;
 * only candidates can be shortlisted. See sponsorCandidates.
 */
export const sponsorShortlistRouter = createTRPCRouter({
  /**
   * Candidates, best first, each flagged if shortlisted. `source` says which
   * ranking they came from; `showSource` is true only for a logged-in
   * organizer, so the fallback note never reaches sponsors.
   */
  list: publicProcedure.input(z.object({ sponsor: sponsorInput })).query(
    async ({
      ctx,
      input,
    }): Promise<{
      sponsorName: string;
      hackers: InterestedHacker[];
      maxShortlist: number;
      source: CandidateSource;
      showSource: boolean;
    }> => {
      const sponsor = await findSponsor(input.sponsor);
      const [candidates, ids, showSource] = await Promise.all([
        sponsorCandidates(sponsor),
        shortlistedIds(sponsor.id),
        isOrganizer(ctx.session?.user.id),
      ]);
      const picked = new Set(ids);
      return {
        sponsorName: sponsor.name,
        hackers: candidates.hackers.map((h) => ({
          ...h,
          shortlisted: picked.has(h.userId),
        })),
        maxShortlist: COFFEE_CHAT_SHORTLIST_SIZE,
        source: candidates.source,
        showSource,
      };
    },
  ),

  /**
   * Add a candidate to the shortlist. Anyone not on the sponsor's current
   * candidate list is a 404. Adding twice is a no-op. Capped at
   * COFFEE_CHAT_SHORTLIST_SIZE, counting only picks still on the list.
   */
  add: publicProcedure
    .input(z.object({ sponsor: sponsorInput, userId: userIdInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const { hackers } = await sponsorCandidates(sponsor);
      const eligible = hackers.find((h) => h.userId === input.userId);
      if (!eligible) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That hacker isn't on your interested list",
        });
      }
      await db.transaction(async (tx) => {
        // Lock the sponsor row so two adds can't both pass the cap.
        await tx
          .select({ id: sponsorJudgingSponsors.id })
          .from(sponsorJudgingSponsors)
          .where(eq(sponsorJudgingSponsors.id, sponsor.id))
          .for("update");
        const [already] = await tx
          .select({ userId: sponsorShortlists.userId })
          .from(sponsorShortlists)
          .where(
            and(
              eq(sponsorShortlists.sponsorId, sponsor.id),
              eq(sponsorShortlists.userId, eligible.userId),
            ),
          );
        if (already) return;
        const [total] = await tx
          .select({ n: count() })
          .from(sponsorShortlists)
          .where(
            and(
              eq(sponsorShortlists.sponsorId, sponsor.id),
              inArray(
                sponsorShortlists.userId,
                hackers.map((h) => h.userId),
              ),
            ),
          );
        if ((total?.n ?? 0) >= COFFEE_CHAT_SHORTLIST_SIZE) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Your shortlist is full (${COFFEE_CHAT_SHORTLIST_SIZE})`,
          });
        }
        await tx
          .insert(sponsorShortlists)
          .values({ sponsorId: sponsor.id, userId: eligible.userId })
          .onConflictDoNothing();
      });
      return { userId: eligible.userId, shortlisted: true };
    }),

  /** Take a hacker off the shortlist. Removing someone not on it is a no-op. */
  remove: publicProcedure
    .input(z.object({ sponsor: sponsorInput, userId: userIdInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      await db
        .delete(sponsorShortlists)
        .where(
          and(
            eq(sponsorShortlists.sponsorId, sponsor.id),
            eq(sponsorShortlists.userId, input.userId),
          ),
        );
      return { userId: input.userId, shortlisted: false };
    }),

  /**
   * Who the sponsor's chats are with: full profile for hackers who agreed
   * to share with sponsors, first name only otherwise. Never an email.
   */
  chatPartners: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }): Promise<ChatPartner[]> => {
      const sponsor = await findSponsor(input.sponsor);
      const rows = await db
        .select({
          chatId: coffeeChats.id,
          firstName: applications.firstName,
          lastName: applications.lastName,
          accountName: users.name,
          share: applications.agreeShareWithSponsors,
          team: teams.name,
          resume: applications.resumeLink,
          github: applications.githubLink,
          linkedIn: applications.linkedInLink,
          devpost: applications.devpostLink,
        })
        .from(coffeeChats)
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .leftJoin(teams, eq(users.teamId, teams.id))
        .where(eq(coffeeChats.sponsorId, sponsor.id));
      return rows.map((r) => {
        const first = r.firstName?.trim()
          ? r.firstName.trim()
          : (r.accountName?.trim().split(/\s+/)[0] ?? "");
        if (r.share !== true) {
          return {
            chatId: r.chatId,
            name: first,
            shared: false,
            team: null,
            resume: null,
            github: null,
            linkedIn: null,
            devpost: null,
          };
        }
        const full = [r.firstName, r.lastName]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ");
        return {
          chatId: r.chatId,
          name: full || first,
          shared: true,
          team: r.team,
          resume: safeProfileUrl(r.resume),
          github: safeProfileUrl(r.github),
          linkedIn: safeProfileUrl(r.linkedIn),
          devpost: safeProfileUrl(r.devpost),
        };
      });
    }),

  /**
   * Organizers: a sponsor's shortlist, oldest pick first, for assigning
   * chats. Hackers no longer on the sponsor's candidate list (for example,
   * they withdrew consent under the in-app ranking) drop off.
   */
  forSponsor: protectedOrganizerProcedure
    .input(z.object({ sponsorId: sponsorInput }))
    .query(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsorId);
      const ids = await shortlistedIds(sponsor.id);
      const { hackers } = await sponsorCandidates(sponsor);
      const byId = new Map(hackers.map((h) => [h.userId, h]));
      return {
        sponsorName: sponsor.name,
        hackers: ids.flatMap((id) => {
          const h = byId.get(id);
          return h ? [h] : [];
        }),
      };
    }),
});
