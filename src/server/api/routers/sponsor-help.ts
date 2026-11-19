import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  fetchHwContactPhones,
  lookupHwContactPhones,
} from "~/server/api/utils/sponsor-hw-contacts";
import {
  dueHelpReping,
  EMERGENCY_CONTACT_NAME,
  helpLocationNoteSchema,
  helpPhoneSchema,
  helpRepNameSchema,
  isHelpVisibleToSponsor,
  normalizeHelpNote,
  SPONSOR_HELP_NOTE_MAX,
  SPONSOR_HELP_REASONS,
  type SponsorHelpReason,
  TRACKED_HELP_ENABLED,
} from "~/lib/sponsor-help";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import {
  markSponsorHelpMessage,
  postSponsorHelpRequest,
  repingSponsorHelp,
  type SponsorHelpDetails,
  type SponsorHelpOutcome,
} from "~/server/slack/sponsor-help";

type HelpRow = typeof sponsorHelpRequests.$inferSelect;

const LIVE = ["open", "claimed"] as const;

/** What the sponsor's page sees. No Slack ids. */
export type SponsorHelpView = {
  id: string;
  reason: SponsorHelpReason;
  note: string | null;
  /** Who pinged, so the card can say "Pinged as <rep>". */
  repName: string | null;
  status: HelpRow["status"];
  claimedByName: string | null;
  createdAt: Date;
  claimedAt: Date | null;
  resolvedAt: Date | null;
};

function toView(row: HelpRow): SponsorHelpView {
  return {
    id: row.id,
    reason: row.reason as SponsorHelpReason,
    note: row.note,
    repName: row.repName,
    status: row.status,
    claimedByName: row.claimedByName,
    createdAt: row.createdAt,
    claimedAt: row.claimedAt,
    resolvedAt: row.resolvedAt,
  };
}

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

/**
 * The sponsor's booth from the sponsor info sheet, for the Slack post. Best
 * effort: null when the sheet isn't set up, has "TBD", or can't be read.
 */
async function boothLocation(sponsorName: string): Promise<string | null> {
  try {
    const sheets = await getSheetsClient();
    const info = await fetchAllSponsorInfo(sheets, getSpreadsheetId());
    const booth = info.get(sponsorName.toLowerCase())?.boothLocation?.trim();
    return booth && booth !== "TBD" ? booth : null;
  } catch {
    return null;
  }
}

function details(row: HelpRow, sponsorName: string): SponsorHelpDetails {
  return {
    sponsorName,
    reason: row.reason as SponsorHelpReason,
    note: row.note,
    location: row.location,
    repName: row.repName,
    phone: row.phone,
    locationNote: row.locationNote,
  };
}

function slackRef(row: HelpRow) {
  return row.slackChannel && row.slackTs
    ? { channel: row.slackChannel, ts: row.slackTs }
    : null;
}

/**
 * Send the due re-ping, if any. The UPDATE only succeeds for the poll that
 * moves ping_count from n to n+1, so concurrent polls send it once.
 */
async function sendDueReping(row: HelpRow, sponsorName: string, now: Date) {
  if (!TRACKED_HELP_ENABLED) return;
  const ref = slackRef(row);
  const step = dueHelpReping(row, now);
  if (!ref || !step) return;
  const [won] = await db
    .update(sponsorHelpRequests)
    .set({ pingCount: step })
    .where(
      and(
        eq(sponsorHelpRequests.id, row.id),
        eq(sponsorHelpRequests.status, "open"),
        eq(sponsorHelpRequests.pingCount, row.pingCount),
      ),
    )
    .returning({ id: sponsorHelpRequests.id });
  if (!won) return;
  if (await repingSponsorHelp(ref, step, details(row, sponsorName))) return;
  // Slack failed: give the step back so the next poll retries it.
  await db
    .update(sponsorHelpRequests)
    .set({ pingCount: row.pingCount })
    .where(
      and(
        eq(sponsorHelpRequests.id, row.id),
        eq(sponsorHelpRequests.pingCount, step),
      ),
    );
}

/** Close a live request (sponsor cancel or organizer resolve). */
async function closeRequest(
  where: ReturnType<typeof and>,
  status: "resolved" | "cancelled",
): Promise<HelpRow | null> {
  const [row] = await db
    .update(sponsorHelpRequests)
    .set({ status, resolvedAt: new Date() })
    .where(and(where, inArray(sponsorHelpRequests.status, [...LIVE])))
    .returning();
  return row ?? null;
}

async function markInSlack(
  row: HelpRow,
  sponsorName: string,
  outcome: SponsorHelpOutcome,
) {
  if (!TRACKED_HELP_ENABLED) return;
  const ref = slackRef(row);
  if (ref)
    await markSponsorHelpMessage(ref, details(row, sponsorName), outcome);
}

