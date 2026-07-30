# Runbook: Hacker Email Campaign Rollout

Operator guide for sending the "Hack Western 13 is coming!" announcement to past
hackers (HW11 + HW12). The code is fully built on branch `feat/hacker-email-campaign`
(Tasks 1–8). This runbook is the **manual rollout** — you run it later with prod
access. Nothing here writes code.

> **Golden rule (safety ordering):** the migration must be applied **and** the
> unsubscribe routes deployed **before any send**. Always dry-run before
> `--commit`/`--send`. Test-send to yourself before the first real batch. Monitor
> bounces/quota daily. Stop the routine when a run reports **0 recipients**.

## Prerequisites

- Prod `DATABASE_URL` (Postgres connection string). Passed **inline** on the command
  line — never commit it.
- Cloudflare Email creds: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`.
- `NEXTAUTH_URL` = prod base URL (e.g. `https://www.hackwestern.com`) — used to build
  unsubscribe links.
- Postgres CLI tools (`pg_restore`) — installed at
  `/opt/homebrew/opt/postgresql@17/bin`. Add to PATH for this shell:
  ```bash
  export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
  ```
- The three dumps in `~/repos/db-dumps/`:
  - `hw_11_db (1).dump` — HW11, Postgres custom format
  - `hw12_dump.dump` — HW12, Postgres custom format
  - `hw12.dump` — HW12, plain SQL (~41 MB, kept as-is)

> **Command pattern:** every script runs as
> `npx dotenv -- tsx ./scripts/<name>.ts …`. The `--` is **required** — without it
> `dotenv` swallows the script's own flags (`--commit`, `--send`, `--chunk`, `--start`).

---

## Step 1 — Apply the migration to prod

Creates the `email_subscriber` table.

```bash
DATABASE_URL='<PROD_DATABASE_URL>' npm run db:migrate
```

Confirm the table exists:

```bash
psql '<PROD_DATABASE_URL>' -c '\d email_subscriber'
```

You should see columns including `email`, `source`, `unsubscribe_token`,
`unsubscribed_at`, `bounced_at`, `last_sent_at`.

---

## Step 2 — Deploy the branch (unsubscribe routes live BEFORE any send)

Deploy `feat/hacker-email-campaign` to prod so both routes are live:

- Page: `/unsubscribe`
- One-click API: `/api/unsubscribe`

**Verify** the page renders the on-brand error state (no send has happened yet, so any
token is invalid):

```
https://www.hackwestern.com/unsubscribe?token=deadbeef
```

You should get the on-brand **"Invalid link"** page. Do not proceed to any send until
this is confirmed live.

---

## Step 3 — Extract emails from the dumps

Restore the custom-format dumps to plain SQL (no database needed — `-f` writes a file):

```bash
cd ~/repos/db-dumps
pg_restore -f /tmp/hw11.sql "hw_11_db (1).dump"
pg_restore -f /tmp/hw12.sql hw12_dump.dump
# hw12.dump is already plain SQL — leave it as-is.
```

Emails live in the hacker-bearing tables' email columns (`user`, `application`).
**Inspect the restored SQL first** to confirm the exact column name and its position in
each `COPY` block:

```bash
grep -n 'COPY public\.' /tmp/hw11.sql | grep -iE 'user|application'
grep -n 'COPY public\.' /tmp/hw12.sql | grep -iE 'user|application'
```

Then pull every email address from those files into one-per-line lists. The
importer normalizes, dedupes, typo-fixes, and drops `.edu`/junk downstream, so a
broad regex grep is fine here:

```bash
grep -oiE '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' /tmp/hw11.sql \
  | sort -u > /tmp/hw11-emails.txt
grep -oiE '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' /tmp/hw12.sql \
  | sort -u > /tmp/hw12-emails.txt

wc -l /tmp/hw11-emails.txt /tmp/hw12-emails.txt
```

> Domain-level validation was done during the project: 5,113 unique
> domain-deliverable addresses (3,822 freemail + 223 other, 1,068 school excluded),
> 0 dead domains. After the typo-fix and `.edu` drop the importer should land around
> **~4,045** rows.

---

## Step 4 — Import subscribers (dry run, then commit)

`scripts/import-subscribers.ts` reads `/tmp/hw11-emails.txt` and `/tmp/hw12-emails.txt`,
normalizes + typo-fixes domains, drops school/junk addresses, and auto-excludes any
email already in the `preregistration` table (keeps the two tables disjoint). It is
**dry-run by default**; `--commit` performs the inserts.

Dry run first — confirm the prepared count is ~4,045:

```bash
DATABASE_URL='<PROD_DATABASE_URL>' \
  npx dotenv -- tsx ./scripts/import-subscribers.ts
```

Output: `Prepared <N> subscriber rows (excluded <M> preregistration emails).`
If `<N>` looks right (~4,045), commit:

```bash
DATABASE_URL='<PROD_DATABASE_URL>' \
  npx dotenv -- tsx ./scripts/import-subscribers.ts --commit
```

Output: `Inserted <N> new, skipped <existing> existing.`

Verify:

```bash
psql '<PROD_DATABASE_URL>' -c 'SELECT count(*) FROM email_subscriber;'
```

---

## Step 5 — Owner test-send to yourself + unsubscribe round-trip

Do this **before any real batch.** Insert your own address as an `hw12` subscriber:

```bash
psql '<PROD_DATABASE_URL>' -c \
  "INSERT INTO email_subscriber (email, source, unsubscribe_token)
   VALUES ('you@example.com', 'hw12', gen_random_uuid()::text);"
```

