import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  BROWSE_FILTERS,
  BROWSE_SORTS,
  browseTeams,
  judgeKey,
  splitJudges,
  splitTeams,
  type BrowseFilter,
  type BrowseSort,
  type TeamReview,
  type TeamScores,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { ProjectCard } from "./project-card";
import {
  type JudgingData,
  type ReviewPatch,
  type SaveState,
} from "./use-sponsor-judging";

const copy = sponsorJudgingCopy;
const VIEWS = ["one", "list"] as const;
type View = (typeof VIEWS)[number];
type Scope = "mine" | "all";
const VIEW_KEY = "hw13-sponsor-judging-view";

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "one";
  } catch {
    return "one";
  }
}

function saveView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the choice still applies now.
  }
}

/**
 * Round 1 browsing, like hacker judging: one project at a time (Previous,
 * Next, Next unscored) or the whole list (search, filter, sort). No other
 * modes (Jazz, 2026-11-19). Several reps share the login: "Who's judging?"
 * first, then each score is that rep's. With two or more reps the list is
 * split evenly between them ("Your 6" / "Everyone's 18"); anyone can still
 * score any project.
 */
export function BrowseProjects({
  me,
  data,
  reviews,
  scoresByTeam,
  saveState,
  onSave,
  onScore,
}: {
  me: string;
  data: JudgingData;
  reviews: ReadonlyMap<string, TeamReview>;
  scoresByTeam: ReadonlyMap<string, TeamScores>;
  saveState: Record<string, SaveState>;
  onSave: (teamId: string, patch: ReviewPatch) => void;
  onScore: (teamId: string, judge: string, score: number | null) => void;
}) {
  const [view, setView] = useState<View>("one");
  useEffect(() => setView(readView()), []);
  const [scope, setScope] = useState<Scope>("mine");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BrowseFilter>("all");
  const [sort, setSort] = useState<BrowseSort>("name");
  const [at, setAt] = useState(0);

  const scorers = useMemo(
    () => [...new Set(data.scores.map((s) => s.judge))],
    [data.scores],
  );
  const judges = useMemo(
    () => splitJudges(data.reps, scorers, me),
    [data.reps, scorers, me],
  );
  const split = judges.length >= 2;
  const owners = useMemo(() => {
    const out = new Map<string, string>();
    if (!split) return out;
    const runs = splitTeams(
      data.teams.map((t) => t.id),
      judges,
    );
    for (const name of judges) {
      for (const id of runs.get(judgeKey(name)) ?? []) out.set(id, name);
    }
    return out;
  }, [data.teams, judges, split]);
  const mine = useMemo(
    () =>
      me
        ? data.teams.filter(
            (t) => judgeKey(owners.get(t.id) ?? "") === judgeKey(me),
          )
        : [],
    [data.teams, owners, me],
  );
  const scoped = split && scope === "mine" ? mine : data.teams;

  const myScore = (teamId: string) =>
    me
      ? (scoresByTeam
          .get(teamId)
          ?.byJudge.find((j) => judgeKey(j.judge) === judgeKey(me))?.score ??
        null)
      : null;

  const listed = useMemo(
    () => browseTeams(scoped, reviews, { query: search, filter, sort }),
    [scoped, reviews, search, filter, sort],
  );
  const scoredByMe = scoped.filter((t) => myScore(t.id) !== null).length;
  const index = Math.min(at, Math.max(0, scoped.length - 1));
  const current = scoped[index];

  const chooseView = (v: View) => {
    setView(v);
    saveView(v);
  };
  const nextUnscored = () => {
    for (let step = 1; step <= scoped.length; step++) {
      const i = (index + step) % scoped.length;
      if (myScore(scoped[i]!.id) === null) {
        setAt(i);
        return;
      }
    }
  };

  const card = (team: (typeof data.teams)[number]) => (
    <ProjectCard
      team={team}
      review={reviews.get(team.id)}
      saveState={saveState[team.id]}
      onSave={(patch) => onSave(team.id, patch)}
      me={me}
      myScore={myScore(team.id)}
      scores={scoresByTeam.get(team.id)}
      owner={split ? (owners.get(team.id) ?? null) : null}
      onScore={(score) => onScore(team.id, me, score)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          role="group"
          aria-label={copy.view.label}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => chooseView(v)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-dashboard-md px-2 text-sm font-semibold md:min-h-9",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                view === v
                  ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                  : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                pressable,
              )}
            >
              {copy.view[v]}
            </button>
          ))}
        </div>
        {split && (
          <div className="flex flex-col gap-1.5">
            <div
              role="group"
              aria-label={copy.scope.label}
              className="flex flex-wrap gap-1.5"
            >
              <DashboardChip
                selected={scope === "mine"}
                onClick={() => {
                  setScope("mine");
                  setAt(0);
                }}
                className="min-h-11 md:min-h-9"
              >
                {copy.scope.mine(mine.length)}
              </DashboardChip>
              <DashboardChip
                selected={scope === "all"}
                onClick={() => {
                  setScope("all");
                  setAt(0);
                }}
                className="min-h-11 md:min-h-9"
              >
                {copy.scope.all(data.teams.length)}
              </DashboardChip>
            </div>
            <p className="m-0 text-sm text-dashboard-text-light">
              {copy.scope.split(judges.length)}
            </p>
          </div>
        )}
      </div>

      {data.teams.length === 0 ? (
        <Empty>{copy.browse.noTeams(data.sponsorTrack)}</Empty>
      ) : view === "one" ? (
        scoped.length === 0 || !current ? (
          <Empty>{copy.browse.noFilterMatch}</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-sm font-medium text-dashboard-text-medium">
              <span className="tabular-nums">
                {copy.one.position(index + 1, scoped.length)}
              </span>
              <span aria-live="polite" className="tabular-nums">
                {scoredByMe === scoped.length
                  ? copy.one.done(scoped.length)
                  : copy.one.progress(scoredByMe, scoped.length)}
              </span>
            </div>
            <div data-tour="judging-first-project">{card(current)}</div>
            <div className="sticky bottom-[var(--sponsor-tabbar,0px)] z-10 -mx-4 grid grid-cols-[auto_1fr_auto] gap-2 border-t border-dashboard-border-subtle bg-dashboard-bg-page/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
              <DashboardButton
                type="button"
                variant="small"
                disabled={index === 0}
                onClick={() => setAt(index - 1)}
                className="min-h-11 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
              >
                <ChevronLeft aria-hidden className="size-4" />
                {copy.one.previous}
              </DashboardButton>
              <DashboardButton
                type="button"
                disabled={scoredByMe === scoped.length}
                onClick={nextUnscored}
                className="min-h-11 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
              >
                {copy.one.nextUnscored}
              </DashboardButton>
              <DashboardButton
                type="button"
                variant="small"
                disabled={index >= scoped.length - 1}
                onClick={() => setAt(index + 1)}
                className="min-h-11 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
              >
                {copy.one.next}
                <ChevronRight aria-hidden className="size-4" />
              </DashboardButton>
            </div>
          </div>
        )
      ) : (
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
              {copy.browse.count(listed.length, scoped.length)}
            </p>
          </div>
          {listed.length === 0 ? (
            <Empty>
              {search.trim()
                ? copy.browse.noMatch(search.trim())
                : copy.browse.noFilterMatch}
            </Empty>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {listed.map((team, i) => (
                <li
                  key={team.id}
                  data-tour={i === 0 ? "judging-first-project" : undefined}
                >
                  {card(team)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
      {children}
    </p>
  );
}
