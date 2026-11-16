import { useState } from "react";
import { Check, Plus, Users } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { sponsorHackersCopy as copy } from "~/content/sponsor-hackers";
import { cn } from "~/lib/utils";
import type { InterestedHacker } from "~/server/api/routers/sponsor-shortlist";
import { api } from "~/utils/api";

type ListData = {
  sponsorName: string;
  hackers: InterestedHacker[];
  maxShortlist: number;
};

/**
 * "Interested hackers" on the sponsor's coffee chats page: hackers who
 * ranked this sponsor, each with a Shortlist toggle. Toggles update the list
 * at once and roll back if the server says no. `announce` speaks the result
 * through the page's status region.
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
  const [onlyShortlisted, setOnlyShortlisted] = useState(false);
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
  const picked = hackers.filter((h) => h.shortlisted).length;
  const shown = onlyShortlisted
    ? hackers.filter((h) => h.shortlisted)
    : hackers;

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
        <p className="m-0 text-base text-dashboard-text-medium">{copy.intro}</p>
      </div>
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
            {copy.empty}
          </p>
        </DashboardPanel>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-dashboard-text-medium">
              {copy.shortlistCount(picked, hackers.length)}
            </p>
            <div
              role="group"
              aria-label={copy.filterLabel}
              className="flex gap-2"
            >
              <DashboardChip
                selected={!onlyShortlisted}
                onClick={() => setOnlyShortlisted(false)}
                className="h-11"
              >
                {copy.filterAll}
              </DashboardChip>
              <DashboardChip
                selected={onlyShortlisted}
                onClick={() => setOnlyShortlisted(true)}
                className="h-11"
              >
                {copy.filterShortlisted}
              </DashboardChip>
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
                {copy.noneShortlisted}
              </p>
            </DashboardPanel>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {shown.map((h) => (
                <li key={h.userId}>
                  <HackerCard hacker={h} onToggle={() => toggle(h)} />
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
  hacker,
  onToggle,
}: {
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
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 break-words text-lg font-semibold text-dashboard-text-heavy">
            {name}
          </h3>
          <span className="break-words text-sm text-dashboard-text-light">
            {hacker.team ?? copy.noTeam}
          </span>
          <DashboardTag className="mt-1 self-start">
            {copy.pick(hacker.rank)}
          </DashboardTag>
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
    </DashboardPanel>
  );
}
