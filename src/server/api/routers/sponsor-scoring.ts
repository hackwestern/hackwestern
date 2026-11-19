import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { env } from "~/env";
import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import {
  hasPrizeTrack,
  isDigitalJudging,
  prizeTrackOf,
} from "~/lib/sponsor-prize-tracks";
import {
  HALVES_MAX,
  HALVES_MIN,
  JUDGE_NAME_MAX,
  NOTE_MAX,
  SPONSOR_FINAL_TOP,
  aggregateScores,
  cleanJudgeName,
  halvesToScore,
  judgeKey,
  judgingOpen,
  matchTeamByLink,
  rankingError,
  sponsorProgress,
  tallyTeams,
  type JudgeScore,
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
  membersByTeam,
} from "~/server/api/utils/sponsor-judging-teams";
import { round2OpenedAt } from "~/server/api/utils/sponsor-judging-settings";
import { mirrorSponsorJudgingSoon } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { db } from "~/server/db";
import {
  coffeeChatReps,
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorShortlistSends,
  sponsorTeamReviews,
  sponsorTeamScores,
  teams,
} from "~/server/db/schema";

const errors = sponsorJudgingCopy.errors;
const sponsorInput = z.string().uuid();
const teamIdInput = z.string().trim().min(1).max(12);
const judgeInput = z.string().trim().min(1).max(JUDGE_NAME_MAX);

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

/**
 * findSponsor for judging: a sponsor without a prize track
 * (src/content/sponsor-prize-tracks.ts) takes no part in judging, so every
 * sponsor judging call refuses them.
 */
async function findTrackSponsor(id: string) {
  const sponsor = await findSponsor(id);
  if (!hasPrizeTrack(sponsor.name)) {
    throw new TRPCError({ code: "FORBIDDEN", message: errors.noPrizeTrack });
  }
  // Digital sponsors have no portal; the spon team enters their top 3
  // (submitDigital). Jazz, 2026-11-19.
  if (isDigitalJudging(sponsor.name)) {
    throw new TRPCError({ code: "FORBIDDEN", message: errors.digital });
  }
  return sponsor;
}

/** Every rep's score for this sponsor, as 1-10 numbers. */
async function scoresFor(sponsorId: string): Promise<JudgeScore[]> {
  const rows = await db
    .select({
      teamId: sponsorTeamScores.teamId,
      judge: sponsorTeamScores.judgeName,
      halves: sponsorTeamScores.scoreHalves,
    })
    .from(sponsorTeamScores)
    .where(eq(sponsorTeamScores.sponsorId, sponsorId));
  return rows.map((r) => ({
    teamId: r.teamId,
    judge: r.judge,
    score: halvesToScore(r.halves),
  }));
}

/**
 * The sponsor's reviews (shortlist flag and note) with `score` set to the
 * team average across reps (sponsor_team_score), or null with no score.
 * A team scored but never shortlisted or noted gets a review too.
 */
function withAverages(
  reviews: readonly Omit<TeamReview, "score">[],
  scores: readonly JudgeScore[],
): TeamReview[] {
  const agg = aggregateScores(scores);
  const out = new Map<string, TeamReview>();
  for (const r of reviews) {
    out.set(r.teamId, { ...r, score: agg.get(r.teamId)?.average ?? null });
  }
  for (const [teamId, a] of agg) {
    if (!out.has(teamId)) {
      out.set(teamId, {
        teamId,
        score: a.average,
        shortlisted: false,
        note: null,
      });
    }
  }
  return [...out.values()];
}

async function reviewsFor(sponsorId: string, scores: readonly JudgeScore[]) {
  const rows = await db
    .select({
      teamId: sponsorTeamReviews.teamId,
      shortlisted: sponsorTeamReviews.shortlisted,
      note: sponsorTeamReviews.note,
    })
    .from(sponsorTeamReviews)
    .where(eq(sponsorTeamReviews.sponsorId, sponsorId));
  return withAverages(rows, scores);
}

