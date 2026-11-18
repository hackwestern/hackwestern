import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, TriangleAlert } from "lucide-react";
import {
  DashboardButton,
  dashboardButtonVariants,
} from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { PresentationsPanel } from "~/components/sponsors/organizer/presentations-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { sponsorColorIndexes } from "~/lib/sponsor-colors";
import { formatAverage, formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

const copy = sponsorJudgingCopy.organizer;
const VIEWS = ["sponsors", "teams"] as const;
type View = (typeof VIEWS)[number];
type Overview = RouterOutputs["sponsorScoring"]["overview"];

const REFRESH_MS = 30_000;

const devpostLink = cn(
  dashboardButtonVariants({ variant: "link" }),
  "shrink-0",
);

/**
 * Organizer "Sponsor judging" tab (?tab=judging): each sponsor's progress
 * and final results (submitted top list in rank order with each team's
 * hackers and the submit time), or every team ranked by how many sponsors put it
 * in their top list and its average score. Organizer-only
 * (sponsorScoring.overview); `sponsor` highlights one sponsor's card.
 */
export function JudgingTab({ sponsor }: { sponsor: string | null }) {
  const overview = api.sponsorScoring.overview.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    retry: 1,
  });
  const [view, setView] = useState<View>("sponsors");
  const refs = useRef(new Map<View, HTMLButtonElement>());
  const data = overview.data;
  const colors = useMemo(
    () => sponsorColorIndexes((data?.sponsors ?? []).map((s) => s.name)),
    [data],
  );

  if (overview.isLoading) {
    return (
      <div
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (!data) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.loadFailed}
        </p>
        <DashboardButton
          variant="small"
          onClick={() => void overview.refetch()}
        >
          {copy.retry}
        </DashboardButton>
      </DashboardPanel>
    );
  }

  const choose = (v: View, focus = false) => {
    setView(v);
    if (focus) refs.current.get(v)?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <PresentationsPanel colors={colors} />
      {data.unsyncedCount > 0 && (
        <p
          role="status"
          className="m-0 flex items-start gap-2 rounded-dashboard-lg bg-dashboard-status-iconBadge px-4 py-3 text-sm font-semibold text-dashboard-text-warning"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {copy.unsynced(data.unsyncedCount)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm font-medium text-dashboard-text-medium">
          {copy.intro(data.finalTop)}
        </p>
        <div
          role="tablist"
          aria-label={copy.viewsLabel}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            choose(view === "sponsors" ? "teams" : "sponsors", true);
          }}
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              ref={(el) => {
                if (el) refs.current.set(v, el);
                else refs.current.delete(v);
              }}
              type="button"
              role="tab"
              id={`judging-view-${v}`}
              aria-selected={view === v}
              aria-controls="judging-view-panel"
              tabIndex={view === v ? 0 : -1}
              onClick={() => choose(v)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-dashboard-md px-3 text-sm font-semibold md:min-h-9",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                view === v
                  ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                  : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                pressable,
              )}
            >
              {copy.views[v]}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="judging-view-panel"
        aria-labelledby={`judging-view-${view}`}
        className="min-w-0"
      >
        {view === "sponsors" ? (
          <BySponsor data={data} colors={colors} focus={sponsor} />
        ) : (
          <AllTeams data={data} colors={colors} />
        )}
      </div>
    </div>
  );
}

