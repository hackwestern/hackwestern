import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  formatAverage,
  formatSubmittedTime,
  teamIdAndLink,
  initialRanking,
  moveItem,
  reconcileRanking,
  type TeamReview,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { ProjectLinks } from "./project-card";
import { type JudgingData, type ReviewPatch } from "./use-sponsor-judging";

const copy = sponsorJudgingCopy;

const iconButton = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy md:size-9",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
  "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  pressable,
);

/**
 * Round 2 ranking: by default the shortlisted teams; once presentations
 * are scheduled, `presented` (team id -> "10:05 AM") limits it to the
 * teams that presented, shows their time, and hides Remove. Teams in rank
 * order, moved with up/down
 * buttons (focus follows the moved team; the new place is announced), the
 * first `finalTop` above a line, and Submit top N with a confirm step.
 * Once submitted it shows "Submitted 10:42 AM" until the ranking changes.
 */
export function ShortlistRanking({
  sponsor,
  data,
  reviews,
  onSave,
  onBrowse,
  presented,
}: {
  sponsor: string;
  data: JudgingData;
  reviews: ReadonlyMap<string, TeamReview>;
  onSave: (teamId: string, patch: ReviewPatch) => void;
  onBrowse: () => void;
  presented?: ReadonlyMap<string, string>;
}) {
  const top = data.finalTop;
  const shortlist = useMemo(
    () =>
      data.teams
        .filter((t) =>
          presented ? presented.has(t.id) : reviews.get(t.id)?.shortlisted,
        )
        .map((t) => ({ ...t, score: reviews.get(t.id)?.score ?? null })),
    [data.teams, reviews, presented],
  );
  const byId = useMemo(
    () => new Map(shortlist.map((t) => [t.id, t])),
    [shortlist],
  );
  const submitted = data.final?.teamIds ?? [];

  const [order, setOrder] = useState<string[]>(() =>
    initialRanking(shortlist, submitted),
  );
  // Teams shortlisted or removed elsewhere join at the end or drop out.
  const shortlistKey = shortlist.map((t) => t.id).join(",");
  useEffect(() => {
    setOrder((o) =>
      reconcileRanking(o, shortlistKey ? shortlistKey.split(",") : []),
    );
  }, [shortlistKey]);

  const [confirming, setConfirming] = useState(false);
  const [announce, setAnnounce] = useState("");
  const moveRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const utils = api.useUtils();
  const submit = api.sponsorScoring.submit.useMutation({
    onSuccess: (res) => {
      setConfirming(false);
      utils.sponsorScoring.get.setData({ sponsor }, (old) =>
        old ? { ...old, final: res } : old,
      );
    },
  });

  const picks = order.slice(0, top);
  const canSubmit = order.length >= top && data.open;
  const matchesSubmitted =
    data.final !== null &&
    picks.length === submitted.length &&
    picks.every((id, i) => submitted[i] === id);

  const move = (index: number, delta: number, dir: "up" | "down") => {
    const id = order[index];
    if (!id) return;
    const next = moveItem(order, index, delta);
    setOrder(next);
    setConfirming(false);
    const rank = next.indexOf(id) + 1;
    setAnnounce(copy.shortlist.moved(byId.get(id)?.name ?? "", rank));
    // Keep focus on the same team's button after it moves; at an end,
    // hand it to the other direction.
    requestAnimationFrame(() => {
      const atEnd =
        (dir === "up" && rank === 1) ||
        (dir === "down" && rank === next.length);
      const key = `${id}:${atEnd ? (dir === "up" ? "down" : "up") : dir}`;
      moveRefs.current.get(key)?.focus();
    });
  };

  if (shortlist.length === 0 && presented) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.round.noPresenters}
        </p>
      </DashboardPanel>
    );
  }
  if (shortlist.length === 0) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.shortlist.empty}
        </p>
        <DashboardButton variant="small" onClick={onBrowse}>
          {copy.shortlist.browse}
        </DashboardButton>
      </DashboardPanel>
    );
  }

  return (
    <div data-tour="judging-rank" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          {presented ? copy.round.presentedHeading : copy.shortlist.heading}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">
          {presented
            ? copy.round.presentedIntro(top)
            : copy.shortlist.intro(top)}
        </p>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {order.map((id, i) => {
          const team = byId.get(id);
          if (!team) return null;
          const inTop = i < top;
          return (
            <li key={id} className="flex flex-col gap-2">
              {i === 0 && (
                <span className="dashboard-section-label text-dashboard-text-active">
                  {copy.shortlist.cutLine(top)}
                </span>
              )}
              {i === top && (
                <span className="dashboard-section-label mt-2 border-t border-dashed border-dashboard-border-strong pt-3 text-dashboard-text-light">
                  {copy.shortlist.belowLine}
                </span>
              )}
              <div
                className={cn(
                  "flex items-start gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-3 shadow-dashboard-card",
                  !inTop && "opacity-80",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                    inTop
                      ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                      : "bg-dashboard-bg-nav text-dashboard-text-medium",
                  )}
                >
                  {i < top
                    ? copy.shortlist.placeShort(i + 1)
                    : copy.shortlist.rank(i + 1)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* leading-7 matches the rank badge, so the badge sits
                      on the first line of a long name. */}
                  <span className="break-words text-base font-semibold leading-7 text-dashboard-text-heavy">
                    {team.name}
                  </span>
                  <span className="break-all text-xs font-medium tabular-nums text-dashboard-text-light">
                    {teamIdAndLink(team.id, team.devpostUrl)}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
                    {team.score === null
                      ? copy.shortlist.noScore
                      : copy.shortlist.scoreOf(formatAverage(team.score)!)}
                    {presented?.get(id) &&
                      ` · ${copy.round.presentsAt(presented.get(id)!)}`}
                  </span>
                  <ProjectLinks team={team} />
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button
                    type="button"
                    ref={(el) => {
                      moveRefs.current.set(`${id}:up`, el);
                    }}
                    aria-label={copy.shortlist.moveUp(team.name)}
                    disabled={i === 0}
                    onClick={() => move(i, -1, "up")}
                    className={iconButton}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    ref={(el) => {
                      moveRefs.current.set(`${id}:down`, el);
                    }}
                    aria-label={copy.shortlist.moveDown(team.name)}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1, "down")}
                    className={iconButton}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  {!presented && (
                    <button
                      type="button"
                      aria-label={copy.shortlist.remove(team.name)}
                      onClick={() => onSave(id, { shortlisted: false })}
                      className={iconButton}
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Submit, or the confirm step. Sticky so it's thumb-reachable. */}
      <div className="sticky bottom-[var(--sponsor-tabbar,0px)] z-10 -mx-4 border-t border-dashboard-border-subtle bg-dashboard-bg-page/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
        {!data.open ? (
          <p className="m-0 text-sm font-medium text-dashboard-text-medium">
            {copy.submit.closed}
          </p>
        ) : confirming ? (
          <div
            className="flex flex-col gap-3"
            role="group"
            aria-labelledby="confirm-title"
          >
            <div className="flex flex-col gap-1">
              <h3
                id="confirm-title"
                className="m-0 text-base font-semibold text-dashboard-text-heavy"
              >
                {copy.submit.confirmTitle(top)}
              </h3>
              <ol className="m-0 list-decimal pl-5 text-sm font-medium text-dashboard-text-heavy">
                {picks.map((id) => (
                  <li key={id} className="break-words">
                    {byId.get(id)?.name}
                  </li>
                ))}
              </ol>
              <p className="m-0 text-sm text-dashboard-text-medium">
                {copy.submit.confirmBody}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DashboardButton
                variant="small"
                onClick={() => setConfirming(false)}
                disabled={submit.isPending}
              >
                {copy.submit.cancel}
              </DashboardButton>
              <DashboardButton
                onClick={() => submit.mutate({ sponsor, teamIds: picks })}
                disabled={submit.isPending}
                className="disabled:opacity-dashboard-disabled"
              >
                {submit.isPending
                  ? copy.submit.submitting
                  : copy.submit.confirm}
              </DashboardButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="flex min-w-0 flex-col gap-0.5">
              {data.final && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-dashboard-status-live">
                  <CheckCircle2 aria-hidden className="size-4" />
                  {copy.submit.submittedAt(
                    formatSubmittedTime(data.final.submittedAt),
                  )}
                </span>
              )}
              {data.final && !data.final.sheetSynced && (
                <span className="text-sm font-medium text-dashboard-status-warning">
                  {copy.submit.sheetPending}
                </span>
              )}
              {data.final && data.final.ineligibleCount > 0 ? (
                <span className="text-sm font-medium text-dashboard-status-warning">
                  {copy.submit.teamGone(data.final.ineligibleCount)}
                </span>
              ) : (
                data.final &&
                !matchesSubmitted && (
                  <span className="text-sm font-medium text-dashboard-text-medium">
                    {copy.submit.changed}
                  </span>
                )
              )}
              {order.length < top && (
                <span className="text-sm font-medium text-dashboard-text-medium">
                  {copy.shortlist.needMore(top, order.length)}
                </span>
              )}
              {submit.isError && (
                <span className="text-sm font-medium text-dashboard-status-warning">
                  {submit.error.data?.code === "BAD_REQUEST"
                    ? submit.error.message
                    : copy.submit.failed}
                </span>
              )}
            </div>
            <DashboardButton
              disabled={
                !canSubmit ||
                (matchesSubmitted && data.final?.sheetSynced === true)
              }
              onClick={() => setConfirming(true)}
              className="shrink-0 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
            >
              {data.final ? copy.submit.resubmit(top) : copy.submit.button(top)}
            </DashboardButton>
          </div>
        )}
      </div>
    </div>
  );
}
