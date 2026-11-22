import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import {
  type RoundView,
  roundLeftMs,
} from "~/components/judging/judge-app/judge-round";

const POLL_MS = 2000;
const DISPLAY_TICK_MS = 250;

/**
 * The round timer for the projector and the organizers' read-only clock. The
 * same state judges see (round, status, when it ends), polled every 2s and
 * counted down locally against the server's clock, so it stays smooth between
 * polls and a refresh is immediately right.
 */
export function useRoundClock() {
  const query = api.judging.board.getClock.useQuery(undefined, {
    refetchInterval: POLL_MS,
    staleTime: 0,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), DISPLAY_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const state = query.data;
  if (!state) return { ...query, state: undefined, remaining: null };

  const view: RoundView = { state, fetchedAt: query.dataUpdatedAt };
  // Before round 1 the clock shows a full round, ready to start.
  const remaining =
    state.status === "idle"
      ? state.roundSeconds * 1000
      : roundLeftMs(view, now);
  return { ...query, state, remaining };
}
