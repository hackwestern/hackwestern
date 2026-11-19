# NEXT: sponsor dashboard (branch `sponsor-dashboard`)

## Now
Build coffee chat preferences + organizer assignment in the app, in its own worktree, with code review before merging.

- **Sponsor side:** `mocks/sponsor-chat-setup-v1/` (preferences form: reps, 1-on-1 and/or group, 15 or 30 min, availability blocks, slot preview, notes, shortlist up to 40, submit, lock). Keep v7's shortlist rules (`mocks/sponsor-coffee-chats-v7/FEEDBACK.md`).
- **Organizer side:** `mocks/organizer-coffee-autofill-v4/` (rooms board, drag room/time, Edit booking, organizer events with hackers, auto-fill preview, send, lock after invites, Request change).
- **Rules:** all in `docs/decisions.md`, entry "2026-11-18: Coffee chat preferences, locking, and organizer bookings". Rooms Sat 10-5, max 6 per room, one room per 1-on-1 rep, no more than contracted chatting hours, warn past 3 h, shortlist locks rooms and times.
- **Data model sketch:** prefs, reps, units (one unit = one 1-on-1 rep or one group = one room), availability blocks, per-slot seat overrides, submission snapshot; add a position to `sponsor_shortlist`; `unitId` on `coffee_chat_hold` and `coffee_chat`. Preferences also mirror to a new sheet tab.
- Copy goes in `src/content/`, not in components.

## Where things stand (2026-11-19)
- **PR #1165** (draft, base `spon-judging`) now has the app code AND all docs, mocks, NEXT.md, context/ and the full decisions log (commits 35a2f8a8, 477dee5a). `_local/` and `_to_delete/` stay out. The repo is public.
- **Backups:** ops-pings and all 14 sd-* branches are pushed to origin as-is, no PRs. Unknown how much of each is already in #1165; check before merging any.
- **Sheet** reorganized 2026-11-18 (Contract Breakdown = per-sponsor day-of hub, Team Assignments = formulas, live sponsor info has 7 sponsors). Mismatches to fix are in Contract Breakdown's "To do / mismatches" column.
- **Handoff page** for a teammate: `docs/handoff/sponsor-dashboard-handoff-2026-11-19.html` (also published privately as a claude.ai artifact).

## Local setup
- **App:** `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx next dev -p 3013`. The `.env` DATABASE_URL (Neon) fails auth.
- **Mocks:** `python -m http.server 3040 --bind 127.0.0.1` from the worktree root, then http://127.0.0.1:3040/mocks/
- **Test sponsors** (side-nav server, port 3035): Scotiabank `11111111-1111-4111-8111-111111111111`, Accenture `22222222-2222-4222-8222-222222222222`.
- Keep `SHEET_WRITES` off locally.

## Open questions for Jazz
- Sponsor edit deadline for preferences (mock placeholder: Thu Nov 19, 11:59 PM).
- New colored floor map: need the original file (only a screenshot exists) in `context/refs-img/`.
- Are Rm 1348-1358 in Ivey (labelled "Ivey · Floor 1" in v4)? Pins need an Ivey floor plan.
- Sheet mismatches: Commure workshop/chats unscheduled, Manulife speaker and contract mismatch, CSE coffee chats, HW contact conflicts (Lucas/Brittney vs Caroline/Alice), Coffee Chats hours.
- Sponsor-track judging: Grand Hall or Rm 2110/2230/2235?
- Registering PCBWay, QNX, Accenture, Manulife and TinyFish as sponsors (Lucas), then add their live sponsor info rows.
- Retire the "Coffee Chat Room Grid" tab? It only has rooms 2241-2243.

## Queued
- QR scan reminder: when an organizer scans a hacker's QR (scavenger hunt, food), pop up if they have an unanswered coffee chat invite.
- Map update once the file arrives.
- ops-pings needs its own PR. Admin page for the web team.

## Files touched this session (2026-11-18/19)
- **Mocks:** `organizer-coffee-autofill-v3`, `v4`; `sponsor-chat-setup-v1` (built by a subagent).
- **Docs:** `docs/decisions.md` (4 entries), `docs/handoff/`, this file.
- **Google Sheet:** Contract Breakdown, Team Assignments, live sponsor info.
- **Elsewhere:** `hackwestern/docs/case-study/build-gallery.mjs` + `index.html` (promo case study gallery, untracked, main repo).
