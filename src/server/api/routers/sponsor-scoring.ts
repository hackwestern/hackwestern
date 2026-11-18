import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
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
  listEligibleTeams,
  writeChosenTeams,
} from "~/server/api/utils/sponsor-judging-teams";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorTeamReviews,
  teams,
} from "~/server/db/schema";

const errors = sponsorJudgingCopy.errors;
const sponsorInput = z.string().uuid();
const teamIdInput = z.string().trim().min(1).max(12);

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
 * Sponsor judging on /sponsors/[uuid]/picks: score submitted teams 1-10,
 * save some to a shortlist, then submit a ranked top SPONSOR_FINAL_TOP.
 * The sponsor's private UUID is the credential, as on their other portal
 * pages; every read and write is scoped to that sponsor, and only teams
 * they can see (submitted, in their track; same rule as Lucas's
 * listAllTeams) can be reviewed or submitted. Organizers read everything
 * through `overview`.
 */
export const sponsorScoringRouter = createTRPCRouter({
  /** Eligible teams, this sponsor's reviews, and their last submission. */
  get: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [eligible, reviews, final] = await Promise.all([
        listEligibleTeams(track),
        reviewsFor(sponsor.id),
        db.query.sponsorFinalPicks.findFirst({
          where: eq(sponsorFinalPicks.sponsorId, sponsor.id),
        }),
      ]);
      // Reviews of teams that have since left the sponsor's list (track
      // changed, submission withdrawn) stay stored but aren't shown.
      const visible = new Set(eligible.map((t) => t.id));
      return {
        sponsorName: sponsor.name,
        sponsorTrack: track,
        finalTop: SPONSOR_FINAL_TOP,
        open: judgingOpen(new Date()),
        teams: eligible,
        reviews: reviews.filter((r) => visible.has(r.teamId)),
        final: final
          ? {
              teamIds: final.teamIds,
              submittedAt: final.submittedAt,
              sheetSynced: final.sheetSyncedAt !== null,
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
   * Submit the ranked top SPONSOR_FINAL_TOP: exactly that many, no repeats,
   * all on this sponsor's shortlist and still eligible. Resubmitting
   * replaces the last one while judging is open. Saved here first, then
   * written to Lucas's judging sheet; if the sheet write fails the
   * submission still counts and `sheetSynced` is false (submit again to
   * retry).
   */
  submit: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        teamIds: z.array(teamIdInput).max(20),
      }),
    )
    .mutation(async ({ input }) => {
      if (!judgingOpen(new Date())) {
        throw new TRPCError({ code: "FORBIDDEN", message: errors.closed });
      }
      const sponsor = await findSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [shortlistRows, eligible] = await Promise.all([
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
      ]);
      const shortlisted = new Set(
        shortlistRows.map((r) => r.teamId).filter((id) => eligible.has(id)),
      );
      const problem = rankingError(input.teamIds, shortlisted);
      if (problem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.ranking[problem](SPONSOR_FINAL_TOP),
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

      let sheetSynced = false;
      try {
        await writeChosenTeams(sponsor.name, input.teamIds);
        sheetSynced = true;
        await db
          .update(sponsorFinalPicks)
          .set({ sheetSyncedAt: new Date() })
          .where(
            and(
              eq(sponsorFinalPicks.sponsorId, sponsor.id),
              eq(sponsorFinalPicks.submittedAt, submittedAt),
            ),
          );
      } catch (error) {
        console.error("Sponsor final picks: sheet write failed", error);
      }
      return { teamIds: input.teamIds, submittedAt, sheetSynced };
    }),

  /**
   * Organizers: every sponsor's progress and submitted ranking, plus all
   * teams ranked by how many sponsors put them in a top list and their
   * average score.
   */
  overview: protectedOrganizerProcedure.query(async () => {
    const [sponsors, reviews, finals] = await Promise.all([
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
    ]);

    const reviewsBySponsor = new Map<string, TeamReview[]>();
    for (const { sponsorId, ...r } of reviews) {
      const list = reviewsBySponsor.get(sponsorId) ?? [];
      list.push(r);
      reviewsBySponsor.set(sponsorId, list);
    }
    const finalBySponsor = new Map(finals.map((f) => [f.sponsorId, f]));

    const inputs = sponsors.map((s) => {
      const f = finalBySponsor.get(s.id);
      return {
        sponsorId: s.id,
        name: s.name,
        reviews: reviewsBySponsor.get(s.id) ?? [],
        final: f ? { teamIds: f.teamIds, submittedAt: f.submittedAt } : null,
      };
    });
    const tallies = tallyTeams(inputs);

    const teamIds = [
      ...new Set([
        ...tallies.map((t) => t.teamId),
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
            })
            .from(teams)
            .where(inArray(teams.id, teamIds))
        : [];
    const teamById = new Map(
      teamRows.map((t) => [
        t.id,
        { name: t.name, devpostUrl: blankToNull(t.devpostUrl) },
      ]),
    );

    return {
      finalTop: SPONSOR_FINAL_TOP,
      sponsors: inputs.map((s) => {
        const scoreOf = new Map(s.reviews.map((r) => [r.teamId, r.score]));
        const f = finalBySponsor.get(s.sponsorId);
        return {
          sponsorId: s.sponsorId,
          name: s.name,
          ...sponsorProgress(s.reviews),
          final: f
            ? {
                submittedAt: f.submittedAt,
                sheetSynced: f.sheetSyncedAt !== null,
                teams: f.teamIds.map((teamId) => ({
                  teamId,
                  name: teamById.get(teamId)?.name ?? teamId,
                  devpostUrl: teamById.get(teamId)?.devpostUrl ?? null,
                  score: scoreOf.get(teamId) ?? null,
                })),
              }
            : null,
        };
      }),
      teams: tallies.map((t) => ({
        ...t,
        name: teamById.get(t.teamId)?.name ?? t.teamId,
        devpostUrl: teamById.get(t.teamId)?.devpostUrl ?? null,
      })),
    };
  }),
});
