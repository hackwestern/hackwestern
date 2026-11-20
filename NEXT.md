# NEXT: sponsor dashboard (worktree `hackwestern-coffee-prefs`, branch `coffee-prefs`)

## Now
Organizer Home (v3 day view) is built and pushed (fcc1209e, bbb15965); screenshots in docs/screens/organizer-home/. Waiting on Jazz: what "contacts sit under Up next and Key rooms" means on the organizer Home (no Key rooms card there), and whether to add the left-out columns (docs/decisions.md, last entry). Re-check PR #1165's Vercel preview once its new deploy finishes.

## Merged in from judging-board (2026-11-19)
- The organizer Judging board (mock organizer-judging-board-v2 with Jazz's 5 changes) is merged: Tools → Judging board. Migration `0061_judging_board` (2 tables) needs running. Build notes: docs/decisions.md, "Judging board build choices"; screenshots in the judging-board worktree, mocks/judging-board-build-v1/screens/.

## Merged in from coffee-board-v12 (2026-11-19, local, not pushed)
- Organizer coffee board v12 (mock organizer-coffee-v12 in full): drag, fixed cells, chat modal, warnings, two-step "isn't free" move, hacker editing, first in line. Migration 0062. Demo data: scripts/seed-coffee-board-v12-demo.sql (local only). Not yet clicked through in a browser; Jazz to check, then push. Open questions: see the coffee-v12 worktree's NEXT.md.

## Where things stand (2026-11-19, end of day)
- Built, reviewed, merged and pushed (PR #1165, sponsor-dashboard ← coffee-prefs): sponsor setup, invites (instant re-send on decline, round 1 expires Sat 10 AM, no open seats), organizer coffee board, My sponsors + Needs attention, sheet merge, judging (6-min slots, up to 15 teams, ranked top 5, Judging Scores tab), portal v6 restyle, Jazz has Noah's view, Agentation (dev only), phone dev login.
- Local only, NOT pushed: bb218af5 locked "Coffee Chat Invites" sheet tab (push with the next work).
- Tests 1784 pass (only the known Apple Wallet failure), tsc clean, lint 0 errors at last full run.
- Ship-run docs: docs/ship/ (start at SHIPPED.md). Mock review queue: hackwestern-sponsor-dash/mocks/CHANGES.md "New mocks for review".

## Mocks waiting for Jazz's review (don't build until approved)
- sponsor-chats-v3 (sponsor Chats one stage at a time, Send availability, 40 hackers, icons, dynamic key rooms, contacts, welcome card)
- sponsor-today-v4 (sponsor Home: chevron Up next, Help bottom left) — likely superseded by sponsor-chats-v3's Home
- organizer-coffee-v12 (drag, fixed cells, red warnings, modal, per-chat counts, contact-the-rep step, edit hackers, first in line; 6 real sponsors)
- organizer-invite-preview-v2 (preview + edit invites before Send; only "invited by 2 sponsors" list)
- organizer-judging-board-v2 (3 rooms, room select, only "Text lead" warning, team modal with members/attendance/links) — finished, ready for review

## Open questions for Jazz
- Who merges PR #1165 to main (runs prod migrations 0059/0060) before Fri 5 PM; add Production secrets (Slack token, run-of-show sheet creds) and arm `COFFEE_ROUNDS_LIVE` Sat morning.
- Sheet data: CSE coffee-chat box unticked; Manulife/Commure judging rooms "RM 555"/"RM 44" test values?; Sun Life has no judging room (4 in-person sponsors, 3 rooms).
- Caroline owns the sheet, so she can't be removed from the locked tabs (only by transferring ownership).
- Old task pings already scheduled in Slack (if any) need cancelling by hand.
- When the real app gets "put someone first in line" / invite preview, it needs an "organizer pick" invite source (small migration).

## Local setup
- App: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret COFFEE_INVITES_ENABLED=dry npx next dev -H 0.0.0.0 -p 3014` (add DEV_LOGIN_KEY=<key> for the phone sign-in link /api/dev/login?key=…; Tailscale IP 100.84.66.106). Jazz's own server: hackwestern-sponsor-dash on :3013 (turbopack).
- Tests: `SKIP_ENV_VALIDATION=1 npx vitest run`. Mock gallery: http://127.0.0.1:3040/mocks/ (rebuild list with `node mocks/build-index.mjs` in hackwestern-sponsor-dash).
- Google Sheets read quota is tight: keep few dev servers running.
- Commit specific files only; no Co-Authored-By lines.

## Files touched this session (2026-11-19)
Shared base (schema 0059/0060, root routers); tracks A–F and integration (coffee-chat-setup/invites/sessions/requests/respond routers + utils, sponsor portal pages + components, organizer components, sheet utils + mirrors, judging lib/routers/components, content files); portal shell restyle; dev login route, next.config, _app (Agentation); docs/ship/*, docs/handoff/*, docs/specs/judging-room-board.md, docs/decisions.md, context/refs.md. Live sheet: Sponsor Day-Of columns, Coffee Chat Setup rebuild, At CC workshop, Judging Scores, Coffee Chat Invites (locked), HW Contacts "Same view as".
