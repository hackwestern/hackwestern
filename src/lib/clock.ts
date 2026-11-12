/** How often clients re-fetch the shared clock. */
export const CLOCK_POLL_INTERVAL_MS = 2000;

export type ClockStatus = "idle" | "running" | "paused";

export type ClockState = {
  status: ClockStatus;
  /** Absolute end time (epoch ms, server clock). Only set while running. */
  endsAtMs: number | null;
  /** Time left (ms) at the moment of pausing. Only set while paused. */
  pausedRemainingMs: number | null;
  durationMs: number;
  /** Server's clock (epoch ms) when this state was read. */
  serverNowMs: number;
};

export function deriveStatus(row: {
  endsAt: Date | null;
  pausedRemainingMs: number | null;
}): ClockStatus {
  if (row.endsAt) return "running";
  if (row.pausedRemainingMs !== null) return "paused";
  return "idle";
}

/**
 * Milliseconds left on the clock. `offsetMs` is (server clock - client clock),
 * so `nowMs + offsetMs` approximates the server's current time even when the
 * viewer's device clock is wrong.
 */
export function remainingMs(
  state: Pick<
    ClockState,
    "status" | "endsAtMs" | "pausedRemainingMs" | "durationMs"
  >,
  nowMs: number,
  offsetMs: number,
): number {
  switch (state.status) {
    case "running":
      return Math.max(0, (state.endsAtMs ?? 0) - (nowMs + offsetMs));
    case "paused":
      return Math.max(0, state.pausedRemainingMs ?? 0);
    default:
      return state.durationMs;
  }
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
