import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { env } from "~/env";
import { judgingRound } from "~/lib/sponsor-presentations";
import {
  NOTE_MAX,
  SCORE_MAX,
  SCORE_MIN,
  SPONSOR_FINAL_TOP,
  judgingOpen,
  rankingError,
  sponsorProgress,
  tallyTeams,
  type TeamReview,
} from "~/lib/sponsor-scoring";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  eligibleTeamIds,
  fetchSponsorTrack,
  fetchSponsorTracks,
  isEligibleTeam,
  listEligibleTeams,
  writeChosenTeams,
} from "~/server/api/utils/sponsor-judging-teams";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorShortlistSends,
  sponsorTeamReviews,
  teams,
} from "~/server/db/schema";

const errors = sponsorJudgingCopy.errors;
const sponsorInput = z.string().uuid();
const teamIdInput = z.string().trim().min(1).max(12);

/** Whether judging is open now (SPONSOR_JUDGING_CLOSES_AT unset = always). */
function isOpen() {
  const closesAt = env.SPONSOR_JUDGING_CLOSES_AT
    ? new Date(env.SPONSOR_JUDGING_CLOSES_AT)
    : null;
  return judgingOpen(new Date(), closesAt);
}

function assertOpen() {
  if (!isOpen()) {
    throw new TRPCError({ code: "FORBIDDEN", message: errors.closed });
  }
}

