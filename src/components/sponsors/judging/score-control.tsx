import { useCallback, useEffect, useId, useRef } from "react";
import { BookOpen, Minus, Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  SCORE_MAX,
  SCORE_MIN,
  SCORE_VALUES,
  formatScore,
  stepScore,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingCopy.score;
/** Width of one number on the strip (a 44px target). */
const TICK = 44;
/** Where an unscored strip rests: the middle of the range. */
const REST = (SCORE_MIN + SCORE_MAX) / 2;
const SETTLE_MS = 140;

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
 * "Rubric" opens the rubric (onRubric).
 */
export function ScoreControl({
  team,
  value,
  onChange,
  onRubric,
}: {
  team: string;
  value: number | null;
  onChange: (score: number | null) => void;
  onRubric: () => void;
}) {
  const labelId = useId();
  const strip = useRef<HTMLDivElement>(null);
  // Scrolls we caused (syncing to `value`) must not set a score; only a
  // scroll the rep started (finger, wheel, trackpad) does.
  const programmatic = useRef(false);
  const userScroll = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shown = value ?? REST;

  const scrollTo = useCallback((score: number, smooth: boolean) => {
    const el = strip.current;
    if (!el) return;
    programmatic.current = true;
    userScroll.current = false;
    const left = SCORE_VALUES.indexOf(score) * TICK;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reduce) el.scrollTo({ left, behavior: "smooth" });
    else el.scrollLeft = left;
    window.setTimeout(
      () => {
        programmatic.current = false;
      },
      smooth ? 450 : 60,
    );
  }, []);

  // Follow the value (another rep's edit, a rollback, ± buttons, keys).
  useEffect(() => {
    scrollTo(shown, false);
    // Only when the value itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  useEffect(() => () => clearTimeout(settle.current), []);

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

  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = strip.current;
      if (!el || programmatic.current || !userScroll.current) return;
      userScroll.current = false;
      const i = Math.round(el.scrollLeft / TICK);
      const score =
        SCORE_VALUES[Math.max(0, Math.min(SCORE_VALUES.length - 1, i))]!;
      set(score);
    }, SETTLE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? stepScore(current(), current() === null ? 0 : 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? stepScore(current(), current() === null ? 0 : -1)
          : e.key === "PageUp"
            ? stepScore(current(), 2)
            : e.key === "PageDown"
              ? stepScore(current(), -2)
              : e.key === "Home"
                ? SCORE_MIN
                : e.key === "End"
                  ? SCORE_MAX
                  : null;
    if (next === null) return;
    e.preventDefault();
    set(next);
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
        <DashboardButton
          type="button"
          variant="small"
          onClick={onRubric}
          aria-haspopup="dialog"
          aria-label={copy.rubricLabel(team)}
          className="min-h-11 md:min-h-9"
        >
          <BookOpen aria-hidden className="size-4" strokeWidth={1.75} />
          {copy.rubric}
        </DashboardButton>
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
        <div className="relative min-w-0 flex-1">
          {/* The middle marker: the number under it is the score. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-1/2 w-11 -translate-x-1/2 rounded-dashboard-md border-2",
              unscored
                ? "border-dashboard-border-default"
                : "border-dashboard-action-primary bg-dashboard-bg-highlight",
            )}
          />
          <div
            ref={strip}
            role="slider"
            tabIndex={0}
            aria-labelledby={labelId}
            aria-valuemin={SCORE_MIN}
            aria-valuemax={SCORE_MAX}
            aria-valuenow={shown}
            aria-valuetext={
              unscored ? copy.notScored : copy.valueText(formatScore(value))
            }
            onKeyDown={onKeyDown}
            onScroll={onScroll}
            onPointerDown={() => (userScroll.current = true)}
            onTouchStart={() => (userScroll.current = true)}
            onWheel={() => (userScroll.current = true)}
            className={cn(
              "relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "rounded-dashboard-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
              "motion-safe:transition-opacity",
              unscored && "opacity-60",
            )}
            style={{
              paddingInline: `calc(50% - ${TICK / 2}px)`,
            }}
          >
            {SCORE_VALUES.map((n) => {
              const on = !unscored && n === value;
              const half = !Number.isInteger(n);
              return (
                <button
                  key={n}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => {
                    set(n);
                    scrollTo(n, true);
                  }}
                  className={cn(
                    "relative flex h-11 shrink-0 snap-center items-center justify-center tabular-nums",
                    half ? "text-sm font-medium" : "text-base font-semibold",
                    on
                      ? "text-dashboard-text-active"
                      : half
                        ? "text-dashboard-text-light"
                        : "text-dashboard-text-medium",
                  )}
                  style={{ width: TICK }}
                >
                  {formatScore(n)}
                </button>
              );
            })}
          </div>
        </div>
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
