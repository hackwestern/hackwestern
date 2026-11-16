import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorInterestCopy as copy } from "~/content/sponsor-interest";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const iconButton = cn(
  "inline-flex size-11 shrink-0 cursor-pixel-hover items-center justify-center rounded-dashboard-md text-dashboard-text-medium transition-colors",
  "hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
  "disabled:pointer-events-none disabled:opacity-dashboard-disabled",
  "[&_svg]:size-4",
);

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Hackers rank the sponsors they'd like to meet (top pick first). Sponsors
// see the hackers who picked them, if the hacker agreed to share their
// profile on their application. Hidden for anyone who isn't an admitted
// hacker (organizers also see the Sponsors tab).
export default function SponsorInterest({ className }: { className?: string }) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const q = api.sponsorInterest.get.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchOnWindowFocus: false,
  });
  const save = api.sponsorInterest.save.useMutation({
    onSuccess: () => utils.sponsorInterest.get.invalidate(),
  });

  const [ranking, setRanking] = useState<string[] | null>(null);
  useEffect(() => {
    if (q.data && ranking === null) setRanking(q.data.ranking);
  }, [q.data, ranking]);

  if (q.isError) {
    return (
      <DashboardPanel className={className}>
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.loadError}
        </p>
      </DashboardPanel>
    );
  }
  if (!q.data || ranking === null) {
    return q.isLoading && session?.user?.id ? (
      <div
        aria-busy="true"
        className={cn(
          "h-64 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card",
          className,
        )}
      />
    ) : null;
  }
  if (!q.data.canRank) return null;

  const data = q.data;
  const others = data.sponsors.filter((s) => !ranking.includes(s));
  const dirty = !sameOrder(ranking, data.ranking);

  const move = (i: number, by: -1 | 1) => {
    const next = [...ranking];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    setRanking(next);
    save.reset();
  };
  const remove = (name: string) => {
    setRanking(ranking.filter((s) => s !== name));
    save.reset();
  };
  const add = (name: string) => {
    setRanking([...ranking, name]);
    save.reset();
  };

  let status: string | null = null;
  if (save.isError) status = copy.saveError;
  else if (dirty) status = copy.unsaved;
  else if (save.isSuccess)
    status = data.sharesWithSponsors ? copy.saved : copy.savedNotShared;

  return (
    <DashboardPanel className={cn("gap-5 p-4 md:p-6", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="dashboard-section-label text-dashboard-text-light">
          {copy.eyebrow}
        </span>
        <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          {copy.title}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.intro}</p>
      </div>

      {!data.sharesWithSponsors && (
        <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-medium">
          {copy.notShared}
        </p>
      )}

      {data.sponsors.length === 0 ? (
        <p className="m-0 text-base text-dashboard-text-light">
          {copy.noSponsors}
        </p>
      ) : (
        <>
          <section
            aria-labelledby="sponsor-interest-ranked"
            className="flex flex-col gap-2"
          >
            <h3
              id="sponsor-interest-ranked"
              className="m-0 text-sm font-semibold text-dashboard-text-heavy"
            >
              {copy.rankedHeading}
            </h3>
            {ranking.length === 0 ? (
              <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-light">
                {copy.rankedEmpty}
              </p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {ranking.map((name, i) => (
                  <li
                    key={name}
                    className="flex min-h-14 items-center gap-1 rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-highlight py-1 pl-3 pr-1"
                  >
                    <span className="w-6 shrink-0 text-sm font-semibold text-dashboard-action-primary">
                      {copy.rank(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-base font-semibold text-dashboard-text-heavy">
                      {name}
                    </span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={copy.moveUpLabel(name)}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={copy.moveDownLabel(name)}
                      disabled={i === ranking.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={copy.removeLabel(name)}
                      onClick={() => remove(name)}
                    >
                      <X aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section
            aria-labelledby="sponsor-interest-others"
            className="flex flex-col gap-2"
          >
            <h3
              id="sponsor-interest-others"
              className="m-0 text-sm font-semibold text-dashboard-text-heavy"
            >
              {copy.othersHeading}
            </h3>
            {others.length === 0 ? (
              <p className="m-0 text-sm text-dashboard-text-light">
                {copy.othersEmpty}
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                {others.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      aria-label={copy.addLabel(name)}
                      onClick={() => add(name)}
                      className={cn(
                        "flex min-h-11 w-full cursor-pixel-hover items-center justify-between gap-3 rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2 text-left font-figtree text-base font-medium text-dashboard-text-heavy transition-colors",
                        "hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                      )}
                    >
                      <span className="min-w-0 break-words">{name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-dashboard-text-link">
                        <Plus aria-hidden className="size-4" />
                        {copy.add}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <DashboardButton
              disabled={!dirty || save.isPending}
              className="disabled:opacity-dashboard-disabled"
              onClick={() => save.mutate({ ranking })}
            >
              {save.isPending ? copy.saving : copy.save}
            </DashboardButton>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "m-0 min-h-5 text-sm",
                save.isError
                  ? "text-dashboard-status-warning"
                  : "text-dashboard-text-light",
              )}
            >
              {status}
            </p>
          </div>
        </>
      )}
    </DashboardPanel>
  );
}