/** Trimmed text, or null when empty. */
function blankToNull(text: string | null) {
  const trimmed = text?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

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

async function reviewsFor(sponsorId: string): Promise<TeamReview[]> {
  return db
    .select({
      teamId: sponsorTeamReviews.teamId,
      score: sponsorTeamReviews.score,
      shortlisted: sponsorTeamReviews.shortlisted,
      note: sponsorTeamReviews.note,
    })
    .from(sponsorTeamReviews)
    .where(eq(sponsorTeamReviews.sponsorId, sponsorId));
}

/**
 * Round state for one sponsor: their sent shortlist, whether any schedule
 * exists, and their presentation slots (placed only). Once a schedule
 * exists AND this sponsor has a placed slot, round 2 ranks only those
 * teams (judgingRound). A sponsor with no slot is never locked out: they
 * keep ranking their shortlist.
 */
async function roundFor(sponsorId: string) {
  const [sent, anySlot, slots] = await Promise.all([
    db.query.sponsorShortlistSends.findFirst({
      where: eq(sponsorShortlistSends.sponsorId, sponsorId),
    }),
    db.query.sponsorPresentations.findFirst({
      columns: { scheduledAt: true },
    }),
    db
      .select({
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        start: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .where(
        and(
          eq(sponsorPresentations.sponsorId, sponsorId),
          isNotNull(sponsorPresentations.startMinute),
        ),
      ),
  ]);
  return {
    shortlistSent: sent ? { sentAt: sent.sentAt, teamIds: sent.teamIds } : null,
    /** When the current schedule was made; null = not scheduled yet. */
    scheduledAt: anySlot?.scheduledAt ?? null,
    slots: slots
      .map((r) => ({ teamId: r.teamId, room: r.room ?? "", start: r.start! }))
      .sort((a, b) => a.start - b.start),
  };
}

/**
 * Write a saved submission to Lucas's judging sheet and mark it synced.
 * The mark only lands if `submittedAt` is still the sponsor's latest
 * submission, so a slow write for an older ranking never marks a newer one
 * as synced. Best effort: logs and returns false on failure, never throws.
 */
async function syncFinalToSheet(
  sponsor: { id: string; name: string },
  teamIds: readonly string[],
  submittedAt: Date,
) {
  try {
    await writeChosenTeams(sponsor.name, teamIds);
    const marked = await db
      .update(sponsorFinalPicks)
      .set({ sheetSyncedAt: new Date() })
      .where(
        and(
          eq(sponsorFinalPicks.sponsorId, sponsor.id),
          eq(sponsorFinalPicks.submittedAt, submittedAt),
        ),
      )
      .returning({ sponsorId: sponsorFinalPicks.sponsorId });
    return marked.length > 0;
  } catch (error) {
    console.error("Sponsor final picks: sheet write failed", error);
    return false;
  }
}

/**
 * Sponsor judging on /sponsors/[uuid]/picks: score submitted teams 1-10,
 * save some to a shortlist, then submit a ranked top SPONSOR_FINAL_TOP.
 * The sponsor's private UUID is the credential, as on their other portal
 * pages; every read and write is scoped to that sponsor, and only teams
 * they can see (submitted, in their track; same rule as Lucas's
 * listAllTeams) can be reviewed or submitted. Organizers read everything
 * through `overview`.
 */
export const sponsorScoringRouter = createTRPCRouter({
  /**
   * Eligible teams, this sponsor's reviews, and their last submission. A
   * submission the sheet never got (the write failed after it was saved)
   * is retried here, best effort.
   */
  get: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [eligible, reviews, final, round] = await Promise.all([
        listEligibleTeams(track),
        reviewsFor(sponsor.id),
        db.query.sponsorFinalPicks.findFirst({
          where: eq(sponsorFinalPicks.sponsorId, sponsor.id),
        }),
        roundFor(sponsor.id),
      ]);
      // Reviews of teams that have since left the sponsor's list (track
      // changed, submission withdrawn) stay stored but aren't shown, and
      // drop out of the submitted ranking too.
      const visible = new Set(eligible.map((t) => t.id));
      const sheetSynced = final
        ? final.sheetSyncedAt !== null ||
          (await syncFinalToSheet(sponsor, final.teamIds, final.submittedAt))
        : false;
      const finalIds = final?.teamIds.filter((id) => visible.has(id)) ?? [];
      return {
        sponsorName: sponsor.name,
        sponsorTrack: track,
        finalTop: SPONSOR_FINAL_TOP,
        open: isOpen(),
        teams: eligible,
        reviews: reviews.filter((r) => visible.has(r.teamId)),
        round: {
          ...round,
          slots: round.slots.filter((s) => visible.has(s.teamId)),
        },
        final: final
          ? {
              teamIds: finalIds,
              /** Submitted teams that can no longer be judged. */
              ineligibleCount: final.teamIds.length - finalIds.length,
              submittedAt: final.submittedAt,
              sheetSynced,
            }
          : null,
      };
    }),

  /**
   * Autosave part of a review: a score (null clears it), the shortlist
   * flag, or the note. Fields left out keep their value.
   */
  review: publicProcedure
    .input(
      z
        .object({
          sponsor: sponsorInput,
          teamId: teamIdInput,
          score: z.number().int().min(SCORE_MIN).max(SCORE_MAX).nullable(),
          shortlisted: z.boolean(),
          note: z.string().max(NOTE_MAX).nullable(),
        })
        .partial({ score: true, shortlisted: true, note: true }),
    )
    .mutation(async ({ input }) => {
      assertOpen();
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const ok = await eligibleTeamIds(track, [input.teamId]);
      if (!ok.has(input.teamId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: errors.notEligible });
      }
      const note =
        input.note === undefined ? undefined : blankToNull(input.note);
      const set = {
        ...(input.score !== undefined && { score: input.score }),
        ...(input.shortlisted !== undefined && {
          shortlisted: input.shortlisted,
        }),
        ...(note !== undefined && { note }),
        updatedAt: new Date(),
      };
      const [row] = await db
        .insert(sponsorTeamReviews)
        .values({ sponsorId: sponsor.id, teamId: input.teamId, ...set })
        .onConflictDoUpdate({
          target: [sponsorTeamReviews.sponsorId, sponsorTeamReviews.teamId],
          set,
        })
        .returning({
          teamId: sponsorTeamReviews.teamId,
          score: sponsorTeamReviews.score,
          shortlisted: sponsorTeamReviews.shortlisted,
          note: sponsorTeamReviews.note,
        });
      return row!;
    }),

  /**
   * End round 1: snapshot the sponsor's current shortlist (eligible teams
   * only) as the one organizers schedule from. Sending again replaces it;
   * the schedule only changes when organizers schedule again.
   */
  sendShortlist: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .mutation(async ({ input }) => {
      assertOpen();
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const rows = await db
        .select({ teamId: sponsorTeamReviews.teamId })
        .from(sponsorTeamReviews)
        .where(
          and(
            eq(sponsorTeamReviews.sponsorId, sponsor.id),
            eq(sponsorTeamReviews.shortlisted, true),
          ),
        );
      const eligible = await eligibleTeamIds(
        track,
        rows.map((r) => r.teamId),
      );
      const teamIds = rows
        .map((r) => r.teamId)
        .filter((id) => eligible.has(id))
        .sort();
      if (teamIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.emptyShortlist,
        });
      }
      const sentAt = new Date();
      await db
        .insert(sponsorShortlistSends)
        .values({ sponsorId: sponsor.id, teamIds, sentAt })
        .onConflictDoUpdate({
          target: sponsorShortlistSends.sponsorId,
          set: { teamIds, sentAt },
        });
      return { sentAt, teamIds };
    }),

  /**
   * Submit the ranked top SPONSOR_FINAL_TOP: exactly that many, no repeats,
   * all on this sponsor's shortlist and still eligible. Resubmitting
   * replaces the last one while judging is open. Saved here first, then
   * written to Lucas's judging sheet; if the sheet write fails the
   * submission still counts and `sheetSynced` is false (the next `get`
   * retries it, or the sponsor can submit again).
   */
  submit: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        teamIds: z.array(teamIdInput).length(SPONSOR_FINAL_TOP, {
          message: errors.ranking.wrongCount(SPONSOR_FINAL_TOP),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      assertOpen();
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [shortlistRows, eligible, round] = await Promise.all([
        db
          .select({ teamId: sponsorTeamReviews.teamId })
          .from(sponsorTeamReviews)
          .where(
            and(
              eq(sponsorTeamReviews.sponsorId, sponsor.id),
              eq(sponsorTeamReviews.shortlisted, true),
            ),
          ),
        eligibleTeamIds(track, input.teamIds),
        roundFor(sponsor.id),
      ]);
      // Round 2 (this sponsor has a placed slot): only teams that presented
      // to them. Otherwise, including a schedule with no slot for them
      // (sent late, no room, none fit), their shortlist.
      const scheduled = judgingRound(round) === "rank";
      const pool = scheduled
        ? round.slots.map((s) => s.teamId)
        : shortlistRows.map((r) => r.teamId);
      const allowed = new Set(pool.filter((id) => eligible.has(id)));
      const problem = rankingError(input.teamIds, allowed);
      if (problem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            problem === "notShortlisted" && scheduled
              ? errors.ranking.notPresented()
              : errors.ranking[problem](SPONSOR_FINAL_TOP),
        });
      }

      const submittedAt = new Date();
      await db
        .insert(sponsorFinalPicks)
        .values({
          sponsorId: sponsor.id,
          teamIds: input.teamIds,
          submittedAt,
          sheetSyncedAt: null,
        })
        .onConflictDoUpdate({
          target: sponsorFinalPicks.sponsorId,
          set: { teamIds: input.teamIds, submittedAt, sheetSyncedAt: null },
        });

      const sheetSynced = await syncFinalToSheet(
        sponsor,
        input.teamIds,
        submittedAt,
      );
      return {
        teamIds: input.teamIds,
        ineligibleCount: 0,
        submittedAt,
        sheetSynced,
      };
    }),

  /**
   * Organizers: every sponsor's progress and submitted ranking, plus all
   * teams ranked by how many sponsors put them in a top list and their
   * average score. Only teams a sponsor can still judge (submitted, in
   * their track) count toward progress and tallies; a withdrawn team stays
   * in that sponsor's submitted list, flagged `eligible: false`.
   */
  overview: protectedOrganizerProcedure.query(async () => {
    const [sponsors, reviews, finals, tracks] = await Promise.all([
      db
        .select({
          id: sponsorJudgingSponsors.id,
          name: sponsorJudgingSponsors.name,
        })
        .from(sponsorJudgingSponsors)
        .orderBy(sponsorJudgingSponsors.name),
      db
        .select({
          sponsorId: sponsorTeamReviews.sponsorId,
          teamId: sponsorTeamReviews.teamId,
          score: sponsorTeamReviews.score,
          shortlisted: sponsorTeamReviews.shortlisted,
          note: sponsorTeamReviews.note,
        })
        .from(sponsorTeamReviews),
      db.select().from(sponsorFinalPicks),
      fetchSponsorTracks(),
    ]);

    const teamIds = [
      ...new Set([
        ...reviews.map((r) => r.teamId),
        ...finals.flatMap((f) => f.teamIds),
      ]),
    ];
    const teamRows =
      teamIds.length > 0
        ? await db
            .select({
              id: teams.id,
              name: teams.name,
              devpostUrl: teams.devpostUrl,
              submissionStatus: teams.submissionStatus,
              tracks: teams.tracks,
            })
            .from(teams)
            .where(inArray(teams.id, teamIds))
        : [];
    const teamById = new Map(
      teamRows.map((t) => [
        t.id,
        { ...t, devpostUrl: blankToNull(t.devpostUrl) },
      ]),
    );

    const reviewsBySponsor = new Map<string, TeamReview[]>();
    for (const { sponsorId, ...r } of reviews) {
      const list = reviewsBySponsor.get(sponsorId) ?? [];
      list.push(r);
      reviewsBySponsor.set(sponsorId, list);
    }
    const finalBySponsor = new Map(finals.map((f) => [f.sponsorId, f]));

    const perSponsor = sponsors.map((s) => {
      const track = tracks.get(s.name.toLowerCase()) ?? null;
      const canJudge = (teamId: string) => {
        const t = teamById.get(teamId);
        return t !== undefined && isEligibleTeam(t, track);
      };
      const all = reviewsBySponsor.get(s.id) ?? [];
      const f = finalBySponsor.get(s.id) ?? null;
      return {
        sponsorId: s.id,
        name: s.name,
        reviews: all.filter((r) => canJudge(r.teamId)),
        final: f
          ? { teamIds: f.teamIds.filter(canJudge), submittedAt: f.submittedAt }
          : null,
        scoreOf: new Map(all.map((r) => [r.teamId, r.score])),
        canJudge,
        stored: f,
      };
    });
    const tallies = tallyTeams(perSponsor);

    return {
      finalTop: SPONSOR_FINAL_TOP,
      /** Sponsors whose saved submission hasn't reached the sheet yet. */
      unsyncedCount: finals.filter((f) => f.sheetSyncedAt === null).length,
      sponsors: perSponsor.map((s) => ({
        sponsorId: s.sponsorId,
        name: s.name,
        ...sponsorProgress(s.reviews),
        final: s.stored
          ? {
              submittedAt: s.stored.submittedAt,
              sheetSynced: s.stored.sheetSyncedAt !== null,
              teams: s.stored.teamIds.map((teamId) => ({
                teamId,
                name: teamById.get(teamId)?.name ?? teamId,
                devpostUrl: teamById.get(teamId)?.devpostUrl ?? null,
                score: s.scoreOf.get(teamId) ?? null,
                eligible: s.canJudge(teamId),
              })),
            }
          : null,
      })),
      teams: tallies.map((t) => ({
        ...t,
        name: teamById.get(t.teamId)?.name ?? t.teamId,
        devpostUrl: teamById.get(t.teamId)?.devpostUrl ?? null,
      })),
    };
  }),
});
