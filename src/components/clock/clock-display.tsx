import { useClock } from "~/hooks/use-clock";
import { formatClock } from "~/lib/clock";
import { cn } from "~/lib/utils";

const STATUS_LABEL = {
  idle: "Ready",
  running: "Running",
  paused: "Paused",
} as const;

/**
 * The shared pitch clock, in the hero's type: Cossette Texte, pale blue-white
 * with a soft dark glow. Sized from its box (`cqw`), so put it inside a
 * HeroScene or another size container.
 */
export function ClockDisplay({ className }: { className?: string }) {
  const { state, remaining, isError } = useClock();
  const low =
    state?.status === "running" && remaining !== null && remaining <= 30_000;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 font-cossetteTexte",
        className,
      )}
    >
      <div
        className={cn(
          "text-[clamp(72px,min(34cqw,40cqh),260px)] font-bold tabular-nums leading-[0.85] tracking-[-0.035em]",
          "[text-shadow:0_-3px_0_rgba(0,52,78,0.2),0_6px_32px_rgba(0,52,78,0.55)]",
          low ? "text-[#ffc9bf]" : "text-[#f5f9ff]",
          state?.status === "paused" && "opacity-70",
        )}
        aria-live="off"
      >
        {remaining === null ? "–:––" : formatClock(remaining)}
      </div>
      <div className="text-[clamp(16px,2.6cqw,30px)] font-normal tracking-[-0.02em] text-[#d0d6dd] [text-shadow:0_2px_12px_rgba(0,52,78,0.6)]">
        {isError && !state
          ? "Can't reach the clock"
          : state
            ? remaining === 0 && state.status === "running"
              ? "Time's up"
              : STATUS_LABEL[state.status]
            : "Loading…"}
      </div>
    </div>
  );
}
