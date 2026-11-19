import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Minus, Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import {
  MAX_SETUP_CHATS,
  availableFree,
  repChatCap,
  setupTotals,
} from "~/lib/coffee-chat-setup";
import { MAX_HACKERS_PER_CHAT, MIN_HACKERS_PER_CHAT, isSessionId } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { AvailabilityGrid } from "./availability-grid";
import { cardClass, LinkButton, StepFooter, useAfterInvites, useAnnounce, type SetupData } from "./shared";

const copy = sponsorSetupCopy.prefs;

type Draft = {
  hackersPerChat: number;
  reps: Record<string, { chatsWanted: number; free: string[] }>;
};

const draftOf = (data: SetupData): Draft => ({
  hackersPerChat: data.hackersPerChat,
  reps: Object.fromEntries(
    data.reps.map((r) => [r.id, { chatsWanted: r.chatsWanted, free: r.free }]),
  ),
});

/** 1-on-1s are always 15 minutes now (no "longer chats", Q1–Q11). */
const formatOf = (hackersPerChat: number) => ({ hackersPerChat, longerOneOnOne: false });

/**
 * Step 2: hackers per chat, when each rep is free, how many chats each rep
 * wants. Saves itself a moment after each change, and on Next / Back.
 */
export function PrefsStep({
  sponsor,
  data,
  teamHref,
  nextHref,
}: {
  sponsor: string;
  data: SetupData;
  teamHref: string;
  nextHref: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { announce, region } = useAnnounce();
  const { guard, dialog } = useAfterInvites(data);
  const [draft, setDraft] = useState<Draft>(() => draftOf(data));
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const confirmed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  latest.current = draft;

  const save = api.coffeeChatSetup.savePrefs.useMutation();

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return true;
    dirty.current = false;
    const d = latest.current;
    try {
      await save.mutateAsync({
        sponsor,
        hackersPerChat: d.hackersPerChat,
        reps: Object.entries(d.reps).map(([id, r]) => ({
          id,
          chatsWanted: r.chatsWanted,
          free: r.free.filter(isSessionId),
        })),
        confirmAfterInvites: confirmed.current || undefined,
      });
      setError(null);
      await utils.coffeeChatSetup.get.invalidate({ sponsor });
      return true;
    } catch (e) {
      dirty.current = true;
      const msg = e instanceof Error ? e.message : sponsorSetupCopy.errors.saveError;
      setError(msg);
      announce(msg);
      return false;
    }
    // save is stable enough; avoid re-creating on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsor]);

  // Save on leaving the page too.
  useEffect(() => () => void flush(), [flush]);

  const edit = (fn: (d: Draft) => Draft) =>
    guard((confirm) => {
      if (confirm) confirmed.current = true;
      dirty.current = true;
      setDraft((d) => fn(d));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    });

  const go = async (href: string) => {
    if (await flush()) void router.push(href);
  };

  const format = formatOf(draft.hackersPerChat);
  const minutes = draft.hackersPerChat === 1 ? 15 : 30;
  const repState = data.reps.map((rep) => {
    const r = draft.reps[rep.id] ?? { chatsWanted: rep.chatsWanted, free: rep.free };
    const avail = availableFree(r.free, data.blocked).length;
    return { rep, ...r, avail, cap: repChatCap(format, r.chatsWanted, avail) };
  });
  const totals = setupTotals(
    format,
    repState.map((r) => ({ chatsWanted: r.chatsWanted, availSessions: r.avail })),
  );

  if (data.reps.length === 0) {
    return (
      <section className={cardClass}>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.noReps}</p>
        <LinkButton href={teamHref}>{sponsorSetupCopy.team.add}</LinkButton>
      </section>
    );
  }

  return (
    <section className={cardClass} aria-labelledby="prefs-heading">
      {region}
      {dialog}
      <div className="flex flex-col gap-1">
        <h2 id="prefs-heading" className="m-0 text-xl font-semibold text-dashboard-text-heavy">{copy.heading}</h2>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.intro}</p>
      </div>

      {/* Q1 */}
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 flex items-center gap-2 p-0 text-lg font-semibold text-dashboard-text-heavy">
          <Num n={1} />
          {copy.q1}
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.q1Label}>
          {Array.from({ length: MAX_HACKERS_PER_CHAT - MIN_HACKERS_PER_CHAT + 1 }, (_, i) => i + MIN_HACKERS_PER_CHAT).map((n) => {
            const on = draft.hackersPerChat === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && edit((d) => ({ ...d, hackersPerChat: n }))}
                className={cn(
                  "size-12 rounded-dashboard-md border text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
                  on
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
                  pressable,
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="m-0 text-base font-semibold text-dashboard-text-link">{copy.format(draft.hackersPerChat)}</p>
        <p className="m-0 text-sm text-dashboard-text-light">{copy.roomCap}</p>
      </fieldset>

      <hr className="m-0 border-dashboard-border-subtle" />

      {/* Q2 */}
      <div className="flex flex-col gap-3">
        <h3 className="m-0 flex items-center gap-2 text-lg font-semibold text-dashboard-text-heavy">
          <Num n={2} />
          {copy.q2}
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-base text-dashboard-text-medium">{copy.q2Hint}</p>
          <button
            type="button"
            onClick={() => void go(teamHref)}
            className="min-h-11 rounded-dashboard-md px-2 text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          >
            {copy.editTeam}
          </button>
        </div>
        <AvailabilityGrid
          data={data}
          free={Object.fromEntries(repState.map((r) => [r.rep.id, r.free]))}
          onToggle={(repId, sessionId) =>
            edit((d) => {
              const r = d.reps[repId]!;
              const free = r.free.includes(sessionId)
                ? r.free.filter((s) => s !== sessionId)
                : [...r.free, sessionId];
              return { ...d, reps: { ...d.reps, [repId]: { ...r, free } } };
            })
          }
        />
      </div>

      <hr className="m-0 border-dashboard-border-subtle" />

      {/* Q3 */}
      <div className="flex flex-col gap-3">
        <h3 className="m-0 flex items-center gap-2 text-lg font-semibold text-dashboard-text-heavy">
          <Num n={3} />
          {copy.q3}
        </h3>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.q3Hint}</p>
        <ul className="m-0 flex list-none flex-col rounded-dashboard-md border border-dashboard-border-default p-0">
          {repState.map(({ rep, chatsWanted, avail, cap }) => {
            const setChats = (n: number) =>
              edit((d) => ({
                ...d,
                reps: { ...d.reps, [rep.id]: { ...d.reps[rep.id]!, chatsWanted: n } },
              }));
            const note =
              chatsWanted > 0 && avail === 0
                ? copy.notFree(rep.name)
                : chatsWanted > cap
                  ? copy.capped(rep.name, avail, cap)
                  : null;
            return (
              <li key={rep.id} className="flex flex-col gap-2 border-b border-dashboard-border-subtle p-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 break-words text-base font-semibold text-dashboard-text-heavy">{rep.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center rounded-dashboard-md border border-dashboard-border-control">
                      <StepBtn label={copy.fewer(rep.name)} disabled={chatsWanted <= 0} onClick={() => setChats(chatsWanted - 1)}>
                        <Minus aria-hidden className="size-4" />
                      </StepBtn>
                      <output aria-label={copy.chatsLabel(rep.name)} className="w-8 text-center text-lg font-semibold tabular-nums text-dashboard-text-heavy">
                        {chatsWanted}
                      </output>
                      <StepBtn label={copy.more(rep.name)} disabled={chatsWanted >= MAX_SETUP_CHATS} onClick={() => setChats(chatsWanted + 1)}>
                        <Plus aria-hidden className="size-4" />
                      </StepBtn>
                    </span>
                    <span className="min-w-[9rem] text-sm font-semibold text-dashboard-text-link" aria-live="polite">
                      {copy.chatsAndTime(chatsWanted, minutes)}
                    </span>
                  </span>
                </div>
                {note && <p className="m-0 text-sm text-dashboard-text-warning">{note}</p>}
              </li>
            );
          })}
        </ul>
        <p className="m-0 text-lg text-dashboard-text-heavy" aria-live="polite">
          {copy.totals(totals.chats, totals.hackers)}
        </p>
      </div>

      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">{error}</p>
      )}

      <StepFooter
        back={
          <DashboardButton variant="outline" className={cn("h-11 text-base", pressable)} onClick={() => void go(teamHref)}>
            {sponsorSetupCopy.backStep}
          </DashboardButton>
        }
        note={save.isPending ? copy.saving : undefined}
        primary={
          <DashboardButton className={cn("min-h-11 md:h-11", pressable)} onClick={() => void go(nextHref)}>
            {copy.next}
          </DashboardButton>
        }
      />
    </section>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-dashboard-action-primary text-sm font-semibold text-dashboard-text-inverse">
      {n}
    </span>
  );
}

function StepBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary disabled:text-dashboard-text-disabled",
        pressable,
      )}
    >
      {children}
    </button>
  );
}
