# HW11/12 Hacker Email Campaign + Unsubscribe — Design

**Date:** 2026-07-30
**Status:** Approved (pending spec review)

## Overview

Import the email addresses of past Hack Western hackers (editions 11 and 12)
into a new subscribers table and send them Hack Western 13 update emails, in
batches that respect Cloudflare's sending quota. Every campaign email carries a
compliant, one-click unsubscribe. This closes the current gap: the site's
transactional emails have no unsubscribe, and there is no store of consented
marketing recipients beyond the ~49 HW13 homepage preregistrations.

## Goals

- A single source of truth for marketable email subscribers, with per-recipient
  provenance (which edition they signed up for) and unsubscribe state.
- Import HW11 + HW12 hacker emails from the existing DB dumps into that table.
- Send HW13 update emails to all subscribed recipients, batched under the
  1000/day Cloudflare cap, resumable, and bounce-aware.
- One-click unsubscribe (link + `List-Unsubscribe` header) that immediately and
  permanently opts a recipient out. Honored on every subsequent send.

## Non-goals

- Per-list / per-year subscription preferences (HTN-style toggle page). Single
  on/off per subscriber for now; table is shaped so lists can be added later.
- Migrating the existing 49 `preregistration` rows into the new table.
  Preregistration is left untouched.
- Retrofitting unsubscribe onto the transactional emails (reset/verify/signup
  confirmation). Tracked as a follow-up, out of scope here.
- Editions older than HW11 (CASL implied-consent window has likely expired).

## Consent / legal basis

- Recipients are limited to **HW11 + HW12** hackers. Basis: CASL implied consent
  from an existing relationship, which lasts ~24 months from last engagement.
  Both editions fall inside that window as of 2026-07.
- Every email states the basis and identifies the sender, and offers immediate
  unsubscribe (CASL requires honoring within 10 business days; we honor
  instantly).
- **Known gap (accepted by owner):** no physical postal address in the footer.
  CAN-SPAM (US recipients) technically requires one. The list is
  majority-Canadian; the risk is accepted. Sender is still identified with a
  contact email + website.

## Data model

New table, created via one Drizzle migration. `preregistration` is unchanged.

```
email_subscribers
  id                serial primary key
  email             varchar(320) unique not null   -- stored lowercased
  source            varchar  not null              -- 'hw11' | 'hw12'
  unsubscribe_token varchar  unique not null       -- random, URL-safe
  unsubscribed_at   timestamp null                 -- null = subscribed
  bounced_at        timestamp null                 -- set on permanent bounce
  last_sent_at      timestamp null                 -- batch cursor / idempotency
  created_at        timestamp not null default now()
```

