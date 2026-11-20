import { TRPCError } from "@trpc/server";
import { count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { ACTIVE_COFFEE_CHAT_STATUSES } from "~/lib/coffee-chat-requests";
import {
  buildSponsorSummaries,
  mySponsorChats,
  orderReps,
  organizerForEmail,
  type MySponsorChats,
  type SponsorRep,
  type SponsorSummaries,
} from "~/lib/sponsor-organizer";
import { repBlocks, type RepBlock } from "~/lib/organizer-home";
import { fetchHwContacts } from "~/server/api/utils/sponsor-hw-contacts";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { buildJudgingBoard } from "~/lib/sponsor-judging-rooms";
import {
  judgingSheet,
  runOfShowFor,
} from "~/server/api/utils/sponsor-judging-board";
import { round2OpenedAt } from "~/server/api/utils/sponsor-judging-settings";
import type { SundayJudging } from "~/lib/sponsor-day-board";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatReps,
  coffeeChatHolds,
  coffeeChatLimits,
  coffeeChats,
  sponsorFinalPicks,
  sponsorHelpRequests,
  sponsorJudgingRooms,
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorShortlistSends,
  sponsorTeamReviews,
  teams,
  users,
} from "~/server/db/schema";

/**
 * Sunday portal progress per sponsor: teams scored and shortlisted, the
 * sent shortlist and the submitted top 5. Counts only, no team data.
 */
async function sundayProgress(): Promise<Map<string, SundayJudging>> {
  const [reviews, sends, finals] = await Promise.all([
    db
      .select({
        sponsorId: sponsorTeamReviews.sponsorId,
        scored: count(sponsorTeamReviews.score),
        shortlisted:
          sql<number>`count(*) filter (where ${sponsorTeamReviews.shortlisted})`.mapWith(
            Number,
          ),
      })
      .from(sponsorTeamReviews)
      .groupBy(sponsorTeamReviews.sponsorId),
    db
      .select({
        sponsorId: sponsorShortlistSends.sponsorId,
        sentAt: sponsorShortlistSends.sentAt,
        teamIds: sponsorShortlistSends.teamIds,
      })
      .from(sponsorShortlistSends),
    db
      .select({
        sponsorId: sponsorFinalPicks.sponsorId,
        submittedAt: sponsorFinalPicks.submittedAt,
      })
      .from(sponsorFinalPicks),
  ]);
  const out = new Map<string, SundayJudging>();
  const row = (id: string) => {
    let r = out.get(id);
    if (!r) {
      r = {
        shortlistSentAt: null,
        shortlistSentCount: 0,
        scored: 0,
        shortlisted: 0,
        finalSubmittedAt: null,
      };
      out.set(id, r);
    }
    return r;
  };
  for (const r of reviews) {
    Object.assign(row(r.sponsorId), {
      scored: r.scored,
      shortlisted: r.shortlisted,
    });
  }
  for (const s of sends) {
    Object.assign(row(s.sponsorId), {
      shortlistSentAt: s.sentAt,
      shortlistSentCount: s.teamIds.length,
    });
  }
  for (const f of finals) row(f.sponsorId).finalSubmittedAt = f.submittedAt;
  return out;
}

