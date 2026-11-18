import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
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
        <div className="-mr-2 flex">
          <DashboardButton
            variant="tertiary"
            className="min-h-11 px-2 text-sm text-dashboard-text-link disabled:text-dashboard-text-disabled md:min-h-9 md:text-sm"
            disabled={selection.selected === null}
            onClick={selection.showAll}
          >
            {copy.all}
          </DashboardButton>
          <DashboardButton
            variant="tertiary"
            className="min-h-11 px-2 text-sm text-dashboard-text-link disabled:text-dashboard-text-disabled md:min-h-9 md:text-sm"
            disabled={shown === 0}
            onClick={selection.clear}
          >
            {copy.clear}
          </DashboardButton>
        </div>
      </div>
      <div className="-mx-2 flex flex-wrap">
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
// desktop); the circle fills blue with a white check when shown. Only colour
// and the check's opacity change, so nothing shifts when toggling.
function SponsorCheck({
  name,
  checked,
  onToggle,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="group flex min-h-11 min-w-0 max-w-full cursor-pixel-hover items-center gap-2 rounded-dashboard-md px-2 text-sm text-dashboard-text-heavy md:min-h-9 [@media(hover:hover)]:hover:bg-dashboard-bg-highlight">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
          "motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-dashboard-action-primary peer-focus-visible:ring-offset-2",
          checked
            ? "border-dashboard-action-primary bg-dashboard-action-primary"
            : "border-dashboard-border-strong bg-dashboard-bg-surface",
        )}
      >
        <Check
          strokeWidth={3}
          className={cn(
            "size-2.5 text-dashboard-text-inverse motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      <span className="min-w-0 break-words">{name}</span>
    </label>
  );
}
