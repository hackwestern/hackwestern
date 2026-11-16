# NEXT — sponsor dashboard (branch `sponsor-dashboard`, not pushed)

## Now
Open the PR. Push `sponsor-dashboard` and open it **into `spon-judging`** (#1112, which it's built on); retarget to `main` once #1112 merges. Jazz to confirm before pushing.

## State (2026-11-16)
- Board: 45 Done, 1 Blocked (T33, Jazz's Slack steps). Backlog empty.
- Checks on 613daf4: `tsc` clean; vitest 968 passed, 1 failed (Apple Wallet signing, fails on base too); `next build` compiled successfully (run in a separate worktree, never in the folder the dev server uses).
- Migrations added: 0039 coffee_chat, 0040 room label/cancelled, 0041 sponsor_help, 0042 help contact, 0043 coffee_chat_room, 0044 coffee_chat_watcher, 0045 sponsor_shortlist.

## Not yet reviewed by a checker agent
T38 (schedule grid), T39 (where-is-everyone move), T41-T46 (rooms, map, ad hoc, watcher, shortlist page, ceremonies). Run code-reviewer + accessibility-tester on `git diff 82bce81..sponsor-dashboard` before merging the PR.

## Jazz (accounts / people)
- Vercel: 7 vars added from `_local/vercel-env.txt`; then move that file to `_local/_to_delete/`.
- Rotate Slack token + signing secret (they were pasted in chat), update Vercel.
- Slack: `/invite @HW13 Bot` in the sponsor team channel; after deploy turn on Event Subscriptions (`/api/slack/events`; reaction_added, message.channels, message.groups). Runbook: docs/runbooks/slack-app.md.
- Optional: service account `hw-run-of-show@...` Editor on the run-of-show sheet (Coffee Chat Bookings mirror).
- Remove MAILJET_* from the Windows/shell environment (local tests could send real mail).
- Move `Downloads\hackwestern-sheets-d3df24095154.json`.
- Test the badge scanner on a real phone.
- Clarify "status" in the spon team's list (assumed: existing sponsor status panel).

## Ask the spon team
- Coffee Chats rows for Scotiabank, Commure, CSE (blank = can't offer chats)
- Canada Life: 3 chatting hours vs a 10-12 window
- Ceremonies tab: add times (or order) per speaker
- Workshops tab: add a Runner/Speaker column
- Room for Sponsor Track Shortlisting
- Check the map pin positions (src/lib/sponsor-map-rooms.ts)

## Local setup
- Dev server: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_spon R2_PUBLIC_BASE_URL=http://localhost:3013 NEXTAUTH_SECRET=local-dev-only-secret NEXTAUTH_URL=http://localhost:3013 SKIP_ENV_VALIDATION=1 npx next dev --turbopack -p 3013`
- Local `.env` has RUN_OF_SHOW_* and GOOGLE_SHEETS_API_KEY (local key `hw-schedule-local`, restricted to Sheets API).
- Demo data: sponsors (Sun Life has a real Coffee Chats row), demo hackers in `_local/demo-accounts.md` (codes demo-otter-kite, demo-maple-fox). Jazz's local account is an organizer; log in at /login (Google login can't work on localhost).
- Worktrees (can be removed after the PR): hackwestern-sd-chat, -sd-help, -sd-hackers, -sd-notify, -sd-sched2. Extra local DBs: hackwestern_sd_*.
- Editing docs/board.md: use a script file (CRLF); keep docs/decisions.md valid UTF-8.
