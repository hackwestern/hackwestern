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
import {
  buildJudgingBoard,
  pickCountFromChosenTeams,
} from "~/lib/sponsor-judging-rooms";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import {
  createCachedLoader,
  getRunOfShow,
} from "~/server/api/utils/run-of-show-sheet";
import {
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  coffeeChatLimits,
  coffeeChats,
  sponsorHelpRequests,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

/**
 * The run of show with registered sponsor names applied (coffee chat rooms
 * and the judging item); null when the sheet can't be read (optional here).
 */
async function runOfShowFor(sponsorNames: string[]) {
  try {
    return applySponsorNames(await getRunOfShow(), sponsorNames);
  } catch (error) {
    console.error("run-of-show sheet read failed (sponsor summary)", error);
    return null;
  }
}

/**
 * Lucas's judging spreadsheet for the judging view: each sponsor's room
 * (Sponsor Info tab) and chosen teams, one read of each. Cached for 30 s,
 * since the summary polls every 15 s per organizer.
 */
const judgingSheetCache = createCachedLoader(async () => {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const [info, chosen] = await Promise.all([
    // Strict: a failed read must show as "couldn't read", not as no rooms.
    fetchAllSponsorInfo(sheets, spreadsheetId, { strict: true }),
    fetchAllChosenTeams(sheets, spreadsheetId),
  ]);
  return {
    rooms: new Map([...info].map(([name, r]) => [name, r.roomNumber])),
    pickCount: pickCountFromChosenTeams(chosen),
  };
}, 30_000);

/** Null when the judging sheet can't be read (picks show as unknown). */
async function judgingSheet() {
  try {
    return await judgingSheetCache.get();
  } catch (error) {
    console.error("judging sheet read failed (sponsor summary)", error);
    return null;
  }
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
        })
        .from(sponsorJudgingSponsors);
      const [runOfShow, sheet, chats, help, holds, limits] = await Promise.all([
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
        db
          .select({
            sponsorId: coffeeChatLimits.sponsorId,
            startTime: coffeeChatLimits.startTime,
            endTime: coffeeChatLimits.endTime,
            hackers: coffeeChatLimits.hackers,
          })
          .from(coffeeChatLimits),
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
        }),
        now,
      });
    },
  ),
});
