import { useState } from "react";
import Link from "next/link";
import { Check, Coffee, Plus, Users } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HackerLinks } from "~/components/sponsors/hacker-links";
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
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: copy.filterAll },
    { value: "shortlisted", label: copy.filterShortlisted },
    { value: "not", label: copy.filterNotShortlisted },
  ];

  return (
    <section
      id="interested"
      aria-labelledby="interested-heading"
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="interested-heading"
          className="m-0 text-xl font-semibold text-dashboard-text-heavy"
        >
          {copy.heading}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">
          {fromForm ? copy.introForm : copy.intro}
        </p>
      </div>
      {data.showSource && !fromForm && (
        <p className="m-0 rounded-dashboard-md border border-dashboard-border-muted p-3 text-sm text-dashboard-text-light">
          {copy.sourceNote}
        </p>
      )}
      <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-medium">
        {copy.shortlistHint}
      </p>

      {hackers.length === 0 ? (
        <DashboardPanel className="items-center text-center">
          <Users
            aria-hidden
            className="size-6 text-dashboard-text-light"
            strokeWidth={1.67}
          />
          <p className="m-0 text-base text-dashboard-text-medium">
            {fromForm ? copy.emptyForm : copy.empty}
          </p>
        </DashboardPanel>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 flex flex-col text-sm text-dashboard-text-light">
              <span className="font-semibold text-dashboard-text-medium">
                {copy.shortlistCount(picked, hackers.length)}
              </span>
              <span>{copy.shortlistCap(data.maxShortlist)}</span>
            </p>
            <div
              role="group"
              aria-label={copy.filterLabel}
              className="flex flex-wrap gap-2"
            >
              {filters.map((f) => (
                <DashboardChip
                  key={f.value}
                  selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className="h-11"
                >
                  {f.label}
                </DashboardChip>
              ))}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="m-0 rounded-dashboard-md bg-dashboard-status-iconBadge p-3 text-sm font-medium text-dashboard-text-warning"
            >
              {error}
            </p>
          )}

          {shown.length === 0 ? (
            <DashboardPanel className="text-center">
              <p className="m-0 text-base text-dashboard-text-medium">
                {filter === "not"
                  ? copy.noneNotShortlisted
                  : copy.noneShortlisted}
              </p>
            </DashboardPanel>
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
    <DashboardPanel
      className={cn(
        "gap-3 p-4 sm:p-5",
        on && "ring-2 ring-dashboard-action-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-label={copy.rankLabel(hacker.rank)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight text-sm font-semibold tabular-nums text-dashboard-text-active"
          >
            {copy.rank(hacker.rank)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 break-words text-lg font-semibold text-dashboard-text-heavy">
              {name}
            </h3>
            {hacker.shared ? (
              <span className="break-words text-sm text-dashboard-text-light">
                {hacker.team ?? copy.noTeam}
              </span>
            ) : (
              <span className="text-sm text-dashboard-text-light">
                {copy.notShared}
              </span>
            )}
            {hacker.pick !== null && (
              <DashboardTag className="mt-1 self-start">
                {copy.pick(hacker.pick)}
              </DashboardTag>
            )}
          </div>
        </div>
        <DashboardButton
          type="button"
          variant="outline"
          aria-pressed={on}
          onClick={onToggle}
          className={cn(
            "h-11 shrink-0",
            on &&
              "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse hover:bg-dashboard-text-active",
          )}
        >
          {on ? <Check aria-hidden /> : <Plus aria-hidden />}
          {copy.shortlist}
          <span className="sr-only"> {name}</span>
        </DashboardButton>
      </div>
      <HackerLinks name={name} links={hacker} />
      {on && (
        <DashboardButton asChild className="sm:w-auto md:h-11 md:w-full">
          <Link
            href={`/sponsors/${sponsor}/scan?hacker=${encodeURIComponent(hacker.userId)}`}
            aria-label={copy.offerLabel(name)}
          >
            <Coffee aria-hidden />
            {copy.offer}
          </Link>
        </DashboardButton>
      )}
    </DashboardPanel>
  );
}
