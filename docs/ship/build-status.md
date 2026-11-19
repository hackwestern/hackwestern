# Build status

Started 2026-11-19, 08:06. Six tracks build in parallel worktrees (A–F); each is code-reviewed, fixed and merged into `coffee-prefs`. Status: **Building**, **Done**, **Simplified** (with note) or **Blocked** (with reason).

Intended features follow `docs/decisions.md`. Where Jazz's ship brief lists something a logged decision removed, the decision wins:
- **No 30-min 1-on-1 option.** 1-on-1 = 15 min, groups = 30 min.
- **Chats per rep instead of hours per rep.** Each rep picks a number of chats; 0 = doesn't chat.
- **No tracked help requests.** Help = the HW lead's name and phone, with Noah as the emergency contact.
- **No overdue-task pings.** Tasks show as "Now and next".

## Sponsor side

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| S1 | First login and orientation (welcome tour) | D | Building | Exists. Its "Need help" step points at the removed tracked help; being re-pointed. |
| S2 | Finding the booth and key rooms | — | Done (existing) | Portal home: Sponsor Bay layout, venue map, floor plans. |
| S3 | Your team: add/remove reps, name + phone, crown primary | A | Building | Old per-slot setup card is still the live UI. |
| S4 | Chatting preferences: hackers per chat 1–5, availability grid (all ticked, own workshop blocked), chats per rep (0 allowed) | A | Building | Nothing writes `coffee_chat_pref` / `coffee_chat_rep` outside the dev seed today. |
| S5 | Review & submit preferences | A | Building | |
| S6 | Shortlist (one person, cap = seats, scanned first) + its own submit | A | Building | Simplified: one person shortlists (Jazz, 2026-11-19). |
| S7 | Scan or look up a hacker → record scan ("Met at Hacker Fair") | A | Building | Scanner exists, but scans aren't saved (`sponsor_scan` has no writer) and there's no rep picker. |
| S8 | Confirmed schedule ("Your chats" calendar, by rep) | A | Building | Today a list from the old flow only. |
| S9 | Changes after invites: strong warning, hackers reconfirm | A + B | Building | |
| S10 | Help: lead name + phone (copy), Noah emergency | D | Building | Tracked Slack help still mounted in 3 places; Noah's phone is a placeholder. |
| S11 | Every screen says state / what changed / do I act / what's next | A | Building | Added to A's brief. |
| S12 | Judging: one at a time or list, 1–10 half points, rubric, "Who's judging?", top 3 | F | Building | Shortlist save currently fails (writes to a deleted sheet tab). |

## Organizer side

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| O1 | Needs attention now (unsubmitted, unscheduled, changed after Send, overdue tasks shown only) | D | Building | Missing today. |
| O2 | Now and next (event + task + owner) under Happening now | D | Building | Missing today. |
| O3 | Hide Task pings tab (pings off) | D | Building | Still visible. |
| O4 | My sponsors (login-email match, reps, Arrival/Booth/CC workshop pills) | D | Building | |
| O5 | Which sponsors submitted / need scheduling | C | Building | Board shows it, but only seed data ever submits (fixed by S5). |
| O6 | Schedule chats from availability, assign rooms, spot clashes | C | Done (existing) + Building | Board v8 built. Adding: partial sessions, 0-chat reps, plain status chips, changed-after-Send flag. |
| O7 | Contacting reps: copy icon beside each phone | C | Building | Today: Contact / Text / Call. |
| O8 | Send confirmed schedules & invites (Noah only) | C + B | Building | `send` has a TODO; wired after B and C merge. |
| O9 | Hacker invites: one per seat, round 1 Fri 10 PM, 30-min Saturday rounds, Slack + email, kill switch | B | Building | |
| O10 | Judging tab: top 3, digital sponsors' top 3 by Devpost link | F | Building | |
| O11 | Run of show tab without the old room-block editor | D | Building | Superseded by the session board. |

## Sheet

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| E1 | Sponsor Status merged into Sponsor Day-Of (app + live sheet) | E | Building | Live sheet edits allowed if they simplify; backup first. |
| E2 | Coffee Chat Setup tab for sessions | E | Building | |
| E3 | Prize tracks from the Sponsor Day-Of checkbox | E | Building | |
| E4 | Sponsor Judging writes top 3 | F | Building | |

## Clean-up (Step 4, simplify)

- Unused code: `sponsorPortal.setCoffeeChatBooking`, `getInterestedHackers`; `sponsorDashboard.listSponsors`, `registerSponsor`; components `coffee-chat-board.tsx`, `schedule-list.tsx`, `sponsor-map.tsx`. Decide in simplify; move rather than delete.
- `src/generated/app.json` is stale (lists `sponsorPortal.getCoffeeChatSchedule`). Regenerate before shipping.
- Docs superseded by the session model: `docs/flows/coffee-chat-room-blocks.md`, `docs/plans/room-blocks.md`, `docs/specs/inline-chat-block-editing.md`, `docs/board.md` (stale). Mark them superseded.
- Missing tests: the sponsor portal router, the sponsor-organizer and sponsor-dashboard routers.
