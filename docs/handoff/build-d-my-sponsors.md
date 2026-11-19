# Track D handoff: My sponsors, Now and next, portal Help

Branch `build-d-my-sponsors`. Commits: f2ca47e9, d0446f83, 4b030d71.

## What's built
- **Top of /internal/sponsors (every tab):** "Happening now" panel with **Needs attention now** (sponsors with no coffee chat preferences, submitted but not fully scheduled, preferences changed after Send, and run-of-show tasks whose time just passed), each with a link to the right tab. It shows "All clear" when empty. **Now and next** comes below it: event now, next event, task now, next task with its owner. Nothing pings and nothing gets marked done. Pure logic is in `src/lib/now-and-next.ts` and `needsAttention()` in `src/lib/sponsor-organizer.ts`.
- **My sponsors** (Sponsors tab): the signed-in organizer's DB email is matched to HW Contacts "Login email" (`sponsorOrganizer.mySponsors`), and that name is matched to Sponsor Day-Of's HW lead (`leadsSponsor`). It shows one logo tab per sponsor with these tables:
  - People: coffee chat reps, crown on the primary, phone with a copy icon.
  - Logistics: Arrival and Booth pills, portal link, coffee chat workshop, their workshop.
  - Coffee chats: preferences, shortlist, schedule, invites.
  - Judging: prize-track sponsors only.
  - A My sponsors / All sponsors switch (`?list=all`). With no email match, or no sponsors led, the page opens All sponsors.
- **Task pings off:** the tab is removed from `ORGANIZER_TABS`, and `?tab=pings`, `?tab=help` and `#help` open Sponsors. `TASK_PINGS_ENABLED = false` (`src/lib/task-pings.ts`) stops the automatic Slack sync after sheet reads. The help column, stat, badge and links are gone. `task-pings-tab.tsx` and `task-reminders.ts` are kept, unused.
- **Run of show:** the old room-block editor is hidden behind `SHOW_ROOM_BLOCKS = false`. The files are kept.
- **Tours:** the pings tour is gone, and a new "mine" tour covers Now and next, the view switch, People and the pills. The sponsor portal's welcome and "Ask for help" steps now describe the new Help.
- **Portal Help:** "Need help?" opens the sponsor's HW lead (`getSponsorPortalInfo`) and Noah Medland (`sponsorHelp.contacts`, phone from HW Contacts at runtime), each with a phone link and a copy icon. The home page's emergency and lead rows use the same copyable phone, so there's no hardcoded or null phone left. The tracked help files and routes are kept but unused. The existing mounts (shell side nav, home, schedule) now render this Help instead of the tracked form.

## Fields needed from track E
1. **Portal lead:** `getSponsorPortalInfo.hwContact` reads only the Sponsor Status tab, so Sun Life showed "Your contact hasn't been assigned yet" in a real-sheet check. After the merge it must come from Sponsor Day-Of's HW lead.
2. **Organizer HW lead:** `getSponsors[].hwContact` should be Sponsor Day-Of's HW lead. My sponsors matches on it.
3. **Status:** `getSponsors[].status`, plus `setSponsorStatus` with "Not arrived" / "Checked in" / "Booth set up". The Arrival and Booth pills read and write this one status.
4. **Coffee chat workshop attendance:** there's no store yet, so the pill is disabled with "Not tracked in the app yet". It needs a Sponsor Day-Of column (attended + who) or a DB column, plus a mutation.
5. **Booth:** `getSponsors[].boothLocation`.

## Notes and risks
- **Live sheet writes:** `setSponsorStatus` writes to the live sheet even when `SHEET_WRITES` is off. This was already true before this build. In the local check, the browser blocked all tRPC POSTs, so no pill was tapped against the real sheet. Track E should guard it.
- **Already-scheduled pings:** reminders scheduled in Slack before pings were switched off still fire. If any were synced in production, cancel them once (for example, with a sync that plans nothing).
- **Changed after Send:** this compares `coffee_chat_pref.updated_at` with the latest placement `sent_at`. Rep edits only count if track A bumps `updated_at` when reps change.
- **Overdue tasks:** a task shows as overdue for 60 minutes after its 30-minute window, newest 3 first, because there's no "done" state.
- **First-name matching:** a one-word HW lead cell ("Noah") matches any organizer with that first name.

## Open questions for Jazz
- People shows phone + copy only, with no Text or Call buttons, matching your coffee board answer. Do you want Text or Call back on My sponsors?
- All sponsors is still Lucas's day board without help. It hasn't been rebuilt as v3's three attribute tables (Set up / Coffee chatting / Judging). Do you want that before the freeze?
- The organizer coffee tour's steps still describe the old board, and its targets belong to track C.
- Needs attention covers your own sponsors when you lead some, and everyone's otherwise. Is that the right scope?
