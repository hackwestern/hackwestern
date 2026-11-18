# NEXT — sponsor dashboard (branch `sponsor-dashboard`, not pushed)

## Now (updated 2026-11-18 late)
- MERGED 8abbe11: `sd-presentations` (Sunday judging rounds per docs/flows/sponsor-judging.md: Send shortlist, scheduler, Notify hackers with per-member claims, round 2 from presenters, /live panel, cheat check). Migration 0050 applied to `hackwestern_spon`. tsc clean; vitest 1295 pass, only Apple Wallet fails. Not seen in a browser (needs Lucas's sheet creds).
  - Owner decisions pending: late shortlist (recommend: fill free gaps, don't move anyone), round 2 timing (recommend: wait for 11:30), add QNX as a sponsor, email members not on Slack (recommend: yes).
- RUNNING `sd-room-blocks` (worktree `hackwestern-sd-room-blocks`, DB `hackwestern_sd_blocks`, port 3022): coffee chats v2 per `docs/flows/coffee-chat-room-blocks.md` in that worktree (sponsor requests 1-on-1 N reps or group M hackers, Ask for fewer, no room cap, one combined view, logos only, sheet Coffee Chats numbers). Migration slot 0051 (its journal lacks 0050: regenerate/renumber at merge).
- RUNNING `sd-availability` (worktree `hackwestern-sd-availability`, port 3023): spon team availability timetable under Run of show + Organizers toggle on the schedule, from RUN OF SHOW columns J-P (SPON TEAM AVAILABILITY / NECESSARY SHIFTS blocks).
- RUNNING `ops-pings` (worktree `hackwestern-ops-pings`, DB `hackwestern_ops_pings`, port 3031), SEPARATE PR stacked on sponsor-dashboard: organizer run-of-show Slack pings from sheet 1lnRCD_q_EYaAcmL-IXkmuWZMNAiFIiU1Linbm8jHyAE ("Schedule View"). DM each owner 15 min before start and at end (title, where, notes/to-do) + post in OPS_PINGS_CHANNEL. Owners matched to Slack profile names of organizer-channel members; groups (Everyone, ALL OF SPON) channel-only; ambiguous names flagged. Needs Jazz: the organizer channel, SLACK_BOT_TOKEN scopes.
- MERGED aaf8e97 `sd-judging-round2`: Open/Close round 2 (organizer button, server-enforced), email for members not on Slack, By hacker view with notice status, Final results with hackers. Migration 0052 applied to `hackwestern_spon` (journal idx 51 = tag 0052). tsc clean; vitest 1363 pass, only Apple Wallet fails.
  - Open question: after round 2 opens, a sponsor with no slot can still rank from their shortlist (never locked out). OK?
  - MERGE NOTE for sd-room-blocks: its migration was told to be 0051; main's journal already has idx 51 (tag 0052). Regenerate/renumber its migration as 0053 at merge.
- Coffee chat page mockups: `mocks/sponsor-coffee-chats-v3/` a-candidate-list, b-rooms-first, c-pipeline (serve with `python -m http.server 3040 --bind 127.0.0.1` from the repo root). Waiting for Jazz's pick.
- Waiting on Jazz: where the sponsor booth projector/screen setup info lives (not in the run-of-show sheet).
- Optional polish offered: portal shows "Welcome, Sponsor!" for a few seconds until the sheet read finishes; could show name + logo from the DB right away.
- `hackwestern-sd-tester` (branch `sd-tester-sponsor`) has no work and no note: ask Jazz.

## To build (queued, Jazz 2026-11-18)
- **Sponsors tab (organizer first page) changes by day** (Jazz 2026-11-18). Build after sd-room-blocks merges (both touch the Sponsors table).
  - Friday: per sponsor, have they arrived, and have they been given their portal link (organizer ticks; store in DB; show counts "5 of 9 arrived").
  - Saturday: coffee chat status (from room blocks v2).
  - Sunday: did they send their shortlist / submit their top 5, and where they should be right now (judging room, presentations, booth) from the run of show.
- **Hacker notification center on the live site.** Hackers see their coffee chat offers/updates and, if a sponsor shortlisted them, their judging presentation rooms + times. Unread count on the existing `NotificationBadge` in `src/components/live/navlinks.tsx`.
- **Slack bot finds hackers by the Slack email they give us.** Add a "Slack email" field hackers fill in (fallback: account email). Today `src/server/slack/coffee-chat-dm.ts` already DMs via `users.lookupByEmail` with the account email, then falls back to email; reuse that one helper for coffee chats AND judging (Notify hackers in sd-presentations), so one lookup, one place.
- Every Slack DM also writes a notification row, so the center and Slack always say the same thing.
- **Admin page (for web team)**, Jazz 2026-11-18. Logistics and system health, not sponsor feedback. Like Vercel's dashboard:
  - Status tiles: site up, database, Google Sheets read, Slack, email (Mailjet), last cron/task-ping run. Green/amber/red with "last checked".
  - Notifications: every coffee chat / judging / task message with its platform (Slack DM, email, notification center), status (sent, failed, no Slack match), and a retry button. Counts per platform.
  - Responses: hackers offered vs accepted / declined / no reply, for coffee chats and judging slots.
  - Errors: recent server errors (tRPC failures, sheet read failures, Slack API errors) with time and where.
  - Alerts: when something fails (site down, sheet unreadable, a batch of messages failing), post to a web-team Slack channel. Site-down needs an outside checker (Vercel cron or an uptime service), since a down site can't report itself.
  - Needs from Jazz: which Slack channel for alerts, who's on the web team (organizer role or a list), and whether an uptime service is OK.
  - Build after the notification center (they share the notification log table).

## Where things stand (2026-11-18)
- Merged: Lucas's #1143 (top-40 candidates), schedule/organizer/sponsor redesigns, sponsor candidates + GitHub avatars, T55 one organizer home (tabs Sponsors | Run of show | Coffee chats | Task pings), room holds + combined Sponsors table + sponsor colours, automatic Slack owner matching + Task pings tab (help merged in), gentle column focus, floor 2 plan image instead of the live map, ceremony/workshop info by day, real sponsor logos (no circle).
- Migrations 0047 (task reminder route key) and 0048 (coffee chat holds) are applied to the local DB.
- Checks on 473435c: tsc clean; vitest all pass except Apple Wallet. One lint warning in `src/components/sponsors/sponsor-badge.tsx` (no-img-element: the disable comment sits on the `return` line; move it onto the `<img>` line inside JSX).
- Login now sends ALL organizers to `/internal/sponsors`.

## Open questions for Jazz
- **REMINDER: Noah's phone number** for the sponsor portal emergency contact. Set `phone` in `src/content/sponsor-venue.ts` (shows "Phone number coming soon" until then).
- Lucas's sheet IDs (`SPONSOR_JUDGING_SHEET`, `SPONSOR_MASTER_SHEET`, `HACKER_INTEREST_FORM`) are not in git: ask Lucas or read them from Vercel env vars. Until then the Sponsors tab is empty locally. `1JRfqib3...` is Luka's HW13 schedule sheet, not Lucas's.
- Add `SLACK_BOT_TOKEN` to local `.env` (signing secret, channel and mention were copied in), then restart :3013.
- Limit Slack owner matching to spon-team channel members? (needs `channels:read`, plus `groups:read` if private)
- More sponsor colour token pairs in `src/lib/tokens.ts` (main folder)? Less needed now that logos show.
- OK to show the interest form's resume + link for hackers who didn't agree to share? (currently yes, first name only)
- Before the PR: `next build` in a spare worktree, strip `mocks/` from the PR, push `sponsor-dashboard`, PR into `spon-judging` (needs Jazz's OK). Slack buttons/reactions only work after deploy; then turn on Event Subscriptions.
- Rotating the Slack token/secret is optional (they were pasted in chat).

## Files touched this session (main areas)
- `src/pages/internal/sponsors.tsx`, `src/components/sponsors/organizer/*` (tabs, Sponsors table, run of show, coffee chats, task pings)
- `src/components/sponsors/`: day-grid, coffee-chat-room-table, sponsor-filter, sponsor-badge, hacker-avatar, help-queue
- `src/pages/sponsors/[uuid]/*` (portal, coffee chats + candidates, scan, schedule)
- `src/server/api/routers/`: sponsor-portal, sponsor-shortlist, coffee-chat-requests, sponsor-organizer, task-reminders, sponsor-schedule; `src/server/slack/directory.ts`
- `src/lib/`: sponsor-timeline, sponsor-colors, sponsor-logos, sponsor-next-event, coffee-chat-holds, sponsor-organizer, run-of-show
- `drizzle/0047`, `drizzle/0048`; `tsconfig.json`, `.eslintrc.cjs`; `src/pages/dashboard.tsx` (organizer redirect); `public/shared/sponsors/scotiabank-trimmed.svg`
- Docs: `docs/decisions.md`, `docs/redesign-brief.md`, `docs/flows/sponsor-organizer.md`, `docs/flows/coffee-chat-room-blocks.md`
- Outside the repo: `~/.claude/skills` (Emil Kowalski skills installed; old versions in `_to_delete/emil-skills-before-2026-11-17`), `~/.claude/settings.json` (removed the `Read(**/.env)` deny rule; other .env variants still blocked).

## Local setup
- Dev server: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_spon R2_PUBLIC_BASE_URL=http://localhost:3013 NEXTAUTH_SECRET=local-dev-only-secret NEXTAUTH_URL=http://localhost:3013 SKIP_ENV_VALIDATION=1 npx next dev --turbopack -p 3013` (restart it after `npm install` or `.env` changes; it goes stale).
- Organizer tabs: `/internal/sponsors` (Sponsors), `?tab=schedule`, `?tab=coffee`, `?tab=pings`. Sponsor portal: `/sponsors/<id>` (local ids: `SELECT name,id FROM sponsor_judging_sponsor` via `docker exec hackwestern_db psql -U postgres -d hackwestern_spon`).
- Demo data: demo hackers in `_local/demo-accounts.md`. Jazz's local account is an organizer; log in at /login (Google login can't work on localhost).
- Worktrees (remove after the PR): hackwestern-sd-chat, -sd-help, -sd-hackers, -sd-notify, -sd-sched2. Extra local DBs: hackwestern_sd_*.
- Editing docs/board.md: use a script file (CRLF); keep docs/decisions.md valid UTF-8.
