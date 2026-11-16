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
- `dev` -> `hw-network-requests-dev` + its own D1 (GitHub env `Dev`; wrangler
  creates the D1 on the first deploy, see `[env.dev]` in `wrangler.toml`)

Each run deploys, applies `schema.sql` (idempotent) and uploads the
`HW_NETWORK_REQUESTS_INGEST_TOKEN` worker secret. Each GitHub environment needs
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and
`HW_NETWORK_REQUESTS_INGEST_TOKEN`. Wrangler prints a harmless "multiple
environments" warning on prod deploys.

Vercel does not read `.env`: set `HW_NETWORK_REQUESTS_INGEST_URL` and
`HW_NETWORK_REQUESTS_INGEST_TOKEN` there. Local: `npm run load-tester:dev`
(loads `.env`), `load-tester:migrate-local`, `load-tester:studio`.

The app skips logging entirely while `HW_NETWORK_REQUESTS_INGEST_URL` or
`HW_NETWORK_REQUESTS_INGEST_TOKEN` is unset. `clock.get` (polled every 2s per client) is
counted per minute in `request_counts` instead of one row per call.
