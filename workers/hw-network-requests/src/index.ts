/**
 * hw-network-requests: stores Hack Western request events in Cloudflare D1.
 *
 *   POST /ingest   Bearer HW_NETWORK_REQUESTS_INGEST_TOKEN  { events?: Event[], counts?: Count[] }
 *
 * Local minimal types so this directory needs no extra dependencies.
 */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}
interface Env {
  DB: D1Database;
  HW_NETWORK_REQUESTS_INGEST_TOKEN: string;
}

const MAX_BATCH = 200;
const D1_BATCH = 90; // stay under D1's per-batch statement limits

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function bearerOk(request: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${expected}`;
  if (given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++)
    diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const str = (v: unknown, max = 100) =>
  typeof v === "string" ? v.slice(0, max) : null;
const int = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;

async function ingest(request: Request, env: Env): Promise<Response> {
  let body: { events?: unknown; counts?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const statements: D1Statement[] = [];
  const events = Array.isArray(body.events)
    ? body.events.slice(0, MAX_BATCH)
    : [];
  for (const e of events as Record<string, unknown>[]) {
    const ts = int(e.ts);
    const procedure = str(e.procedure);
    const type = str(e.type, 20);
    const status = str(e.status, 40);
    const duration = int(e.durationMs);
    const phase = str(e.phase, 20);
    if (
      ts === null ||
      !procedure ||
      !type ||
      !status ||
      duration === null ||
      !phase
    )
      continue;
    statements.push(
      env.DB.prepare(
        "INSERT INTO request_events (ts, procedure, type, status, duration_ms, user_hash, phase) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(ts, procedure, type, status, duration, str(e.userHash, 32), phase),
    );
  }

  const counts = Array.isArray(body.counts)
    ? body.counts.slice(0, MAX_BATCH)
    : [];
  for (const c of counts as Record<string, unknown>[]) {
    const minute = int(c.minute);
    const procedure = str(c.procedure);
    const n = int(c.n);
    const phase = str(c.phase, 20);
    if (minute === null || !procedure || n === null || n < 1 || !phase)
      continue;
    statements.push(
      env.DB.prepare(
        "INSERT INTO request_counts (minute, procedure, n, phase) VALUES (?, ?, ?, ?)",
      ).bind(minute, procedure, n, phase),
    );
  }

  for (let i = 0; i < statements.length; i += D1_BATCH) {
    await env.DB.batch(statements.slice(i, i + D1_BATCH));
  }
  return json({ stored: statements.length });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/ingest") {
      if (!bearerOk(request, env.HW_NETWORK_REQUESTS_INGEST_TOKEN))
        return json({ message: "Unauthorized" }, 401);
      return ingest(request, env);
    }
    return json({ message: "Not found" }, 404);
  },
};
