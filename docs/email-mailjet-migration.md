# Email migration: Cloudflare → Mailjet

Full cutover of the email transport from **Cloudflare Email Sending** (beta,
$5/mo, hard **200/day** cap) to **Mailjet Send API v3.1**. Cloudflare's 200/day
cap can't do app-season bursts (a 4,000-person blast would take 20 days; ~1,600
acceptance emails, 8 days), which is what forces the move — independent of cost.

This branch is a **held replacement**: merge it the day Mailjet is provisioned
and warmed. It is **not** a coexistence/feature-flag setup — on merge, all email
(transactional + drip) sends via Mailjet.

## What this branch changes (code — done)

- `src/server/mail.ts` — transport swapped to Mailjet; **same `sendEmail`
  interface**, so no caller changed (signup/verify/reset/application
  confirmations + the drip all keep working).
- `src/server/mail-mailjet.ts` — the Mailjet Send API v3.1 transport (pure,
  unit-tested in `mail-mailjet.test.ts`).
- `src/env.js` / `.env.example` — added `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
  (optional at build time so the branch compiles before the account exists;
  `sendEmail` guards on them at runtime).
- `.github/workflows/send-campaign.yml` — drip now needs the Mailjet secrets.

## Architecture: keep the two streams isolated

Even on one platform, transactional and marketing must NOT share a sending
reputation — a marketing-complaint spike cannot be allowed to sink
password-reset / acceptance delivery. Isolate via:

| Stream                                                          | Sender                         | Mailjet subaccount | Sending subdomain           |
| --------------------------------------------------------------- | ------------------------------ | ------------------ | --------------------------- |
| Transactional (signup/verify/reset, **acceptances/rejections**) | `hello@hackwestern.com`        | subaccount A       | e.g. `send.hackwestern.com` |
| Marketing (drip, apps-open blast, 2-day warning)                | `updates@mail.hackwestern.com` | subaccount B       | `mail.hackwestern.com`      |

Subaccount count is tier-gated (Starter = 1) — you likely need **Essential/
Premium** for two. Each subaccount has its own API key/secret. This branch wires
a single `MAILJET_API_KEY`/`MAILJET_SECRET_KEY`; when the second subaccount
exists, route marketing sends (the drip) through its key — small follow-up in
`sendEmail` (add an optional `stream` arg) or a second env pair.

## Volume sizing

Busiest month (October, high end): 4,000 apps-open + ~400 new-signup
confirmations + ~1,600 application confirmations + ~1,600 decisions + 4,000
2-day warning ≈ **~12,000** of the 15k Essential tier. Transactional +
marketing share the monthly pool. Flex to the 20k tier for a spike month, then
drop back.

## Before merging (prerequisites — needs the live account)

1. Mailjet account provisioned; plan chosen (Essential+ for 2 subaccounts).
2. Two subaccounts created (transactional, marketing).
3. Sending subdomains added + **SPF/DKIM verified** in Mailjet for each:
   - SPF: add Mailjet's `include:spf.mailjet.com` to the subdomain's TXT.
   - DKIM: add the `mailjet._domainkey.<subdomain>` TXT Mailjet generates.
   - Keep DMARC (`p=reject` on the marketing subdomain is fine once aligned).
   - Set a **custom tracking (CNAME) domain** so click-tracking is on
     `hackwestern.com`, not Mailjet's shared `mjt.lu`.
4. Secrets set in GitHub + Vercel: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`.
5. **Warm up** (see below) — do NOT switch cold in-season.

## Warmup (must land before October)

Mailjet's IPs/your subdomains start cold. Start ~2 months out (by early
September). Warm each stream to its own subdomain, engaged recipients first,
daily and consistent:

| Week | ~emails/day |
| ---- | ----------- |
| 1    | 20 → 40     |
| 2    | 80          |
| 3    | 120         |
| 4    | 150+ (full) |

Transactional warms naturally via real signups; front-load engaged seeds if
needed. Watch bounces (<2%) and complaints (<0.10%) before each step up.

## Cutover (merge day)

1. Confirm prerequisites 1–5 above, warmup green.
2. Merge this branch to `dev`, then promote `dev → main` (prod).
3. Verify a live transactional send (trigger a signup) lands in inbox and
   authenticates (SPF/DKIM/DMARC pass in "show original").
4. Verify a drip run sends via Mailjet (`ok` lines, no send-config error).

## Rollback

Revert the merge commit (restores the Cloudflare transport in `mail.ts`); the
Cloudflare secrets are still present, so transactional resumes immediately.
Keep the Cloudflare account active until Mailjet is proven for a full cycle.

## Phase 2 (after cutover is stable)

- **Bounce handling:** Mailjet does NOT return permanent bounces synchronously
  (Cloudflare did, via `permanent_bounces`). The drip's `classifyResult` →
  `bouncedAt` marking goes quiet. Port `scripts/sync-cf-suppression.ts` to
  Mailjet's suppression/contact-events API so bounced addresses are marked in
  the DB. Mailjet auto-suppresses known-bad addresses regardless, so no mail is
  sent to them in the meantime.
- **Retire Cloudflare:** once suppression sync is ported, remove
  `CLOUDFLARE_EMAIL_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` from `src/env.js`,
  `.env.example`, and the workflows; delete `scripts/sync-cf-suppression.ts` +
  `.github/workflows/sync-cf-suppression.yml`; close the Cloudflare Email
  Sending beta.
