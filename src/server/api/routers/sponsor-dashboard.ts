import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sponsorStatusSheetCopy as statusCopy } from "~/content/sponsor-status-sheet";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import {
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
  fetchSheetSponsors,
  fetchSheetSponsorNames,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
import { writeSponsorStatus } from "~/server/api/utils/sponsor-info-tab";
import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";

export const sponsorDashboardRouter = createTRPCRouter({
  /**
   * Register a sponsor and get their private UUID. Organizer-only. The name
   * must match the Sponsor Day-Of tab's "Sponsor Name" spelling, since that is what
   * the judging sheet is keyed on.
   */
  registerSponsor: protectedOrganizerProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const [inserted] = await db
        .insert(sponsorJudgingSponsors)
        .values({ name })
        .onConflictDoNothing({ target: sponsorJudgingSponsors.name })
        .returning();
      if (inserted) return inserted;
      // Someone registered this name first; return their row.
      return db.query.sponsorJudgingSponsors.findFirst({
        where: eq(sponsorJudgingSponsors.name, name),
      });
    }),

  /**
   * List all registered sponsor UUIDs and names. Organizer-only.
   */
  listSponsors: protectedOrganizerProcedure.query(async () => {
    return db.query.sponsorJudgingSponsors.findMany();
  }),

  /**
   * Full sponsor board for organizers: every acquired sponsor from the master
   * sheet (tier, amount, contacts, notes), joined with their private-link UUID
   * and their current picks from the judging sheet. Sponsors that are
   * registered but no longer on the Sponsor Day-Of tab are appended with an empty
   * tier so typos stay visible instead of silently disappearing. Organizer-only.
   */
  getSponsors: protectedOrganizerProcedure.query(async () => {
    try {
      const [master, registered, sheets, spreadsheetId] = await Promise.all([
        fetchSheetSponsors(),
        db.query.sponsorJudgingSponsors.findMany(),
        getSheetsClient(),
        Promise.resolve(getSpreadsheetId()),
      ]);
      const [picks, sponsorInfoMap] = await Promise.all([
        fetchAllChosenTeams(sheets, spreadsheetId),
        fetchAllSponsorInfo(sheets, spreadsheetId),
      ]);

      const registeredByName = new Map(
        registered.map((row) => [row.name, row]),
      );

      const sponsors = master.map((sponsor) => {
        const info = sponsorInfoMap.get(sponsor.name.toLowerCase());
        const hwContact =
          info?.hwContact && info.hwContact !== "—"
            ? info.hwContact
            : sponsor.hwContact || "—";

        return {
          name: sponsor.name,
          tier: sponsor.tier,
          amount: sponsor.amount,
          companyContact: sponsor.companyContact,
          hwContact,
          notes: sponsor.notes,
          sponsorId: registeredByName.get(sponsor.name)?.id ?? null,
          teamIds: picks.get(sponsor.name) ?? [],
          status: info?.status ?? "Not arrived",
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          onMasterSheet: true,
        };
      });

      const masterNames = new Set(master.map((sponsor) => sponsor.name));
      for (const row of registered) {
        if (masterNames.has(row.name)) continue;
        const info = sponsorInfoMap.get(row.name.toLowerCase());
        const hwContact =
          info?.hwContact && info.hwContact !== "—" ? info.hwContact : "—";
        sponsors.push({
          name: row.name,
          tier: "",
          amount: "",
          companyContact: "",
          hwContact,
          notes: "Registered but not on the Sponsor Day-Of tab",
          sponsorId: row.id,
          teamIds: picks.get(row.name) ?? [],
          status: info?.status ?? "Not arrived",
          roomNumber: info?.roomNumber ?? "TBD",
          boothLocation: info?.boothLocation ?? "TBD",
          onMasterSheet: false,
        });
      }

      return sponsors;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load sponsors",
      });
    }
  }),

  /**
   * Set a sponsor's status in the Status column of the Sponsor Day-Of tab
   * (Sponsor Status was merged into it on 2026-11-19). Organizer-only.
   */
  setSponsorStatus: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorName: z.string().trim().min(1).max(255),
        status: z.enum(SPONSOR_STATUS_VALUES),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const result = await writeSponsorStatus(
          sheets,
          getSpreadsheetId(),
          input.sponsorName,
          input.status,
        );
        if (!result.ok) {
          // A sponsor missing from Sponsor Day-Of gets no new row there:
          // that tab is the sponsor list, edited by the spon team.
          throw new TRPCError({
            code:
              result.reason === "not-found"
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
            message:
              result.reason === "not-found"
                ? statusCopy.errors.notFound(input.sponsorName)
                : result.reason === "no-tab"
                  ? statusCopy.errors.noTab
                  : statusCopy.errors.noColumn,
          });
        }

        // Sheet writes off (dev, tests): nothing reached the sheet, which
        // the caller sees as success with sheetWritten false.
        const sheetWritten = !("written" in result);
        return {
          sponsorName: input.sponsorName,
          status: input.status,
          sheetWritten,
          ...(sheetWritten ? {} : { note: statusCopy.notWritten }),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : statusCopy.errors.writeFailed,
        });
      }
    }),

  /**
   * Register every sponsor from the master sponsor sheet that isn't in the
   * judging table yet. Organizer-only; run this whenever the sponsor roster
   * changes (before judging opens, plus late additions). Returns the full
   * list of sponsors in master-sheet order with their private UUIDs, so the
   * caller can build each sponsor's judging link.
   */
  syncSponsors: protectedOrganizerProcedure.mutation(async () => {
    const names = await fetchSheetSponsorNames();
    if (names.length === 0) return [];

    await db
      .insert(sponsorJudgingSponsors)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing({ target: sponsorJudgingSponsors.name })
      .returning();

    const rows = await db.query.sponsorJudgingSponsors.findMany();
    const byName = new Map(rows.map((row) => [row.name, row]));

    return names.map((name) => {
      const row = byName.get(name);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sponsor "${name}" vanished during sync`,
        });
      }
      return { id: row.id, name, createdAt: row.createdAt };
    });
  }),
});
