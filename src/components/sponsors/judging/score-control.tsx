import { useEffect, useId, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  SCORE_MAX,
  SCORE_MIN,
  formatScore,
  stepScore,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingCopy.score;
/** Range position used only until the rep chooses a score. */
const REST = (SCORE_MIN + SCORE_MAX) / 2;

const stepButton = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
  "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  pressable,
);

/**
 * One rep's overall score, 1 to 10 in half points (Holia's judging UX): a
 * horizontal scroll-snap strip of 1, 1.5 … 10. Scroll or swipe it and the
 * number that settles in the middle is the score; tap a number; use −/+
 * for 0.5 steps; or focus the strip and use ← → (Home/End, PageUp/Down).
 * It's an ARIA slider. It stays dimmed and reads "–" until touched.
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
  const labelId = useId();
  const shown = value ?? REST;

  // The score this control last asked for. `value` arrives a moment later
  // (the optimistic update waits on a cancel), so quick key presses or taps
  // step from this, not from a stale `value`.
  // Values it asked for that may still echo back through `value` are
  // ignored; any other new `value` (another rep's edit, a rollback) wins.
  const latest = useRef(value);
  const sent = useRef<(number | null)[]>([]);
  useEffect(() => {
    if (value === latest.current) {
      sent.current = [];
      return;
    }
    if (sent.current.includes(value)) return;
    sent.current = [];
    latest.current = value;
  }, [value]);
  const current = () => latest.current;

  const ask = (score: number | null) => {
    latest.current = score;
    sent.current.push(score);
    onChange(score);
  };
  const set = (score: number) => {
    if (score !== latest.current) ask(score);
  };

  const unscored = value === null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          id={labelId}
          className="text-sm font-semibold text-dashboard-text-medium"
        >
          {copy.heading}
        </span>
        <output
          aria-hidden
          className={cn(
            "ml-auto text-[32px] font-bold tabular-nums leading-none",
            unscored
              ? "text-dashboard-text-disabled"
              : "text-dashboard-text-active",
          )}
        >
          {unscored ? copy.unscored : formatScore(value)}
          <span className="text-base font-semibold text-dashboard-text-light">
            {copy.outOf}
          </span>
        </output>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={copy.lower(team)}
          disabled={value === SCORE_MIN}
          onClick={() => set(stepScore(current(), current() === null ? 0 : -1))}
          className={stepButton}
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <input
          type="range"
          min={SCORE_MIN}
          max={SCORE_MAX}
          step={0.5}
          value={shown}
          aria-labelledby={labelId}
          aria-label={copy.label(team)}
          aria-valuetext={
            unscored ? copy.notScored : copy.valueText(formatScore(value))
          }
          onChange={(e) => set(Number(e.target.value))}
          className={cn(
            "h-11 min-w-0 flex-1 cursor-pointer accent-dashboard-action-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
            unscored && "opacity-60",
          )}
        />
        <button
          type="button"
          aria-label={copy.raise(team)}
          disabled={value === SCORE_MAX}
          onClick={() => set(stepScore(current(), current() === null ? 0 : 1))}
          className={stepButton}
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs font-medium text-dashboard-text-light">
        <span aria-hidden>{copy.low}</span>
        {value !== null ? (
          <DashboardButton
            type="button"
            variant="link"
            onClick={() => ask(null)}
            aria-label={copy.clearLabel(team)}
            className="-my-2"
          >
            {copy.clear}
          </DashboardButton>
        ) : (
          <span aria-hidden>{copy.hint}</span>
        )}
        <span aria-hidden>{copy.high}</span>
      </div>
    </div>
  );
}
