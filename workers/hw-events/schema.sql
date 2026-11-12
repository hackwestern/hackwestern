-- D1 schema for the hw-events Worker. Apply with:
--   npx wrangler d1 execute hw-events --remote --file=schema.sql
-- No retention: Hack Western runs once a year, so rows are kept indefinitely.

CREATE TABLE IF NOT EXISTS request_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,           -- epoch ms
  procedure   TEXT    NOT NULL,           -- tRPC path, e.g. "teams.getTeam"
  type        TEXT    NOT NULL,           -- query | mutation
  status      TEXT    NOT NULL,           -- "OK" or tRPC error code
  duration_ms INTEGER NOT NULL,
  user_hash   TEXT,                       -- salted hash; NULL when anonymous
  phase       TEXT    NOT NULL            -- before | during | after | unknown
);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON request_events (ts);
CREATE INDEX IF NOT EXISTS idx_events_proc ON request_events (procedure);
CREATE INDEX IF NOT EXISTS idx_events_user ON request_events (user_hash, ts);

-- Per-minute counters for high-frequency polling procedures (e.g. clock.get).
-- Several rows may exist per (minute, procedure), one per server instance;
-- sum `n` when reading.
CREATE TABLE IF NOT EXISTS request_counts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  minute    INTEGER NOT NULL,             -- epoch minutes
  procedure TEXT    NOT NULL,
  n         INTEGER NOT NULL,
  phase     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_counts_minute ON request_counts (minute);
