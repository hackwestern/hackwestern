import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  formatPresentationTime,
  PRESENTATION_PITCH_MINUTES,
  PRESENTATION_QA_MINUTES,
  SHORTLIST_MAX,
} from "~/lib/sponsor-presentations";
import {
  formatAverage,
  formatSubmittedTime,
  teamIdAndLink,
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
  "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  pressable,
);

/**
 * Round 1's shortlist step: the shortlisted teams (remove with X) and
 * "Send shortlist", which hands the list to organizers for scheduling (at
 * most SHORTLIST_MAX, one per presentation slot). Once scheduled, each
 * team shows its presentation time, in time order. Sending again replaces
 * the sent list. Round 2 (ranking) opens on this tab once organizers open
 * it after presentations.
 */
export function ShortlistSend({
  sponsor,
  data,
  reviews,
  onSave,
  onBrowse,
  locked = false,
}: {
  /**
   * Round 2 is open but this sponsor has no presentation slot, so they
   * can't rank (Jazz, 2026-11-18): say so plainly, in place of the
   * "round 2 opens later" note.
   */
  locked?: boolean;
  sponsor: string;
  data: JudgingData;
  reviews: ReadonlyMap<string, TeamReview>;
  onSave: (teamId: string, patch: ReviewPatch) => void;
  onBrowse: () => void;
}) {
  // Team id -> slot start, once presentations are scheduled.
  const startOf = useMemo(
    () => new Map(data.round.slots.map((s) => [s.teamId, s.start])),
    [data.round.slots],
  );
  const shortlist = useMemo(
    () =>
      data.teams
        .filter((t) => reviews.get(t.id)?.shortlisted)
        .map((t) => ({ ...t, score: reviews.get(t.id)?.score ?? null }))
        .sort(
          (a, b) =>
            (startOf.get(a.id) ?? Infinity) - (startOf.get(b.id) ?? Infinity) ||
            (b.score ?? 0) - (a.score ?? 0) ||
            a.name.localeCompare(b.name),
        ),
    [data.teams, reviews, startOf],
  );
  const tooMany = shortlist.length > SHORTLIST_MAX;
  const sent = data.round.shortlistSent;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const changed =
    sent !== null &&
    shortlist
      .map((t) => t.id)
      .sort()
      .join(",") !== [...sent.teamIds].sort().join(",");

  const utils = api.useUtils();
  const send = api.sponsorScoring.sendShortlist.useMutation({
    onSuccess: (res) => {
      utils.sponsorScoring.get.setData({ sponsor }, (old) =>
        old ? { ...old, round: { ...old.round, shortlistSent: res } } : old,
      );
    },
  });

  if (shortlist.length === 0 && !sent && !locked) {
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          {copy.round.sendHeading}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.round.sendIntro(SHORTLIST_MAX)}
        </p>
        {startOf.size > 0 && (
          <p className="m-0 text-sm font-semibold text-dashboard-text-active">
            {copy.round.format(
              PRESENTATION_PITCH_MINUTES,
              PRESENTATION_QA_MINUTES,
            )}
          </p>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shortlist.map((team) => (
          <li
            key={team.id}
            className="flex items-start gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-3 shadow-dashboard-card"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="break-words text-base font-semibold text-dashboard-text-heavy">
                {team.name}
              </span>
              <span className="break-all text-xs font-medium tabular-nums text-dashboard-text-light">
                {teamIdAndLink(team.id, team.devpostUrl)}
              </span>
              <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
                {team.score === null
                  ? copy.shortlist.noScore
                  : copy.shortlist.scoreOf(formatAverage(team.score)!)}
                {startOf.has(team.id) &&
                  ` · ${copy.round.presentsAt(formatPresentationTime(startOf.get(team.id)!))}`}
              </span>
              <ProjectLinks team={team} />
            </div>
            <button
              type="button"
              aria-label={copy.shortlist.remove(team.name)}
              disabled={sent !== null}
              onClick={() => onSave(team.id, { shortlisted: false })}
              className={iconButton}
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <p
        className={cn(
          "m-0 text-sm",
          locked
            ? "rounded-dashboard-lg bg-dashboard-status-iconBadge px-4 py-3 font-semibold text-dashboard-text-warning"
            : "text-dashboard-text-medium",
        )}
      >
        {locked ? copy.round.locked : copy.round.waiting}
      </p>

      <div className="sticky bottom-[var(--sponsor-tabbar,0px)] z-10 -mx-4 border-t border-dashboard-border-subtle bg-dashboard-bg-page/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
        {!data.open ? (
          <p className="m-0 text-sm font-medium text-dashboard-text-medium">
            {copy.submit.closed}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="flex min-w-0 flex-col gap-0.5">
              {sent && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-dashboard-status-live">
                  <CheckCircle2 aria-hidden className="size-4" />
                  {copy.round.sentAt(
                    formatSubmittedTime(sent.sentAt),
                    sent.teamIds.length,
                  )}
                </span>
              )}
              {changed && (
                <span className="text-sm font-medium text-dashboard-text-medium">
                  {copy.round.changed}
                </span>
              )}
              {tooMany && (
                <span className="text-sm font-medium text-dashboard-status-warning">
                  {copy.round.tooMany(SHORTLIST_MAX, shortlist.length)}
                </span>
              )}
              {send.isError && (
                <span className="text-sm font-medium text-dashboard-status-warning">
                  {send.error.data?.code === "BAD_REQUEST"
                    ? send.error.message
                    : copy.round.sendFailed}
                </span>
              )}
            </div>
            <DashboardButton
              disabled={
                send.isPending ||
                shortlist.length === 0 ||
                tooMany ||
                sent !== null
              }
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
            >
              {send.isPending ? copy.round.sending : copy.round.send}
            </DashboardButton>
          </div>
        )}
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed z-50 inset-x-0 bottom-0 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-dashboard-2xl bg-dashboard-bg-surface p-5 shadow-dashboard-card focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[560px] sm:rounded-dashboard-2xl sm:p-6">
            <Dialog.Title className="m-0 text-xl font-semibold text-dashboard-text-heavy">
              {copy.shortlistSubmitConfirm.title}
            </Dialog.Title>
            <Dialog.Description className="m-0 text-sm leading-relaxed text-dashboard-text-medium">
              {copy.shortlistSubmitConfirm.body(shortlist.length)}
            </Dialog.Description>
            <ol className="m-0 max-h-60 list-decimal overflow-y-auto pl-5 text-sm font-medium text-dashboard-text-heavy">
              {shortlist.map((team) => (
                <li key={team.id} className="py-1">{team.name}</li>
              ))}
            </ol>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <DashboardButton variant="small" disabled={send.isPending}>
                  Go back
                </DashboardButton>
              </Dialog.Close>
              <DashboardButton
                disabled={send.isPending}
                onClick={() => {
                  send.mutate({ sponsor }, {
                    onSuccess: () => setConfirmOpen(false),
                  });
                }}
              >
                {send.isPending
                  ? copy.round.sending
                  : copy.shortlistSubmitConfirm.confirm}
              </DashboardButton>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
