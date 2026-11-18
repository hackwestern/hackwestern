import { useRef } from "react";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { SCORE_MAX, SCORE_MIN } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingCopy.score;
const VALUES = Array.from(
  { length: SCORE_MAX - SCORE_MIN + 1 },
  (_, i) => SCORE_MIN + i,
);

/**
 * A 1-10 score as a radio group: one tap sets it, arrow keys move it
 * (Home/End jump to the ends), and only the chosen value (or 1 when
 * unscored) is in the Tab order. Two rows of five on phones so every
 * target is at least 44px tall and wide enough to hit; one row from sm up.
 */
export function ScoreControl({
  team,
  value,
  onChange,
}: {
  team: string;
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusValue = value ?? SCORE_MIN;

  const choose = (n: number, focus = false) => {
    if (n !== value) onChange(n);
    if (focus) refs.current[n - SCORE_MIN]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = value ?? SCORE_MIN - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? Math.min(SCORE_MAX, at + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? Math.max(SCORE_MIN, at - 1)
          : e.key === "Home"
            ? SCORE_MIN
            : e.key === "End"
              ? SCORE_MAX
              : null;
    if (next === null) return;
    e.preventDefault();
    choose(next, true);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm font-semibold text-dashboard-text-medium"
          aria-hidden
        >
          {copy.heading}
          <span className="ml-1.5 tabular-nums text-dashboard-text-heavy">
            {value ?? "–"}
            <span className="text-dashboard-text-light">{copy.outOf}</span>
          </span>
        </span>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={copy.clearLabel(team)}
            className={cn(
              "-my-2 -mr-2 min-h-11 rounded-dashboard-md px-2 text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:min-h-9 [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
              pressable,
            )}
          >
            {copy.clear}
          </button>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={copy.label(team)}
        onKeyDown={onKeyDown}
        className="grid grid-cols-5 gap-1 sm:grid-cols-10"
      >
        {VALUES.map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - SCORE_MIN] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={n === focusValue ? 0 : -1}
              onClick={() => choose(n)}
              className={cn(
                "min-h-11 rounded-dashboard-md border text-base font-semibold tabular-nums sm:min-h-10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1",
                // Only the chosen score stands out; the rest stay alike.
                on
                  ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                  : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-medium [@media(hover:hover)]:hover:border-dashboard-border-strong [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                pressable,
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
