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