/** The sponsor's reps from Your team, in the order they were listed. */
async function repNames(sponsorId: string): Promise<string[]> {
  const rows = await db
    .select({ name: coffeeChatReps.name })
    .from(coffeeChatReps)
    .where(eq(coffeeChatReps.sponsorId, sponsorId))
    .orderBy(asc(coffeeChatReps.position), asc(coffeeChatReps.createdAt));
  const seen = new Set<string>();
  return rows
    .map((r) => cleanJudgeName(r.name))
    .filter((name) => {
      const key = judgeKey(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Round state for one sponsor: their sent shortlist, whether any schedule
 * exists, their presentation slots (placed only), and whether organizers
 * have opened round 2. Once round 2 is open, a sponsor ranks only the
 * teams that presented to them; a sponsor with no placed slot can't rank
 * at all (Jazz, 2026-11-18; judgingRound "locked").
 */
async function roundFor(sponsorId: string) {
  const [sent, anySlot, slots, openedAt] = await Promise.all([
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
    round2OpenedAt(),
  ]);
  return {
    shortlistSent: sent ? { sentAt: sent.sentAt, teamIds: sent.teamIds } : null,
    /** When the current schedule was made; null = not scheduled yet. */
    scheduledAt: anySlot?.scheduledAt ?? null,
    slots: slots
      .map((r) => ({ teamId: r.teamId, room: r.room ?? "", start: r.start! }))
      .sort((a, b) => a.start - b.start),
    /** Organizers opened round 2 (after presentations). */
    round2Open: openedAt !== null,
  };
}

/**
 * Mirror a saved submission to the Sponsor Judging sheet tab and mark it
 * synced. (Lucas's old "Judging" tab was deleted on 2026-11-19; the
 * database is the record and the tab is a one-way view.) The mark only
 * lands if `submittedAt` is still the sponsor's latest submission, so a
 * slow write for an older ranking never marks a newer one as synced. With
 * sheet writes off (sheetWritesEnabled) nothing is written and it stays
 * unsynced. Best effort: never throws.
 */
async function syncFinalToSheet(sponsorId: string, submittedAt: Date) {
  try {
    const result = await mirrorSponsorJudgingSoon();
    if (!result?.ok) return false;
    const marked = await db
      .update(sponsorFinalPicks)
      .set({ sheetSyncedAt: new Date() })
      .where(
        and(
          eq(sponsorFinalPicks.sponsorId, sponsorId),
          eq(sponsorFinalPicks.submittedAt, submittedAt),
        ),
      )
      .returning({ sponsorId: sponsorFinalPicks.sponsorId });
    return marked.length > 0;
  } catch (error) {
    console.error("Sponsor final picks: sheet mirror failed", error);
    return false;
  }
}

/** Save a sponsor's ranked top list (replacing any earlier one), then mirror it. */
async function saveFinal(sponsorId: string, teamIds: string[]) {
  const submittedAt = new Date();
  await db
    .insert(sponsorFinalPicks)
    .values({ sponsorId, teamIds, submittedAt, sheetSyncedAt: null })
    .onConflictDoUpdate({
      target: sponsorFinalPicks.sponsorId,
      set: { teamIds, submittedAt, sheetSyncedAt: null },
    });
  const sheetSynced = await syncFinalToSheet(sponsorId, submittedAt);
  return { teamIds, ineligibleCount: 0, submittedAt, sheetSynced };
}

/**
 * Keep sponsor_team_review.score at the rounded team average, so readers
 * of the older one-score column (the organizer day board's "scored"
 * count) stay right. Null when no rep has scored the team.
 */
async function syncReviewScore(sponsorId: string, teamId: string) {
  const rows = await db
    .select({ halves: sponsorTeamScores.scoreHalves })
    .from(sponsorTeamScores)
    .where(
      and(
        eq(sponsorTeamScores.sponsorId, sponsorId),
        eq(sponsorTeamScores.teamId, teamId),
      ),
    );
  const average =
    rows.reduce((sum, r) => sum + halvesToScore(r.halves), 0) /
    Math.max(1, rows.length);
  const score =
    rows.length > 0 ? Math.min(10, Math.max(1, Math.round(average))) : null;
  const updatedAt = new Date();
  await db
    .insert(sponsorTeamReviews)
    .values({ sponsorId, teamId, score, updatedAt })
    .onConflictDoUpdate({
      target: [sponsorTeamReviews.sponsorId, sponsorTeamReviews.teamId],
      set: { score, updatedAt },
    });
}

/**
 * The registered sponsor row for a digital prize track entry, created when
 * it's missing: digital sponsors get no portal link, but their entered top
 * 3 is stored like any other sponsor's.
 */
async function digitalSponsorRow(entry: string) {
  const registered = await db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors);
  const found = registered.find((s) => prizeTrackOf(s.name) === entry);
  if (found) return found;
  await db
    .insert(sponsorJudgingSponsors)
    .values({ name: entry })
    .onConflictDoNothing({ target: sponsorJudgingSponsors.name });
  const row = await db.query.sponsorJudgingSponsors.findFirst({
    where: eq(sponsorJudgingSponsors.name, entry),
    columns: { id: true, name: true },
  });
  return row!;
}

/** Digital prize track entries in list order (PCBWay today). */
const digitalEntries = (): string[] =>
  SPONSOR_PRIZE_TRACKS.filter((entry) => isDigitalJudging(entry));

/** A digital entry by name (loose match), or NOT_FOUND. */
function digitalEntry(name: string) {
  const entry = digitalEntries().find((e) => prizeTrackOf(name, [e]) !== null);
  if (!entry) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.notDigital });
  }
  return entry;
}

