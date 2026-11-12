/**
 * Request-event logging for traffic profiling.
 *
 * Every tRPC call is reported (metadata only: no inputs, outputs, emails or
 * IPs) to a Cloudflare Worker that stores it in D1 (see workers/hw-events).
 * That keeps analytics writes off the main Neon database.
 *
 * - Fire and forget: failures are swallowed and never affect the request.
 * - Disabled unless EVENTS_INGEST_URL and EVENTS_INGEST_TOKEN are both set.
 * - High-frequency polling procedures (HOT_PROCEDURES, e.g. `clock.get` every
 *   2s per client) are not stored row-by-row. They are counted in memory per
 *   minute and flushed as one aggregate row, which keeps D1 writes tiny.
 */
import { createHmac } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { env } from "~/env";

export const HOT_PROCEDURES = new Set(["clock.get"]);

export interface RequestEvent {
  ts: number;
  procedure: string;
  type: string;
  /** "OK" or a tRPC error code such as "UNAUTHORIZED". */
  status: string;
  durationMs: number;
  /** Salted hash of the user id; null for anonymous callers. */
  userHash: string | null;
  phase: string;
}

interface CountRow {
  minute: number;
  procedure: string;
  n: number;
  phase: string;
}

const enabled = () => !!env.EVENTS_INGEST_URL && !!env.EVENTS_INGEST_TOKEN;

export function currentPhase(now = Date.now()): string {
  const start = env.HACK_START ? Date.parse(env.HACK_START) : NaN;
  const end = env.HACK_END ? Date.parse(env.HACK_END) : NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return "unknown";
  if (now < start) return "before";
  if (now <= end) return "during";
  return "after";
}

export function hashUser(userId: string | undefined): string | null {
  if (!userId) return null;
  const secret = env.NEXTAUTH_SECRET ?? "hw-events";
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 16);
}

function send(body: { events?: RequestEvent[]; counts?: CountRow[] }) {
  const request = fetch(`${env.EVENTS_INGEST_URL}/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.EVENTS_INGEST_TOKEN}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
  // Keep the serverless function alive until the beacon is sent.
  waitUntil(request);
}

/* Per-instance minute counters for hot procedures. */
let countMinute = Math.floor(Date.now() / 60_000);
let counts = new Map<string, number>();

function flushCounts(nextMinute: number) {
  if (counts.size === 0) {
    countMinute = nextMinute;
    return;
  }
  const phase = currentPhase(countMinute * 60_000);
  const rows: CountRow[] = [...counts].map(([procedure, n]) => ({
    minute: countMinute,
    procedure,
    n,
    phase,
  }));
  counts = new Map();
  countMinute = nextMinute;
  send({ counts: rows });
}

export function recordEvent(event: Omit<RequestEvent, "phase">) {
  try {
    if (!enabled()) return;
    if (HOT_PROCEDURES.has(event.procedure)) {
      const minute = Math.floor(event.ts / 60_000);
      if (minute !== countMinute) flushCounts(minute);
      counts.set(event.procedure, (counts.get(event.procedure) ?? 0) + 1);
      return;
    }
    send({ events: [{ ...event, phase: currentPhase(event.ts) }] });
  } catch {
    // Logging must never break a request.
  }
}
