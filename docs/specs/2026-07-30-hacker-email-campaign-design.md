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
- School/`.edu` recipients (graduation bounce risk, unverifiable by MX) — see
  Import step 4.

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
  source            varchar  not null              -- 'hw11' | 'hw12' → edition # in footer
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
   (users/applications), excluding organizer/sponsor/mentor records.
3. **Clean:** lowercase, dedup, drop the known dead/junk domains, and
   auto-correct the salvageable typos (`gmaill.com`→`gmail.com`,
   `outlook.con`→`outlook.com`, `uwo.com`→`uwo.ca`,
   `uwaterloo.caq`→`uwaterloo.ca`, `sheidancollege`→`sheridancollege`,
   `mail.utoronto.com`→`mail.utoronto.ca`).
4. **Exclude school/.edu addresses.** Any `.edu`, `.ac.*`, or known
   Canadian university domain (uwo.ca, uwaterloo.ca, mcmaster.ca, utoronto.ca,
   etc.) is dropped — graduated hackers lose these mailboxes and MX cannot detect
   it, so they are a bounce risk we avoid entirely. A hacker who also provided a
   personal (freemail/other) address is still reached via that one, since we
   dedup per person across editions; only people whose *only* address is a `.edu`
   are dropped.
5. **Assign** `source` (hw12 wins on overlap) + generate `unsubscribe_token`.
6. **Insert** idempotently (skip emails already present). Dry-run default;
   `--commit` to write.

Validation already run (MX + syntax + typo-correction on the combined dumps):
5,113 unique deliverable addresses, 0 dead domains. Bucketed: **3,822 freemail**
(gmail/outlook/etc — safe), **1,068 school/.edu** (excluded per step 4), **223
other**. **Send target ≈ 4,045** (freemail + other), before the hacker-row filter
narrows it further.

## Deduplication & single-send guarantee

Requirement: **no address ever receives more than one campaign email.** Enforced
at four layers:

1. **Normalization on import.** Every email is trimmed + lowercased before
   storage, so `A@X.com` and `a@x.com` collapse to one. (Optional, gmail-only:
   canonicalize `johndoe`/`john.doe`/`johndoe+tag@gmail.com` to one inbox — dots
   and `+tags` are ignored by gmail. Applied to `@gmail.com`/`@googlemail.com`
   only, since dot/plus semantics are provider-specific.)
2. **Unique constraint.** `email_subscribers.email` is `UNIQUE` — the DB rejects
   a second row for the same normalized address, across both editions and all
   three dumps. hw12 wins on overlap (insert order + `ON CONFLICT DO NOTHING`).
3. **Send-cursor exclusion.** The batch query excludes any row with
   `last_sent_at >= :campaignStart`, so a row already emailed in this campaign is
   never re-selected on a later daily run.
4. **Crash safety.** `last_sent_at` is written immediately after each successful
   send (sequential, one at a time). Worst case on a mid-send crash is a single
   address re-sent once; the unique row + cursor prevent any wider duplication.

Note: the ~49 `preregistration` (HW13 site) signups live in a separate table and
are not part of this campaign, so no cross-table double-send occurs here. If a
future send unions both sources, dedup by normalized email across tables first.

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

New `campaignTemplate(email, edition, unsubscribeUrl)` in `email-templates.ts`
(reuses the shared MJML skeleton: banner → white card → footer). `edition` is the
number derived from `source` (`hw11`→`11`, `hw12`→`12`). Footer adds:

```
You're receiving this at {email} because you subscribed to Hack Western {edition}.
Unsubscribe · hackwestern.com
```

e.g. "…because you subscribed to Hack Western 12." Rendered in the existing small
grey footer style. The `{email}`, `{edition}`, and `{unsubscribeUrl}` are
per-recipient, so the send loop renders the template per row (not once).

## Send pipeline (chunked, paced, resumable, bounce-aware)

One-off script (`scripts/send-campaign.ts`). Rather than one big daily blast, it
sends **small chunks spread across the day** — gentler on receiving providers
(sudden spikes from a low-reputation domain get throttled / spam-foldered) and it
warms the sending domain gradually. The 1000/day Cloudflare cap is a ceiling, not
the target rate.

- **Query per chunk:** `email_subscribers WHERE unsubscribed_at IS NULL AND
  bounced_at IS NULL AND (last_sent_at IS NULL OR last_sent_at < :campaignStart)`
  ordered by id, `LIMIT :chunkSize`.
- **Chunk send:** sequential, ~500ms gap between messages, per-recipient template
  render, per-row ok/FAIL log. Default `chunkSize ≈ 75`.
- **Pacing:** self-paced runner sleeps ~45 min between chunks, only within a
  daytime window (e.g. 9am–7pm local — better deliverability + open rates, looks
  human). Long-running/background, or relaunched by a scheduler; either way
  resumable via `last_sent_at`, so restarts never double-send.
- **Warmup ramp:** ease volume up over days instead of a flat rate — e.g. day 1
  ~200, day 2 ~400, then ~600–800/day, always < the 1000/day cap. A cold domain
  sending 900 on day 1 is exactly the spike we're avoiding.
- **On success:** set `last_sent_at = now()`.
- **On bounce:** Cloudflare returns `permanent_bounces`; set `bounced_at` on
  those rows so they're skipped and never retried.
- **Quota / throttle awareness:** `sendEmail` can return HTTP 200 with
  `success:false` (quota exhaustion), or bounce/failure rate can climb; the loop
  checks `error` on every result and, if failures spike, pauses/stops early and
  logs where it stopped so the next run resumes cleanly.
- **Cadence:** ~4,045 target over roughly **6–8 days** at the ramped, paced rate.
  Tunable via `--chunk`, `--interval`, `--daily-cap`, `--window`. Dry-run
  default; `--send` to fire.

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
