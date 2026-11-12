import { TRPCError } from "@trpc/server";
import { eq, count } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { teams, users } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  MAX_SPONSOR_PICKS,
  MIN_SPONSOR_PICKS,
} from "~/lib/sponsor-picks";
import {
  SHEET_TAB,
  fetchColumnA,
  findSponsorRows,
  getJudgingSheetId,
  getSheetsClient,
  getSpreadsheetId,
  parseTeamIds,
  resolveSponsorName,
} from "~/server/api/utils/sponsor-sheets";

export const sponsorJudgingRouter = createTRPCRouter({
  /**
   * Get the team ids a sponsor has selected. Public, keyed by the sponsor's
   * private UUID. The resolved name is matched against column A of the
   * sheet; returns the parsed team id list from column B (empty list if the
   * sponsor has no row or no picks yet).
   */
  getChosenTeams: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsor);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [rowNumber] = findSponsorRows(columnA, sponsorName);
        if (!rowNumber) {
          return { sponsorName, teamIds: [] as string[] };
        }

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SHEET_TAB}!B${rowNumber}`,
        });
        const pickedCell = (res.data.values?.[0]?.[0] ?? "") as string;

        return { sponsorName, teamIds: parseTeamIds(pickedCell) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch sponsor's chosen teams",
        });
      }
    }),

  /**
   * Replace a sponsor's chosen teams. Public. Takes only the sponsor UUID
   * (the private URL identifier); the resolved name is what gets written to
   * the sheet. Overwrites column B on the sponsor's existing row, or appends
   * a new row (name + team ids) if the sponsor isn't in the sheet yet. An
   * empty teamIds list clears the sponsor's picks.
   */
  setChosenTeams: publicProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        // Empty list clears the picks; otherwise 5-10 teams, matching the
        // picks page (constants shared via ~/lib/sponsor-picks).
        teamIds: z
          .array(z.string().min(1))
          .max(MAX_SPONSOR_PICKS)
          .refine(
            (teamIds) =>
              teamIds.length === 0 || teamIds.length >= MIN_SPONSOR_PICKS,
            {
              message: `Pick between ${MIN_SPONSOR_PICKS} and ${MAX_SPONSOR_PICKS} teams, or none to clear your picks`,
            },
          ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const sponsorName = await resolveSponsorName(input.sponsorId);
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        const columnA = await fetchColumnA(sheets, spreadsheetId);
        const [existingRow] = findSponsorRows(columnA, sponsorName);

        const cellValue = input.teamIds.join(", ");

        if (existingRow) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TAB}!B${existingRow}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[cellValue]],
            },
          });
          return { sponsorName, teamIds: input.teamIds };
        }

        // No row yet. The append below races with any other first write for
        // the same sponsor: both can see "no row" and both append, leaving a
        // duplicate row that would silently shadow picks. Re-read column A
        // afterwards and collapse any extra rows onto the first one.
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${SHEET_TAB}!A:B`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            majorDimension: "ROWS",
            values: [[sponsorName, cellValue]],
          },
        });

        const rowsAfterAppend = findSponsorRows(
          await fetchColumnA(sheets, spreadsheetId),
          sponsorName,
        );
        const [canonicalRow, ...duplicates] = rowsAfterAppend;
        if (canonicalRow && duplicates.length > 0) {
          const sheetId = await getJudgingSheetId(sheets, spreadsheetId);
          // Delete highest row numbers first so earlier indices stay valid.
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [...duplicates]
                .sort((a, b) => b - a)
                .map((rowNumber) => ({
                  deleteDimension: {
                    range: {
                      sheetId,
                      dimension: "ROWS",
                      startIndex: rowNumber - 1,
                      endIndex: rowNumber,
                    },
                  },
                })),
            },
          });
          // The surviving row may hold the other writer's picks; assert ours.
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TAB}!B${canonicalRow}`,
            valueInputOption: "RAW",
            requestBody: {
              majorDimension: "ROWS",
              values: [[cellValue]],
            },
          });
        }

        return { sponsorName, teamIds: input.teamIds };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update sponsor's chosen teams",
        });
      }
    }),

  /**
   * List all teams from the teams table. Public but gated: the caller must
   * present a registered sponsor UUID (the private link), so the team
   * roster isn't enumerable by anyone. Used by the sponsor picks page.
   * Returns each team's id, name, and member count. No track filtering —
   * that will be added later.
   */
  listAllTeams: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }) => {
      // Existence check only; throws NOT_FOUND for an unregistered UUID.
      await resolveSponsorName(input.sponsor);

      const allTeams = await db
        .select({
          id: teams.id,
          name: teams.name,
          memberCount: count(users.id),
        })
        .from(teams)
        .leftJoin(users, eq(users.teamId, teams.id))
        .groupBy(teams.id, teams.name)
        .orderBy(teams.name);

      return allTeams.map((team) => ({
        id: team.id,
        name: team.name,
        members:
          team.memberCount === 1 ? "1 member" : `${team.memberCount} members`,
      }));
    }),
});
