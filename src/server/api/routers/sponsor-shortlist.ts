import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { sponsorHackersCopy } from "~/content/sponsor-hackers";
import { isAdmittedStatus } from "~/lib/admission";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { loadSponsorSetup } from "~/server/api/utils/coffee-chat-setup";
import {
  NO_STUDY,
  safeProfileUrl,
  sponsorCandidates,
  studyFields,
  type CandidateSource,
  type SponsorCandidate,
} from "~/server/api/utils/sponsor-shortlist";
import { mirrorCoffeeChatSetupLater } from "~/server/api/utils/coffee-chat-setup-sheet-mirror";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPrefs,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorScans,
  sponsorShortlists,
  teams,
  users,
} from "~/server/db/schema";

/** A hacker on the sponsor's candidate list, with their shortlist state. */
export type InterestedHacker = SponsorCandidate & { shortlisted: boolean };

/**
 * A hacker the sponsor scanned at their booth ("Met at Hacker Fair"). Same
 * privacy as candidates: full name, team and links only when the hacker
 * agreed to share with sponsors; otherwise the first name alone.
 */
export type ScannedHacker = {
  userId: string;
  name: string;
  shared: boolean;
  team: string | null;
  repName: string | null;
  school: string | null;
  program: string | null;
  year: string | null;
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
};

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

const errors = sponsorHackersCopy.errors;
const setupErrors = sponsorSetupCopy.errors;
const sponsorInput = z.string().uuid();
const userIdInput = z.string().trim().min(1).max(255);

async function findSponsor(id: string) {
  const sponsor = await db.query.sponsorJudgingSponsors.findFirst({
    where: eq(sponsorJudgingSponsors.id, id.toLowerCase()),
    columns: { id: true, name: true },
  });
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownSponsor });
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

/** Scanned hackers, first scan first. Anyone no longer admitted drops off. */
async function scannedHackers(
  sponsorId: string,
  conn: Pick<typeof db, "select"> = db,
): Promise<ScannedHacker[]> {
  const rows = await conn
    .select({
      userId: sponsorScans.userId,
      repName: sponsorScans.repName,
      status: applications.status,
      firstName: applications.firstName,
      lastName: applications.lastName,
      accountName: users.name,
      share: applications.agreeShareWithSponsors,
      team: teams.name,
      resume: applications.resumeLink,
      github: applications.githubLink,
      linkedIn: applications.linkedInLink,
      devpost: applications.devpostLink,
      school: applications.school,
      schoolOther: applications.schoolOther,
      major: applications.major,
      yearOfStudy: applications.yearOfStudy,
    })
    .from(sponsorScans)
    .innerJoin(users, eq(users.id, sponsorScans.userId))
    .leftJoin(applications, eq(applications.userId, sponsorScans.userId))
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(eq(sponsorScans.sponsorId, sponsorId))
    .orderBy(asc(sponsorScans.scannedAt), asc(sponsorScans.userId));
  return rows
    .filter((r) => isAdmittedStatus(r.status))
    .map((r) => {
      const first =
        [r.firstName, r.accountName?.trim().split(/\s+/)[0]]
          .map((n) => n?.trim() ?? "")
          .find((n) => n.length > 0) ?? "";
      const shared = r.share === true;
      const full = [r.firstName, r.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");
      return {
        userId: r.userId,
        name: shared ? full || first : first,
        shared,
        team: shared ? r.team : null,
        repName: r.repName,
        resume: shared ? safeProfileUrl(r.resume) : null,
        github: shared ? safeProfileUrl(r.github) : null,
        linkedIn: shared ? safeProfileUrl(r.linkedIn) : null,
        devpost: shared ? safeProfileUrl(r.devpost) : null,
        ...(shared ? studyFields(r) : NO_STUDY),
      };
    });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Throws unless the shortlist can change: chatting preferences submitted
 * (the seats come from them) and the shortlist not submitted.
 */
async function assertShortlistOpen(
  tx: Tx,
  sponsorId: string,
  { needPrefs = true, allowSubmitted = false } = {},
) {
  const [pref] = await tx
    .select({
      submittedAt: coffeeChatPrefs.submittedAt,
      shortlistSubmittedAt: coffeeChatPrefs.shortlistSubmittedAt,
    })
    .from(coffeeChatPrefs)
    .where(eq(coffeeChatPrefs.sponsorId, sponsorId));
  if (needPrefs && !pref?.submittedAt) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: setupErrors.prefsFirst });
  }
  if (!allowSubmitted && pref?.shortlistSubmittedAt) {
    throw new TRPCError({ code: "CONFLICT", message: setupErrors.shortlistSubmitted });
  }
}

/** Lock the sponsor row: every shortlist write and preference save takes it. */
async function lockSponsor(tx: Tx, sponsorId: string) {
  await tx
    .select({ id: sponsorJudgingSponsors.id })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, sponsorId))
    .for("update");
}

/** Shortlist cap: hacker seats minus people they scanned (decisions 2026-11-19). */
const capOf = (seats: number, scanned: number) => Math.max(0, seats - scanned);

/**
 * The cap and how many picks count against it, read inside the locked
 * transaction. Picks count only while still on the candidate list and not
 * scanned (scanned hackers already take a seat).
 */
