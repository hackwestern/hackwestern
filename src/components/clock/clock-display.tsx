import { useClock } from "~/hooks/use-clock";
import { formatClock } from "~/lib/clock";
import { cn } from "~/lib/utils";

const STATUS_LABEL = {
  idle: "Ready",
  running: "Running",
  paused: "Paused",
} as const;

export function ClockDisplay({ className }: { className?: string }) {
  const { state, remaining, isError } = useClock();

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "font-mono text-8xl font-bold tabular-nums",
          state?.status === "running" &&
            remaining !== null &&
            remaining <= 30_000 &&
            "text-red-600",
        )}
        aria-live="off"
      >
        {remaining === null ? "–:––" : formatClock(remaining)}
      </div>
      <div className="text-sm text-slate-500">
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
