import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { hover } from "~/components/internals/interaction";
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

/**
 * Sponsors as a light list of round checkboxes (native inputs, so Tab,
 * Space and screen readers work as usual) with All sponsors and Clear.
 */
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
    <fieldset
      aria-labelledby={labelId}
      className={cn(
        "m-0 flex min-w-0 flex-col gap-1 rounded-dashboard-lg border-0 bg-dashboard-bg-surface px-4 py-3 shadow-dashboard-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <span
          id={labelId}
          className="text-sm font-semibold text-dashboard-text-heavy"
        >
          {copy.label}
          <span className="ml-2 font-medium tabular-nums text-dashboard-text-light">
            {copy.count(shown, names.length)}
          </span>
        </span>
      </div>
      <div className="-mx-1 flex flex-wrap items-center">
        {/* All sponsors: ticked when every sponsor shows; ticking it shows
            everyone, unticking it hides everyone (Jazz, 2026-11-17). */}
        <SponsorCheck
          name={copy.all}
          checked={shown === names.length && names.length > 0}
          onToggle={
            shown === names.length ? selection.clear : selection.showAll
          }
          strong
        />
        <span
          aria-hidden="true"
          className="mx-2 h-5 w-px bg-dashboard-border-subtle"
        />
        {names.map((name) => (
          <SponsorCheck
            key={name}
            name={name}
            checked={selection.isShown(name)}
            onToggle={() => selection.toggle(name)}
          />
        ))}
      </div>
      {shown === 0 && (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.none}</p>
      )}
    </fieldset>
  );
}

// One sponsor: the whole label is the hit area (44px tall on touch, 36px on
// desktop) around a round DashboardCheckbox. Only colour and the check's
// opacity change, so nothing shifts when toggling.
function SponsorCheck({
  name,
  checked,
  onToggle,
  strong = false,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  strong?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 min-w-0 max-w-full cursor-pixel-hover items-center gap-1 rounded-dashboard-md pr-2 text-sm text-dashboard-text-heavy md:min-h-9",
        strong && "font-semibold",
        hover.highlight,
      )}
    >
      <DashboardCheckbox round checked={checked} onCheckedChange={onToggle} />
      <span className="min-w-0 break-words">{name}</span>
    </label>
  );
}