/**
 * Sponsor judging on /sponsors/[uuid]/picks: each rep scores submitted
 * teams 1-10 in half points (several reps share one login: "Who's
 * judging?"), the sponsor saves some to a shortlist, then submits a ranked
 * top SPONSOR_FINAL_TOP (1st-3rd). The sponsor's private UUID is the
 * credential, as on their other portal pages; every read and write is
 * scoped to that sponsor, and only teams they can see (submitted, in their
 * track; same rule as Lucas's listAllTeams) can be reviewed or submitted.
 * Digital sponsors have no portal; organizers enter their top 3
 * (submitDigital). Organizers read everything through `overview`.
 */
export const sponsorScoringRouter = createTRPCRouter({
  /**
   * Eligible teams, this sponsor's reviews (score = team average), every
   * rep's scores, the sponsor's reps for "Who's judging?", and their last
   * submission. A submission the sheet never got is retried here, best
   * effort.
   */
  get: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }) => {
      const sponsor = await findTrackSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [eligible, scores, final, round, reps] = await Promise.all([
        listEligibleTeams(track),
        scoresFor(sponsor.id),
        db.query.sponsorFinalPicks.findFirst({
          where: eq(sponsorFinalPicks.sponsorId, sponsor.id),
        }),
        roundFor(sponsor.id),
        repNames(sponsor.id),
      ]);
      const reviews = await reviewsFor(sponsor.id, scores);
      // Reviews of teams that have since left the sponsor's list (track
      // changed, submission withdrawn) stay stored but aren't shown, and
      // drop out of the submitted ranking too.
      const visible = new Set(eligible.map((t) => t.id));
      const sheetSynced = final
        ? final.sheetSyncedAt !== null ||
          (await syncFinalToSheet(sponsor.id, final.submittedAt))
        : false;
      const finalIds = final?.teamIds.filter((id) => visible.has(id)) ?? [];
      return {
        sponsorName: sponsor.name,
        sponsorTrack: track,
        finalTop: SPONSOR_FINAL_TOP,
        open: isOpen(),
        teams: eligible,
        reviews: reviews.filter((r) => visible.has(r.teamId)),
        /** Every rep's score (1-10, half points), for "who gave what". */
        scores: scores.filter((s) => visible.has(s.teamId)),
        /** Reps listed on Your team, for "Who's judging?". */
        reps,
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
   * One rep's score for one team, in half points (halves 2-20 = 1-10);
   * null clears that rep's score. Each rep's score is kept separately
   * (sponsor_team_score); the team average is what the shortlist and
   * ranking sort by.
   */
  score: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        teamId: teamIdInput,
        judge: judgeInput,
        halves: z.number().int().min(HALVES_MIN).max(HALVES_MAX).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      assertOpen();
      const sponsor = await findTrackSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const ok = await eligibleTeamIds(track, [input.teamId]);
      if (!ok.has(input.teamId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: errors.notEligible });
      }
      const judge = cleanJudgeName(input.judge);
      // One score per rep per team, whatever the name's case or spacing.
      const existing = await db
        .select({ judge: sponsorTeamScores.judgeName })
        .from(sponsorTeamScores)
        .where(
          and(
            eq(sponsorTeamScores.sponsorId, sponsor.id),
            eq(sponsorTeamScores.teamId, input.teamId),
          ),
        );
      const same = existing
        .map((r) => r.judge)
        .filter((name) => judgeKey(name) === judgeKey(judge));
      await db.transaction(async (tx) => {
        if (same.length > 0) {
          await tx
            .delete(sponsorTeamScores)
            .where(
              and(
                eq(sponsorTeamScores.sponsorId, sponsor.id),
                eq(sponsorTeamScores.teamId, input.teamId),
                inArray(sponsorTeamScores.judgeName, same),
              ),
            );
        }
        if (input.halves !== null) {
          await tx.insert(sponsorTeamScores).values({
            sponsorId: sponsor.id,
            teamId: input.teamId,
            judgeName: judge,
            scoreHalves: input.halves,
            updatedAt: new Date(),
          });
        }
      });
      await syncReviewScore(sponsor.id, input.teamId);
      return {
        teamId: input.teamId,
        judge,
        score: input.halves === null ? null : halvesToScore(input.halves),
      };
    }),

  /**
   * Autosave part of a review: the shortlist flag or the note. Fields left
   * out keep their value. Scores go through `score` (one per rep).
   */
  review: publicProcedure
    .input(
      z
        .object({
          sponsor: sponsorInput,
          teamId: teamIdInput,
          shortlisted: z.boolean(),
          note: z.string().max(NOTE_MAX).nullable(),
        })
        .partial({ shortlisted: true, note: true }),
    )
    .mutation(async ({ input }) => {
      assertOpen();
      const sponsor = await findTrackSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const ok = await eligibleTeamIds(track, [input.teamId]);
      if (!ok.has(input.teamId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: errors.notEligible });
      }
      const note =
        input.note === undefined ? undefined : blankToNull(input.note);
      const set = {
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
      const sponsor = await findTrackSponsor(input.sponsor);
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
      await mirrorSponsorJudgingSoon();
      return { sentAt, teamIds };
    }),

  /**
   * Submit the ranked top SPONSOR_FINAL_TOP (1st, 2nd, 3rd): exactly that
   * many, no repeats, all teams that presented to this sponsor and still
   * eligible. Only once organizers have opened round 2, and only for a
   * sponsor with a placed presentation slot (no slot: FORBIDDEN, Jazz
   * 2026-11-18). Resubmitting replaces the last one while judging is open.
   * Saved here first, then mirrored to the Sponsor Judging tab; if that
   * fails (or sheet writes are off) the submission still counts and
   * `sheetSynced` is false (the next `get` retries it).
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
      const sponsor = await findTrackSponsor(input.sponsor);
      const track = await fetchSponsorTrack(sponsor.name);
      const [eligible, round] = await Promise.all([
        eligibleTeamIds(track, input.teamIds),
        roundFor(sponsor.id),
      ]);
      if (!round.round2Open) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: errors.round2Closed,
        });
      }
      // Round 2 ranks only teams that presented to this sponsor. No placed
      // slot (sent late, no room, none fit) means no round 2 for them.
      if (round.slots.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: errors.noSlot });
      }
      const allowed = new Set(
        round.slots.map((s) => s.teamId).filter((id) => eligible.has(id)),
      );
      const problem = rankingError(input.teamIds, allowed);
      if (problem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            problem === "notShortlisted"
              ? errors.ranking.notPresented()
              : errors.ranking[problem](SPONSOR_FINAL_TOP),
        });
      }
      return saveFinal(sponsor.id, input.teamIds);
    }),

  /**
   * Organizers: a digital sponsor's track teams (submitted, in its track)
   * for matching pasted Devpost links on the organizer tab, with the top 3
   * entered so far.
   */
  digitalTeams: protectedOrganizerProcedure
    .input(z.object({ name: z.string().trim().min(1).max(255) }))
    .query(async ({ input }) => {
      const entry = digitalEntry(input.name);
      const sponsor = await digitalSponsorRow(entry);
      const track = await fetchSponsorTrack(sponsor.name);
      const [eligible, final] = await Promise.all([
        listEligibleTeams(track),
        db.query.sponsorFinalPicks.findFirst({
          where: eq(sponsorFinalPicks.sponsorId, sponsor.id),
        }),
      ]);
      return {
        name: sponsor.name,
        track,
        teams: eligible.map((t) => ({
          id: t.id,
          name: t.name,
          devpostUrl: t.devpostUrl,
        })),
        final: final
          ? { teamIds: final.teamIds, submittedAt: final.submittedAt }
          : null,
      };
    }),

  /**
   * Organizers enter a digital sponsor's 1st-3rd place by pasting Devpost
   * links (a team ID works too). Each link must match a different
   * submitted team in that sponsor's track, or nothing is saved. Stored
   * like a portal submission and mirrored to the Sponsor Judging tab.
   */
  submitDigital: protectedOrganizerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        links: z
          .array(z.string().trim().min(1).max(2048))
          .length(SPONSOR_FINAL_TOP, {
            message: errors.ranking.wrongCount(SPONSOR_FINAL_TOP),
          }),
      }),
    )
    .mutation(async ({ input }) => {
      assertOpen();
      const entry = digitalEntry(input.name);
      const sponsor = await digitalSponsorRow(entry);
      const track = await fetchSponsorTrack(sponsor.name);
      const eligible = await listEligibleTeams(track);
      const teamIds = input.links.map((link, i) => {
        const team = matchTeamByLink(link, eligible);
        if (!team) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errors.digitalNoMatch(i + 1, link),
          });
        }
        return team.id;
      });
      if (new Set(teamIds).size !== teamIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.ranking.duplicate(),
        });
      }
      return saveFinal(sponsor.id, teamIds);
    }),

  /**
   * Organizers: every sponsor's progress and submitted ranking (final
   * results: teams in rank order with their hackers, average score and
   * each rep's score), plus all teams ranked by how many sponsors put
   * them in a top list and their average score. Only teams a sponsor can
   * still judge (submitted, in their track) count toward progress and
   * tallies; a withdrawn team stays in that sponsor's submitted list,
   * flagged `eligible: false`. Digital sponsors are listed with
   * `digital: true` (their top 3 is entered on this tab).
   */
  overview: protectedOrganizerProcedure.query(async () => {
    const [registered, reviewRows, scoreRows, finals, tracks] =
      await Promise.all([
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
            shortlisted: sponsorTeamReviews.shortlisted,
            note: sponsorTeamReviews.note,
          })
          .from(sponsorTeamReviews),
        db
          .select({
            sponsorId: sponsorTeamScores.sponsorId,
            teamId: sponsorTeamScores.teamId,
            judge: sponsorTeamScores.judgeName,
            halves: sponsorTeamScores.scoreHalves,
          })
          .from(sponsorTeamScores),
        db.select().from(sponsorFinalPicks),
        fetchSponsorTracks(),
      ]);
    // Only prize track sponsors take part in judging.
    const sponsors = registered.filter((s) => hasPrizeTrack(s.name));

    const teamIds = [
      ...new Set([
        ...reviewRows.map((r) => r.teamId),
        ...scoreRows.map((r) => r.teamId),
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
    // Final results show each submitted team's hackers.
    const members = await membersByTeam([
      ...new Set(finals.flatMap((f) => f.teamIds)),
    ]);
    const teamById = new Map(
      teamRows.map((t) => [
        t.id,
        { ...t, devpostUrl: blankToNull(t.devpostUrl) },
      ]),
    );

    const groupBy = <T extends { sponsorId: string }>(rows: readonly T[]) => {
      const map = new Map<string, T[]>();
      for (const row of rows) {
        const list = map.get(row.sponsorId) ?? [];
        list.push(row);
        map.set(row.sponsorId, list);
      }
      return map;
    };
    const reviewsBySponsor = groupBy(reviewRows);
    const scoresBySponsor = groupBy(scoreRows);
    const finalBySponsor = new Map(finals.map((f) => [f.sponsorId, f]));

    const perSponsor = sponsors.map((s) => {
      const track = tracks.get(s.name.toLowerCase()) ?? null;
      const canJudge = (teamId: string) => {
        const t = teamById.get(teamId);
        return t !== undefined && isEligibleTeam(t, track);
      };
      const scores: JudgeScore[] = (scoresBySponsor.get(s.id) ?? []).map(
        (r) => ({
          teamId: r.teamId,
          judge: r.judge,
          score: halvesToScore(r.halves),
        }),
      );
      const all = withAverages(reviewsBySponsor.get(s.id) ?? [], scores);
      const f = finalBySponsor.get(s.id) ?? null;
      return {
        sponsorId: s.id,
        name: s.name,
        digital: isDigitalJudging(s.name),
        reviews: all.filter((r) => canJudge(r.teamId)),
        final: f
          ? { teamIds: f.teamIds.filter(canJudge), submittedAt: f.submittedAt }
          : null,
        scoreOf: new Map(all.map((r) => [r.teamId, r.score])),
        agg: aggregateScores(scores),
        judges: new Set(scores.map((x) => judgeKey(x.judge))).size,
        canJudge,
        stored: f,
      };
    });
    const tallies = tallyTeams(perSponsor);

    return {
      finalTop: SPONSOR_FINAL_TOP,
      /** Sponsors whose saved submission hasn't reached the sheet yet. */
      unsyncedCount: finals.filter((f) => f.sheetSyncedAt === null).length,
      /** Digital prize track entries (top 3 entered here), in list order. */
      digital: digitalEntries(),
      sponsors: perSponsor.map((s) => ({
        sponsorId: s.sponsorId,
        name: s.name,
        digital: s.digital,
        /** Reps who've scored at least one team. */
        judges: s.judges,
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
                byJudge: s.agg.get(teamId)?.byJudge ?? [],
                eligible: s.canJudge(teamId),
                members: members.get(teamId) ?? [],
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
