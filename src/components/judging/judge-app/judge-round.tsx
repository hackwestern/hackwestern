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

/** The round timer: big countdown, "Paused" when an organizer stops it. */
export function RoundClock({ view }: { view: RoundView }) {
  const now = useNow(500);
  const { state } = view;
  const left = roundLeftMs(view, now);
  const label =
    state.status === "paused"
      ? "Paused"
      : roundIsOpen(view, now)
        ? "left"
        : "Time's up";
  return (
    <section
      aria-label="Round timer"
      className={`${card} flex items-center justify-between gap-3 px-4 py-3`}
    >
      <span className="text-base font-medium text-dashboard-text-heavy">
        Round {state.round} of {state.totalRounds}
      </span>
      <span className="flex items-baseline gap-2">
        <span
          className="font-mono text-3xl font-bold tabular-nums text-dashboard-text-heavy"
          role="timer"
        >
          {formatHold(left)}
        </span>
        <span className="text-sm font-semibold text-dashboard-text-light">
          {label}
        </span>
      </span>
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
    title = "No table for you this round";
    body = `Round ${state.round} is on. Sit this one out and wait for the next.`;
  } else {
    title = `Round ${state.round} is over`;
    body = "Wait here. The organizers will start the next round.";
  }

  return (
    <>
      <section className={`${card} flex flex-col gap-1.5 p-4`}>
        <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
          {title}
        </h1>
        <p className="text-base font-medium text-dashboard-text-light">
          {body}
        </p>
      </section>
      {state.status !== "idle" && <RoundClock view={view} />}
      {upcoming && (
        <section
          aria-label="Your next table"
          className={`${card} flex flex-col gap-1 p-4`}
        >
          <span className="text-base font-medium text-dashboard-text-light">
            Your table in round {upcoming.round}
          </span>
          <span className="text-6xl font-bold tabular-nums leading-none text-dashboard-text-heavy">
            {upcoming.table}
          </span>
        </section>
      )}
    </>
  );
}
