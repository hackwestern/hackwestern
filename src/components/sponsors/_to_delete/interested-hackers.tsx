import { useState } from "react";
import Link from "next/link";
import { Check, Coffee, Plus, Users } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { hover, press } from "~/components/internals/interaction";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorHackersCopy as copy } from "~/content/sponsor-hackers";
import { cn } from "~/lib/utils";
import type { InterestedHacker } from "~/server/api/routers/sponsor-shortlist";
import type { CandidateSource } from "~/server/api/utils/sponsor-shortlist";
import { api } from "~/utils/api";

type ListData = {
  sponsorName: string;
  hackers: InterestedHacker[];
  maxShortlist: number;
  source: CandidateSource;
  showSource: boolean;
};

type Filter = "all" | "shortlisted" | "not";

/**
 * "Candidates" on the sponsor's coffee chats page: up to 40 hackers, best
 * first, each with a Shortlist toggle. Shortlisted hackers get an Offer
 * coffee chat button that opens the scan page's offer flow for them.
 * Toggles update the list at once and roll back if the server says no.
 * `announce` speaks the result through the page's status region.
 */
export function InterestedHackers({
  sponsor,
  data,
  announce,
}: {
  sponsor: string;
  data: ListData;
  announce: (message: string) => void;
}) {
  const utils = api.useUtils();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const setShortlisted = (userId: string, shortlisted: boolean) =>
    utils.sponsorShortlist.list.setData({ sponsor }, (old) =>
      old
        ? {
            ...old,
            hackers: old.hackers.map((h) =>
              h.userId === userId ? { ...h, shortlisted } : h,
            ),
          }
        : old,
    );

  const handlers = (shortlisted: boolean) => ({
    onMutate: async ({ userId }: { userId: string }) => {
      setError(null);
      await utils.sponsorShortlist.list.cancel({ sponsor });
      const previous = utils.sponsorShortlist.list.getData({ sponsor });
      setShortlisted(userId, shortlisted);
      return { previous };
    },
    onError: (
      err: { data?: { code?: string } | null },
      { userId }: { userId: string },
      context?: { previous?: ListData },
    ) => {
      if (context?.previous) {
        utils.sponsorShortlist.list.setData({ sponsor }, context.previous);
      }
      const name = nameOf(data.hackers, userId);
      const message =
        err.data?.code === "CONFLICT"
          ? copy.shortlistFull(data.maxShortlist)
          : copy.toggleError(name);
      setError(message);
      announce(message);
    },
    onSuccess: (_: unknown, { userId }: { userId: string }) => {
      const name = nameOf(data.hackers, userId);
      announce(shortlisted ? copy.added(name) : copy.removed(name));
    },
    onSettled: () => utils.sponsorShortlist.list.invalidate({ sponsor }),
  });

  const add = api.sponsorShortlist.add.useMutation(handlers(true));
  const remove = api.sponsorShortlist.remove.useMutation(handlers(false));

  const toggle = (hacker: InterestedHacker) => {
    const input = { sponsor, userId: hacker.userId };
    if (hacker.shortlisted) remove.mutate(input);
    else add.mutate(input);
  };

  const { hackers } = data;
  const fromForm = data.source === "interestForm";
  const picked = hackers.filter((h) => h.shortlisted).length;
  const shown = hackers.filter((h) =>
    filter === "all"
      ? true
      : filter === "shortlisted"
        ? h.shortlisted
        : !h.shortlisted,
  );
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: copy.filterAll, count: hackers.length },
    { value: "shortlisted", label: copy.filterShortlisted, count: picked },
    {
      value: "not",
      label: copy.filterNotShortlisted,
      count: hackers.length - picked,
    },
  ];
  const fill = Math.min(1, picked / Math.max(1, data.maxShortlist));

  return (
    <section
      id="interested"
      aria-labelledby="interested-heading"
      className="flex scroll-mt-20 flex-col gap-4"
    >
      <h2 id="interested-heading" className="sr-only">
        {copy.heading}
      </h2>
      <p className="m-0 text-base text-dashboard-text-medium">
        {fromForm ? copy.introForm : copy.intro}
      </p>
      {data.showSource && !fromForm && (
        <p className="m-0 rounded-dashboard-lg border border-dashboard-border-muted p-3 text-sm text-dashboard-text-light">
          {copy.sourceNote}
        </p>
      )}

      {hackers.length === 0 ? (
        <DashboardPanel className="items-center gap-2 rounded-dashboard-2xl py-10 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-dashboard-bg-inset">
            <Users
              aria-hidden
              className="size-6 text-dashboard-text-light"
              strokeWidth={1.67}
            />
          </span>
          <p className="m-0 max-w-[400px] text-base text-dashboard-text-medium">
            {fromForm ? copy.emptyForm : copy.empty}
          </p>
        </DashboardPanel>
      ) : (
        <>
          {/* Shortlist progress: count, cap and a bar toward the cap. */}
          <div className="flex flex-col gap-2 rounded-dashboard-2xl bg-dashboard-bg-surface p-4 shadow-dashboard-card">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-base font-semibold text-dashboard-text-heavy">
                {copy.shortlistCount(picked, hackers.length)}
              </span>
              <span className="text-sm text-dashboard-text-light">
                {copy.shortlistCap(data.maxShortlist)}
              </span>
            </div>
            <div
              aria-hidden
              className="h-1.5 w-full overflow-hidden rounded-full bg-dashboard-bg-nav"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-dashboard-action-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${fill})` }}
              />
            </div>
            <p className="m-0 text-sm text-dashboard-text-medium">
              {copy.shortlistHint}
            </p>
          </div>

          {/* Filters: small segmented pills with counts, like the day
              pills on the schedule header ("Shortlisted 4"). */}
          <div
            role="group"
            aria-label={copy.filterLabel}
            className="inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-full bg-dashboard-bg-inset p-0.5"
          >
            {filters.map((f) => {
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={copy.filterCount(f.label, f.count)}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-11 cursor-pixel-hover items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-figtree text-sm font-semibold leading-none sm:h-8 sm:text-xs",
                    press,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1",
                    on
                      ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                      : cn("text-dashboard-text-medium", hover.surface),
                  )}
                >
                  {f.label}
                  <span
                    aria-hidden
                    className={cn(
                      "tabular-nums",
                      on ? "opacity-80" : "text-dashboard-text-light",
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p
              role="alert"
              className="m-0 rounded-dashboard-lg bg-dashboard-status-iconBadge p-3 text-sm font-medium text-dashboard-text-warning"
            >
              {error}
            </p>
          )}

          {shown.length === 0 ? (
            <p className="m-0 rounded-dashboard-2xl bg-dashboard-bg-inset p-6 text-center text-base text-dashboard-text-medium">
              {filter === "not"
                ? copy.noneNotShortlisted
                : copy.noneShortlisted}
            </p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {shown.map((h) => (
                <li key={h.userId}>
                  <HackerCard
                    sponsor={sponsor}
                    hacker={h}
                    onToggle={() => toggle(h)}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function nameOf(hackers: InterestedHacker[], userId: string) {
  return hackers.find((h) => h.userId === userId)?.name ?? copy.unnamed;
}

function HackerCard({
  sponsor,
  hacker,
  onToggle,
}: {
  sponsor: string;
  hacker: InterestedHacker;
  onToggle: () => void;
}) {
  const name = hacker.name || copy.unnamed;
  const on = hacker.shortlisted;

  return (
    <article
      aria-labelledby={`hacker-${hacker.userId}`}
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-2xl border bg-dashboard-bg-surface p-4 shadow-dashboard-card transition-colors duration-150 ease-out motion-reduce:transition-none sm:p-5",
        on ? "border-dashboard-action-primary" : "border-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          {/* Only shared profiles carry a GitHub link, so no consent
              means initials, never a photo. */}
          <HackerAvatar
            name={name}
            github={hacker.shared ? hacker.github : null}
            size="lg"
          />
          <span
            aria-label={copy.rankLabel(hacker.rank)}
            className="absolute -bottom-1 -right-1 inline-flex min-w-6 items-center justify-center rounded-full border-2 border-dashboard-bg-surface bg-dashboard-text-heavy px-1 text-xs font-semibold tabular-nums leading-5 text-dashboard-text-inverse"
          >
            {copy.rank(hacker.rank)}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3
            id={`hacker-${hacker.userId}`}
            className="m-0 break-words text-lg font-semibold leading-snug text-dashboard-text-heavy"
          >
            {name}
          </h3>
          <span className="break-words text-sm text-dashboard-text-light">
            {hacker.shared ? (hacker.team ?? copy.noTeam) : copy.notShared}
          </span>
          {hacker.pick !== null && (
            <span className="mt-1 self-start rounded-dashboard-sm bg-dashboard-bg-highlight px-2 py-0.5 text-xs font-medium text-dashboard-text-active">
              {copy.pick(hacker.pick)}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-pressed={on}
          onClick={onToggle}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-dashboard-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 [&_svg]:size-4",
            on
              ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse [@media(hover:hover)]:hover:bg-dashboard-text-active"
              : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
            pressable,
          )}
        >
          {on ? <Check aria-hidden /> : <Plus aria-hidden />}
          {copy.shortlist}
          <span className="sr-only"> {name}</span>
        </button>
      </div>
      <HackerLinks name={name} links={hacker} />
      {on && (
        <Link
          href={`/sponsors/${sponsor}/scan?hacker=${encodeURIComponent(hacker.userId)}`}
          aria-label={copy.offerLabel(name)}
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-dashboard-lg bg-dashboard-action-primary px-4 text-base font-semibold text-dashboard-text-inverse shadow-dashboard-primary-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 [@media(hover:hover)]:hover:bg-dashboard-text-active",
            pressable,
          )}
        >
          <Coffee aria-hidden className="size-4" />
          {copy.offer}
        </Link>
      )}
    </article>
  );
}
