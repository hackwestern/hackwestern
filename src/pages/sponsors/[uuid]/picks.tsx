import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Lock } from "lucide-react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { BrowseProjects } from "~/components/sponsors/judging/browse-projects";
import { ShortlistRanking } from "~/components/sponsors/judging/shortlist-ranking";
import { ShortlistSend } from "~/components/sponsors/judging/shortlist-send";
import { useSponsorJudging } from "~/components/sponsors/judging/use-sponsor-judging";
import { pressable, SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { sponsorVenueCopy } from "~/content/sponsor-venue";
import { judgingUnlocked } from "~/lib/sponsor-judging-unlock";
import {
  formatPresentationTime,
  judgingRound,
} from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import { uuidRegex } from "~/utils/urls";

const copy = sponsorJudgingCopy;
const STEPS = ["browse", "shortlist"] as const;
type Step = (typeof STEPS)[number];

// Sponsor judging (kept at Lucas's /sponsors/[uuid]/picks URL): each rep
// picks their name, goes through the submitted projects one at a time or as
// a list and scores them 1-10 in half points; the sponsor saves some to a
// shortlist and sends it, then ranks the teams that presented and submits
// a top SPONSOR_FINAL_TOP (1st-3rd). See docs/decisions.md (2026-11-19).
export default function SponsorJudgingPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);
  const { query, reviews, scoresByTeam, save, setScore, saveState } =
    useSponsorJudging(uuid, validUuid);
  const data = query.data;

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
        ? new Map(
            data.round.slots.map((s) => [
              s.teamId,
              formatPresentationTime(s.start),
            ]),
          )
        : null,
    [data, round],
  );
  const shortlistCount = !data
    ? 0
    : presented
      ? presented.size
      : data.teams.filter((t) => reviews.get(t.id)?.shortlisted).length;

  const chooseStep = (s: Step, focus = false) => {
    setStep(s);
    if (focus) stepRefs.current.get(s)?.focus();
  };

  // Same rule as the nav: locked until Sunday 9:00 AM, unless previewing.
  // This lock is UI-only by design: the server enforces only the close
  // time. Round 1 starts at 9:00 Sunday (docs/flows/sponsor-judging.md),
  // so the page simply doesn't show judging before then.
  if (
    router.isReady &&
    router.query.preview !== "judging" &&
    !judgingUnlocked(new Date())
  ) {
    const locked = sponsorVenueCopy.judgingLocked;
    return (
      <SponsorShell title={copy.seoTitle}>
        <DashboardPanel className="items-start gap-3">
          <h1 className="dashboard-h1 m-0 flex items-center gap-2">
            <Lock aria-hidden className="size-6 shrink-0" />
            {locked.pageTitle}
          </h1>
          <p className="m-0 text-base text-dashboard-text-medium">
            {locked.message}
          </p>
          <DashboardButton
            asChild
            variant="outline"
            className={cn("h-11", pressable)}
          >
            <Link href={`/sponsors/${uuid}`}>{locked.home}</Link>
          </DashboardButton>
        </DashboardPanel>
      </SponsorShell>
    );
  }

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
  };

  return (
    <SponsorShell title={copy.seoTitle}>
      <div data-tour="judging-intro" className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <DashboardTag>{data.sponsorName}</DashboardTag>
          {data.sponsorTrack && (
            <DashboardTag className="bg-dashboard-bg-highlight text-dashboard-text-active">
              {copy.trackTag(data.sponsorTrack)}
            </DashboardTag>
          )}
        </div>
        <h1 className="dashboard-h1 m-0">{copy.title}</h1>
        <p className="m-0 text-base leading-relaxed text-dashboard-text-medium">
          {copy.intro(data.finalTop)}
        </p>
      </div>

      {/* Browse | Shortlist, sticky so switching is one tap on a long list. */}
      <div className="sticky top-0 z-20 -mx-4 bg-dashboard-bg-page/95 px-4 py-2 backdrop-blur-sm sm:-mx-5 sm:px-5">
        <div
          role="tablist"
          aria-label={copy.steps.label}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            chooseStep(step === "browse" ? "shortlist" : "browse", true);
          }}
        >
          {STEPS.map((s) => {
            const on = step === s;
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
                data-tour={
                  s === "shortlist" ? "judging-shortlist-tab" : undefined
                }
                aria-selected={on}
                aria-controls={`panel-${s}`}
                tabIndex={on ? 0 : -1}
                onClick={() => chooseStep(s)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-dashboard-md px-2 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  on
                    ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                    : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                  pressable,
                )}
              >
                {copy.steps[s]}
                <span
                  className={cn(
                    "rounded-full px-2 text-xs tabular-nums leading-5",
                    on
                      ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                      : "bg-dashboard-bg-navSelected text-dashboard-text-medium",
                  )}
                >
                  {counts[s]}
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
        {step === "browse" ? (
          <BrowseProjects
            sponsor={uuid}
            data={data}
            reviews={reviews}
            scoresByTeam={scoresByTeam}
            saveState={saveState}
            onSave={save}
            onScore={setScore}
          />
        ) : presented ? (
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
