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

/** The last 1:30 of a round: score and walk to the next table. */
const BUFFER_MS = 90_000;

/** Red for the last minute and when time is up. Calm purple otherwise. */
const WARN = "#b42318";

/**
 * The round timer: the time big and centred, a wide bar that drains under it.
 * Goes red for the last minute and when time is up, and dims while an
 * organizer has it paused. Fills whatever width it is given.
 */
export function RoundClock({
  view,
  nextTable = null,
}: {
  view: RoundView;
  /** This judge's table in the next round, named in the buffer message. */
  nextTable?: number | null;
}) {
  const now = useNow(500);
  const { state } = view;
  const left = roundLeftMs(view, now);
  const open = roundIsOpen(view, now);
  const paused = state.status === "paused";
  const over = !open && !paused;
  const warn = over || (open && !paused && left <= URGENT_MS);
  const buffer = open && !paused && left <= BUFFER_MS;
  const total = Math.max(1, state.roundSeconds * 1000);
  const pct = over ? 0 : Math.min(100, (left / total) * 100);

  return (
    <section
      aria-label="Round timer"
      className={`${card} flex flex-col gap-4 p-5 font-figtree sm:px-8 sm:py-6`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-dashboard-bg-highlight px-3 py-1 text-sm font-semibold text-dashboard-text-active">
          Round {state.round} of {state.totalRounds}
        </span>
        <span className="text-sm font-semibold text-dashboard-text-light">
          {paused
            ? "Paused"
            : over
              ? "Time's up"
              : buffer
                ? "Buffer"
                : "Time left"}
        </span>
      </div>
      {buffer && (
        <p
          role="status"
          className="rounded-dashboard-sm bg-dashboard-bg-highlight px-4 py-3 text-center text-base font-semibold text-dashboard-text-active"
        >
          {nextTable !== null
            ? `Buffer: submit your score and move to table ${nextTable}.`
            : "Buffer: submit your score. That was your last table."}
        </p>
      )}
      <span
        role="timer"
        style={warn ? { color: WARN } : undefined}
        className={`text-center text-6xl font-bold tabular-nums leading-none sm:text-7xl ${
          warn ? "" : "text-dashboard-text-heavy"
        } ${paused ? "opacity-60" : ""}`}
      >
        {formatHold(left)}
      </span>
      <div
        aria-hidden="true"
        className="h-3 w-full overflow-hidden rounded-full bg-dashboard-bg-inset"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-linear ${
            warn ? "" : "bg-dashboard-action-primary"
          } ${paused ? "opacity-50" : ""}`}
          style={{
            width: `${pct}%`,
            ...(warn ? { backgroundColor: WARN } : {}),
          }}
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
