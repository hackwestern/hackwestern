# hw-network-requests

Cloudflare Worker + D1 that stores request events for traffic profiling, so
analytics writes stay off the main Neon database. Metadata only: procedure,
status, duration, a salted user hash and the event phase. Never request bodies.

## Config

Everything lives in the repo-root `.env` (no `.dev.vars`): `HW_NETWORK_REQUESTS_INGEST_TOKEN`.
The worker reads the same name the app does. The worker only accepts writes
(`POST /ingest`); read data with `npm run load-tester:query`.

## Deploy (CI/CD, not npm scripts)

Prod operations are meant to run from the pipeline, not by hand:

- create the D1 once: `npx wrangler d1 create hw-network-requests` (paste the id into `wrangler.toml`)
- apply `schema.sql` to the remote D1
- upload the `HW_NETWORK_REQUESTS_INGEST_TOKEN` worker secret
- `wrangler deploy -c workers/hw-network-requests/wrangler.toml` (prints the URL)

Vercel does not read `.env`: set `HW_NETWORK_REQUESTS_INGEST_URL` and
`HW_NETWORK_REQUESTS_INGEST_TOKEN` there. Local: `npm run load-tester:dev`
(loads `.env`), `load-tester:migrate-local`, `load-tester:studio`.

The app skips logging entirely while `HW_NETWORK_REQUESTS_INGEST_URL` or
`HW_NETWORK_REQUESTS_INGEST_TOKEN` is unset. `clock.get` (polled every 2s per client) is
counted per minute in `request_counts` instead of one row per call.
