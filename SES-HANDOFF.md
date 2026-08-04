# SES / Email Deliverability — Handoff

> Working doc for continuing the SES production-access effort. **Delete before merging to `main`** (it's a handoff note, not shipping code). No secrets in here — account IDs and case numbers only.

## TL;DR
Marketing SES production access was **rejected** (new-account + `MARKETING` mail-type = highest bar). Plan: **re-appeal as TRANSACTIONAL first** to get out of the sandbox and build reputation; keep marketing OFF SES for now. Account-trust + SES Part A setup is **done**. Remaining: add Website URL on the AWS account, (optionally) deploy the new privacy page, then **reply to the AWS case** with the transactional-first draft below.

## Key decisions
- **Re-appeal as transactional, not marketing.** Transactional is the lower approval bar; `hackwestern.com` mail (verification / RSVP / application confirmations) genuinely is transactional.
- **Marketing stays off SES for now.** The ~4,000-person "you're auto-subscribed" blast is a cold-list marketing send — do NOT send it via SES (sandbox or a future grant) right now. It's parked.
- **Brevo was considered and dropped** (user's call). No managed-provider work in flight.
- Reply to the **existing case**, don't open a new one (unless it's been resolved >14 days and won't reopen → then new case referencing the old ID).

## Status — DONE
- ✅ AWS root email already on org domain (`hello@hackwestern.com`) — no change needed.
- ✅ Expired payment method (Meghan Lo card) **replaced** with a valid one.
- ✅ `hackwestern.com` verified as an SES identity in **us-east-1**, DKIM **SUCCESS**.
- ✅ Account-level **suppression** enabled (BOUNCE + COMPLAINT) — account-wide (also covers `marketing.hackwestern.com`).
- ✅ Clean **mailbox-simulator** sends (success/bounce/complaint).
- ✅ SES account state: `ProductionAccessEnabled=false` (still sandbox), `SendingEnabled=true`, `EnforcementStatus=HEALTHY`, quota 200/day @ 1/s.
- ✅ Privacy policy page built + pushed to this branch (`/privacy`).

## Status — REMAINING (before sending the re-appeal)
1. **AWS Account page → add Website URL** = `https://hackwestern.com` (currently None). Also Company name = `Hack Western`. Quick trust signal.
2. **Confirm privacy page content** (see below) — provider list + résumé→sponsor sharing.
3. **Run `next lint` + prettier** on the two changed files (couldn't run in the cloud container — no deps installed).
4. **Deploy the privacy page** so `hackwestern.com/privacy` is live — required only if you want the draft to claim a privacy policy (see draft note). Otherwise use the softened line.
5. **Reply to AWS case #178547265200428** with the draft below.

## This branch's code changes (commit `ea1e6b8`)
- **`src/pages/privacy.tsx`** (new) — full privacy policy at `/privacy`. Tailored to the real stack: Vercel Speed Insights (only analytics), GitHub/Google/Discord OAuth sign-in, Vercel/Neon/Cloudflare/AWS/Zoho providers, sponsor résumé sharing. Uses `SEO` component, `cossetteTexte`/`figtree` fonts, indexable.
- **`src/pages/index.tsx`** — "Privacy Policy" link under the sign-up form (matches the existing "Interested in sponsoring?" link).
- **Verify before merge:** provider list accurate? résumé→sponsor sharing OK to state as implied consent? Run lint/prettier.
- **Aside:** existing sponsor link points to `hello@hackwestern.me` (`.me`, not `.com`) — possible typo routing sponsor inquiries nowhere. Not touched here.

To view: `git checkout claude/ses-limits-rejected-u08bz5 && npm run dev` → http://localhost:3000/privacy (static, no DB/login needed).

## Re-appeal draft (paste as a reply to case #178547265200428)
> Plain text. Every claim below is now true given the setup above. **Privacy line:** as written it says "shows our public sign-up form, and includes our contact information" (safe now). Only change it to "…and includes our privacy policy" once `hackwestern.com/privacy` is actually deployed.

```
Hello,

Thank you for the review. We would like to be reconsidered, and we have
revised our request to a narrower, lower-risk scope rather than
resubmitting the same one.

Revised request: production access for TRANSACTIONAL email only, from our
verified domain hackwestern.com, in us-east-1. We are not requesting bulk
or promotional sending in this request. We are asking for a modest initial
sending quota matching our real volume (on the order of a few hundred
emails per day).

About us: Hack Western is a registered student-run non-profit hackathon at
Western University in London, Ontario, Canada. Our website,
https://hackwestern.com, describes the event, shows our public sign-up
form, and includes our contact information.

What we send (all transactional, triggered by a user action):
- Account email-verification and password-reset messages.
- Confirmation emails when someone submits an application or RSVPs.
- A confirmation email when someone signs up on our website to receive
  updates, sent only in response to their own signup.
These are one-to-one, transaction-triggered messages to the individual who
took the action. We are not sending unsolicited mail to a list under this
request.

Recipient and reputation handling:
- We have enabled SES account-level suppression for bounces and complaints,
  and we monitor the bounce and complaint reputation metrics in the SES
  console, pausing if either approaches AWS thresholds.
- We have tested our setup against the SES mailbox simulator (success,
  bounce, and complaint) to confirm our bounce and complaint handling
  behaves correctly before any production volume.
- Every recipient reached this way took an explicit action (verification,
  application, RSVP, or opt-in signup) immediately before the email is sent.

Authentication and account:
- hackwestern.com is a verified SES identity with DKIM signing enabled and
  passing, and SPF and DMARC are published for the domain.
- Our AWS root-account contact is an address on our own hackwestern.com
  domain, and our account billing is current and verified.

Prior context: our organization previously used a different provider on
shared sending infrastructure. We have since moved to properly
authenticated, dedicated identities under our own domain, which is why we
are establishing this SES setup cleanly from the start.

We are happy to provide any additional detail. Thank you for reconsidering.

Best regards,
Hack Western Organizing Team
```

## Reference
- AWS account: **279138051063** (Amazon Web Services Canada, Inc.), region **us-east-1**.
- Support case: **#178547265200428** (SES production access).
- SES identities: `hackwestern.com` (transactional, this effort) + `marketing.hackwestern.com` (marketing, custom MAIL FROM `bounce.marketing.hackwestern.com`, DMARC p=quarantine).
- Re-appeal facts (verified against AWS docs + re:Post + practitioners): denials are NOT final; reply to the same case; no cooldown; change something material; a case resolved >14 days can't be reopened → file a new one referencing the old ID.
