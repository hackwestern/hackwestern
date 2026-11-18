import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { cn } from "~/lib/utils";

const copy = coffeeChatCopy.organizer.sponsorFilter;
const STORAGE_KEY = "hw-coffee-chat-sponsor-filter";

export type SponsorSelection = {
  /** Sponsors shown; null = every sponsor (the default). */
  selected: ReadonlySet<string> | null;
  isShown: (sponsor: string) => boolean;
  toggle: (sponsor: string) => void;
  showAll: () => void;
  clear: () => void;
  /** Show just this sponsor. */
  showOnly: (sponsor: string) => void;
};

/**
 * Which sponsors the Coffee chats tables and totals show. Stored as the
 * sponsors left out, so a sponsor added later shows by default. Remembered
 * on this device; storage failures just mean it lasts for this visit.
 *
 * `focus` (a sponsor name, e.g. from ?sponsor= on /internal/sponsors) shows
 * just that sponsor once it is in `names`; All sponsors still undoes it, and
 * so does the focus going away.
 */
export function useSponsorSelection(
  names: readonly string[],
  focus: string | null = null,
): SponsorSelection {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setHidden(parsed.filter((n): n is string => typeof n === "string"));
      }
    } catch {
      // Blocked or bad storage: show everyone.
    }
  }, []);
  const save = (next: string[]) => {
    setHidden(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };
  // Applied once per focus value, after the stored choice loads, so the
  // focus wins and a later "All sponsors" sticks. Dropping the focus (e.g.
  // "Show everyone") shows every sponsor again.
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!focus) {
      if (focused.current !== null) {
        focused.current = null;
        save([]);
      }
      return;
    }
    if (focused.current === focus || !names.includes(focus)) return;
    focused.current = focus;
    save(names.filter((n) => n !== focus));
    // save only writes state and storage; names/focus are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, names]);
  const selected = useMemo(() => {
    const out = new Set(hidden);
    if (!names.some((n) => out.has(n))) return null;
    return new Set(names.filter((n) => !out.has(n)));
  }, [hidden, names]);
  return {
    selected,
    isShown: (sponsor) => selected === null || selected.has(sponsor),
    toggle: (sponsor) =>
      save(
        hidden.includes(sponsor)
          ? hidden.filter((n) => n !== sponsor)
          : [...hidden, sponsor],
      ),
    showAll: () => save([]),
    clear: () => save([...names]),
    showOnly: (sponsor) => save(names.filter((n) => n !== sponsor)),
  };
}

/** Sponsor chips (multi-select) with All sponsors and Clear. */
export function SponsorFilter({
  names,
  selection,
  className,
}: {
  names: readonly string[];
  selection: SponsorSelection;
  className?: string;
}) {
  const labelId = useId();
  const shown = names.filter(selection.isShown).length;
  if (names.length === 0) return null;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn(
        "flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-3 shadow-dashboard-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={labelId}
          className="text-sm font-semibold text-dashboard-text-heavy"
        >
          {copy.label}
          <span className="ml-2 font-medium text-dashboard-text-light">
            {copy.count(shown, names.length)}
          </span>
        </span>
        <div className="flex gap-1">
          <DashboardButton
            variant="tertiary"
            className="min-h-11 px-2"
            disabled={selection.selected === null}
            onClick={selection.showAll}
          >
            {copy.all}
          </DashboardButton>
          <DashboardButton
            variant="tertiary"
            className="min-h-11 px-2"
            disabled={shown === 0}
            onClick={selection.clear}
          >
            {copy.clear}
          </DashboardButton>
        </div>
      </div>
      {/* One row that scrolls sideways on phones, wraps on wider screens. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {names.map((name) => (
          <DashboardChip
            key={name}
            selected={selection.isShown(name)}
            onClick={() => selection.toggle(name)}
            className="min-h-11 shrink-0"
          >
            {name}
          </DashboardChip>
        ))}
      </div>
      {shown === 0 && (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.none}</p>
      )}
    </div>
  );
}
