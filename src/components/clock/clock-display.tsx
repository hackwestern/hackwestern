import { useRoundClock } from "~/hooks/use-round-clock";
import { formatClock } from "~/lib/clock";
import { cn } from "~/lib/utils";

/**
 * The round clock, in the hero's type: Cossette Texte, pale blue-white with a
 * soft dark glow. It mirrors the round timer judges see and is read only;
 * rounds are run from the Judging controls. Sized from its box (`cqw`), so put
 * it inside a HeroScene or another size container.
 */
export function ClockDisplay({ className }: { className?: string }) {
  const { state, remaining, isError } = useRoundClock();
  const timeUp =
    !!state &&
    state.enabled &&
    remaining === 0 &&
    (state.status === "running" || state.status === "closed");
  const low =
    state?.status === "running" && remaining !== null && remaining <= 60_000;

  const label =
    isError && !state
      ? "Can't reach the clock"
      : !state
        ? "Loading…"
        : !state.enabled
          ? "Rounds are off"
          : timeUp
            ? "Time's up"
            : state.status === "idle"
              ? "Waiting for round 1"
              : state.status === "paused"
                ? "Paused"
                : "Running";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 font-cossetteTexte",
        className,
      )}
    >
      {state?.enabled && state.round > 0 && (
        <div className="text-[clamp(18px,3.4cqw,40px)] font-normal tracking-[-0.02em] text-[#d0d6dd] [text-shadow:0_2px_12px_rgba(0,52,78,0.6)]">
          Round {state.round} of {state.totalRounds}
        </div>
      )}
      <div
        className={cn(
          "text-[clamp(72px,min(34cqw,40cqh),260px)] font-bold tabular-nums leading-[0.85] tracking-[-0.035em]",
          "[text-shadow:0_-3px_0_rgba(0,52,78,0.2),0_6px_32px_rgba(0,52,78,0.55)]",
          low || timeUp ? "text-[#ffc9bf]" : "text-[#f5f9ff]",
          state?.status === "paused" && "opacity-70",
        )}
        aria-live="off"
      >
        {remaining === null || !state?.enabled
          ? "–:––"
          : formatClock(remaining)}
      </div>
      <div className="text-[clamp(16px,2.6cqw,30px)] font-normal tracking-[-0.02em] text-[#d0d6dd] [text-shadow:0_2px_12px_rgba(0,52,78,0.6)]">
        {label}
      </div>
    </div>
  );
}
