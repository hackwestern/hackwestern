# Decisions log (ship run, 2026-11-19)

Calls made during the unattended build, and anything blocked or left for Jazz. Product decisions are also copied into `docs/decisions.md`.

## Calls made

- **Logged decisions win over the ship brief's feature list.** The brief asks for optional 30-min 1-on-1s, hours per rep, tracked help requests and overdue-task pings; `docs/decisions.md` (2026-11-19) removed all four. The brief's own "when not sure" order puts project decisions first.
- **Ship-run docs live in `docs/ship/`**, not the repo root, to keep the root clean.
- **One person shortlists** (Jazz, mid-build): no rep picker, no picked-by column.
- **Invites can't fire by accident:** nothing is sent until an organizer presses Send for that sponsor, plus a `COFFEE_INVITES_ENABLED` kill switch that defaults to off outside production.
- **Live sheet:** edited directly only to simplify it. A full Drive copy is made first, retired tabs are hidden with an "(old)" prefix rather than deleted, sharing is unchanged, and the Rationale + Decisions tab is kept in sync.

- **Invites (track B's open questions):**
  1. *Cap per hacker:* at most **2 live invites** (pending or accepted) per hacker at a time. Otherwise the top-ranked hackers collect seats and decline late. Considered: no cap (unfair), a cap of 1 (too few chats for keen hackers).
  2. *Delivery record:* add `coffee_chat.notified_at` (migration 0060, in track B's branch only). Rounds retry invites that were never notified and never DM twice. Considered: no record (a failed DM is never retried; a resend double-DMs).
  3. *Timed rounds:* keep the page-traffic trigger and "Run now", and add a GitHub Actions workflow every 10 minutes on Saturday that runs a round. Like `incomplete-reminder.yml`, it's a dry run unless the repo variable `COFFEE_ROUNDS_LIVE` is `true`. Considered: page traffic only (stalls if nobody has the page open).
  4. *Partial sessions:* the rule stays: a session cut by the workshop buffer keeps only whole chats that end by the buffer. For Sun Life (setup 2:00, buffer from 1:45), 30-minute chats give 1:00–1:30, which matches Jazz's note.
  5. *Friday declines:* seats freed overnight wait for round 2 at 10:30 AM. Jazz already accepted that 10–11 AM chats are filled only in round 1.

- **Live sheet restructured (track E):**
  - A backup copy was made first. Its link is kept out of the repo because the repo is public.
  - Sponsor Day-Of gained Status, Booth location, Workshop room, Workshop time, Judging room and Team track filter, with values moved from Sponsor Status.
  - Sponsor Status is now hidden as "(old) Sponsor Status".
  - Coffee Chat Setup was rebuilt for sessions; the old version is hidden as "(old) Coffee Chat Setup".
  - Five rows of Rationale + Decisions were updated. One write overwrote two rows; both were restored with their exact text.
- **Track B's agent couldn't be resumed** after finishing (its session record was gone). A fresh agent applies the review fixes from the handoff doc.

- **Organizer board (track C's open questions):**
  1. *Partial sessions* end at the last whole chat: 15-minute chats give 1:00–1:45 and 30-minute chats give 1:00–1:30. This is the same rule as invites (D4).
  2. *A sponsor whose reps all asked for 0 chats* still counts as submitted, shown as "Submitted, no chats asked". They did their part.
  3. *No organizer names on board changes*: showing which sponsor changed something is enough. Considered: a new placements column (another migration for little gain).
  4. *The Help sheet's "30-minute 1-on-1s" goes now*, and the scheduler ignores `longer_one_on_one`. Jazz removed that option, so 1-on-1s are always 15 minutes.
  5. *Disabled look on the shared primary `DashboardButton`*, not only on Send, so every disabled button looks disabled.

- **My sponsors (track D's open questions):**
  1. *People* shows phone + copy only, no Text/Call, the same as the coffee board (Jazz's answer).
  2. *All sponsors* stays the existing day board without help; rebuilding it as the mock's three tables is skipped before the freeze. My sponsors is the new view.
  3. *Needs attention* shows every sponsor's items, with the organizer's own sponsors first. Someone arriving cold (and Noah, who sends) needs the whole picture. Considered: own sponsors only (hides problems from Noah).
  4. *A task counts as overdue* for one hour after its window, since nothing marks tasks done. Accepted.
  5. *CC workshop pill:* attendance is stored in a new Sponsor Day-Of column "At CC workshop" (checkbox), read and written like Status. It's wired at merge. Considered: dropping the pill (Jazz asked for it), a DB column (the sheet is where the team already looks).
- **Sheet writes were not fully gated:** saving a sponsor status wrote to the live sheet even with SHEET_WRITES off. This predates the build. Fixed in track E, and every write call is now checked to be gated.

- **Sponsor setup (track A's open questions):**
  1. *Scanned hackers count against the seat cap.* They fill seats first, so the shortlist shows "N seats · M taken by people you scanned · shortlist up to N − M". Considered: not counting them (sponsors would shortlist people who can never get a seat).
  2. *Removing a rep after Send stays allowed behind the warning*, but must tell hackers. The removal calls track B's `reconcileInvitesAfterChange` with `removingPlacementIds` before the delete, so invited hackers get a cancellation and their seats are re-offered. Wired at merge. Considered: organizer-only removal (sponsors are never there at the same time to ask), soft delete (needs a migration).
  3. *Shortlist cards* also show school, program and year where the application has them. Skills stay off.
  4. *"Message organizers"* opens track D's Help (lead + Noah). There's no separate form.
- **Judging (track F's open questions):**
  1. The sheet's status words are fine, and the "In person / Digital" column stays.
  2. The list is split between reps alphabetically. Splitting by table comes later.
  3. Anyone on the sponsor login can send the shortlist and submit the top 3. One login is shared by the team.
  4. *The Run-of-show judging panel* reads pick counts from the deleted tab and always shows "unknown". It now counts saved picks from the database (fix at merge).
  5. *"No portal link for digital sponsors"* is decided by the sheet's In person / Digital column, not by whether a DB row exists. Checked at merge.

- **Integration (gaps from the test guide):**
  1. *Moving or fixing a sent chat keeps it sent.* Invited hackers are asked to reconfirm the new room or time straight away. Today it goes back to draft and disappears from the sponsor's "Your chats" until Noah sends again, so the sponsor and the hackers would see a gap. Noah's Send stays the Friday batch; after that, organizers move chats and hackers hear right away. Considered: back to draft until the next Send (sponsor sees it vanish; only Noah can fix it).
  2. *Send also re-confirms sponsors who changed after invites.* Their sent chats get a new sent time and the flag clears. Today the flag stays forever when the change needs no new chats, because Send only looks at drafts.
  3. *Sponsor edits after Send update invites right away* (`reconcileInvitesAfterChange`), and removing a rep cancels their hackers' invites first. New reps or sessions aren't placed until an organizer re-runs Auto-schedule and Noah sends.
  4. *A partial session can be ticked on the sponsor side.* A session the workshop buffer only cuts shows "1:00–1:30 only" instead of being blocked. Without this, Sun Life's 1:00–1:30 can never reach the board.
  5. *Each sponsor's confirmed schedule is the portal's "Your chats".* Nothing is emailed or texted to the primary contact: no rep emails are collected, and the sponsor is told at the workshop to check the portal.
  6. *Digital sponsors* come from a fixed list in the content file (PCBWay), not the sheet's In person / Digital column. One sponsor, one weekend.
  7. *Sponsor edits after Send are refused while the run of show is unreadable* (removing a rep, saving preferences). Without workshop times invites can't be checked, and a removed rep would drop their invites silently. Considered: save and skip the invite update (stale invites nobody fixes).
  8. *The Ivey-together fix doesn't reconcile invites:* it only moves unpinned chats, and a sent chat counts as pinned on the board, so it never touches an invited chat.
  9. *"At CC workshop" live column* added as K on Sponsor Day-Of (checkboxes on the 15 sponsor rows, header note). The contract checkboxes shifted one column right; the app finds every column by header.

- **Integration review fixes:**
  - Sponsor writes now take the board lock before the sponsor-row lock, the same order as organizer writes. A sponsor save during an organizer fix could otherwise deadlock.
  - Send stamps its sent time after it gets the lock, so a sponsor save made while Send waited still gets its "Changed after invites" flag cleared.
  - The reconfirm count only counts sponsors whose already-sent chats were re-stamped.
  - *Not changed:* a sponsor who hasn't been sent can still save preferences when the run of show can't be read. Refusing would block every sponsor at the Friday workshop during a sheet outage, and the organizer board already rejects chats that land in a workshop window.

## Blocked / for Jazz

- **Task pings already in Slack:** if any were synced in production before pings were turned off, those scheduled Slack messages will still send. Check Slack's scheduled messages for the ping bot and cancel them. (I can't see production Slack.)

- **Sheet data questions (from track E):**
  - CSE is on Coffee Chat Setup, but its "Coffee Chats & Interviews" box on Sponsor Day-Of isn't ticked. Which is right?
  - Manulife's and Commure's judging rooms ("RM 555", "RM 44") and track filters were moved as they were, but neither has a prize track. Test values?
- **Backup sheet ownership:** the backup copy is owned by the connected Google account. Check its sharing if the team needs it.

- **Arm invite rounds on Saturday morning:** `gh variable set COFFEE_ROUNDS_LIVE --body true`. Production must also have `COFFEE_INVITES_ENABLED` unset or `1`. Left unarmed, because arming sends real DMs.

_(filled in as the run goes)_
