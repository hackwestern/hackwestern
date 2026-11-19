# Track A handoff: sponsor coffee chat setup (build-a-cc-setup)

2026-11-19. Sponsor side of the session model, on `/sponsors/[uuid]/coffee-chats`.

## What's built

- **Chats home** (`/coffee-chats`): status card, "Add a hacker" (scan), two entry cards (Chatting preferences, required; Shortlist, optional, locked until preferences are submitted), and "Your chats" once organizers send.
- **Chatting preferences** (`?flow=prefs&step=1|2|3`): Your team (name + phone, crown = primary contact, no email) → hackers per chat 1–5 (1-on-1 = 15 min, groups = 30 min), reps × sessions grid (all open sessions start ticked, workshop ±15 min blocked and labelled), chats per rep stepper (0 allowed) with time → Review & submit (sets `coffee_chat_pref.submitted_at`). Step 2 autosaves 0.8 s after each change and on Next/Back.
- **Shortlist** (`?flow=shortlist&step=1|2`): one list, no rep picker, no picked-by label. Cap = hacker seats from preferences. One at a time (Skip / Shortlist) or List (Shortlisted / Not shortlisted / Everyone). Scanned hackers listed first in their own block. Review & submit sets `shortlist_submitted_at`; "Edit shortlist" clears it. No deadline or auto-submit text.
- **Scanning**: after a scan, "Which rep wants to talk to them?" (chips from Your team) and "Add to Met at Hacker Fair" write a `sponsor_scan` row (rep name if picked; a re-scan keeps the first time, a picked rep updates it). The old per-slot offer form still shows only when the old model has open times.
- **Your chats** (after Send): calendar of reps × sessions with room + building ("Main building" / "Ivey, 15 min walk"), format, chats, partial-session end time, invited hackers (first names + Invited/Confirmed); filter by rep; List view.
- **Status card** on every screen: state ("Not started", "Draft saved, not submitted", "Submitted, waiting for organizers to schedule", "Scheduled, invites going out", "Scheduled, X of Y seats accepted"), what changed and who (from `sent_at`, `submitted_at`, `shortlist_submitted_at`, `updated_at`; "since you were last here" uses a per-device localStorage timestamp), whether they need to act, and what happens next.

## For track B (invites / reconfirmation)

- Changes after Send are allowed. Every team/preferences write returns PRECONDITION_FAILED ("Invites are already out. Changing this will ask N hackers…") unless the client passes `confirmAfterInvites: true`; the page shows that warning first.
- Every rep or preference edit (`addRep`, `updateRep`, `removeRep`, `setPrimary`, `savePrefs`) sets `coffee_chat_pref.updated_at = now` in the same transaction. Submits (`submitPrefs`, shortlist `submit`/`reopen`) and shortlist picks never touch it (tested). **Edited after Send = `updated_at` > latest placement `sent_at`** (the `get` procedure returns this as `editedAfterSend`; tested).
- **Write paths that can change placements' validity after Send** (call `reconcileInvitesAfterChange` after each at merge; all in `src/server/api/routers/coffee-chat-setup.ts`):
  1. `removeRep`: deletes the rep; cascades to their placements and those placements' `coffee_chat` invites.
  2. `savePrefs`, a rep's `chatsWanted` lowered (or set to 0): fewer chats than placed seats.
  3. `savePrefs`, a session unticked: a placed session the rep is no longer free.
  4. `savePrefs`, `hackersPerChat` changed: seats per chat change (and 1-on-1 ↔ group changes chat length 15 ↔ 30).
  `updateRep` (name/phone) and `setPrimary` don't affect validity; `addRep` and `submitPrefs` can't invalidate a placement. Shortlist writes (`sponsorShortlist.add/remove/submit/reopen`) are allowed after Send with no confirm and only change who's offered seats in later rounds.
- What B must do when a sent sponsor edits:
  - **Removed rep**: `coffee_chat_rep` delete cascades to their placements and to `coffee_chat` rows with that `placement_id`. Those hackers lose their invite silently today. B should notify them (or soft-handle before the cascade; that needs a schema change, see below).
  - **Unticked session / fewer chats / different hackers per chat**: placements stay; the organizer board (track C) flags them invalid. B should reconfirm affected hackers after organizers move or remove the chat.
  - **Name/phone/crown edits**: no hacker impact.
- Scans: `sponsor_scan` (sponsor, user, rep_name, scanned_at). `recordScan` takes a `repId` from Your team (or null) and stores that rep's name. Scanned hackers are not on `sponsor_shortlist`; invite them first by reading `sponsor_scan`. They take seats: the shortlist cap is seats − scanned.
- Shortlist: `sponsor_shortlist` rows, oldest first. Only candidates can be added; the cap counts only picks still on the candidate list.

## For track E (sheet)

`// after merge with build-e-sheet: void mirrorCoffeeChatSetup();` sits after every preferences, rep and shortlist save in `coffee-chat-setup.ts` and `sponsor-shortlist.ts`.

## Review fixes (R2–R6)

- Preferences autosave runs one save at a time (each waits for the one in flight); a failed save shows "Not saved, retrying…" and retries after 3 s. `savePrefs` skips rep ids that aren't the sponsor's (removed in another tab) and returns `skipped`; the page then refetches.
- Shortlist `add` reads the cap under the sponsor-row lock; `submit` refuses when picks exceed it ("Your shortlist has 10 people but you now have 4 seats. Remove 6."); the shortlist itself is kept. `add`, `remove`, `submit`, `reopen` all take the sponsor-row lock.
- `submitPrefs` validates with `loadSponsorSetup(sponsor, tx)` after the lock.

## Decisions (coordinator, 2026-11-19)

- Scanned hackers count against the seat cap: "N seats · M taken by people you scanned · shortlist up to N − M".
- Shortlist cards show school, program and year when the hacker agreed to share with sponsors. No skills.
- "Message organizers" is wired to track D's Help at merge (TODO in `prefs-step.tsx`).

## Decisions I made (judgement calls)

- Scanned hackers aren't shortlistable; they're shown read-only at the top ("We invite people you scan first").
- New reps start at 4 chats with every open session ticked (the v6 mock's default). Stepper max 16.
- After a shortlist submit, the list is locked; "Edit shortlist" reopens it (clears `shortlist_submitted_at`) and they submit again.
- Preferences stay submitted while edited (organizers always see the latest valid data); re-submitting moves `submitted_at` forward.
- The Chats page uses `?flow=&step=` query params, not new routes, so the shared shell nav (`NAV_BY_PATH`) didn't need changes.
- Schedule page: the old window/hours `CoffeeChatSummary` card is unlinked (file kept). `/hackers` now redirects to the shortlist flow.
- `src/components/sponsors/interested-hackers.tsx` moved to `src/components/sponsors/_to_delete/` (replaced by the shortlist flow). `chat-setup-card.tsx` and `sponsor-holds.tsx` are no longer used on the portal but are still used or compile, so they stay.

## Open questions for Jazz

1. Removing a rep after invites deletes their chats and invites by cascade (track B tells hackers at merge). Should removal after Send be organizer-only instead? A soft remove would need a schema change (`coffee_chat_rep.removed_at`).
