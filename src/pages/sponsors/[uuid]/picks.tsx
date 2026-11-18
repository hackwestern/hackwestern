import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Search, X } from "lucide-react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { ProjectCard } from "~/components/sponsors/judging/project-card";
import { ShortlistRanking } from "~/components/sponsors/judging/shortlist-ranking";
import { ShortlistSend } from "~/components/sponsors/judging/shortlist-send";
import { useSponsorJudging } from "~/components/sponsors/judging/use-sponsor-judging";
import { pressable, SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  BROWSE_FILTERS,
  BROWSE_SORTS,
  browseTeams,
  type BrowseFilter,
  type BrowseSort,
} from "~/lib/sponsor-scoring";
import {
  formatPresentationTime,
  judgingRound,
} from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import { uuidRegex } from "~/utils/urls";

const copy = sponsorJudgingCopy;
const STEPS = ["browse", "shortlist"] as const;
type Step = (typeof STEPS)[number];

// Sponsor judging (kept at Lucas's /sponsors/[uuid]/picks URL): browse the
// submitted projects, score them 1-10 and save some to a shortlist, then
// rank the shortlist and submit a top SPONSOR_FINAL_TOP. The submission is
// also written to Lucas's judging sheet. See docs/decisions.md (2026-11-18).
export default function SponsorJudgingPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);
  const { query, reviews, save, saveState } = useSponsorJudging(
    uuid,
    validUuid,
  );
  const data = query.data;

  const [step, setStep] = useState<Step>("browse");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BrowseFilter>("all");
  const [sort, setSort] = useState<BrowseSort>("name");
  const stepRefs = useRef(new Map<Step, HTMLButtonElement>());

  const visible = useMemo(
    () =>
      data
        ? browseTeams(data.teams, reviews, { query: search, filter, sort })
        : [],
    [data, reviews, search, filter, sort],
  );
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

  if (!router.isReady || (validUuid && query.isLoading)) {
    return (
      <SponsorShell
        title={copy.seoTitle}
        backHref={uuid ? `/sponsors/${uuid}` : undefined}
      >
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
      <SponsorShell title={copy.seoTitle} backHref={`/sponsors/${uuid}`}>
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
      <SponsorShell title={copy.seoTitle} backHref={`/sponsors/${uuid}`}>
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
    <SponsorShell title={copy.seoTitle} backHref={`/sponsors/${uuid}`}>
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
          <>
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <label className="sr-only" htmlFor="team-search">
                  {copy.browse.searchLabel}
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-text-disabled"
                />
                <input
                  id="team-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.browse.searchPlaceholder}
                  className="min-h-11 w-full rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface pl-10 pr-11 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [&::-webkit-search-cancel-button]:hidden"
                />
                {search && (
                  <button
                    type="button"
                    aria-label={copy.browse.clearSearch}
                    onClick={() => setSearch("")}
                    className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-dashboard-md text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:text-dashboard-text-heavy"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="group"
                  aria-label={copy.browse.filterLabel}
                  className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
                >
                  {BROWSE_FILTERS.map((f) => (
                    <DashboardChip
                      key={f}
                      selected={filter === f}
                      onClick={() => setFilter(f)}
                      className="min-h-11 shrink-0 md:min-h-9"
                    >
                      {copy.browse.filters[f]}
                    </DashboardChip>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-dashboard-text-medium">
                  {copy.browse.sortLabel}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as BrowseSort)}
                    className="min-h-11 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-2 text-base font-semibold text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:min-h-9 md:text-sm"
                  >
                    {BROWSE_SORTS.map((s) => (
                      <option key={s} value={s}>
                        {copy.browse.sorts[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p
                className="m-0 text-sm font-medium text-dashboard-text-light"
                aria-live="polite"
              >
                {copy.browse.count(visible.length, data.teams.length)}
              </p>
            </div>

            {data.teams.length === 0 ? (
              <Empty>{copy.browse.noTeams(data.sponsorTrack)}</Empty>
            ) : visible.length === 0 ? (
              <Empty>
                {search.trim()
                  ? copy.browse.noMatch(search.trim())
                  : copy.browse.noFilterMatch}
              </Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {visible.map((team, i) => (
                  <li
                    key={team.id}
                    data-tour={i === 0 ? "judging-first-project" : undefined}
                  >
                    <ProjectCard
                      team={team}
                      review={reviews.get(team.id)}
                      saveState={saveState[team.id]}
                      onSave={(patch) => save(team.id, patch)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
      {children}
    </p>
  );
}
