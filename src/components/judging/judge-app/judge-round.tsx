import { Hourglass } from "lucide-react";
import { type RouterOutputs } from "~/utils/api";
import { card } from "~/components/judging/shared/judge-ui";
import {
  formatHold,
  useNow,
} from "~/components/judging/control/control-shared";

export type JudgeRound = RouterOutputs["judging"]["me"]["getMyStops"]["round"];

/** A round as the judge's screen last fetched it, with when that was. */
export interface RoundView {
  state: JudgeRound;
  /** Date.now() when the state arrived, to correct for a wrong device clock. */
  fetchedAt: number;
}

/** Milliseconds left in the round, counted against the server's clock. */
export function roundLeftMs(view: RoundView, now: number): number {
  const { state } = view;
  if (state.status === "running" && state.endsAt) {
    const skew = state.serverNow.getTime() - view.fetchedAt;
    return Math.max(0, state.endsAt.getTime() - (now + skew));
  }
  return state.remainingMs ?? 0;
}

/** Can stops be scored right now? False once the timer has run out here, even before the next poll. */
export function roundIsOpen(view: RoundView, now: number): boolean {
  const { state } = view;
  if (state.status === "paused") return true;
  return state.status === "running" && roundLeftMs(view, now) > 0;
}

/** Under this the timer turns to a warning colour. */
const URGENT_MS = 60_000;

/** The round timer: big countdown with a draining bar, "Paused" when stopped. */
export function RoundClock({ view }: { view: RoundView }) {
  const now = useNow(500);
  const { state } = view;
  const left = roundLeftMs(view, now);
  const open = roundIsOpen(view, now);
  const paused = state.status === "paused";
  const over = !open && !paused;
  const urgent = open && !paused && left <= URGENT_MS;
  const total = Math.max(1, state.roundSeconds * 1000);
  const pct = over ? 0 : Math.min(100, (left / total) * 100);
  const tone =
    over || urgent
      ? "text-dashboard-text-warning"
      : "text-dashboard-text-heavy";

  return (
    <section
      aria-label="Round timer"
      className={`${card} flex flex-col gap-3 p-4`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-dashboard-bg-highlight px-3 py-1 text-sm font-semibold text-dashboard-text-active">
          Round {state.round} of {state.totalRounds}
        </span>
        <span className="text-sm font-semibold text-dashboard-text-light">
          {paused ? "Paused" : over ? "Time's up" : "Time left"}
        </span>
      </div>
      <span
        role="timer"
        className={`text-center font-mono text-6xl font-bold tabular-nums leading-none ${tone}`}
      >
        {formatHold(left)}
      </span>
      <div
        aria-hidden="true"
        className="h-2 w-full overflow-hidden rounded-full bg-dashboard-bg-inset"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-linear ${
            over || urgent
              ? "bg-dashboard-text-warning"
              : "bg-dashboard-action-primary"
          } ${paused ? "opacity-60" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

/** Between rounds, or a round with no table for this judge. */
export function RoundWait({
  view,
  upcoming,
}: {
  view: RoundView;
  /** This judge's next table and the round it is for. */
  upcoming: { table: number; round: number } | null;
}) {
  const now = useNow(500);
  const { state } = view;
  const open = roundIsOpen(view, now);

  let title: string;
  let body: string;
  if (state.status === "idle") {
    title = "Waiting for round 1";
    body = "The organizers will start the first round. Stay close.";
  } else if (open) {
    title = "Sitting this one out";
    body = `You have no table in round ${state.round}. Hang tight for the next.`;
  } else {
    title = `Round ${state.round} is over`;
    body = "Wait here. The organizers will start the next round.";
  }

  return (
    <>
      <section
        className={`${card} flex flex-col items-center gap-3 px-4 py-6 text-center`}
      >
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-dashboard-bg-highlight text-dashboard-text-active"
        >
          <Hourglass className="size-7" />
        </span>
        <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
          {title}
        </h1>
        <p className="max-w-[28ch] text-base font-medium text-dashboard-text-light">
          {body}
        </p>
      </section>
      {state.status !== "idle" && <RoundClock view={view} />}
      {upcoming && (
        <section
          aria-label="Your next table"
          className={`${card} flex flex-col items-center gap-1 p-4 text-center`}
        >
          <span className="rounded-full bg-dashboard-bg-highlight px-3 py-1 text-sm font-semibold text-dashboard-text-active">
            Up next · round {upcoming.round}
          </span>
          <span className="text-7xl font-bold tabular-nums leading-none text-dashboard-text-heavy">
            {upcoming.table}
          </span>
          <span className="text-base font-medium text-dashboard-text-light">
            Table
          </span>
        </section>
      )}
    </>
  );
}
