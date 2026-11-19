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
- What B must do when a sent sponsor edits:
  - **Removed rep**: `coffee_chat_rep` delete cascades to their placements and to `coffee_chat` rows with that `placement_id`. Those hackers lose their invite silently today. B should notify them (or soft-handle before the cascade; that needs a schema change, see below).
  - **Unticked session / fewer chats / different hackers per chat**: placements stay; the organizer board (track C) flags them invalid. B should reconfirm affected hackers after organizers move or remove the chat.
  - **Name/phone/crown edits**: no hacker impact.
- Scans: `sponsor_scan` (sponsor, user, rep_name, scanned_at). Scanned hackers are not on `sponsor_shortlist`; invite them first by reading `sponsor_scan`.
- Shortlist: `sponsor_shortlist` rows, oldest first. Only candidates can be added; the cap counts only picks still on the candidate list.

## For track E (sheet)

`// after merge with build-e-sheet: void mirrorCoffeeChatSetup();` sits after every preferences, rep and shortlist save in `coffee-chat-setup.ts` and `sponsor-shortlist.ts`.

## Decisions I made (judgement calls)

- Scanned hackers don't count against the shortlist cap and aren't shortlistable; they're shown read-only at the top ("We invite people you scan first").
- New reps start at 4 chats with every open session ticked (the v6 mock's default). Stepper max 16.
- After a shortlist submit, the list is locked; "Edit shortlist" reopens it (clears `shortlist_submitted_at`) and they submit again.
- Preferences stay submitted while edited (organizers always see the latest valid data); re-submitting moves `submitted_at` forward.
- The Chats page uses `?flow=&step=` query params, not new routes, so the shared shell nav (`NAV_BY_PATH`) didn't need changes.
- Schedule page: the old window/hours `CoffeeChatSummary` card is unlinked (file kept). `/hackers` now redirects to the shortlist flow.
- `src/components/sponsors/interested-hackers.tsx` moved to `src/components/sponsors/_to_delete/` (replaced by the shortlist flow). `chat-setup-card.tsx` and `sponsor-holds.tsx` are no longer used on the portal but are still used or compile, so they stay.

## Open questions for Jazz

1. Should scanned hackers count against the seat cap shown on the shortlist ("6 of 14 seats")? Today they don't.
2. Removing a rep after invites deletes their chats and invites by cascade. Is that OK with the warning, or should removal after Send be organizer-only? (Making it soft would need a schema change: e.g. `coffee_chat_rep.removed_at` instead of delete.)
3. The candidate card shows name, team and links only. The mock also had school, program, year, skills; those aren't in `SponsorCandidate` yet.
4. "Need something different? Message organizers" from the mock isn't wired (the Help modal is track D's).