// The organizer sponsor home (/internal/sponsors) beyond Lucas's sheet
// board: one call for every sponsor's chats and help, not one per row.
export const sponsorOrganizerRouter = createTRPCRouter({
  /**
   * Every registered sponsor's coffee chat room, accepted and pending chats,
   * and live help request, plus help totals for the tab badge, and the
   * Sunday judging board (rooms, picks, status). Organizers only.
   */
  summary: protectedOrganizerProcedure.query(
    async (): Promise<SponsorSummaries> => {
      const now = new Date();
      const sponsors = await db
        .select({
          id: sponsorJudgingSponsors.id,
          name: sponsorJudgingSponsors.name,
          coffeeChatStyle: sponsorJudgingSponsors.coffeeChatStyle,
          coffeeChatPerSlot: sponsorJudgingSponsors.coffeeChatPerSlot,
          coffeeChatWatcher: sponsorJudgingSponsors.coffeeChatWatcher,
          portalLinkGivenAt: sponsorJudgingSponsors.portalLinkGivenAt,
        })
        .from(sponsorJudgingSponsors);
      const [
        runOfShow,
        sheet,
        chats,
        help,
        holds,
        limits,
        sunday,
        presentations,
        openedAt,
        boardRooms,
      ] = await Promise.all([
        runOfShowFor(sponsors.map((s) => s.name)),
        judgingSheet(),
        db
          .select({
            chatId: coffeeChats.id,
            sponsorId: coffeeChats.sponsorId,
            room: coffeeChats.room,
            slotTime: coffeeChats.slotTime,
            expiresAt: coffeeChats.expiresAt,
            durationMinutes: coffeeChats.durationMinutes,
            status: coffeeChats.status,
            firstName: applications.firstName,
            lastName: applications.lastName,
            userName: users.name,
            share: applications.agreeShareWithSponsors,
            github: applications.githubLink,
          })
          .from(coffeeChats)
          .innerJoin(users, eq(users.id, coffeeChats.userId))
          .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
          .where(inArray(coffeeChats.status, [...ACTIVE_COFFEE_CHAT_STATUSES])),
        db
          .select({
            id: sponsorHelpRequests.id,
            sponsorId: sponsorHelpRequests.sponsorId,
            status: sponsorHelpRequests.status,
            claimedByName: sponsorHelpRequests.claimedByName,
            createdAt: sponsorHelpRequests.createdAt,
          })
          .from(sponsorHelpRequests)
          .where(inArray(sponsorHelpRequests.status, ["open", "claimed"])),
        db
          .select({
            holdId: coffeeChatHolds.id,
            sponsorId: coffeeChatHolds.sponsorId,
            room: coffeeChatHolds.room,
            startTime: coffeeChatHolds.startTime,
            endTime: coffeeChatHolds.endTime,
          })
          .from(coffeeChatHolds),
        db
          .select({
            sponsorId: coffeeChatLimits.sponsorId,
            startTime: coffeeChatLimits.startTime,
            endTime: coffeeChatLimits.endTime,
            hackers: coffeeChatLimits.hackers,
          })
          .from(coffeeChatLimits),
        sundayProgress(),
        // Placed slots only (a null start couldn't fit).
        db
          .select({
            sponsorId: sponsorPresentations.sponsorId,
            room: sponsorPresentations.room,
            start: sponsorPresentations.startMinute,
            teamName: teams.name,
          })
          .from(sponsorPresentations)
          .innerJoin(teams, eq(teams.id, sponsorPresentations.teamId))
          .where(isNotNull(sponsorPresentations.startMinute)),
        round2OpenedAt(),
        // Rooms set on the Judging board win over the sheets.
        db.select().from(sponsorJudgingRooms),
      ]);
      return buildSponsorSummaries({
        sponsors,
        setups: runOfShow?.coffeeChats ?? [],
        chats: chats.map(({ userName, firstName, ...c }) => ({
          ...c,
          // Application first name, else the account name's first word.
          firstName: firstName?.trim()
            ? firstName
            : (userName?.trim().split(/\s+/)[0] ?? ""),
        })),
        help,
        holds,
        limits,
        judging: buildJudgingBoard({
          sponsors,
          items: runOfShow?.items ?? [],
          runOfShowRead: runOfShow !== null,
          sheet,
          boardRooms: new Map(boardRooms.map((r) => [r.sponsorId, r.room])),
        }),
        sunday,
        presentations: presentations.flatMap((p) =>
          p.start === null
            ? []
            : [
                {
                  sponsorId: p.sponsorId,
                  room: p.room ?? "",
                  start: p.start,
                  teamName: p.teamName,
                },
              ],
        ),
        round2Open: openedAt !== null,
        now,
      });
    },
  ),

  /**
   * My sponsors: who the signed-in organizer is (their HW Contacts "Login
   * email" matched to their account email, case-insensitive; null = no
   * match, so the page shows All sponsors only), and per registered sponsor
   * the coffee chat reps (People: name, phone, crown) and coffee chat
   * progress. Which sponsors are theirs is matched on the page against
   * Sponsor Day-Of's HW lead (getSponsors) via `contactNames`, the HW
   * Contacts names in row order (`me.row` indexes it). HW Contacts is
   * cached (HW_CONTACTS_CACHE_MS); a failed read keeps the last good rows,
   * and `contactsError` is true only when it has never been read. Organizers
   * only; phones come from the database and emails never leave the server.
   */
  mySponsors: protectedOrganizerProcedure.query(async ({ ctx }) => {
    const [user, contacts, sponsors, prefs, reps, placements, invites] =
      await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, ctx.session.user.id),
          columns: { email: true },
        }),
        fetchHwContacts(),
        db
          .select({ id: sponsorJudgingSponsors.id })
          .from(sponsorJudgingSponsors),
        db
          .select({
            sponsorId: coffeeChatPrefs.sponsorId,
            submittedAt: coffeeChatPrefs.submittedAt,
            shortlistSubmittedAt: coffeeChatPrefs.shortlistSubmittedAt,
            updatedAt: coffeeChatPrefs.updatedAt,
          })
          .from(coffeeChatPrefs),
        db
          .select({
            id: coffeeChatReps.id,
            sponsorId: coffeeChatReps.sponsorId,
            name: coffeeChatReps.name,
            phone: coffeeChatReps.phone,
            isPrimary: coffeeChatReps.isPrimary,
            position: coffeeChatReps.position,
            chatsWanted: coffeeChatReps.chatsWanted,
          })
          .from(coffeeChatReps),
        db
          .select({
            id: coffeeChatPlacements.id,
            repId: coffeeChatPlacements.repId,
            sessionId: coffeeChatPlacements.sessionId,
            room: coffeeChatPlacements.room,
            status: coffeeChatPlacements.status,
            sentAt: coffeeChatPlacements.sentAt,
          })
          .from(coffeeChatPlacements),
        // Session invites: chats tied to a placement (track B's rounds).
        db
          .select({
            sponsorId: coffeeChats.sponsorId,
            placementId: coffeeChats.placementId,
            status: coffeeChats.status,
          })
          .from(coffeeChats)
          .where(isNotNull(coffeeChats.placementId)),
      ]);
    const sponsorOfRep = new Map(reps.map((r) => [r.id, r.sponsorId]));
    const out: Record<
      string,
      { reps: SponsorRep[]; chats: MySponsorChats; blocks: RepBlock[] }
    > = {};
    for (const { id } of sponsors) {
      const mine = reps.filter((r) => r.sponsorId === id);
      const theirPlacements = placements.filter(
        (p) => sponsorOfRep.get(p.repId) === id,
      );
      const theirInvites = invites.filter((i) => i.sponsorId === id);
      out[id] = {
        // The Home's "Chats by rep": each rep's sent sessions and seats.
        blocks: repBlocks({
          reps: mine,
          placements: theirPlacements,
          invites: theirInvites,
        }),
        reps: orderReps(mine).map(
          ({ id: repId, name, phone, isPrimary, position }) => ({
            id: repId,
            name,
            phone,
            isPrimary,
            position,
          }),
        ),
        chats: mySponsorChats({
          pref: prefs.find((p) => p.sponsorId === id) ?? null,
          reps: mine,
          placements: theirPlacements,
          invites: theirInvites,
        }),
      };
    }
    const rows = contacts?.value ?? [];
    return {
      me: organizerForEmail(user?.email, rows),
      contactNames: rows.map((c) => c.name),
      contactsError: contacts === null,
      sponsors: out,
    };
  }),

  /**
   * Friday: mark a sponsor's private portal link as handed over (or undo
   * it). Organizers only. Returns the stored time (null = not given).
   */
  setPortalLinkGiven: protectedOrganizerProcedure
    .input(z.object({ sponsorId: z.string().uuid(), given: z.boolean() }))
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(sponsorJudgingSponsors)
        // A second "given" keeps the first time; undo clears it.
        .set({
          portalLinkGivenAt: input.given
            ? sql`coalesce(${sponsorJudgingSponsors.portalLinkGivenAt}, now())`
            : null,
        })
        .where(eq(sponsorJudgingSponsors.id, input.sponsorId))
        .returning({
          portalLinkGivenAt: sponsorJudgingSponsors.portalLinkGivenAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sponsor not found",
        });
      }
      return { sponsorId: input.sponsorId, linkGivenAt: row.portalLinkGivenAt };
    }),
});
