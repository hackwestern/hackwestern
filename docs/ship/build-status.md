# Build status

Started 2026-11-19, 08:06. Merged: C (08:54), E (08:58), D (09:20). Six tracks build in parallel worktrees (A–F); each is code-reviewed, fixed and merged into `coffee-prefs`. Status: **Building**, **Done**, **Simplified** (with note) or **Blocked** (with reason).

Intended features follow `docs/decisions.md`. Where Jazz's ship brief lists something a logged decision removed, the decision wins:
- **No 30-min 1-on-1 option.** 1-on-1 = 15 min, groups = 30 min.
- **Chats per rep instead of hours per rep.** Each rep picks a number of chats; 0 = doesn't chat.
- **No tracked help requests.** Help = the HW lead's name and phone, with Noah as the emergency contact.
- **No overdue-task pings.** Tasks show as "Now and next".

## Sponsor side

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| S1 | First login and orientation (welcome tour) | D | Done | Exists. Its "Need help" step points at the removed tracked help; being re-pointed. |
| S2 | Finding the booth and key rooms | — | Done | Portal home: Sponsor Bay layout, venue map, floor plans. |
| S3 | Your team: add/remove reps, name + phone, crown primary | A | Building | Old per-slot setup card is still the live UI. |
| S4 | Chatting preferences: hackers per chat 1–5, availability grid (all ticked, own workshop blocked), chats per rep (0 allowed) | A | Done | Cut sessions tickable ("1:00–1:30 only", Integration 5); "Contact organizers" opens Help. |
| S5 | Review & submit preferences | A | Building | |
| S6 | Shortlist (one person, cap = seats, scanned first) + its own submit | A | Building | Simplified: one person shortlists (Jazz, 2026-11-19). |
| S7 | Scan or look up a hacker → record scan ("Met at Hacker Fair") | A | Building | Scanner exists, but scans aren't saved (`sponsor_scan` has no writer) and there's no rep picker. |
| S8 | Confirmed schedule ("Your chats" calendar, by rep) | A | Done | Times from usableWindow (Integration 6); moved chats stay. |
| S9 | Changes after invites: strong warning, hackers reconfirm | A + B | Done | Rep removal and pref saves reconcile invites (Integration 1). |
| S10 | Help: lead name + phone (copy), Noah emergency | D | Done | Tracked Slack help still mounted in 3 places; Noah's phone is a placeholder. |
| S11 | Every screen says state / what changed / do I act / what's next | A | Building | Added to A's brief. |
| S12 | Judging: one at a time or list, 1–10 half points, rubric, "Who's judging?", top 3 | F | Building | Shortlist save currently fails (writes to a deleted sheet tab). |

## Organizer side

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| O1 | Needs attention now (unsubmitted, unscheduled, changed after Send, overdue tasks shown only) | D | Done | Missing today. |
| O2 | Now and next (event + task + owner) under Happening now | D | Done | Missing today. |
| O3 | Hide Task pings tab (pings off) | D | Done | Still visible. |
| O4 | My sponsors (login-email match, reps, Arrival/Booth/CC workshop pills) | D | Done | CC workshop pill wired to Sponsor Day-Of "At CC workshop" (Integration 8). |
| O5 | Which sponsors submitted / need scheduling | C | Done | Board shows it, but only seed data ever submits (fixed by S5). |
| O6 | Schedule chats from availability, assign rooms, spot clashes | C | Done | Board v8 built. Adding: partial sessions, 0-chat reps, plain status chips, changed-after-Send flag. |
| O7 | Contacting reps: copy icon beside each phone | C | Done | Today: Contact / Text / Call. |
| O8 | Send confirmed schedules & invites (Noah only) | C + B | Done | Also re-confirms sponsors changed after invites (Integration 2). |
| O9 | Hacker invites: one per seat, round 1 Fri 10 PM, 30-min Saturday rounds, Slack + email, kill switch | B | Done | Board shows per-sponsor invite summary (Integration 7). |
| O10 | Judging tab: top 3, digital sponsors' top 3 by Devpost link | F | Building | |
| O11 | Run of show tab without the old room-block editor | D | Done | Superseded by the session board. |

## Sheet

| # | Feature | Track | Status | Notes |
|---|---|---|---|---|
| E1 | Sponsor Status merged into Sponsor Day-Of (app + live sheet) | E | Done | Live sheet edits allowed if they simplify; backup first. |
| E2 | Coffee Chat Setup tab for sessions | E | Done | Mirrored after every setup save (Integration 3). |
| E3 | Prize tracks from the Sponsor Day-Of checkbox | E | Done | |
| E4 | Sponsor Judging writes top 3 | F | Building | |

## Clean-up (Step 4, simplify)

- Unused code: `sponsorPortal.setCoffeeChatBooking`, `getInterestedHackers`; `sponsorDashboard.listSponsors`, `registerSponsor`; components `coffee-chat-board.tsx`, `schedule-list.tsx`, `sponsor-map.tsx`. Decide in simplify; move rather than delete.
- `src/generated/app.json` is stale (lists `sponsorPortal.getCoffeeChatSchedule`). Regenerate before shipping.
- Docs superseded by the session model: `docs/flows/coffee-chat-room-blocks.md`, `docs/plans/room-blocks.md`, `docs/specs/inline-chat-block-editing.md`, `docs/board.md` (stale). Mark them superseded.
- Missing tests: the sponsor portal router, the sponsor-organizer and sponsor-dashboard routers.
