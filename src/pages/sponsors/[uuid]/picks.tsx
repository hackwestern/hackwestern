import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, MapPin } from "lucide-react";
import { useRouter } from "next/router";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { BrowseProjects } from "~/components/sponsors/judging/browse-projects";
import { PresentationScoring } from "~/components/sponsors/judging/presentation-scoring";
import {
  JudgePicker,
  JudgingAs,
  useJudgeName,
} from "~/components/sponsors/judging/judge-picker";
import { ShortlistRanking } from "~/components/sponsors/judging/shortlist-ranking";
import { ShortlistSend } from "~/components/sponsors/judging/shortlist-send";
import { useSponsorJudging } from "~/components/sponsors/judging/use-sponsor-judging";
import { pressable, SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  formatPresentationTime,
  judgingRound,
} from "~/lib/sponsor-presentations";
import { judgeKey } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = sponsorJudgingCopy;
type Step =
  | "browse"
  | "shortlist"
  | "presentations"
  | "top";
const ALL_STEPS: readonly Step[] = [
  "browse",
  "shortlist",
  "presentations",
  "top",
];

function JudgingIdentity({
  name,
  reps,
  scores,
  onSwitch,
}: {
  name: string;
  reps: readonly string[];
  scores: readonly { judge: string }[];
  onSwitch: () => void;
}) {
  const others = [...new Set([
    ...reps,
    ...scores.map((score) => score.judge),
  ])].filter((candidate) => judgeKey(candidate) !== judgeKey(name));
  return (
    <JudgingAs name={name} others={others} onSwitch={onSwitch} />
  );
}

