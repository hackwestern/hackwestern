import { TRPCError } from "@trpc/server";
import { asc } from "drizzle-orm";
import { z } from "zod";

import {
  ownLocation,
  type CompanyLocations,
  type OrganizerRunOfShow,
  type SponsorSchedule,
} from "~/lib/run-of-show";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import {
  getRunOfShow,
  runOfShowSheetUrl,
} from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";

/** Columns every sponsor sees, whoever they are. */
const ALL_HANDS_COLUMNS = new Set(["big-event", "food"]);

async function registeredSponsors() {
  return db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors)
    .orderBy(asc(sponsorJudgingSponsors.name));
}

function findSponsor(
  sponsors: { id: string; name: string }[],
  id: string,
): { id: string; name: string } {
  const sponsor = sponsors.find((s) => s.id === id.toLowerCase());
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Unknown sponsor id" });
  }
  return sponsor;
}

/**
 * The parsed sheet with sponsor names matched. Coffee chat rooms come from
 * room blocks, not a per-sponsor setting. Fails closed.
 */
async function readSheet(sponsors: { name: string }[]) {
  try {
    const snapshot = await getRunOfShow();
    const sheet = applySponsorNames(
      snapshot,
      sponsors.map((s) => s.name),
    );
    return {
      readAt: snapshot.readAt,
      // Organizer-only: the sponsor `get` below never copies it out.
      availability: snapshot.availability,
      ...sheet,
    };
  } catch (error) {
    console.error("run-of-show sheet read failed", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't read the run-of-show sheet",
    });
  }
}

export const sponsorScheduleRouter = createTRPCRouter({
  /** One sponsor's schedule: all-hands items plus their own. Public (UUID). */
  get: publicProcedure
    .input(z.object({ sponsor: z.string().uuid() }))
    .query(async ({ input }): Promise<SponsorSchedule> => {
      const sponsors = await registeredSponsors();
      const { name } = findSponsor(sponsors, input.sponsor);
      const sheet = await readSheet(sponsors);
      return {
        sponsorName: name,
        readAt: sheet.readAt,
        items: sheet.items
          .filter(
            (item) =>
              ALL_HANDS_COLUMNS.has(item.column) ||
              item.sponsors.includes(name) ||
              // Sponsor Bay hours apply to every sponsor.
              item.column === "spon-booth" ||
              // Events for all sponsors ("Sponsor Judging Workshop", "Sponsor
              // Track Shortlisting"). Other companies' workshops (MLH, QNX) are
              // left out even when that company isn't a registered sponsor.
              (item.column === "sponsor-workshop" &&
                item.sponsors.length === 0 &&
                /^sponsor\b/i.test(item.title)),
          )
          // A shared room ("Scotiabank: Rm 2110, Canada Life: Rm 2230") is
          // trimmed here so a sponsor never receives another sponsor's room
          // (judging rooms too, even when this sponsor isn't in the list).
          .map((item) => ({
            ...item,
            location: item.location
              ? ownLocation(
                  item.location,
                  name,
                  sponsors.map((s) => s.name),
                )
              : null,
            sponsors:
              item.sponsors.length > 1
                ? item.sponsors.filter((n) => n === name)
                : item.sponsors,
          })),
        coffeeChat: sheet.coffeeChats.find((c) => c.sponsor === name) ?? null,
        // Only this sponsor's own speaking slots (for their next-event card);
        // the ceremony running order is organizer-only (Jazz, 2026-11-17).
        ceremonies: sheet.ceremonies
          .filter((segment) => segment.sponsor === name)
          .map((segment) => ({ ...segment, yours: true })),
        // Rooms of other sponsors' workshops are not sent.
        workshops: sheet.workshops.filter((w) => w.sponsor === name),
      };
    }),

  /** Where every company is. Organizers only: sponsors never see this. */
  organizerCompanies: protectedOrganizerProcedure.query(
    async (): Promise<CompanyLocations> => {
      const sponsors = await registeredSponsors();
      const sheet = await readSheet(sponsors);
      return {
        readAt: sheet.readAt,
        sponsorBay: sheet.items.filter((item) => item.column === "spon-booth"),
        companies: sponsors.map(({ name }) => ({
          name,
          items: sheet.items.filter((item) => item.sponsors.includes(name)),
          coffeeChat: sheet.coffeeChats.find((c) => c.sponsor === name) ?? null,
        })),
      };
    },
  ),

  /** Everything, including team tasks and the sheet link. Organizers only. */
  organizer: protectedOrganizerProcedure.query(
    async (): Promise<OrganizerRunOfShow> => {
      const sponsors = await registeredSponsors();
      const sheet = await readSheet(sponsors);
      return {
        readAt: sheet.readAt,
        sheetUrl: runOfShowSheetUrl(),
        items: sheet.items,
        tasks: sheet.tasks,
        coffeeChats: sheet.coffeeChats,
        ceremonies: sheet.ceremonies,
        workshops: sheet.workshops,
        availability: sheet.availability,
      };
    },
  ),
});
