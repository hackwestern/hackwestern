/**
 * Builds `traffic-profile.json` from the request events stored in D1.
 *
 *   EVENTS_INGEST_URL=https://hw-network-requests.<acct>.workers.dev \
 *   EVENTS_READ_TOKEN=... npm run network:profile
 *   npm run k6:generate -- --profile traffic-profile.json
 *
 * Output:
 *  - routes:   share of all traffic per procedure (feeds k6 target weights)
 *  - personas: per auth tier, share of users, route-to-route transition
 *              probabilities and think times (median / p90)
 *  - phases:   average requests per minute in each event phase
 *
 * Pure aggregation lives in `buildProfile` so it can be unit tested.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface EventRow {
  id: number;
  ts: number;
  procedure: string;
  type: string;
  status: string;
  duration_ms: number;
  user_hash: string | null;
  phase: string;
}
export interface CountRow {
  minute: number;
  procedure: string;
  n: number;
  phase: string;
}
type Persona = "organizer" | "judge" | "hacker" | "anonymous";

const SESSION_GAP_MS = 30 * 60_000;
const RANK: Persona[] = ["organizer", "judge", "hacker", "anonymous"];

const round = (n: number, d = 4) => Number(n.toFixed(d));
const quantile = (sorted: number[], q: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
    : 0;

export function buildProfile(
  events: EventRow[],
  counts: CountRow[],
  authOf: Record<string, string>,
) {
  // ---- routes: share of all traffic, counting aggregated polls too ----
  const perProc = new Map<string, number>();
  for (const e of events)
    perProc.set(e.procedure, (perProc.get(e.procedure) ?? 0) + 1);
  for (const c of counts)
    perProc.set(c.procedure, (perProc.get(c.procedure) ?? 0) + c.n);
  const total = [...perProc.values()].reduce((a, b) => a + b, 0) || 1;
  const routes = Object.fromEntries(
    [...perProc]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => [k, round(n / total, 6)]),
  );

  // ---- personas: classify each user by the highest auth tier they touched ----
  const byUser = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.user_hash) continue;
    (
      byUser.get(e.user_hash) ?? byUser.set(e.user_hash, []).get(e.user_hash)!
    ).push(e);
  }
  const personaOf = (rows: EventRow[]): Persona => {
    const tiers = new Set(rows.map((r) => authOf[r.procedure]));
    if (tiers.has("organizer")) return "organizer";
    if (tiers.has("judge")) return "judge";
    return "hacker";
  };

  const acc: Record<
    string,
    { users: number; trans: Map<string, Map<string, number>>; gaps: number[] }
  > = {};
  const ensure = (p: Persona) =>
    (acc[p] ??= { users: 0, trans: new Map(), gaps: [] });

  for (const rows of byUser.values()) {
    rows.sort((a, b) => a.ts - b.ts);
    const p = ensure(personaOf(rows));
    p.users++;
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i]!;
      const prev = rows[i - 1];
      const from =
        prev && cur.ts - prev.ts <= SESSION_GAP_MS ? prev.procedure : "START";
      if (prev && from !== "START") p.gaps.push(cur.ts - prev.ts);
      const edge = p.trans.get(from) ?? p.trans.set(from, new Map()).get(from)!;
      edge.set(cur.procedure, (edge.get(cur.procedure) ?? 0) + 1);
    }
  }
  const anonymous = events.filter((e) => !e.user_hash).length;
  if (anonymous) ensure("anonymous").users = anonymous; // calls, not users: no id to group by

  const totalUsers = Object.values(acc).reduce((n, p) => n + p.users, 0) || 1;
  const personas = Object.fromEntries(
    RANK.filter((p) => acc[p]).map((name) => {
      const a = acc[name]!;
      const gaps = [...a.gaps].sort((x, y) => x - y);
      return [
        name,
        {
          share: round(a.users / totalUsers),
          thinkTimeMs: { p50: quantile(gaps, 0.5), p90: quantile(gaps, 0.9) },
          transitions: Object.fromEntries(
            [...a.trans].map(([from, edge]) => {
              const sum = [...edge.values()].reduce((x, y) => x + y, 0);
              return [
                from,
                Object.fromEntries(
                  [...edge].map(([to, n]) => [to, round(n / sum)]),
                ),
              ];
            }),
          ),
        },
      ];
    }),
  );

  // ---- phases: average requests / minute over the minutes that had traffic ----
  const phaseMinutes = new Map<string, Map<number, number>>();
  const bump = (phase: string, minute: number, n: number) => {
    const m =
      phaseMinutes.get(phase) ?? phaseMinutes.set(phase, new Map()).get(phase)!;
    m.set(minute, (m.get(minute) ?? 0) + n);
  };
  for (const e of events) bump(e.phase, Math.floor(e.ts / 60_000), 1);
  for (const c of counts) bump(c.phase, c.minute, c.n);
  const phases = Object.fromEntries(
    [...phaseMinutes].map(([phase, mins]) => {
      const vals = [...mins.values()].sort((a, b) => a - b);
      return [
        phase,
        {
          activeMinutes: vals.length,
          avgPerMinute: round(vals.reduce((a, b) => a + b, 0) / vals.length, 1),
          peakPerMinute: vals.at(-1) ?? 0,
        },
      ];
    }),
  );

  return {
    totals: { events: events.length, polledCalls: total - events.length },
    routes,
    personas,
    phases,
  };
}

async function fetchAll<T>(
  base: string,
  token: string,
  table: string,
): Promise<T[]> {
  const rows: T[] = [];
  let after = 0;
  for (;;) {
    const res = await fetch(
      `${base}/export?table=${table}&after=${after}&limit=5000`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) throw new Error(`export ${table} failed: ${res.status}`);
    const page = (await res.json()) as { rows: T[]; next: number | null };
    rows.push(...page.rows);
    if (page.next === null) return rows;
    after = page.next;
  }
}

async function main() {
  const base = process.env.EVENTS_INGEST_URL?.replace(/\/$/, "");
  const token = process.env.EVENTS_READ_TOKEN;
  if (!base || !token) {
    throw new Error("Set EVENTS_INGEST_URL and EVENTS_READ_TOKEN.");
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const appMap = JSON.parse(
    fs.readFileSync(path.join(root, "src/generated/app.json"), "utf8"),
  ) as {
    trpc: { path: string; auth: string }[];
  };
  const authOf = Object.fromEntries(appMap.trpc.map((t) => [t.path, t.auth]));

  const [events, counts] = await Promise.all([
    fetchAll<EventRow>(base, token, "request_events"),
    fetchAll<CountRow>(base, token, "request_counts"),
  ]);
  const profile = {
    generatedAt: new Date().toISOString(),
    ...buildProfile(events, counts, authOf),
  };
  const out = path.join(root, "traffic-profile.json");
  fs.writeFileSync(out, JSON.stringify(profile, null, 2) + "\n");
  console.log(
    `Wrote traffic-profile.json from ${events.length} events and ${counts.length} count rows.`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
