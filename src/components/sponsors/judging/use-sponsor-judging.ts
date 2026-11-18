import { useCallback, useMemo, useRef, useState } from "react";
import { type TeamReview } from "~/lib/sponsor-scoring";
import { api, type RouterOutputs } from "~/utils/api";

export type JudgingData = RouterOutputs["sponsorScoring"]["get"];
export type JudgingTeam = JudgingData["teams"][number];
export type ReviewPatch = Partial<
  Pick<TeamReview, "score" | "shortlisted" | "note">
>;
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
      if (vars.score !== undefined) patch.score = vars.score;
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

  const reviews = useMemo(
    () =>
      new Map<string, TeamReview>(
        (query.data?.reviews ?? []).map((r) => [r.teamId, r]),
      ),
    [query.data],
  );

  return { query, reviews, save, saveState };
}
