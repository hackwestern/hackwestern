import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, GripVertical, Plus, Search, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  PRESENTATION_PITCH_MINUTES,
  PRESENTATION_QA_MINUTES,
} from "~/lib/sponsor-presentations";
import {
  formatAverage,
  formatSubmittedTime,
  minPicks,
  type TeamReview,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { ProjectLinks } from "./project-card";
import { type JudgingData, type ReviewPatch } from "./use-sponsor-judging";

const copy = sponsorJudgingCopy;

const iconButton = cn(
  "inline-flex size-9 shrink-0 items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy sm:size-9",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
  "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  pressable,
);

/**
 * Round 2 ranking: by default the shortlisted teams; once presentations
 * are scheduled, `presented` (team id -> "10:05 AM") limits it to the
 * teams that presented, shows their time, and hides Remove. Teams fill five
 * fixed slots; each slot opens a chooser and filled slots drag to reorder,
 * then the sponsor submits the top N.
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
  const shortlist = useMemo(
    () =>
      data.teams
        .filter((t) =>
          presented ? presented.has(t.id) : reviews.get(t.id)?.shortlisted,
        )
        .map((t) => ({ ...t, score: reviews.get(t.id)?.score ?? null })),
    [data.teams, reviews, presented],
  );
  // Fewer than five teams presented: rank all of them.
  const top = Math.min(data.finalTop, shortlist.length);
  const byId = useMemo(
    () => new Map(shortlist.map((t) => [t.id, t])),
    [shortlist],
  );
  const submitted = data.final?.teamIds ?? [];
  const initialIds =
    data.top5Draft ??
    submitted.filter((id) => shortlist.some((team) => team.id === id));
  const [topIds, setTopIds] = useState<(string | null)[]>(() =>
    Array.from({ length: top }, (_, i) => initialIds[i] ?? null),
  );
  const [selectionSlot, setSelectionSlot] = useState<number | null>(null);
  const [selectionQuery, setSelectionQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchDrag = useRef<{ id: string; from: number } | null>(null);

  // Keep the place number stable: if a team becomes unavailable, clear only
  // that slot instead of filling it or shifting the remaining picks.
  const shortlistKey = shortlist.map((t) => t.id).join(",");
  useEffect(() => {
    setTopIds((current) => {
      const available = new Set(shortlistKey ? shortlistKey.split(",") : []);
      return Array.from({ length: top }, (_, i) =>
        current[i] && available.has(current[i]) ? current[i] : null,
      );
    });
  }, [shortlistKey, top]);

  const [confirming, setConfirming] = useState(false);
  const [announce, setAnnounce] = useState("");
  const canEdit = data.final === null;
  const [draftState, setDraftState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const draftKey = topIds.map((id) => id ?? "").join("|");
  const firstDraftSave = useRef(true);

  const utils = api.useUtils();
  const saveDraft = api.sponsorScoring.saveTop5Draft.useMutation({
    onMutate: () => setDraftState("saving"),
    onSuccess: (_res, vars) => {
      setDraftState("saved");
      utils.sponsorScoring.get.setData({ sponsor }, (old) =>
        old ? { ...old, top5Draft: vars.teamIds } : old,
      );
    },
    onError: () => setDraftState("error"),
  });
  const submit = api.sponsorScoring.submit.useMutation({
    onSuccess: (res) => {
      setConfirming(false);
      utils.sponsorScoring.get.setData({ sponsor }, (old) =>
        old ? { ...old, final: res } : old,
      );
    },
  });

  useEffect(() => {
    if (!canEdit) return;
    if (firstDraftSave.current) {
      firstDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveDraft.mutate({
        sponsor,
        // The draft always has five places.
        teamIds: Array.from(
          { length: data.finalTop },
          (_, i) => topIds[i] ?? null,
        ),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftKey, sponsor, saveDraft.mutate, topIds, canEdit, data.finalTop]);

  const picks = topIds.filter((id): id is string => id !== null);
  const enoughPicks = picks.length >= minPicks(top);
  const hasGaps = picks.some((id, index) => topIds[index] !== id);
  const canSubmit = canEdit && enoughPicks && !hasGaps && data.open;
  const matchesSubmitted =
    data.final !== null &&
    picks.length === submitted.length &&
    picks.every((id, i) => submitted[i] === id);

  const openSelection = (index: number) => {
    if (!canEdit) return;
    setSelectionSlot(index);
    setSelectionQuery("");
  };

  const chooseTeam = (teamId: string) => {
    if (!canEdit) return;
    if (selectionSlot === null) return;
    const target = selectionSlot;
    const oldId = topIds[target] ?? null;
    const from = topIds.indexOf(teamId);
    const next = [...topIds];
    if (from >= 0) {
      next[from] = oldId;
    }
    next[target] = teamId;
    setTopIds(next);
    setAnnounce(
      copy.shortlist.selected(byId.get(teamId)?.name ?? teamId, target + 1),
    );
    setConfirming(false);
    setSelectionSlot(null);
  };

  const clearSlot = (index: number) => {
    if (!canEdit) return;
    const next = [...topIds];
    next[index] = null;
    setTopIds(next);
    setConfirming(false);
  };

  const reorder = (from: number, to: number) => {
    if (!canEdit) return;
    if (from === to) return;
    const next = [...topIds];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id ?? null);
    // Keep the full set of draft slots.
    setTopIds(Array.from({ length: top }, (_, i) => next[i] ?? null));
    setConfirming(false);
    if (id) {
      setAnnounce(copy.shortlist.moved(byId.get(id)?.name ?? id, to + 1));
    }
  };

  const beginTouchDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    id: string,
    from: number,
  ) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDrag.current = { id, from };
    setDraggedId(id);
    setDragOverIndex(from);
  };

  const moveTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!touchDrag.current) return;
    const at = document.elementFromPoint(event.clientX, event.clientY);
    const slot = at?.closest("[data-top-slot]");
    const target = slot?.getAttribute("data-top-slot");
    if (target !== null && target !== undefined) {
      setDragOverIndex(Number(target));
    }
  };

  const endTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!touchDrag.current) return;
    event.preventDefault();
    const drag = touchDrag.current;
    const at = document.elementFromPoint(event.clientX, event.clientY);
    const slot = at?.closest("[data-top-slot]");
    const target = slot?.getAttribute("data-top-slot");
    if (target !== null && target !== undefined) {
      reorder(drag.from, Number(target));
    }
    touchDrag.current = null;
    setDraggedId(null);
    setDragOverIndex(null);
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          {presented ? copy.round.presentedHeading : copy.shortlist.heading}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">
          {presented
            ? copy.round.presentedIntro(minPicks(top), top)
            : copy.shortlist.intro(top)}
        </p>
        {presented && (
          <p className="m-0 text-sm font-semibold text-dashboard-text-active">
            {copy.round.format(
              PRESENTATION_PITCH_MINUTES,
              PRESENTATION_QA_MINUTES,
            )}
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">
            {copy.shortlist.slotsHeading}
          </h3>
          <span
            aria-live="polite"
            className={cn(
              "min-w-20 text-right text-xs font-medium",
              draftState === "error"
                ? "text-dashboard-status-warning"
                : "text-dashboard-text-light",
            )}
          >
            {draftState === "saving"
              ? copy.saving
              : draftState === "error"
                ? copy.saveFailed
                : copy.saved}
          </span>
        </div>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.shortlist.slotsIntro}
        </p>
      </div>

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {(canEdit ? topIds : submitted).map((id, index) => {
          const team = id ? byId.get(id) : null;
          return (
            <li
              key={`slot-${index}`}
              data-top-slot={index}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId =
                  draggedId ?? event.dataTransfer.getData("text/plain");
                const from = topIds.indexOf(sourceId);
                if (from >= 0) reorder(from, index);
                setDraggedId(null);
                setDragOverIndex(null);
              }}
              className={cn(
                "flex items-stretch gap-1.5 rounded-dashboard-2xl border bg-dashboard-bg-surface p-1.5 shadow-dashboard-card sm:gap-2 sm:p-2",
                team
                  ? "border-dashboard-border-default"
                  : "border-dashed border-dashboard-border-strong",
                draggedId === id && "opacity-60",
                dragOverIndex === index &&
                  draggedId !== id &&
                  "ring-2 ring-dashboard-action-primary ring-offset-2",
              )}
            >
              <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 self-stretch">
                <span className="mx-1 flex h-11 w-11 items-center justify-center rounded-full bg-dashboard-action-primary text-sm font-bold tabular-nums text-dashboard-text-inverse">
                  {index + 1}
                </span>
                {team && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Drag ${team.name} to reorder`}
                    draggable
                    onDragStart={(event) => {
                      setDraggedId(team.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", team.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverIndex(null);
                    }}
                    onPointerDown={(event) =>
                      beginTouchDrag(event, team.id, index)
                    }
                    onPointerMove={moveTouchDrag}
                    onPointerUp={endTouchDrag}
                    onPointerCancel={() => {
                      touchDrag.current = null;
                      setDraggedId(null);
                      setDragOverIndex(null);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowLeft"
                      ) {
                        event.preventDefault();
                        if (index > 0) reorder(index, index - 1);
                      } else if (
                        event.key === "ArrowDown" ||
                        event.key === "ArrowRight"
                      ) {
                        event.preventDefault();
                        if (index < top - 1) reorder(index, index + 1);
                      }
                    }}
                    className="inline-flex size-9 cursor-grab touch-none items-center justify-center rounded-dashboard-md text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary active:cursor-grabbing [@media(hover:hover)]:hover:bg-dashboard-bg-highlight"
                  >
                    <GripVertical aria-hidden className="size-5" />
                  </span>
                )}
              </div>

              {team ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSelection(index)}
                      className={cn(
                        "flex min-w-0 items-start gap-2 rounded-dashboard-md px-1 py-1 text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                        pressable,
                      )}
                      aria-label={copy.shortlist.choose(index + 1)}
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="break-words text-base font-semibold text-dashboard-text-heavy">
                          {team.name}
                        </span>
                        <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
                          {team.score === null
                            ? copy.shortlist.noScore
                            : copy.shortlist.scoreOf(
                                formatAverage(team.score)!,
                              )}
                        </span>
                      </span>
                    </button>
                    <ProjectLinks team={team} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openSelection(index)}
                  className={cn(
                    "flex min-h-20 min-w-0 flex-1 items-center justify-center gap-2 rounded-dashboard-md px-3 text-sm font-semibold text-dashboard-text-active",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    pressable,
                  )}
                >
                  <Plus aria-hidden className="size-5" />
                  {copy.shortlist.addTeam}
                </button>
              )}

              {team && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={copy.shortlist.clearTeam}
                    onClick={() => clearSlot(index)}
                    className={iconButton}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <Dialog.Root
        open={selectionSlot !== null}
        onOpenChange={(open) => {
          if (!open) setSelectionSlot(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-dashboard-2xl bg-dashboard-bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[560px] sm:rounded-dashboard-2xl sm:pb-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Dialog.Title className="m-0 text-xl font-semibold">
                  {copy.shortlist.chooseTitle}
                </Dialog.Title>
                <Dialog.Description className="m-0 text-sm text-dashboard-text-light">
                  {selectionSlot !== null
                    ? copy.shortlist.choose(selectionSlot + 1)
                    : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={copy.submit.cancel}
                className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight"
              >
                <X aria-hidden className="size-5" />
              </Dialog.Close>
            </div>

            <label className="relative block">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-text-light"
              />
              <span className="sr-only">{copy.shortlist.chooseSearch}</span>
              <input
                type="search"
                value={selectionQuery}
                onChange={(event) => setSelectionQuery(event.target.value)}
                placeholder={copy.shortlist.chooseSearch}
                className="min-h-11 w-full rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface py-2 pl-10 pr-3 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              />
            </label>

            <div className="flex flex-col gap-2">
              {shortlist
                .filter((team) =>
                  team.name
                    .toLowerCase()
                    .includes(selectionQuery.trim().toLowerCase()),
                )
                .map((team) => {
                  const selected = topIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => chooseTeam(team.id)}
                      className={cn(
                        "flex min-h-14 items-start gap-3 rounded-dashboard-lg border px-3 py-2 text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                        selected
                          ? "border-dashboard-action-primary bg-dashboard-bg-highlight"
                          : "border-dashboard-border-default bg-dashboard-bg-surface [@media(hover:hover)]:hover:border-dashboard-border-strong",
                        pressable,
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="break-words text-base font-semibold text-dashboard-text-heavy">
                          {team.name}
                        </span>
                      </span>
                      {selected && (
                        <span className="shrink-0 rounded-full bg-dashboard-action-primary px-2 text-xs font-semibold leading-5 text-dashboard-text-inverse">
                          {copy.shortlist.selectedTeam}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Submit, or the confirm step. Sticky so it's thumb-reachable. */}
      <div className="sticky bottom-[var(--sponsor-tabbar,0px)] z-10 -mx-4 border-t border-dashboard-border-subtle bg-dashboard-bg-page/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
        {!data.open ? (
          <p className="m-0 text-sm font-medium text-dashboard-text-medium">
            {copy.submit.closed}
          </p>
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
              {canEdit && !enoughPicks && (
                <span className="text-sm font-medium text-dashboard-text-medium">
                  {copy.shortlist.needMore(minPicks(top), picks.length)}
                </span>
              )}
              {canEdit && enoughPicks && hasGaps && (
                <span className="text-sm font-medium text-dashboard-text-medium">
                  {copy.shortlist.fillGaps}
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
              disabled={!canSubmit || data.final !== null}
              onClick={() => setConfirming(true)}
              className="shrink-0 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
            >
              {canEdit && enoughPicks
                ? copy.submit.button(picks.length)
                : copy.submit.finalPicks}
            </DashboardButton>
          </div>
        )}
      </div>

      <Dialog.Root open={confirming} onOpenChange={setConfirming}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-dashboard-2xl bg-dashboard-bg-surface p-5 shadow-dashboard-card focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[560px] sm:rounded-dashboard-2xl sm:p-6">
            <Dialog.Title className="m-0 text-xl font-semibold text-dashboard-text-heavy">
              {copy.submit.confirmTitle(picks.length)}
            </Dialog.Title>
            <Dialog.Description className="m-0 text-sm leading-relaxed text-dashboard-text-medium">
              {copy.submit.confirmBody}
            </Dialog.Description>
            <ol className="m-0 list-decimal pl-5 text-sm font-medium text-dashboard-text-heavy">
              {picks.map((id) => (
                <li key={id} className="py-1">
                  {byId.get(id)?.name}
                </li>
              ))}
            </ol>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <DashboardButton variant="small" disabled={submit.isPending}>
                  {copy.submit.cancel}
                </DashboardButton>
              </Dialog.Close>
              <DashboardButton
                onClick={() => submit.mutate({ sponsor, teamIds: picks })}
                disabled={!canSubmit || submit.isPending}
              >
                {submit.isPending
                  ? copy.submit.submitting
                  : copy.submit.confirm}
              </DashboardButton>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
