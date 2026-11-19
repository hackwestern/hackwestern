import { useState } from "react";
import { CircleCheck, ScanLine } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { LoadError, ScheduleSkeleton } from "~/components/sponsors/schedule-states";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import type { InterestedHacker, ScannedHacker } from "~/server/api/routers/sponsor-shortlist";
import { api } from "~/utils/api";
import { cardClass, LinkButton, StepFooter, useAnnounce } from "./shared";

const copy = sponsorSetupCopy.shortlist;

type View = "one" | "list";
type Filter = "shortlisted" | "not" | "all";

/**
 * The shortlist flow: one list, made by one person on the sponsor login
 * (no "who's shortlisting" picker). Opens once chatting preferences are
 * submitted; capped at the sponsor's hacker seats. Scanned hackers are
 * listed first: we invite them first anyway.
 */
export function ShortlistFlow({
  sponsor,
  step,
  prefsHref,
  pickHref,
  reviewHref,
  homeHref,
}: {
  sponsor: string;
  step: 1 | 2;
  prefsHref: string;
  pickHref: string;
  reviewHref: string;
  homeHref: string;
}) {
  const utils = api.useUtils();
  const q = api.sponsorShortlist.list.useQuery({ sponsor }, { retry: 1, refetchOnWindowFocus: false });
  const { announce, region } = useAnnounce();
  const [view, setView] = useState<View>("one");
  const [filter, setFilter] = useState<Filter>("shortlisted");
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    await Promise.all([
      utils.sponsorShortlist.list.invalidate({ sponsor }),
      utils.coffeeChatSetup.get.invalidate({ sponsor }),
    ]);
  };
  const onError = (e: { message: string }) => {
    const msg = e.message || copy.toggleError;
    setError(msg);
    announce(msg);
  };
  const add = api.sponsorShortlist.add.useMutation({ onError });
  const remove = api.sponsorShortlist.remove.useMutation({ onError });
  const submit = api.sponsorShortlist.submit.useMutation({
    onSuccess: async () => {
      await refresh();
      announce(copy.submitted);
    },
    onError,
  });
  const reopen = api.sponsorShortlist.reopen.useMutation({ onSuccess: refresh, onError });

  if (q.isLoading) return <ScheduleSkeleton />;
  if (!q.data) return <LoadError onRetry={() => void q.refetch()} />;
  const data = q.data;

  if (!data.prefsSubmitted) {
    return (
      <section className={cardClass}>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.locked}</p>
        <LinkButton href={prefsHref}>{copy.goPrefs}</LinkButton>
      </section>
    );
  }

  const picked = data.hackers.filter((h) => h.shortlisted);
  const max = data.maxShortlist;
  const full = data.picked >= max;
  const over = data.picked > max;
  const submitted = !!data.submittedAt;
  const busy = add.isPending || remove.isPending;

  const toggle = (h: InterestedHacker) => {
    setError(null);
    if (h.shortlisted) {
      remove.mutate(
        { sponsor, userId: h.userId },
        { onSuccess: () => void refresh().then(() => announce(copy.removed(h.name))) },
      );
    } else {
      add.mutate(
        { sponsor, userId: h.userId },
        { onSuccess: () => void refresh().then(() => announce(copy.added(h.name))) },
      );
    }
  };

  const seats = (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-base text-dashboard-text-medium">
        <span className="text-xl font-bold text-dashboard-text-heavy">{copy.seats(data.picked, max)}</span>{" "}
        {copy.seatsSuffix}
      </p>
      <p className="m-0 text-sm text-dashboard-text-light">
        {copy.capLine(data.seats, data.scanned.length, max)}
      </p>
      {over && (
        <p role="alert" className="m-0 text-base font-semibold text-dashboard-text-warning">
          {sponsorSetupCopy.errors.overCap(data.picked, max)}
        </p>
      )}
      {data.sent && <p className="m-0 text-sm text-dashboard-text-medium">{copy.sentNote}</p>}
    </div>
  );

  const scannedSection = data.scanned.length > 0 && (
    <section aria-labelledby="scanned-heading" className="flex flex-col gap-2 rounded-dashboard-md bg-dashboard-bg-highlight p-3">
      <h3 id="scanned-heading" className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy">
        <ScanLine aria-hidden className="size-4" />
        {copy.scannedHeading}
      </h3>
      <p className="m-0 text-sm text-dashboard-text-medium">{copy.scannedNote}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {data.scanned.map((h) => (
          <ScannedRow key={h.userId} hacker={h} />
        ))}
      </ul>
    </section>
  );

  const submittedBanner = submitted && (
    <div className="flex flex-col gap-3 rounded-dashboard-md bg-dashboard-bg-highlight p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy">
        <CircleCheck aria-hidden className="size-5 shrink-0 text-dashboard-status-live" />
        {copy.lockedSubmitted}
      </p>
      <DashboardButton
        variant="outline"
        className={cn("h-11 text-base", pressable)}
        aria-disabled={reopen.isPending || undefined}
        onClick={() => !reopen.isPending && reopen.mutate({ sponsor })}
      >
        {copy.edit}
      </DashboardButton>
    </div>
  );

  if (step === 2) {
    return (
      <section className={cardClass} aria-labelledby="sl-review">
        {region}
        <h2 id="sl-review" className="m-0 text-xl font-semibold text-dashboard-text-heavy">{copy.reviewHeading}</h2>
        {submittedBanner}
        {seats}
        {scannedSection}
        {picked.length === 0 ? (
          <p className="m-0 text-base text-dashboard-text-medium">{copy.reviewEmpty}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {picked.map((h) => (
              <HackerRow key={h.userId} hacker={h} disabled={busy || submitted} canAdd={!full} onToggle={() => toggle(h)} />
            ))}
          </ul>
        )}
        {error && <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">{error}</p>}
        <StepFooter
          back={<LinkButton href={pickHref} variant="outline">{sponsorSetupCopy.backStep}</LinkButton>}
          primary={
            submitted ? (
              <LinkButton href={homeHref}>{sponsorSetupCopy.back}</LinkButton>
            ) : (
              <DashboardButton
                className={cn("min-h-11 md:h-11", pressable, over && "opacity-dashboard-disabled")}
                aria-disabled={submit.isPending || over || undefined}
                onClick={() => !submit.isPending && !over && submit.mutate({ sponsor })}
              >
                {submit.isPending ? copy.submitting : copy.submit}
              </DashboardButton>
            )
          }
        />
      </section>
    );
  }

  const queue = data.hackers.filter((h) => !h.shortlisted && !skipped.has(h.userId));
  const current = queue[0];
  const listed = data.hackers.filter((h) =>
    filter === "all" ? true : filter === "shortlisted" ? h.shortlisted : !h.shortlisted,
  );

  return (
    <section className={cardClass} aria-labelledby="sl-pick">
      {region}
      <h2 id="sl-pick" className="sr-only">{copy.steps[0]}</h2>
      <ol className="m-0 flex list-none flex-col gap-2 rounded-dashboard-md border border-dashboard-border-default p-3">
        {copy.how.map((line, i) => (
          <li key={line} className="flex items-start gap-2 text-base text-dashboard-text-medium">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-dashboard-action-primary text-xs font-semibold text-dashboard-text-inverse">
              {i + 1}
            </span>
            {line}
          </li>
        ))}
      </ol>
      {submittedBanner}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {seats}
        <div role="radiogroup" aria-label={copy.viewLabel} className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1">
          {(["one", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-11 rounded-dashboard-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                view === v ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card" : "text-dashboard-text-medium",
                pressable,
              )}
            >
              {v === "one" ? copy.oneAtATime : copy.list}
            </button>
          ))}
        </div>
      </div>
      {max === 0 && <p className="m-0 text-base text-dashboard-text-warning">{copy.noSeats}</p>}
      {full && max > 0 && <p className="m-0 text-sm text-dashboard-text-medium">{copy.full(max)}</p>}

      {scannedSection}

      {view === "one" ? (
        data.hackers.length === 0 ? (
          <p className="m-0 text-base text-dashboard-text-medium">{copy.nobody}</p>
        ) : current ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
            <p className="m-0 text-sm text-dashboard-text-light">{copy.left(queue.length)}</p>
            <HackerCard hacker={current} />
            <div className="grid grid-cols-2 gap-2">
              <DashboardButton
                variant="outline"
                className={cn("h-12 text-base font-semibold", pressable)}
                onClick={() => setSkipped((s) => new Set(s).add(current.userId))}
              >
                {copy.skip}
              </DashboardButton>
              <DashboardButton
                className={cn("h-12 md:h-12", pressable, (full || submitted) && "opacity-dashboard-disabled")}
                aria-disabled={busy || full || submitted || undefined}
                aria-label={copy.addLabel(current.name)}
                onClick={() => !busy && !full && !submitted && toggle(current)}
              >
                {copy.add}
              </DashboardButton>
            </div>
          </div>
        ) : (
          <p className="m-0 text-base text-dashboard-text-medium">{copy.allSeen}</p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
            {(["shortlisted", "not", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  filter === f
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium",
                  pressable,
                )}
              >
                {copy.filters[f]}
              </button>
            ))}
          </div>
          {listed.length === 0 ? (
            <p className="m-0 text-base text-dashboard-text-medium">
              {filter === "shortlisted" ? copy.noneShortlisted : filter === "not" ? copy.noneLeft : copy.nobody}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {listed.map((h) => (
                <HackerRow key={h.userId} hacker={h} disabled={busy || submitted} canAdd={!full} onToggle={() => toggle(h)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">{error}</p>}

      <StepFooter
        back={<LinkButton href={homeHref} variant="outline">{sponsorSetupCopy.back}</LinkButton>}
        primary={<LinkButton href={reviewHref}>{copy.reviewNext}</LinkButton>}
      />
    </section>
  );
}

/** "Western University · Computer Science · 3rd year", when shared. */
function studyLine(h: { school?: string | null; program?: string | null; year?: string | null }) {
  return [h.school, h.program, h.year ? copy.year(h.year) : null].filter(Boolean).join(" · ");
}

function HackerCard({ hacker }: { hacker: InterestedHacker }) {
  return (
    <article className="flex flex-col gap-3 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface p-4">
      <div className="flex items-center gap-3">
        <HackerAvatar name={hacker.name} github={hacker.github} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h3 className="m-0 break-words text-lg font-semibold text-dashboard-text-heavy">{hacker.name}</h3>
          <span className="text-sm text-dashboard-text-light">
            {hacker.shared ? (hacker.team ?? copy.noTeam) : copy.notShared}
          </span>
        </div>
      </div>
      {studyLine(hacker) && <p className="m-0 text-base text-dashboard-text-medium">{studyLine(hacker)}</p>}
      <HackerLinks name={hacker.name} links={hacker} />
    </article>
  );
}

function HackerRow({
  hacker,
  disabled,
  canAdd,
  onToggle,
}: {
  hacker: InterestedHacker;
  disabled: boolean;
  canAdd: boolean;
  onToggle: () => void;
}) {
  const blocked = disabled || (!hacker.shortlisted && !canAdd);
  return (
    <li className="flex flex-col gap-2 border-b border-dashboard-border-subtle py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <HackerAvatar name={hacker.name} github={hacker.github} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="break-words text-base font-semibold text-dashboard-text-heavy">{hacker.name}</span>
          <span className="text-sm text-dashboard-text-light">
            {hacker.shared ? (hacker.team ?? copy.noTeam) : copy.notShared}
          </span>
          {studyLine(hacker) && <span className="text-sm text-dashboard-text-medium">{studyLine(hacker)}</span>}
        </span>
        <DashboardButton
          variant={hacker.shortlisted ? "outline" : "small"}
          className={cn("h-11 shrink-0", pressable, blocked && "opacity-dashboard-disabled")}
          aria-disabled={blocked || undefined}
          aria-label={hacker.shortlisted ? copy.removeLabel(hacker.name) : copy.addLabel(hacker.name)}
          onClick={() => !blocked && onToggle()}
        >
          {hacker.shortlisted ? copy.remove : copy.add}
        </DashboardButton>
      </div>
      <HackerLinks name={hacker.name} links={hacker} />
    </li>
  );
}

function ScannedRow({ hacker }: { hacker: ScannedHacker }) {
  return (
    <li className="flex items-center gap-3 rounded-dashboard-md bg-dashboard-bg-surface p-2">
      <HackerAvatar name={hacker.name} github={hacker.github} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-base font-semibold text-dashboard-text-heavy">{hacker.name}</span>
        <span className="text-xs text-dashboard-text-light">
          {[copy.scannedTag, hacker.repName ? copy.scannedBy(hacker.repName) : null, studyLine(hacker) || null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </li>
  );
}
