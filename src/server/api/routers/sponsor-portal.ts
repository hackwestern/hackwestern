import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  COFFEE_CHAT_ROOMS,
  coffeeChatBlocksFor,
  coffeeChatSlotKeyOf,
  diffCoffeeChatGrid,
  findCoffeeChatConflicts,
  isBookedBy,
  isCoffeeChatSlot,
  isPureCancellation,
  mergeCoffeeChatBookings,
  sortCoffeeChatSlots,
} from "~/lib/coffee-chats";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
  resolveSponsorName,
} from "~/server/api/utils/sponsor-sheets";
import {
  ensureCoffeeChatTab,
  fetchCoffeeChatGrid,
  writeCoffeeChatGridDiff,
  writeCoffeeChatGridFull,
} from "~/server/api/utils/sponsor-coffee-chats";
import {
  fetchHwContactPhones,
  lookupHwContactPhones,
} from "~/server/api/utils/sponsor-hw-contacts";
import { fetchRankedInterestRows } from "~/server/api/utils/hacker-interest";
import { db } from "~/server/db";
import { sponsorFinalPicks } from "~/server/db/schema";

export const sponsorPortalRouter = createTRPCRouter({
  /**
   * Return the highest-scoring applicants who selected this sponsor in the
   * interest form. The private sponsor UUID gates access; the form supplies
   * the contact links and the database supplies the application score.
   */
  getInterestedHackers: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const ranked = await fetchRankedInterestRows(sponsorName);
        const hackers = ranked.map((row, index) => ({
          name: row.name,
          resumeUrl: row.resumeUrl || null,
          extraLink: row.extraLink || null,
          rank: index + 1,
        }));

        return { sponsorName, hackers };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load interested hackers",
        });
      }
    }),

  /**
   * Get public sponsor portal info for /sponsors/[id]. Public.
   * Resolves the sponsor UUID to its name, then loads their HW contact
   * from the master sheet and their room number and booth location
   * from the "sponsor info" tab. The HW contact name is matched against
   * the HW contacts sheet to attach a phone number when one is listed.
   * Also returns their coffee-chat allowance ("Coffee Chat Max Minutes"
   * on the sponsor info tab; 0 = disabled) plus how many slots they have
   * already booked on the Coffee Chats grid.
   * Does NOT expose amount or status.
   */
  getSponsorPortalInfo: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const [
          sponsorInfoMap,
          picksMap,
          contactPhones,
          coffeeChatGrid,
          finalPick,
        ] = await Promise.all([
          fetchAllSponsorInfo(sheets, spreadsheetId),
          fetchAllChosenTeams(sheets, spreadsheetId),
          fetchHwContactPhones(),
          fetchCoffeeChatGrid(sheets, spreadsheetId),
          db.query.sponsorFinalPicks.findFirst({
            where: eq(sponsorFinalPicks.sponsorId, input.sponsor.toLowerCase()),
            columns: { teamIds: true },
          }),
        ]);

        const info = sponsorInfoMap.get(sponsorName.toLowerCase());
        // The submitted ranking (sponsor_final_pick) wins over the sheet,
        // which can lag behind it while a sheet write is pending.
        const picks = finalPick?.teamIds ?? picksMap.get(sponsorName) ?? [];
        // The sponsor info tab on the judging sheet is the only source for
        // the HW contact; an empty cell stays "—".
        const hwContact = info?.hwContact ?? "—";
        const hwContactPhones = lookupHwContactPhones(hwContact, contactPhones);

        const maxCoffeeChatMinutes = info?.maxCoffeeChatMinutes ?? 0;
        const coffeeChatBookedCount = coffeeChatGrid.filter((booking) =>
          isBookedBy(booking, sponsorName),
        ).length;

        return {
          sponsorName,
          hwContact,
          hwContactPhone: hwContactPhones[0] ?? null,
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          // Empty string when blank so the portal can omit the workshop card.
          workshopLocation: info?.workshopLocation ?? null,
          workshopTime: info?.workshopTime ?? null,
          picksCount: picks.length,
          // Judging applies when the sponsor awards a prize track, has a
          // judging room, or has already submitted picks. The portal shows
          // the Judging tile on any of these (no judging room needed).
          judgingApplies:
            Boolean(info?.track) ||
            Boolean(info?.roomNumber && info.roomNumber !== "TBD") ||
            picks.length > 0,
          // Coffee chats: 0 minutes means the sponsor never sees the booking
          // link at all.
          maxCoffeeChatMinutes,
          maxCoffeeChatBlocks: coffeeChatBlocksFor(maxCoffeeChatMinutes),
          coffeeChatBookedCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load sponsor portal information",
        });
      }
    }),

  /**
   * Save the sponsor's coffee-chat booking (their full desired final state,
   * so re-saving with fewer slots cancels the rest). Public, keyed by the
   * private UUID. Validates every slot is real, free of other sponsors'
   * bookings, and within the sponsor's allowance — except a pure
   * cancellation, which stays allowed if their allowance was reduced after
   * they booked. Rewrites the visual grid with shading.
   */
  setCoffeeChatBooking: publicProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        slots: z
          .array(
            z.object({
              room: z.number().int().min(1).max(COFFEE_CHAT_ROOMS.length),
              time: z.string().regex(/^\d{1,2}:\d{2}$/),
            }),
          )
          .max(200),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsorId);

        // Deduplicate while rejecting anything that isn't a real slot.
        const requested = sortCoffeeChatSlots(
          (() => {
            const unique = new Map<string, { room: number; time: string }>();
            for (const slot of input.slots) {
              if (!isCoffeeChatSlot(slot)) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Not a bookable slot: Room ${slot.room} at ${slot.time}`,
                });
              }
              unique.set(coffeeChatSlotKeyOf(slot), slot);
            }
            return [...unique.values()];
          })(),
        );

        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const [sponsorInfoMap, grid] = await Promise.all([
          fetchAllSponsorInfo(sheets, spreadsheetId),
          fetchCoffeeChatGrid(sheets, spreadsheetId),
        ]);
        const maxCoffeeChatMinutes =
          sponsorInfoMap.get(sponsorName.toLowerCase())?.maxCoffeeChatMinutes ??
          0;
        const maxBlocks = coffeeChatBlocksFor(maxCoffeeChatMinutes);

        const conflicts = findCoffeeChatConflicts(requested, grid, sponsorName);
        if (conflicts.length > 0) {
          const conflict = conflicts[0]!;
          const roomLabel =
            COFFEE_CHAT_ROOMS.find((room) => room.id === conflict.room)
              ?.label ?? `Room ${conflict.room}`;
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${roomLabel} at ${conflict.time} was just booked. Pick a different slot.`,
          });
        }

        if (
          requested.length > maxBlocks &&
          !isPureCancellation(requested, grid, sponsorName)
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              maxBlocks === 0
                ? "Coffee chats aren't enabled for your sponsorship yet."
                : `Your package includes ${maxCoffeeChatMinutes} minutes — that's ${maxBlocks} × 15-minute blocks. Remove some slots to save.`,
          });
        }

        const merged = mergeCoffeeChatBookings(grid, sponsorName, requested);
        const { sheetId, created } = await ensureCoffeeChatTab(
          sheets,
          spreadsheetId,
        );
        // New/never-seeded tab: lay out the full grid. Otherwise write only
        // changed cells so concurrent saves and organizer edits survive.
        if (created) {
          await writeCoffeeChatGridFull(sheets, spreadsheetId, sheetId, merged);
        } else {
          await writeCoffeeChatGridDiff(
            sheets,
            spreadsheetId,
            sheetId,
            diffCoffeeChatGrid(grid, merged),
          );
        }

        return {
          sponsorName,
          bookedCount: requested.length,
          myBooked: requested.map(({ room, time }) => ({ room, time })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to save coffee chat booking",
        });
      }
    }),
});