- `source` drives the footer year ("…because you subscribed to Hack Western
  {11|12}").
- If an email appears in both editions, insert once and prefer `hw12` (more
  recent engagement = stronger consent).
- `unsubscribe_token` is a random 20+ byte hex/base64url string, matching the
  existing reset/verify token style in `auth.ts`.
- `last_sent_at` makes the send resumable and idempotent across daily batches.

## Import pipeline

One-off script (`scripts/import-subscribers.ts`), run locally against the prod
DB via an inline `DATABASE_URL` (never committed).

1. **Source:** the three dumps in `~/repos/db-dumps/` — `hw_11_db (1).dump`
   (HW11), `hw12_dump.dump` + `hw12.dump` (HW12). Restore custom-format dumps to
   text with `pg_restore` (no DB needed to extract).
2. **Filter to hackers:** pull emails from hacker-bearing rows only
   (users/applications), excluding organizer/sponsor/mentor records. This shrinks
   the raw ~5.1k address matches to the real hacker set.
3. **Clean:** lowercase, dedup, drop the 12 known dead/junk domains, and
   auto-correct the salvageable typos (`gmaill.com`→`gmail.com`,
   `outlook.con`→`outlook.com`, `uwo.com`→`uwo.ca`,
   `uwaterloo.caq`→`uwaterloo.ca`, `sheidancollege`→`sheridancollege`,
   `mail.utoronto.com`→`mail.utoronto.ca`).
4. **Assign** `source` (hw12 wins on overlap) + generate `unsubscribe_token`.
5. **Insert** idempotently (skip emails already present). Dry-run default;
   `--commit` to write.

Validation already run (MX + syntax on the combined dumps): 5,122 unique
addresses, 0 syntax-invalid, 12 undeliverable domains → ~5,110 domain-deliverable
before the hacker-row filter narrows it further.

## Unsubscribe flow (instant, one-click)

- **Route:** `GET /unsubscribe?token=…` (Next.js page or API route). Looks up
  the token, sets `unsubscribed_at = now()` if not already set, renders a simple
  "You've been unsubscribed" confirmation. Invalid/missing token → generic
  "link invalid" page. Idempotent (re-hitting is a no-op success).
- **One-click headers:** every campaign email sets
  `List-Unsubscribe: <https://hackwestern.com/unsubscribe?token=…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), passed through
  `sendEmail`'s existing `headers` option. Satisfies Gmail/Yahoo bulk-sender
  rules.
- **Footer link:** visible "Unsubscribe" anchor to the same URL.
- No auth required — the token is the capability. Tokens are unguessable and
  scoped to a single subscriber.

## Email template changes

New `campaignTemplate(email, year, unsubscribeUrl)` in `email-templates.ts`
(reuses the shared MJML skeleton: banner → white card → footer). Footer adds:

```
You're receiving this at {email} because you subscribed to Hack Western {year}.
Unsubscribe · hackwestern.com
```

Rendered in the existing small grey footer style. The `{email}` and
`{unsubscribeUrl}` are per-recipient, so the send loop renders the template per
row (not once).

## Send pipeline (batched, resumable, bounce-aware)

One-off script (`scripts/send-campaign.ts`), same run pattern as the backfill.

- **Query:** `email_subscribers WHERE unsubscribed_at IS NULL AND bounced_at IS
  NULL AND (last_sent_at IS NULL OR last_sent_at < :campaignStart)` ordered by
  id, `LIMIT :limit` (default 900, under the 1000/day cap).
- **Send:** sequential, ~500ms gap, per-recipient template render, per-row
  ok/FAIL log.
- **On success:** set `last_sent_at = now()`.
- **On bounce:** Cloudflare returns `permanent_bounces`; set `bounced_at` on
  those rows so they're skipped next run and never retried.
- **Cadence:** re-run daily for ~6 days until the query drains. `--send` to fire
  (dry-run default), `--limit` to override the daily cap.
- **Quota awareness:** `sendEmail` can return HTTP 200 with `success:false` on
  quota exhaustion; the loop checks `error` on every result and stops early if it
  starts seeing quota failures, logging where it stopped.

## Testing

- **Unit:** token generation uniqueness; unsubscribe route sets `unsubscribed_at`
  and is idempotent; send query excludes unsubscribed + already-sent + bounced
  rows; template renders the per-recipient footer + unsubscribe URL.
- **Import:** dry-run over a fixture asserts dedup, typo correction, hw12-wins
  overlap, dead-domain drop.
- **Manual:** send one campaign email to the owner's address first (as with the
  backfill), verify rendering + that the unsubscribe link actually flips the
  flag, before the first real batch.

## Rollout

1. Migration → prod (`db:generate`, `db:migrate`).
2. Deploy the `/unsubscribe` route (must be live before any send).
3. Run import (dry-run → `--commit`) against prod.
4. Owner test-send to self; verify unsubscribe round-trip.
5. Daily batches (~900) until drained, monitoring bounces + quota.

## Open items

- Confirm which dump tables/columns identify "hacker" vs organizer/sponsor/mentor
  (resolved during import-script build by inspecting the restored schema).
- Campaign email body copy (the actual HW13 announcement) — separate from this
  infra work.
- Follow-up: add unsubscribe to transactional emails for full compliance.
