# NEXT: coffee chat build (worktree `hackwestern-coffee-prefs`, branch `coffee-prefs`)

## Now
Review `mocks/sponsor-chat-calendar-v1` with Jazz (spec: `docs/specs/sponsor-chat-calendar.md`), then build the sponsor flow in the app: 1 Calendar, 2 Shortlist, 3 Confirm. Open: Jazz's OK on the buffer (30-min chats = 25 + 5 break; 15-min back to back).

## Done (2026-11-19)
- Spon Team sheet reorganized: "Start here" tab, tab order, blue/orange tab colors, yellow = missing info, Sunlife/Tinyfish respelled, "live sponsor info" → "Sponsor Status", Contract Breakdown → "Sponsor Day-Of", Team Assignments → "Spon Team". Backup: `_local/spon-run-of-show-backup-2026-11-19-before-reorg.xlsx`.
- App finds "Sponsor Status" (old names still work). Commit f2f20e49.
- Organizer Sponsors tab reads the sponsor list from Sponsor Day-Of, not the separate master sheet (was stuck on Loading). Commit 16ae9b34.
- Both merged (fast-forward) into `sponsor-dashboard` locally. Not pushed.
- Mocks (in `hackwestern-sponsor-dash/mocks/`): sponsor-chat-setup-modal-a/b/c-v1 (Jazz prefers B's look, not a modal), sponsor-chat-setup-steps-v1 (in-page, B look), organizer-coffee-autofill-v5, organizer-coffee-cards-grid-v1.

## Queued (in the order Jazz asked)
1. Scan page: after scanning a hacker, the sponsor picks which of their reps wants to talk to them.
2. Saturday workarounds (proposed, not approved): held slots, invite from scan, ask for a slot, booth chat.
3. Organizer coffee chat page: rooms grid first, sponsor info under the rooms. Organizer bookings = ad hoc room bookings (e.g. a sponsor wants a room last minute), not schedule events, and no separate tab. v5 and cards-grid mocks still show schedule events and an events tab: fix in the next mock.
4. Help ping (proposed, see decisions 2026-11-19): phone field in setup; "Need help" shows the HW lead's name + phone; Slack post carries sponsor, message, location, sponsor phone and @mentions the lead; no help tracking on the dashboard.
5. Do NOT push `sponsor-dashboard` until Jazz says so.
6. Bug (live app): /internal/sponsors at 390px wide renders blank below the status filter pills (seen by the home-table mock agent, 2026-11-19). Organizers use phones, so fix before the event.

## Open questions
- Setup deadline: Fri Nov 20, 9:30 PM; auto-submit at 9:30; invites out by 10 PM Fri (decision 2026-11-19).
- Coffee chat planning: answer the 5 open questions in decisions 2026-11-19 "two pools" (rooms as columns, flexibility + busy strip, clash winner, Ivey default, Ivey reps and the booth), then mock sponsor-chat-calendar-v2.
- Drive folders: Drive connector is on a view-only Google account; reconnect as jazz.gu2004 to move files.
- Vercel env snapshot is from Nov 16; confirm production's RUN_OF_SHOW_SHEET before merging.
- HW contact conflicts: Sponsor Status says Lucas (Manulife) and Brittney (Commure); Sponsor Day-Of says Caroline and Alice.

## Local setup
- Worktree app: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx next dev -p 3014`
- Tests: `SKIP_ENV_VALIDATION=1 npx vitest run` (baseline: 1 known Apple Wallet failure)
- Mocks: http://127.0.0.1:3040/mocks/ (served from hackwestern-sponsor-dash)
- Keep SHEET_WRITES off locally.
- Read prize tracks from Sponsor Day-Of "Custom API / Prize Track" checkbox instead of the hardcoded src/content/sponsor-prize-tracks.ts (today: Canada Life, QNX, Scotiabank, Sun Life, TinyFish, PCBWay). TinyFish judges remotely (decision 2026-11-19).
- My sponsors: read HW Contacts "Login email" (column C, header match) to map the signed-in organizer to their name, then Sponsor Day-Of HW lead to their sponsors; on-call from RUN OF SHOW shifts.

## Jazz's to-do list (2026-11-19)
1. Judging view: pick the final design (mocks A–D; D = Holia slider, rubric modal, 3 modes, several reps) and decide whether a sent top 5 can be changed.
2. Hacker coffee chat invites on Slack: Accept / Decline DM (exists) updated for the session model, expiry 20 min (35 Ivey), auto-refill, reconfirm after changes.
3. Spon team task pings on Slack: owner DM / team channel (exists) + "Text" on overdue tasks + failure-only delivery status.
4. Sponsor help comms: "Text your lead" from the portal; lead off shift → "Leave a message" posts to Slack tagging whoever's on call (on-call from RUN OF SHOW, Slack user found by login email).
5. Done 2026-11-19: "Rationale + Decisions" tab in the sheet (first tab) summarizing every decision; keep it in sync with docs/decisions.md.
- Build: merge Sponsor Status into Sponsor Day-Of; rebuild Coffee Chat Setup columns for the session model; Sponsor requested help flow (Slack DM + I'm on it + 5-min escalation).
- Overnight unattended build: Jazz said no for now (2026-11-19). Build order if/when it runs: sponsor setup → invites → task pings + help + My sponsors (v3 layout) → sheet mirrors; judging Saturday.

## 8-hour build plan (Jazz, 2026-11-19) — start in a FRESH session
Read first: docs/decisions.md (all 2026-11-19 entries, esp. "Jazz's answers to the full plan"), docs/specs/coffee-chat-sessions.md, hackwestern-sponsor-dash/mocks/CHANGES.md. Mocks: sponsor = mocks/sponsor-portal-flow-hacker-v6, organizer coffee = mocks/organizer-coffee-v8, My sponsors = mocks/organizer-my-sponsors-v3, judging = mocks/sponsor-judging-redesign-d-v1 (but: no modes, 1-at-a-time or list, top 3).
0. (30 min, main branch first) Merge coffee-prefs into sponsor-dashboard once its review fixes pass. Make shared changes once (schema additions, router registration, sponsors.tsx tabs) before worktrees.
Parallel tracks, each its own worktree + port + code review before merge:
A. Sponsor coffee chat setup (portal): Your team (name+phone, crown), preferences (hackers per chat 1–5, availability grid, chats per rep incl. 0), review & submit, shortlist (shared, cap, scanned first, due 9:30 PM), Your chats calendar after Send. Fri 5 PM.
B. Hacker invites from the schedule: exact seats, round 1 Fri 10 PM (accept by Sat 10 AM), round 2 Sat 10:30 AM + automatic 30-min rounds; order scanned → shortlist → interested; existing Slack Accept/Decline + email fallback.
C. Organizer board tweaks: copy icon on phones (no Contact/Text/Call), chats asked per rep, Noah-only Send, partial session (1:00–1:30) for buffer-cut sessions, sheet Room Grid mirror.
D. My sponsors (v3 tables, reps only) + login-email matching + portal Help = lead's number + Noah emergency.
E. Sheet: merge Sponsor Status into Sponsor Day-Of; Coffee Chat Setup columns for sessions; Sponsor Judging writes (top 3).
F. (Saturday) Judging: one at a time or list, Holia-style 1–10 half-point score + rubric, several reps, ranked top 3, digital entry by Devpost link.
Future (low priority): run of show + task pings rework.