function isUniqueViolation(error: unknown): boolean {
  let e: unknown = error;
  for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

const sponsorInput = z.object({ sponsor: z.string().uuid() });

export const sponsorHelpRouter = createTRPCRouter({
  /**
   * The portal Help's emergency contact (decisions 2026-11-19, Q1–Q11):
   * Noah's name and his phone from HW Contacts, read at runtime so no
   * number is in the repo. The sponsor's own HW lead comes from
   * getSponsorPortalInfo. Public, but only for a real sponsor link.
   */
  contacts: publicProcedure.input(sponsorInput).query(async ({ input }) => {
    await findSponsor(input.sponsor);
    const phones = await fetchHwContactPhones();
    const [phone] = lookupHwContactPhones(EMERGENCY_CONTACT_NAME, phones);
    return {
      emergency: { name: EMERGENCY_CONTACT_NAME, phone: phone ?? null },
    };
  }),

  /**
   * Ask for help. One live request per sponsor. Public (UUID). Refused while
   * tracked help is off (TRACKED_HELP_ENABLED), before anything is stored or
   * posted to Slack.
   */
  request: publicProcedure
    .input(
      sponsorInput.extend({
        reason: z.enum(SPONSOR_HELP_REASONS),
        note: z.string().max(SPONSOR_HELP_NOTE_MAX).optional(),
        repName: helpRepNameSchema,
        phone: helpPhoneSchema,
        locationNote: helpLocationNoteSchema,
      }),
    )
    .mutation(async ({ input }): Promise<SponsorHelpView> => {
      if (!TRACKED_HELP_ENABLED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: sponsorHelpCopy.trackedOff,
        });
      }
      const sponsor = await findSponsor(input.sponsor);
      const conflict = () =>
        new TRPCError({
          code: "CONFLICT",
          message: "A help request is already open",
        });
      const live = await db.query.sponsorHelpRequests.findFirst({
        where: and(
          eq(sponsorHelpRequests.sponsorId, sponsor.id),
          inArray(sponsorHelpRequests.status, [...LIVE]),
        ),
        columns: { id: true },
      });
      if (live) throw conflict();

      const location = await boothLocation(sponsor.name);
      let row: HelpRow | undefined;
      try {
        [row] = await db
          .insert(sponsorHelpRequests)
          .values({
            sponsorId: sponsor.id,
            reason: input.reason,
            note: normalizeHelpNote(input.note),
            location,
            repName: input.repName,
            phone: input.phone,
            locationNote: normalizeHelpNote(input.locationNote),
          })
          .returning();
      } catch (error) {
        // Two taps at once: the partial unique index lets only one in.
        if (isUniqueViolation(error)) throw conflict();
        throw error;
      }
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const ref = await postSponsorHelpRequest(details(row, sponsor.name));
      if (ref) {
        const [updated] = await db
          .update(sponsorHelpRequests)
          .set({ slackChannel: ref.channel, slackTs: ref.ts })
          .where(eq(sponsorHelpRequests.id, row.id))
          .returning();
        row = updated ?? row;
      }
      return toView(row);
    }),

  /**
   * The sponsor's current request (live, or resolved in the last few
   * minutes), else null. Polled every 15s while live; sends a due re-ping on
   * read, so no cron is needed. Inert (null, no DB read, no re-ping) while
   * tracked help is off.
   */
  status: publicProcedure
    .input(sponsorInput)
    .query(async ({ input }): Promise<SponsorHelpView | null> => {
      if (!TRACKED_HELP_ENABLED) return null;
      const sponsor = await findSponsor(input.sponsor);
      const row = await db.query.sponsorHelpRequests.findFirst({
        where: eq(sponsorHelpRequests.sponsorId, sponsor.id),
        orderBy: [desc(sponsorHelpRequests.createdAt)],
      });
      const now = new Date();
      if (!row || !isHelpVisibleToSponsor(row, now)) return null;
      await sendDueReping(row, sponsor.name, now);
      return toView(row);
    }),

  /** The sponsor no longer needs help. A no-op while tracked help is off. */
  cancel: publicProcedure
    .input(sponsorInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      if (!TRACKED_HELP_ENABLED) return { ok: true as const };
      const sponsor = await findSponsor(input.sponsor);
      const row = await closeRequest(
        and(
          eq(sponsorHelpRequests.id, input.id),
          eq(sponsorHelpRequests.sponsorId, sponsor.id),
        ),
        "cancelled",
      );
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No open request to cancel",
        });
      }
      await markInSlack(row, sponsor.name, { kind: "cancelled" });
      return { ok: true as const };
    }),

  /** Open and claimed requests, oldest first. Organizers only. */
  list: protectedOrganizerProcedure.query(async () => {
    return db
      .select({
        id: sponsorHelpRequests.id,
        sponsorId: sponsorHelpRequests.sponsorId,
        sponsorName: sponsorJudgingSponsors.name,
        reason: sponsorHelpRequests.reason,
        note: sponsorHelpRequests.note,
        location: sponsorHelpRequests.location,
        repName: sponsorHelpRequests.repName,
        phone: sponsorHelpRequests.phone,
        locationNote: sponsorHelpRequests.locationNote,
        status: sponsorHelpRequests.status,
        claimedByName: sponsorHelpRequests.claimedByName,
        postedToSlack: sql<boolean>`${sponsorHelpRequests.slackTs} is not null`,
        createdAt: sponsorHelpRequests.createdAt,
        claimedAt: sponsorHelpRequests.claimedAt,
      })
      .from(sponsorHelpRequests)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorHelpRequests.sponsorId),
      )
      .where(inArray(sponsorHelpRequests.status, [...LIVE]))
      .orderBy(asc(sponsorHelpRequests.createdAt));
  }),

  /** Mark a request done (backup when Slack is down). Organizers only. */
  resolve: protectedOrganizerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const row = await closeRequest(
        and(eq(sponsorHelpRequests.id, input.id)),
        "resolved",
      );
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No open request with that id",
        });
      }
      const sponsor = await db.query.sponsorJudgingSponsors.findFirst({
        where: eq(sponsorJudgingSponsors.id, row.sponsorId),
        columns: { name: true },
      });
      await markInSlack(row, sponsor?.name ?? "", { kind: "resolved" });
      return { ok: true as const };
    }),
});
