import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { CLOCK_POLL_INTERVAL_MS, remainingMs } from "~/lib/clock";

const DISPLAY_TICK_MS = 250;

/**
 * Shared event clock. Polls the server every 2s for the clock's absolute end
 * time and renders the countdown locally, so the on-screen time stays smooth
 * between polls and a late joiner or refresh is immediately correct.
 */
export function useClock() {
  const query = api.clock.get.useQuery(undefined, {
    refetchInterval: CLOCK_POLL_INTERVAL_MS,
    staleTime: 0,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), DISPLAY_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const state = query.data;
  if (!state) {
    return { ...query, state: undefined, remaining: null };
  }

  // Server clock minus client clock at the moment this response arrived.
  // (Ignores network latency, which is well under a second.)
  const offsetMs = state.serverNowMs - query.dataUpdatedAt;

  return {
    ...query,
    state,
    remaining: remainingMs(state, now, offsetMs),
  };
}
