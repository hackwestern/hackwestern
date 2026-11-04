import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import SEO from "~/components/seo";
import { api } from "~/utils/api";

const MIN_PICKS = 5;
const MAX_PICKS = 10;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PickableTeam = {
  id: string;
  name: string;
  members: string;
};

const CARD = "w-full rounded-2xl border-[1.5px] bg-white px-4 py-3.5 text-left";
const CARD_OFF = "border-[#d6dbe5] active:bg-[#f6f3f9]";
const CARD_ON = "border-[#a16bc7] bg-[#f6f3f9] shadow-[0_0_0_1px_#a16bc7]";
const COUNTER =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold";
const COUNTER_OFF = "bg-[#eef1f6] text-[#4a5d73]";
const COUNTER_ON = "bg-[#a16bc7] text-white";

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

  // Fetch all teams from the database
  const teamsQ = api.sponsorJudging.listAllTeams.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const allTeams: PickableTeam[] = teamsQ.data ?? [];

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTeams;
    return allTeams.filter((team) =>
      `${team.name} ${team.members}`.toLowerCase().includes(q),
    );
  }, [query, allTeams]);

  const atMax = selected.length >= MAX_PICKS;

  function toggle(teamId: string) {
    setSaved(false);
    setSelected((current) => {
      if (current.includes(teamId)) {
        return current.filter((id) => id !== teamId);
      }
      if (current.length >= MAX_PICKS) return current;
      return [...current, teamId];
    });
  }

  function savePicks() {
    if (selected.length < MIN_PICKS) return;
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
          <div className="h-8 w-40 animate-pulse rounded bg-[#e3e7ef]" />
          <div className="h-11 w-full animate-pulse rounded-[10px] bg-[#e3e7ef]" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-[#e3e7ef]" />
          ))}
        </div>
      </Shell>
    );
  }

  if (!validUuid) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-5 text-center">
          <h1 className="m-0 text-lg font-bold">Link not recognised</h1>
          <p className="mb-0 mt-2 text-sm leading-[1.5] text-[#4a5d73]">
            This private link isn&apos;t valid. Ask your Hack Western contact
            for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const canSave = selected.length >= MIN_PICKS && !save.isPending;

  return (
    <Shell
      counter={
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            atMax ? "text-[#b4570b]" : "text-[#4a5d73]"
          }`}
        >
          {selected.length} of {MAX_PICKS} selected · min {MIN_PICKS}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          {validUuid && (
            <Link
              href={`/sponsors/${uuid}`}
              className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#5b3fa0] hover:underline"
            >
              ← Back to sponsor hub
            </Link>
          )}
          {existingQ.data?.sponsorName && (
            <p className="m-0 text-[15px] font-bold text-[#0b2238]">
              {existingQ.data.sponsorName}
            </p>
          )}
          <h1 className="m-0 text-[26px] font-bold leading-tight">
            Pick your top teams
          </h1>
          <p className="mb-0 mt-1.5 text-[15px] leading-[1.5] text-[#4a5d73]">
            Choose between {MIN_PICKS} and {MAX_PICKS} teams.
            You can come back and change your picks any time before judging
            closes.
          </p>
        </div>

        <label className="sr-only" htmlFor="team-search">
          Search teams
        </label>
        <input
          id="team-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search teams…"
          className="min-h-11 w-full rounded-[10px] border-[1.5px] border-[#c3cad8] bg-white px-3 text-[16px] placeholder:text-[#bbb3c0] focus:border-[#a16bc7] focus:outline-none focus:ring-2 focus:ring-[#e1c8fa]"
        />

        {searchOpen && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearchOpen(false);
            }}
            className="-mt-2 self-start bg-transparent p-0 text-[14px] font-semibold text-[#a16bc7] underline"
          >
            Clear search
          </button>
        )}

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {teamsQ.isLoading && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>
                  <div className="h-16 w-full animate-pulse rounded-2xl bg-[#e3e7ef]" />
                </li>
              ))}
            </>
          )}
          {!teamsQ.isLoading && visibleTeams.map((team) => {
            const on = selected.includes(team.id);
            const disabled = !on && atMax;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggle(team.id)}
                  className={`${CARD} ${
                    on ? CARD_ON : CARD_OFF
                  } ${disabled ? "opacity-50" : "cursor-pointer"}`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`${COUNTER} ${
                        on ? COUNTER_ON : COUNTER_OFF
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[16px] font-bold text-[#0b2238]">
                        {team.name}
                      </span>
                      <span className="truncate text-[13px] text-[#4a5d73]">
                        {team.members}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!teamsQ.isLoading && visibleTeams.length === 0 && query && (
            <li className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#4a5d73]">
              No teams match “{query}”.
            </li>
          )}
          {!teamsQ.isLoading && allTeams.length === 0 && !query && (
            <li className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#4a5d73]">
              No teams have been created yet.
            </li>
          )}
        </ul>

        {atMax && (
          <p className="m-0 rounded-xl bg-[#fff4e8] px-4 py-3 text-[14px] leading-[1.45] text-[#6b3a10]">
            That&apos;s the max of {MAX_PICKS}. Deselect a team to swap in a
            different one.
          </p>
        )}
      </div>

      {/* Sticky save bar: thumb-reachable on phones, padded above the safe area. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d6dbe5] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <span className="flex flex-col">
            <span
              className={`text-[15px] font-bold tabular-nums text-[#0b2238] ${
                selected.length < MIN_PICKS ? "text-[#7a1a0f]" : ""
              }`}
            >
              {selected.length} / {MAX_PICKS}
            </span>
            <span className="text-[12px] text-[#4a5d73]">
              pick at least {MIN_PICKS}
            </span>
          </span>
          <button
            type="button"
            disabled={!canSave}
            onClick={savePicks}
            className="min-h-12 flex-1 rounded-[10px] bg-[#5b3fa0] px-4 text-[16px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[260px]"
          >
            {save.isPending
              ? "Saving…"
              : save.isError
                ? "Failed — tap to retry"
                : saved
                  ? "Saved ✓"
                  : "Save picks"}
          </button>
        </div>
        {save.isError && (
          <p className="m-0 bg-[#fdecea] px-4 pb-3 pt-2 text-center text-[13px] font-medium text-[#7a1a0f]">
            Couldn&apos;t save your picks. Check your connection and try again.
          </p>
        )}
        {saved && (
          <p className="m-0 px-4 pb-3 text-center text-[13px] font-medium text-[#166534]">
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
      <div className="min-h-screen bg-[#eef1f6] px-4 pb-4 pt-6 font-figtree text-[#0b2238] sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-extrabold tracking-tight">
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
