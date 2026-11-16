# hw-network-requests

Cloudflare Worker + D1 that stores request events for traffic profiling, so
analytics writes stay off the main Neon database. Metadata only: procedure,
status, duration, a salted user hash and the event phase. Never request bodies.

## Config

Everything lives in the repo-root `.env` (no `.dev.vars`): `HW_NETWORK_REQUESTS_INGEST_TOKEN`.
The worker reads the same name the app does. The worker only accepts writes
(`POST /ingest`); read data with `npm run load-tester:query`.

## Deploy (CI/CD, not npm scripts)

`.github/workflows/deploy-load-tester-worker.yml` deploys on push:

- `main` -> prod worker `hw-network-requests` + D1 (GitHub env `Production`)
- `dev` -> `hw-network-requests-dev` + its own D1 (GitHub env `Dev`; see
  `[env.dev]` in `wrangler.toml`)

Each run deploys and applies pending D1 migrations (`migrations/*.sql`, tracked
per database by wrangler). Each GitHub environment
needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The ingest token is
not in GitHub: set it on the worker once per environment (it persists across
deploys), using the same value as in Vercel:

```bash
npx wrangler secret put HW_NETWORK_REQUESTS_INGEST_TOKEN -c workers/hw-network-requests/wrangler.toml        # prod
npx wrangler secret put HW_NETWORK_REQUESTS_INGEST_TOKEN -c workers/hw-network-requests/wrangler.toml -e dev # dev
```

Wrangler prints a harmless "multiple environments" warning on prod deploys.

Vercel does not read `.env`: set `HW_NETWORK_REQUESTS_INGEST_URL` and
`HW_NETWORK_REQUESTS_INGEST_TOKEN` there. Local: `npm run load-tester:dev`
(loads `.env`), `load-tester:migrate` (local D1), `load-tester:studio`.

## Changing the schema

Never edit an applied migration; add the next numbered file.

```bash
npm run load-tester:migrate:new -- add_env_column   # creates migrations/0002_add_env_column.sql
# edit it, e.g. ALTER TABLE request_events ADD COLUMN env TEXT;
npm run load-tester:migrate                         # apply to the local D1
```

Remote is automatic: merging to `dev` applies it to the dev D1, merging to
`main` applies it to prod (the "Apply D1 migrations" step in CI). Each
database records what it has run in its own `d1_migrations` table.

The app skips logging entirely while `HW_NETWORK_REQUESTS_INGEST_URL` or
`HW_NETWORK_REQUESTS_INGEST_TOKEN` is unset. `clock.get` (polled every 2s per client) is
counted per minute in `request_counts` instead of one row per call.
