import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { hover } from "~/components/internals/interaction";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
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
 * With `colors`, each sponsor shows its colour dot; with `onHighlight`, the
 * name is its own button that highlights the sponsor (aria-pressed) while
 * the checkbox keeps showing or hiding them.
 */
export function SponsorFilter({
  names,
  selection,
  className,
  colors,
  highlight = null,
  onHighlight,
}: {
  names: readonly string[];
  selection: SponsorSelection;
  className?: string;
  /** Palette indexes by sponsor name (sponsorColorIndexes). */
  colors?: ReadonlyMap<string, number>;
  highlight?: string | null;
  onHighlight?: (name: string) => void;
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
            badge={
              colors ? <SponsorBadge name={name} colors={colors} /> : undefined
            }
            highlighted={highlight === name}
            onHighlight={onHighlight ? () => onHighlight(name) : undefined}
          />
        ))}
      </div>
      {shown === 0 && (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.none}</p>
      )}
      {onHighlight && (
        <p className="m-0 text-xs text-dashboard-text-light">
          {copy.highlightHint}
        </p>
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
  badge,
  highlighted = false,
  onHighlight,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  strong?: boolean;
  /** The sponsor's colour badge (SponsorBadge). */
  badge?: ReactNode;
  highlighted?: boolean;
  onHighlight?: () => void;
}) {
  const swatch = badge ?? null;
  if (onHighlight) {
    // Checkbox and name are separate targets: tick = show/hide, name =
    // highlight. Both keep the 44px touch height.
    return (
      <span className="flex min-h-11 min-w-0 max-w-full items-center rounded-dashboard-md md:min-h-9">
        <label
          className={cn(
            "flex min-h-11 cursor-pixel-hover items-center rounded-dashboard-md md:min-h-9",
            hover.highlight,
          )}
        >
          <DashboardCheckbox
            round
            checked={checked}
            onCheckedChange={onToggle}
          />
          <span className="sr-only">{copy.show(name)}</span>
        </label>
        <DashboardButton
          variant="link"
          aria-pressed={highlighted}
          aria-label={copy.highlight(name)}
          onClick={onHighlight}
          className={cn(
            "min-w-0 whitespace-normal px-1.5 text-left font-medium text-dashboard-text-heavy focus-visible:ring-offset-0",
            highlighted && "bg-dashboard-bg-navSelected font-semibold",
          )}
        >
          {swatch}
          <span className="min-w-0 break-words">{name}</span>
        </DashboardButton>
      </span>
    );
  }
  return (
    <label
      className={cn(
        "flex min-h-11 min-w-0 max-w-full cursor-pixel-hover items-center gap-1 rounded-dashboard-md pr-2 text-sm text-dashboard-text-heavy md:min-h-9",
        strong && "font-semibold",
        hover.highlight,
      )}
    >
      <DashboardCheckbox round checked={checked} onCheckedChange={onToggle} />
      {swatch}
      <span className="min-w-0 break-words">{name}</span>
    </label>
  );
}
