import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Check, Search, X } from "lucide-react";

import SEO from "~/components/seo";
import { uuidRegex } from "~/utils/urls";
import { api } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "~/lib/sponsor-picks";
import { cn } from "~/lib/utils";

type PickableTeam = {
  id: string;
  name: string;
  members: string;
};

const CARD =
  "w-full rounded-dashboard-2xl border-[1.5px] bg-dashboard-bg-surface px-4 py-3.5 text-left shadow-dashboard-card transition-colors";
const CARD_OFF =
  "border-dashboard-border-default hover:bg-dashboard-bg-highlight";
const CARD_ON =
  "border-dashboard-action-primary bg-dashboard-bg-highlight ring-1 ring-dashboard-action-primary";
const COUNTER =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold";
const COUNTER_OFF = "bg-dashboard-bg-nav text-dashboard-text-medium";
const COUNTER_ON = "bg-dashboard-action-primary text-dashboard-text-inverse";

export default function SponsorPicksPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // Existing picks from the judging sheet, so a sponsor re-opening their link
  // sees what they already chose. Ready as soon as the uuid is known; seeded
  // into the selection once (see seededFor), later edits stay local until save.
  const existingQ = api.sponsorJudging.getChosenTeams.useQuery(
    { sponsor: uuid },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
    },
  );
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const existingPicks = existingQ.data;
  useEffect(() => {
    if (!existingPicks || seededFor === uuid) return;
    setSeededFor(uuid);
    setSelected(existingPicks.teamIds);
  }, [existingPicks, seededFor, uuid]);

  const save = api.sponsorJudging.setChosenTeams.useMutation();

  // Fetch all teams from the database (gated on this sponsor's private UUID)
  const teamsQ = api.sponsorJudging.listAllTeams.useQuery(
    { sponsor: uuid },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
    },
  );
  const allTeams = useMemo<PickableTeam[]>(
    () => teamsQ.data ?? [],
    [teamsQ.data],
  );

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTeams;
    return allTeams.filter((team) =>
      `${team.name} ${team.members}`.toLowerCase().includes(q),
    );
  }, [query, allTeams]);

  const atMax = selected.length >= MAX_SPONSOR_PICKS;

  function toggle(teamId: string) {
    setSaved(false);
    setSelected((current) => {
      if (current.includes(teamId)) {
        return current.filter((id) => id !== teamId);
      }
      if (current.length >= MAX_SPONSOR_PICKS) return current;
      return [...current, teamId];
    });
  }

  function savePicks() {
    if (selected.length < MIN_SPONSOR_PICKS) return;
    save.mutate(
      { sponsorId: uuid, teamIds: selected },
      { onSuccess: () => setSaved(true) },
    );
  }

  if (!router.isReady) {
    // Keep the layout on first paint (SSR + hydration) instead of a blank page.
    return (
      <Shell>
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-8 w-40 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav" />
          <div className="h-11 w-full animate-pulse rounded-dashboard-md bg-dashboard-bg-nav" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card"
            />
          ))}
        </div>
      </Shell>
    );
  }

  if (!validUuid) {
    return (
      <Shell>
        <div className="rounded-dashboard-2xl bg-dashboard-bg-surface p-5 text-center shadow-dashboard-card">
          <h1 className="dashboard-h1 m-0">Link not recognised</h1>
          <p className="mb-0 mt-2 text-base font-medium leading-relaxed text-dashboard-text-medium">
            This private link isn&apos;t valid. Ask your Hack Western contact
            for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const canSave = selected.length >= MIN_SPONSOR_PICKS && !save.isPending;

  return (
    <Shell
      counter={
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            atMax
              ? "text-dashboard-status-warning"
              : "text-dashboard-text-light",
          )}
        >
          {selected.length} of {MAX_SPONSOR_PICKS} selected · min{" "}
          {MIN_SPONSOR_PICKS}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {validUuid && (
            <Link
              href={`/sponsors/${uuid}`}
              className="mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-dashboard-text-medium hover:text-dashboard-text-heavy"
            >
              <ArrowLeft
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.67}
              />
              Back to sponsor hub
            </Link>
          )}
          {existingQ.data?.sponsorName && (
            <DashboardTag className="self-start">
              {existingQ.data.sponsorName}
            </DashboardTag>
          )}
          <h1 className="dashboard-h1 m-0">Pick your top teams</h1>
          <p className="mb-0 mt-1 text-base font-medium leading-relaxed text-dashboard-text-medium">
            Choose between {MIN_SPONSOR_PICKS} and {MAX_SPONSOR_PICKS} teams.
            You can come back and change your picks any time before judging
            closes.
          </p>
        </div>

        <label className="sr-only" htmlFor="team-search">
          Search teams
        </label>
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-dashboard-text-disabled"
          />
          <input
            id="team-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search teams…"
            className="min-h-11 w-full rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface pl-10 pr-9 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setSearchOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-dashboard-xs p-1 text-dashboard-text-light hover:text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
            >
              <X aria-hidden="true" className="size-4" strokeWidth={1.67} />
            </button>
          )}
        </div>

        {searchOpen && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearchOpen(false);
            }}
            className="-mt-2 self-start bg-transparent p-0 text-sm font-medium text-dashboard-text-link underline"
          >
            Clear search
          </button>
        )}

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {teamsQ.isLoading && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>
                  <div className="h-16 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card" />
                </li>
              ))}
            </>
          )}
          {!teamsQ.isLoading &&
            visibleTeams.map((team) => {
              const on = selected.includes(team.id);
              const disabled = !on && atMax;
              return (
                <li key={team.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggle(team.id)}
                    className={cn(
                      CARD,
                      on ? CARD_ON : CARD_OFF,
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(COUNTER, on ? COUNTER_ON : COUNTER_OFF)}
                      >
                        {on && <Check className="size-4" strokeWidth={2.5} />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                        <span className="truncate text-base font-semibold text-dashboard-text-heavy">
                          {team.name}
                        </span>
                        <span className="truncate text-sm font-medium text-dashboard-text-light">
                          {team.members}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          {!teamsQ.isLoading && visibleTeams.length === 0 && query && (
            <li className="rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium italic text-dashboard-text-medium">
              No teams match &ldquo;{query}&rdquo;.
            </li>
          )}
          {!teamsQ.isLoading && allTeams.length === 0 && !query && (
            <li className="rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium italic text-dashboard-text-medium">
              No teams have been created yet.
            </li>
          )}
        </ul>

        {atMax && (
          <p className="m-0 rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-highlight px-4 py-3 text-sm font-medium leading-relaxed text-dashboard-text-heavy">
            That&apos;s the max of {MAX_SPONSOR_PICKS}. Deselect a team to swap
            in a different one.
          </p>
        )}
      </div>

      {/* Sticky save bar: thumb-reachable on phones, padded above the safe area. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-dashboard-border-subtle bg-dashboard-bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-dashboard-bg-surface/80">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <span className="flex flex-col">
            <span
              className={cn(
                "text-base font-semibold tabular-nums text-dashboard-text-heavy",
                selected.length < MIN_SPONSOR_PICKS &&
                  "text-dashboard-status-warning",
              )}
            >
              {selected.length} / {MAX_SPONSOR_PICKS}
            </span>
            <span className="text-xs font-medium text-dashboard-text-light">
              pick at least {MIN_SPONSOR_PICKS}
            </span>
          </span>
          <DashboardButton
            disabled={!canSave}
            onClick={savePicks}
            className="flex-1 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled sm:max-w-[260px]"
          >
            {save.isPending
              ? "Saving…"
              : save.isError
                ? "Failed — tap to retry"
                : saved
                  ? "Saved"
                  : "Save picks"}
          </DashboardButton>
        </div>
        {save.isError && (
          <p className="m-0 bg-[#fdecea] px-4 pb-3 pt-2 text-center text-sm font-medium text-[#7a1a0f]">
            Couldn&apos;t save your picks. Check your connection and try again.
          </p>
        )}
        {saved && (
          <p className="m-0 px-4 pb-3 text-center text-sm font-medium text-dashboard-status-live">
            Your picks are saved. Changes save only when you tap Save picks.
          </p>
        )}
      </div>
      {/* Room so the last card clears the sticky bar. */}
      <div className="h-32" />
    </Shell>
  );
}

function Shell({
  children,
  counter,
}: {
  children: React.ReactNode;
  counter?: React.ReactNode;
}) {
  return (
    <>
      <SEO title="Sponsor picks" noindex />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-4 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-medium">
              Hack Western 13
            </span>
            {counter}
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