async function capState(
  tx: Tx,
  sponsor: { id: string; name: string },
  candidates: readonly { userId: string }[],
) {
  const [setup, scanned] = await Promise.all([
    loadSponsorSetup(sponsor, tx),
    scannedHackers(sponsor.id, tx),
  ]);
  const scannedIds = new Set(scanned.map((h) => h.userId));
  const countable = candidates.map((h) => h.userId).filter((id) => !scannedIds.has(id));
  const [total] = countable.length
    ? await tx
        .select({ n: count() })
        .from(sponsorShortlists)
        .where(
          and(
            eq(sponsorShortlists.sponsorId, sponsor.id),
            inArray(sponsorShortlists.userId, countable),
          ),
        )
    : [{ n: 0 }];
  return { cap: capOf(setup.totals.hackers, scanned.length), picked: total?.n ?? 0 };
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
      /** Hackers they scanned at their booth, first scan first. */
      scanned: ScannedHacker[];
      /** Hacker seats from chatting preferences. */
      seats: number;
      /** The shortlist cap: seats minus people they scanned (never < 0). */
      maxShortlist: number;
      /** Shortlisted hackers counted against the cap. */
      picked: number;
      prefsSubmitted: boolean;
      submittedAt: Date | null;
      /** Organizers sent this sponsor's schedule. */
      sent: boolean;
      source: CandidateSource;
      showSource: boolean;
    }> => {
      const sponsor = await findSponsor(input.sponsor);
      const [candidates, ids, showSource, setup, scanned] = await Promise.all([
        sponsorCandidates(sponsor),
        shortlistedIds(sponsor.id),
        isOrganizer(ctx.session?.user.id),
        loadSponsorSetup(sponsor),
        scannedHackers(sponsor.id),
      ]);
      const picked = new Set(ids);
      const scannedIds = new Set(scanned.map((h) => h.userId));
      // Scanned hackers are listed on their own, first; not twice.
      const hackers = candidates.hackers
        .filter((h) => !scannedIds.has(h.userId))
        .map((h) => ({ ...h, shortlisted: picked.has(h.userId) }));
      return {
        sponsorName: sponsor.name,
        hackers,
        scanned,
        seats: setup.totals.hackers,
        maxShortlist: capOf(setup.totals.hackers, scanned.length),
        picked: hackers.filter((h) => h.shortlisted).length,
        prefsSubmitted: !!setup.submittedAt,
        submittedAt: setup.shortlistSubmittedAt,
        sent: setup.confirmed,
        source: candidates.source,
        showSource,
      };
    },
  ),

  /**
   * Add a candidate to the shortlist. Anyone not on the sponsor's current
   * candidate list is a 404. Adding twice is a no-op. Opens once chatting
   * preferences are submitted; closed while the shortlist is submitted.
   * Capped at the sponsor's hacker seats minus people they scanned, read
   * under the sponsor-row lock (so a preference save can't race it).
   * Allowed after Send with no confirm: it only changes who's offered
   * seats in later rounds.
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
          message: errors.notCandidate,
        });
      }
      await db.transaction(async (tx) => {
        await lockSponsor(tx, sponsor.id);
        await assertShortlistOpen(tx, sponsor.id);
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
        const { cap, picked } = await capState(tx, sponsor, hackers);
        if (picked >= cap) {
          throw new TRPCError({
            code: "CONFLICT",
            message: setupErrors.shortlistFull,
          });
        }
        await tx
          .insert(sponsorShortlists)
          .values({ sponsorId: sponsor.id, userId: eligible.userId })
          .onConflictDoNothing();
      });
      mirrorCoffeeChatSetupLater();
      return { userId: eligible.userId, shortlisted: true };
    }),

  /**
   * Take a hacker off the shortlist. Removing someone not on it is a no-op.
   * Closed while the shortlist is submitted.
   */
  remove: publicProcedure
    .input(z.object({ sponsor: sponsorInput, userId: userIdInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      await db.transaction(async (tx) => {
        await lockSponsor(tx, sponsor.id);
        await assertShortlistOpen(tx, sponsor.id, { needPrefs: false });
        await tx
          .delete(sponsorShortlists)
          .where(
            and(
              eq(sponsorShortlists.sponsorId, sponsor.id),
              eq(sponsorShortlists.userId, input.userId),
            ),
          );
      });
      mirrorCoffeeChatSetupLater();
      return { userId: input.userId, shortlisted: false };
    }),

  /**
   * Review & submit the shortlist: sets coffee_chat_pref.shortlist_
   * submitted_at. Needs submitted chatting preferences, and no more picks
   * than the cap (preferences may have lowered it since). An empty
   * shortlist may be submitted (seats then go to scanned and interested
   * hackers).
   */
  submit: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const { hackers } = await sponsorCandidates(sponsor);
      const now = new Date();
      await db.transaction(async (tx) => {
        await lockSponsor(tx, sponsor.id);
        await assertShortlistOpen(tx, sponsor.id, { allowSubmitted: true });
        const { cap, picked } = await capState(tx, sponsor, hackers);
        if (picked > cap) {
          throw new TRPCError({
            code: "CONFLICT",
            message: setupErrors.overCap(picked, cap),
          });
        }
        await tx
          .update(coffeeChatPrefs)
          // Not updated_at: that marks preference/rep edits only.
          .set({ shortlistSubmittedAt: now })
          .where(eq(coffeeChatPrefs.sponsorId, sponsor.id));
      });
      mirrorCoffeeChatSetupLater();
      return { submittedAt: now };
    }),

  /** Edit shortlist: back to not submitted until they submit again. */
  reopen: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      await db.transaction(async (tx) => {
        await lockSponsor(tx, sponsor.id);
        await tx
          .update(coffeeChatPrefs)
          .set({ shortlistSubmittedAt: null })
          .where(eq(coffeeChatPrefs.sponsorId, sponsor.id));
      });
      mirrorCoffeeChatSetupLater();
      return { ok: true };
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
