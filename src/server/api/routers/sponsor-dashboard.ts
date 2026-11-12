import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";
import { createTRPCRouter, protectedOrganizerProcedure } from "~/server/api/trpc";
import {
  cell,
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
  fetchMasterSponsors,
  fetchMasterSponsorNames,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
import { ensureSponsorInfoTab } from "~/server/api/utils/sponsor-info-tab";
import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";

export const sponsorDashboardRouter = createTRPCRouter({
  /**
   * Register a sponsor and get their private UUID. Organizer-only. The name
   * must match the master sheet's "Company Name" spelling, since that is what
   * the judging sheet is keyed on.
   */
  registerSponsor: protectedOrganizerProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const existing = await db.query.sponsorJudgingSponsors.findFirst({
        where: eq(sponsorJudgingSponsors.name, name),
      });
      if (existing) {
        return existing;
      }
      const [row] = await db
        .insert(sponsorJudgingSponsors)
        .values({ name })
        .returning();
      return row;
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
   * registered but no longer on the master sheet are appended with an empty
   * tier so typos stay visible instead of silently disappearing. Organizer-only.
   */
  getSponsors: protectedOrganizerProcedure.query(async () => {
    try {
      const [master, registered, sheets, spreadsheetId] = await Promise.all([
        fetchMasterSponsors(),
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
          notes: "Registered but missing from the master sheet",
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
   * Set a sponsor's status in the "sponsor info" tab.
   * Organizer-only.
   */
  setSponsorStatus: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorName: z.string().min(1),
        status: z.enum(SPONSOR_STATUS_VALUES),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        const tab = await ensureSponsorInfoTab(sheets, spreadsheetId);

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tab}'!A1:C`,
        });

        const rows = res.data.values ?? [];
        const target = input.sponsorName.trim().toLowerCase();
        let targetRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const name = cell(rows[i], 0);
          const lower = name.toLowerCase();
          if (
            lower === target &&
            lower !== "sponsor name" &&
            lower !== "company name"
          ) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tab}'!B${targetRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[input.status]],
            },
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${tab}'!A:E`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              majorDimension: "ROWS",
              values: [[input.sponsorName, input.status, "TBD", "TBD", "—"]],
            },
          });
        }

        return { sponsorName: input.sponsorName, status: input.status };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor status in spreadsheet",
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
    const names = await fetchMasterSponsorNames();
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
