import { eq, inArray } from "drizzle-orm";

import { ACTIVE_COFFEE_CHAT_STATUSES } from "~/lib/coffee-chat-requests";
import {
  buildSponsorSummaries,
  type SponsorSummaries,
} from "~/lib/sponsor-organizer";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { buildJudgingBoard } from "~/lib/sponsor-judging-rooms";
import {
  judgingSheet,
  runOfShowFor,
} from "~/server/api/utils/sponsor-judging-board";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  coffeeChats,
  sponsorHelpRequests,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

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
          coffeeChatRoom: sponsorJudgingSponsors.coffeeChatRoom,
          coffeeChatReps: sponsorJudgingSponsors.coffeeChatReps,
          coffeeChatWatcher: sponsorJudgingSponsors.coffeeChatWatcher,
        })
        .from(sponsorJudgingSponsors);
      const [runOfShow, sheet, chats, help, holds] = await Promise.all([
        runOfShowFor(sponsors.map((s) => s.name)),
        judgingSheet(),
        db
          .select({
            chatId: coffeeChats.id,
            sponsorId: coffeeChats.sponsorId,
            room: coffeeChats.room,
            slotTime: coffeeChats.slotTime,
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
        judging: buildJudgingBoard({
          sponsors,
          items: runOfShow?.items ?? [],
          runOfShowRead: runOfShow !== null,
          sheet,
        }),
        now,
      });
    },
  ),
});