function BySponsor({
  data,
  colors,
  focus,
}: {
  data: Overview;
  colors: ReadonlyMap<string, number>;
  focus: string | null;
}) {
  if (data.sponsors.length === 0) {
    return <Empty>{copy.noSponsors}</Empty>;
  }
  const focusKey = focus?.toLowerCase() ?? null;
  return (
    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
      {data.sponsors.map((s) => {
        const focused =
          focusKey !== null &&
          (s.sponsorId.toLowerCase() === focusKey ||
            s.name.toLowerCase() === focusKey);
        return (
          <li key={s.sponsorId}>
            <section
              aria-labelledby={`judging-${s.sponsorId}`}
              className={cn(
                "flex h-full flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card",
                focused && "ring-2 ring-dashboard-action-primary",
              )}
            >
              <div className="flex items-start gap-2.5">
                <SponsorBadge
                  name={s.name}
                  colors={colors}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3
                    id={`judging-${s.sponsorId}`}
                    className="m-0 break-words text-base font-semibold text-dashboard-text-heavy"
                  >
                    {s.name}
                  </h3>
                  {s.final ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-dashboard-status-live">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 aria-hidden className="size-4" />
                        {copy.submittedAt(
                          formatSubmittedTime(s.final.submittedAt),
                        )}
                      </span>
                      {!s.final.sheetSynced && (
                        <span className="inline-flex items-center gap-1 rounded-dashboard-sm bg-dashboard-status-iconBadge px-2 py-0.5 text-xs font-semibold leading-5 text-dashboard-text-warning">
                          <TriangleAlert aria-hidden className="size-3.5" />
                          {copy.sheetPending}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-dashboard-text-light">
                      {copy.notYet}
                    </span>
                  )}
                </div>
              </div>
              <p className="m-0 text-sm font-medium tabular-nums text-dashboard-text-medium">
                {copy.scored(s.scored)} · {copy.shortlisted(s.shortlisted)}
              </p>
              {s.final && (
                <ol className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
                  {s.final.teams.map((t, i) => (
                    <li
                      key={t.teamId}
                      className="flex items-start gap-2.5 py-2"
                    >
                      <span className="inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight px-1.5 text-xs font-bold tabular-nums text-dashboard-text-active">
                        {copy.rankOf(i + 1)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span
                          className={cn(
                            "break-words text-sm font-semibold",
                            t.eligible
                              ? "text-dashboard-text-heavy"
                              : "text-dashboard-text-light line-through",
                          )}
                        >
                          {t.name}
                        </span>
                        {!t.eligible && (
                          <span className="text-xs font-semibold text-dashboard-text-warning">
                            {copy.ineligible}
                          </span>
                        )}
                        {t.members.length > 0 ? (
                          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                            {t.members.map((m) => (
                              <li
                                key={m.userId}
                                className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-dashboard-text-medium"
                              >
                                <HackerAvatar
                                  name={m.name}
                                  github={m.github}
                                  size="sm"
                                />
                                <span className="break-words">{m.name}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs font-medium text-dashboard-text-light">
                            {copy.noMembers}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-dashboard-text-light">
                        {t.score === null
                          ? copy.noScore
                          : copy.scoreOf(t.score)}
                      </span>
                      {t.devpostUrl && (
                        <a
                          href={t.devpostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={copy.openDevpost(t.name)}
                          className={cn(devpostLink, "-mr-2")}
                        >
                          <ExternalLink aria-hidden className="size-4" />
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </li>
        );
      })}
    </ul>
  );
}

function AllTeams({
  data,
  colors,
}: {
  data: Overview;
  colors: ReadonlyMap<string, number>;
}) {
  if (data.teams.length === 0) {
    return <Empty>{copy.noTeams}</Empty>;
  }
  const cols = copy.columns;
  return (
    <>
      {/* Phones: one card per team, nothing scrolls sideways. */}
      <ol className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
        {data.teams.map((t, i) => {
          const avg = formatAverage(t.averageScore);
          return (
            <li
              key={t.teamId}
              className="flex items-start gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight text-xs font-bold tabular-nums text-dashboard-text-active">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="break-words text-base font-semibold leading-7 text-dashboard-text-heavy">
                  {t.name}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-dashboard-text-medium">
                  {cols.inTop(data.finalTop)}:{" "}
                  {copy.inTopCount(t.topSponsors.length)}
                  {t.topSponsors.map((name) => (
                    <span key={name} title={name} className="inline-flex">
                      <SponsorBadge name={name} colors={colors} />
                      <span className="sr-only">{name}</span>
                    </span>
                  ))}
                </span>
                <span className="text-sm font-medium tabular-nums text-dashboard-text-medium">
                  {cols.average}:{" "}
                  {avg ? copy.averageOf(avg, t.scoreCount) : copy.noAverage}
                </span>
              </div>
              {t.devpostUrl && (
                <a
                  href={t.devpostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.openDevpost(t.name)}
                  className={cn(devpostLink, "-mr-2 -mt-2")}
                >
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              )}
            </li>
          );
        })}
      </ol>
      <div className="hidden overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-dashboard-border-default text-dashboard-text-light">
              <th scope="col" className="w-12 px-4 py-3 font-semibold">
                {cols.rank}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {cols.team}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {cols.inTop(data.finalTop)}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {cols.average}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">{cols.links}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t, i) => {
              const avg = formatAverage(t.averageScore);
              return (
                <tr
                  key={t.teamId}
                  className="border-b border-dashboard-border-subtle last:border-b-0"
                >
                  <td className="px-4 py-2.5 font-bold tabular-nums text-dashboard-text-medium">
                    {i + 1}
                  </td>
                  <th
                    scope="row"
                    className="break-words px-4 py-2.5 font-semibold text-dashboard-text-heavy"
                  >
                    {t.name}
                  </th>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold tabular-nums text-dashboard-text-heavy">
                        {t.topSponsors.length}
                      </span>
                      {t.topSponsors.map((name) => (
                        <span key={name} title={name} className="inline-flex">
                          <SponsorBadge name={name} colors={colors} />
                          <span className="sr-only">{name}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-dashboard-text-medium">
                    {avg ? copy.averageOf(avg, t.scoreCount) : copy.noAverage}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {t.devpostUrl && (
                      <a
                        href={t.devpostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={copy.openDevpost(t.name)}
                        className={devpostLink}
                      >
                        {copy.devpost}
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
      {children}
    </p>
  );
}
