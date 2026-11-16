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

Never edit an applied migration. Add the next numbered file:

```bash
npx wrangler d1 migrations create hw-network-requests add_env_column -c workers/hw-network-requests/wrangler.toml
# edit migrations/0002_add_env_column.sql, e.g. ALTER TABLE request_events ADD COLUMN env TEXT;
npm run load-tester:migrate     # try it on the local D1
```

CI applies it to dev when it reaches `dev` and to prod when it reaches `main`.

The app skips logging entirely while `HW_NETWORK_REQUESTS_INGEST_URL` or
`HW_NETWORK_REQUESTS_INGEST_TOKEN` is unset. `clock.get` (polled every 2s per client) is
counted per minute in `request_counts` instead of one row per call.
