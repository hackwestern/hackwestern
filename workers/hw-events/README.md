# hw-events

Cloudflare Worker + D1 that stores request events for traffic profiling, so
analytics writes stay off the main Neon database. Metadata only: procedure,
status, duration, a salted user hash and the event phase. Never request bodies.

## Deploy

```bash
cd workers/hw-events
npx wrangler d1 create hw-events            # paste the database_id into wrangler.toml
npx wrangler d1 execute hw-events --remote --file=schema.sql
npx wrangler secret put INGEST_TOKEN        # also set as EVENTS_INGEST_TOKEN in Vercel
npx wrangler secret put READ_TOKEN          # used by `npm run profile:build`
npx wrangler deploy                         # prints the URL -> EVENTS_INGEST_URL in Vercel
```

The app skips logging entirely while `EVENTS_INGEST_URL` or
`EVENTS_INGEST_TOKEN` is unset. `clock.get` (polled every 2s per client) is
counted per minute in `request_counts` instead of one row per call.
