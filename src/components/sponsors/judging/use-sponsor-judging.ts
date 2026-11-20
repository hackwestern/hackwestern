import { useCallback, useMemo, useRef, useState } from "react";
import {
  aggregateScores,
  judgeKey,
  scoreToHalves,
  type JudgeScore,
  type TeamReview,
} from "~/lib/sponsor-scoring";
import { api, type RouterOutputs } from "~/utils/api";

export type JudgingData = RouterOutputs["sponsorScoring"]["get"];
export type JudgingTeam = JudgingData["teams"][number];
export type ReviewPatch = Partial<Pick<TeamReview, "shortlisted" | "note">>;
export type SaveState = "saving" | "saved" | "error";

const EMPTY: TeamReview = {
  teamId: "",
  score: null,
  shortlisted: false,
  note: null,
};

/**
 * The sponsor's judging data plus autosaving review edits. Each edit shows
 * at once (optimistic), saves in the background, and on failure rolls back
 * only the fields it changed, and only if nothing newer replaced them.
 * After a failure it refetches once no other save is in flight, so the
 * cache ends up matching what the server actually saved.
 */
export function useSponsorJudging(sponsor: string, enabled: boolean) {
  const utils = api.useUtils();
  const query = api.sponsorScoring.get.useQuery(
    { sponsor },
    {
      enabled,
      refetchOnWindowFocus: false,
      // FORBIDDEN (no prize track) won't change on a retry.
      retry: (count, error) => error.data?.code !== "FORBIDDEN" && count < 1,
    },
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const inFlight = useRef(0);
  const needsRefetch = useRef(false);

  const patchCache = useCallback(
    (teamId: string, patch: ReviewPatch) => {
      utils.sponsorScoring.get.setData({ sponsor }, (old) => {
        if (!old) return old;
        const has = old.reviews.some((r) => r.teamId === teamId);
        const reviews = has
          ? old.reviews.map((r) =>
              r.teamId === teamId ? { ...r, ...patch } : r,
            )
          : [...old.reviews, { ...EMPTY, teamId, ...patch }];
        return { ...old, reviews };
      });
    },
    [utils, sponsor],
  );

  const mutation = api.sponsorScoring.review.useMutation({
    onMutate: async (vars) => {
      await utils.sponsorScoring.get.cancel({ sponsor });
      const before =
        utils.sponsorScoring.get
          .getData({ sponsor })
          ?.reviews.find((r) => r.teamId === vars.teamId) ?? EMPTY;
      const patch: ReviewPatch = {};
      if (vars.shortlisted !== undefined) patch.shortlisted = vars.shortlisted;
      if (vars.note !== undefined) patch.note = vars.note;
      patchCache(vars.teamId, patch);
      inFlight.current += 1;
      setSaveState((s) => ({ ...s, [vars.teamId]: "saving" }));
      return { before, patch };
    },
    onError: (_err, vars, ctx) => {
      if (!ctx) return;
      const now = utils.sponsorScoring.get
        .getData({ sponsor })
        ?.reviews.find((r) => r.teamId === vars.teamId);
      const rollback: ReviewPatch = {};
      for (const key of Object.keys(ctx.patch) as (keyof ReviewPatch)[]) {
        // A newer edit to the same field wins; don't undo it.
        if (now && now[key] === ctx.patch[key]) {
          (rollback as Record<string, unknown>)[key] = ctx.before[key];
        }
      }
      patchCache(vars.teamId, rollback);
      setSaveState((s) => ({ ...s, [vars.teamId]: "error" }));
      needsRefetch.current = true;
    },
    onSettled: () => {
      inFlight.current = Math.max(0, inFlight.current - 1);
      // Refetching earlier would overwrite edits still saving.
      if (inFlight.current === 0 && needsRefetch.current) {
        needsRefetch.current = false;
        void utils.sponsorScoring.get.invalidate({ sponsor });
      }
    },
    onSuccess: (_row, vars) => {
      setSaveState((s) =>
        s[vars.teamId] === "saving" ? { ...s, [vars.teamId]: "saved" } : s,
      );
    },
  });

  const { mutate } = mutation;
  const save = useCallback(
    (teamId: string, patch: ReviewPatch) =>
      mutate({ sponsor, teamId, ...patch }),
    [mutate, sponsor],
  );

  // One rep's score: optimistic, then saved. On failure the cache is
  // refetched once nothing else is saving, like review edits.
  const scoreMutation = api.sponsorScoring.score.useMutation({
    onMutate: async (vars) => {
      await utils.sponsorScoring.get.cancel({ sponsor });
      utils.sponsorScoring.get.setData({ sponsor }, (old) => {
        if (!old) return old;
        const key = judgeKey(vars.judge);
        const scores: JudgeScore[] = old.scores.filter(
          (s) => !(s.teamId === vars.teamId && judgeKey(s.judge) === key),
        );
        if (vars.halves !== null) {
          scores.push({
            teamId: vars.teamId,
            judge: vars.judge,
            score: vars.halves / 2,
          });
        }
        return { ...old, scores };
      });
      inFlight.current += 1;
      setSaveState((s) => ({ ...s, [vars.teamId]: "saving" }));
    },
    onError: (_err, vars) => {
      setSaveState((s) => ({ ...s, [vars.teamId]: "error" }));
      needsRefetch.current = true;
    },
    onSuccess: (_row, vars) => {
      setSaveState((s) =>
        s[vars.teamId] === "saving" ? { ...s, [vars.teamId]: "saved" } : s,
      );
    },
    onSettled: () => {
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current === 0 && needsRefetch.current) {
        needsRefetch.current = false;
        void utils.sponsorScoring.get.invalidate({ sponsor });
      }
    },
  });
  const { mutate: mutateScore } = scoreMutation;
  const setScore = useCallback(
    (teamId: string, judge: string, score: number | null) =>
      mutateScore({
        sponsor,
        teamId,
        judge,
        halves: score === null ? null : scoreToHalves(score),
      }),
    [mutateScore, sponsor],
  );

  const scoresByTeam = useMemo(
    () => aggregateScores(query.data?.scores ?? []),
    [query.data],
  );

  // Reviews carry the team average as `score`, recomputed from the live
  // per-rep scores so an optimistic score shows in sort and shortlist.
  const reviews = useMemo(() => {
    const map = new Map<string, TeamReview>(
      (query.data?.reviews ?? []).map((r) => [
        r.teamId,
        { ...r, score: scoresByTeam.get(r.teamId)?.average ?? null },
      ]),
    );
    for (const [teamId, agg] of scoresByTeam) {
      if (!map.has(teamId)) {
        map.set(teamId, { ...EMPTY, teamId, score: agg.average });
      }
    }
    return map;
  }, [query.data, scoresByTeam]);

  return { query, reviews, scoresByTeam, save, setScore, saveState };
}