Send exactly one email (the eligible-recipients query orders by `id` ascending; your
freshly inserted row is last, so use a large chunk **or** temporarily ensure it's the
only eligible row — simplest is to run a small chunk and check the recipient printed).
Confirm it's you, then send:

```bash
DATABASE_URL='<PROD_DATABASE_URL>' \
CLOUDFLARE_ACCOUNT_ID='<...>' \
CLOUDFLARE_EMAIL_API_TOKEN='<...>' \
NEXTAUTH_URL='https://www.hackwestern.com' \
  npx dotenv -- tsx ./scripts/send-campaign.ts --send --chunk=1
```

> Tip: run the **dry run** first (drop `--send`) to see which address chunk=1 would
> hit; the query returns the lowest `id` first, so if you want to guarantee it's you,
> test on a throwaway/empty DB or delete the imported rows' eligibility isn't practical
> — instead, run the dry run, confirm the printed recipient, and only `--send` once
> you're comfortable. If chunk=1 targets a real hacker instead of you, hold off and
> test on staging.

Checks:

1. The email **renders** correctly (subject "Hack Western 13 is coming!", footer shows
   the edition number, no physical address, a working Unsubscribe link).
2. Click **Unsubscribe** in the footer → lands on `/unsubscribe`, one-click confirms.
3. Re-query the row and confirm `unsubscribed_at` is now set:

   ```bash
   psql '<PROD_DATABASE_URL>' -c \
     "SELECT email, unsubscribed_at, last_sent_at FROM email_subscriber
      WHERE email='you@example.com';"
   ```

   `unsubscribed_at` non-null = one-click works. Once verified, you may delete the test
   row.

---

## Step 6 — Schedule the paced cloud routine

`scripts/send-campaign.ts` is dry-run by default; `--send` actually sends. Flags:

- `--chunk=<n>` — number of recipients this fire (default 75).
- `--start=<ISO>` — the campaign start timestamp. The eligibility query only sends to
  rows whose `last_sent_at` is null or **earlier than** `--start`, so keep this value
  **fixed for the whole campaign** — that's what prevents anyone getting a second copy.

**Cloudflare limit is 1000 emails/day.** Ramp over days and stay under it:

| Day | Target/day | Suggested `--chunk` | Cadence |
|-----|-----------|--------------------|---------|
| 1   | ~200      | ~40                | every ~45 min |
| 2   | ~400      | ~55                | every ~45 min |
| 3+  | ~600–800  | ~75                | every ~45 min |

At ~75/fire, every ~45 min, in a 9am–7pm window (~10 hrs → ~13 fires) you send
~975/day — right under the cap. Start smaller and ramp `--chunk` up across days.

Create the routine (use the `schedule` skill / routines):

- **Cron:** every ~45 minutes, **only** within a 9am–7pm window (your timezone).
- **Command per fire (single command):**
  ```bash
  npx dotenv -- tsx ./scripts/send-campaign.ts --send --chunk=<ramped n> --start=<CAMPAIGN_START_ISO>
  ```
  e.g. `--start=2026-08-01T00:00:00Z` — pick it once and never change it.
- **Env provisioned in the routine config** (never committed):
  `DATABASE_URL` (prod), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`,
  `NEXTAUTH_URL`.
- **Routine prompt / guardrail:** run the one send command, report the chunk log
  (`sent / bounced / failed`), then stop. Do not retry, do not loop, do not raise the
  chunk size on its own.

The send script self-throttles (500 ms between emails) and **stops early on any
quota/rate/429 error** within a fire, so a single fire can't blow the cap.

---

## Step 7 — Monitor daily & wind down

Each day while the routine runs:

- Watch the per-fire logs for `bounced` and `failed` counts. Bounced addresses get
  `bounced_at` set automatically and are excluded from future sends.
- Spot-check quota:
  ```bash
  psql '<PROD_DATABASE_URL>' -c \
    "SELECT count(*) FROM email_subscriber
     WHERE last_sent_at::date = CURRENT_DATE;"
  ```
  Keep the daily total < 1000.
- If bounce/fail rates spike, pause the routine and investigate before resuming.

**Stop condition:** when a fire reports **0 recipients**
(`Chunk: 0 recipient(s).`), the eligible list is drained — **disable/delete the
routine.** The campaign is complete.

Remaining-work check:

```bash
psql '<PROD_DATABASE_URL>' -c \
  "SELECT count(*) FROM email_subscriber
   WHERE unsubscribed_at IS NULL AND bounced_at IS NULL AND last_sent_at IS NULL;"
```

`0` = everyone eligible has been sent to.

---

## Quick reference

| Action | Command |
|--------|---------|
| Migrate prod | `DATABASE_URL='<prod>' npm run db:migrate` |
| Restore HW11 dump | `pg_restore -f /tmp/hw11.sql "hw_11_db (1).dump"` |
| Restore HW12 dump | `pg_restore -f /tmp/hw12.sql hw12_dump.dump` |
| Import (dry run) | `DATABASE_URL='<prod>' npx dotenv -- tsx ./scripts/import-subscribers.ts` |
| Import (commit) | `… npx dotenv -- tsx ./scripts/import-subscribers.ts --commit` |
| Send (dry run) | `… npx dotenv -- tsx ./scripts/send-campaign.ts --chunk=<n> --start=<ISO>` |
| Send (real) | `… npx dotenv -- tsx ./scripts/send-campaign.ts --send --chunk=<n> --start=<ISO>` |
