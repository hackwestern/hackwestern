# Judging — local testing runbook

How to bring up the judging system locally, smoke-test it end-to-end, and run
an in-person dress rehearsal. Everything here works with zero manual database
edits.

## Prerequisites

- Docker running
- `npm ci` done
- `.env` present with `DATABASE_URL` pointing at localhost (both scripts below
  refuse to run against a non-localhost database)

## First-time setup

```bash
npm run db:start     # postgres container on 5432
npm run db:migrate   # schema + judging triggers
```

**Port 5432 already taken?** (`bind: address already in use` — e.g. a native
postgres install owns it). Run a dedicated container on 5433 and repoint
`.env`:

```bash
# password = whatever your DATABASE_URL says; db name "." is intentional
docker run -d --name hw_judging_db \
  -e POSTGRES_PASSWORD=<password> -e POSTGRES_DB=. \
  -p 5433:5432 docker.io/postgres
# then change localhost:5432 -> localhost:5433 in .env and rerun db:migrate
```

## Seed a judging state

```bash
npm run seed:judging -- --teams 30 --judges 5 --sponsors 2 --rounds 3 --yes
```

Takes ~2 seconds. This **deletes all rows** in `team`, `judge`,
`judging_queue`, `judging_skip` and `team_mark`, then creates:

- 30 submitted teams, every sponsor track covered
- 5 judge accounts (2 sponsored with a track), each with a working
  credentials login
- 1 organizer account
- a loaded queue (3 rounds per team)

Flags (all optional):

| Flag | Default | Meaning |
|---|---|---|
| `--teams N` | 30 | submitted teams |
| `--judges N` | 5 | judge accounts |
| `--sponsors N` | 2 | how many of the judges are sponsored (tracks assigned round-robin) |
| `--rounds N` | 3 | rounds per team loaded into the queue |
| `--password STR` | `hw13-judging` | login password for all seeded accounts |
| `--emails a@x,b@y` | — | ALSO promote existing real accounts to organizer judges (they must have signed up in the app first; errors listing any that don't exist) |
| `--yes` | — | skip the wipe confirmation (required in non-interactive shells) |

## Smoke-test the backend (no UI needed)

```bash
npm run judging:driver
```

Runs 27 checks against the real endpoints via per-judge tRPC callers: the
single-judge happy path, 5 judges assigning and submitting simultaneously,
skip, force-assign (and the evicted judge being blocked), the final-mark
trigger, the sponsored flow, ranking, and purge. Prints ✓/✗ per check and
exits non-zero on failure.

The driver consumes queue rounds and ends by purging the queue — **rerun
`seed:judging` after it** before demoing to humans.

Not covered by the driver: the 15-minute stale-hold reclaim (needs a clock;
`judging.test.ts` covers it by backdating `assigned_at`).

## In-person dress rehearsal

1. `npm run seed:judging -- --yes` (fresh state)
2. `npm run dev`
3. Each person signs in at `/login`:
   - `judge1..judge5@judging.hackwestern.dev` — judges 1–2 are sponsored
   - `organizer@judging.hackwestern.dev` — organizer/admin
   - password `hw13-judging` (or whatever `--password` you set)

   Prefer real accounts? Have people sign up in the app first, then seed with
   `--emails their@emails`.
4. Judges walk the flow; the organizer account drives the admin endpoints
   (`judging.admin.*`: `loadQueue`, `getLatestRanking`, `getAllJudges`,
   `assignJudgeForTeam`, `purgeQueue`, `addJudges`, `deleteTeamMark`).

Note: there is no judging UI yet — until it lands, "walking the flow" means
driving the tRPC endpoints (or watching the driver). The UI is the open
blocker for a real rehearsal.

## Troubleshooting

- **"Non-interactive shell: pass --yes"** — the wipe confirmation needs a TTY;
  add `--yes`.
- **"Seeded judging state not found"** from the driver — run `seed:judging`
  first; the driver looks up accounts by the `@judging.hackwestern.dev`
  email domain.
- **"Invalid environment variables"** — your `.env` predates newer required
  vars; add placeholder values for whatever it lists (local dev doesn't use
  them).
- **Sponsored judge gets "No teams are currently available to judge"** — every
  queued team overlapping their track is already marked/skipped by them, or
  held by others. Reseed, or check `judging_queue`.

## Known gaps (as of 2026-09-17)

- `getSponsorTrackRanking` endpoint not built — sponsored marks are stored but
  can't be ranked.
- Cheat-check status not surfaced in `getLatestRanking`.
- Judging UI not started.