// Sponsor judging (kept at Lucas's /sponsors/[uuid]/picks URL): each rep
// picks their name, goes through the submitted projects one at a time or as
// a list and scores them 1-10 in half points; the sponsor saves some to a
// shortlist and sends it, then ranks the teams that presented and submits
// a top SPONSOR_FINAL_TOP (1st-5th). See docs/decisions.md (2026-11-19).
export default function SponsorJudgingPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);
  const { query, reviews, scoresByTeam, save, setScore, saveState } =
    useSponsorJudging(uuid, validUuid);
  const data = query.data;
  const judge = useJudgeName(uuid);
  const [switchingJudge, setSwitchingJudge] = useState(false);
  const portalInfo = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: uuid },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const [step, setStep] = useState<Step>("browse");
  const stepRefs = useRef(new Map<Step, HTMLButtonElement>());

  // Round 2 once organizers open it and this sponsor has presentation
  // slots: rank the teams that presented (team id -> "10:05 AM"). Before
  // that, round 1's sent shortlist with a note that round 2 opens later.
  // Round 2 open with no slot of their own: "locked", no ranking.
  const round = data ? judgingRound(data.round) : "shortlist";
  const presented = useMemo(
    () =>
      data && round === "rank"
        ? data.round.remote
          ? // Judged online: their sent shortlist, no times.
            new Map(
              (data.round.shortlistSent?.teamIds ?? []).map((id) => [id, ""]),
            )
          : new Map(
              data.round.slots.map((s) => [
                s.teamId,
                formatPresentationTime(s.start),
              ]),
            )
        : null,
    [data, round],
  );
  const roundTwoAvailable = round === "rank";
  const locked = (s: Step) =>
    s === "browse" || s === "shortlist"
      ? roundTwoAvailable
      : !roundTwoAvailable;

  useEffect(() => {
    if (roundTwoAvailable && (step === "browse" || step === "shortlist")) {
      setStep("presentations");
    } else if (!roundTwoAvailable && (step === "presentations" || step === "top")) {
      setStep("browse");
    }
  }, [roundTwoAvailable, step]);

  const shortlistCount = !data
    ? 0
    : presented
      ? presented.size
      : data.teams.filter((t) => reviews.get(t.id)?.shortlisted).length;

  const chooseStep = (s: Step, focus = false) => {
    if (locked(s)) return;
    setStep(s);
    if (focus) stepRefs.current.get(s)?.focus();
  };

  if (!router.isReady || (validUuid && query.isLoading)) {
    return (
      <SponsorShell title={copy.seoTitle}>
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-8 w-40 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav motion-reduce:animate-none" />
          <div className="h-12 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-nav motion-reduce:animate-none" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none"
            />
          ))}
        </div>
      </SponsorShell>
    );
  }

  if (!validUuid || query.error?.data?.code === "NOT_FOUND") {
    return (
      <SponsorShell title={copy.seoTitle}>
        <DashboardPanel className="text-center">
          <h1 className="dashboard-h1 m-0">{copy.invalid.title}</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            {copy.invalid.body}
          </p>
        </DashboardPanel>
      </SponsorShell>
    );
  }

  // Sponsors without a prize track don't judge: a quiet note, no retry.
  if (query.error?.data?.code === "FORBIDDEN") {
    return (
      <SponsorShell title={copy.seoTitle}>
        <DashboardPanel className="items-start">
          <h1 className="dashboard-h1 m-0">{copy.noPrizeTrack.title}</h1>
          <p className="m-0 text-base leading-relaxed text-dashboard-text-medium">
            {copy.noPrizeTrack.body}
          </p>
        </DashboardPanel>
      </SponsorShell>
    );
  }

  if (!data) {
    return (
      <SponsorShell title={copy.seoTitle}>
        <DashboardPanel className="items-start">
          <p className="m-0 text-base text-dashboard-text-medium">
            {query.error?.message ?? copy.loadFailed}
          </p>
          <DashboardButton variant="small" onClick={() => void query.refetch()}>
            {copy.retry}
          </DashboardButton>
        </DashboardPanel>
      </SponsorShell>
    );
  }

  const counts: Record<Step, number> = {
    browse: data.teams.length,
    shortlist: shortlistCount,
    presentations: presented?.size ?? 0,
    top: data.final?.teamIds.length ?? 0,
  };

  return (
    <SponsorShell title={copy.seoTitle}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <DashboardTag>{data.sponsorName}</DashboardTag>
          {data.sponsorTrack && (
            <DashboardTag className="bg-dashboard-bg-highlight text-dashboard-text-active">
              {copy.trackTag(data.sponsorTrack)}
            </DashboardTag>
          )}
          {roundTwoAvailable ? (
            <DashboardTag>{copy.steps.round2Stage}</DashboardTag>
          ) : (
            <DashboardTag>{copy.steps.round1Stage}</DashboardTag>
          )}
        </div>
        <h1 className="dashboard-h1 m-0">{copy.title}</h1>
        <p className="m-0 text-base leading-relaxed text-dashboard-text-medium">
          {copy.intro(data.finalTop)}
        </p>
        {portalInfo.data?.roomNumber &&
          portalInfo.data.roomNumber !== "TBD" && (
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2 text-sm shadow-dashboard-card">
              <MapPin
                aria-hidden
                className="size-4 shrink-0 text-dashboard-text-active"
              />
              <span className="text-dashboard-text-light">Judging room</span>
              <span className="font-semibold text-dashboard-text-heavy">
                {portalInfo.data.roomNumber}
              </span>
            </div>
          )}
      </div>

      {data.teams.length === 0 && (
        <p
          role="status"
          className="m-0 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-4 py-3 text-sm font-semibold text-dashboard-text-medium shadow-dashboard-card"
        >
          {copy.noTeamsCurrently}
        </p>
      )}

      {judge.ready &&
        (!judge.name || switchingJudge) ? (
          <JudgePicker
            reps={data.reps}
            current={judge.name}
            onPick={(name) => {
              judge.choose(name);
              setSwitchingJudge(false);
            }}
          />
        ) : judge.ready && judge.name ? (
          <JudgingIdentity
            name={judge.name}
            reps={data.reps}
            scores={data.scores}
            onSwitch={() => setSwitchingJudge(true)}
          />
        ) : null}

      {/* Four judging stages stay visible; unavailable stages stay locked. */}

      {/* Four judging stages stay visible; unavailable stages stay locked. */}
      <div className="-mx-4 px-4 py-2 sm:-mx-5 sm:px-5">
        <div
          role="tablist"
          aria-label={copy.steps.label}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1 sm:grid-cols-4"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const at = ALL_STEPS.indexOf(step);
            if (at < 0) return;
            const delta = e.key === "ArrowRight" ? 1 : -1;
            for (let n = 1; n <= ALL_STEPS.length; n++) {
              const next =
                ALL_STEPS[
                  (at + delta * n + ALL_STEPS.length * 2) % ALL_STEPS.length
                ];
              if (next && !locked(next)) {
                chooseStep(next, true);
                break;
              }
            }
          }}
        >
          {ALL_STEPS.map((s) => {
            const on = step === s;
            const isLocked = locked(s);
            const stage =
              s === "browse" || s === "shortlist"
                ? copy.steps.round1
                : copy.steps.round2;
            return (
              <button
                key={s}
                ref={(el) => {
                  if (el) stepRefs.current.set(s, el);
                  else stepRefs.current.delete(s);
                }}
                type="button"
                role="tab"
                id={`step-${s}`}
                aria-selected={on}
                aria-controls={`panel-${s}`}
                aria-disabled={isLocked}
                disabled={isLocked}
                tabIndex={on ? 0 : -1}
                onClick={() => chooseStep(s)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-dashboard-md px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  isLocked &&
                    "cursor-not-allowed text-dashboard-text-placeholder opacity-70",
                  on
                    ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                    : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                  pressable,
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {isLocked && <Lock aria-hidden className="size-3.5" />}
                  {copy.steps[s]}
                  {!isLocked && (
                    <span
                      className={cn(
                        "ml-0.5 rounded-full px-1.5 text-xs tabular-nums leading-5",
                        on
                          ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                          : "bg-dashboard-bg-navSelected text-dashboard-text-medium",
                      )}
                    >
                      {counts[s]}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium leading-4 text-dashboard-text-light">
                  {isLocked
                    ? s === "browse" || s === "shortlist"
                      ? copy.steps.round1Complete
                      : copy.steps.lockedRound2
                    : stage}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${step}`}
        aria-labelledby={`step-${step}`}
        className="flex flex-col gap-4"
      >
        {!judge.ready || !judge.name || switchingJudge ? null : step === "browse" ? (
          <BrowseProjects
            me={judge.name}
            data={data}
            reviews={reviews}
            scoresByTeam={scoresByTeam}
            saveState={saveState}
            onSave={save}
            onScore={setScore}
          />
        ) : step === "presentations" && judge.name && presented ? (
          <PresentationScoring
            me={judge.name}
            data={data}
            scoresByTeam={scoresByTeam}
            saveState={saveState}
            onScore={setScore}
          />
        ) : step === "top" && presented ? (
          <ShortlistRanking
            sponsor={uuid}
            data={data}
            reviews={reviews}
            onSave={save}
            onBrowse={() => chooseStep("browse", true)}
            presented={presented}
          />
        ) : round === "locked" ? (
          // Round 2 is open, but no team presented to this sponsor: no
          // slot, no ranking (Jazz, 2026-11-18; the server refuses too).
          <ShortlistSend
            sponsor={uuid}
            data={data}
            reviews={reviews}
            onSave={save}
            onBrowse={() => chooseStep("browse", true)}
            locked
          />
        ) : (
          <ShortlistSend
            sponsor={uuid}
            data={data}
            reviews={reviews}
            onSave={save}
            onBrowse={() => chooseStep("browse", true)}
          />
        )}
      </div>
    </SponsorShell>
  );
}
