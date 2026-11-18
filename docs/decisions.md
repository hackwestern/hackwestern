# Decisions

## 2026-10-02 — Desktop sections keep fixed heights; wide screens crop photos

**Decision:** On desktop every section keeps its 1440-design height at every screen width (hero scene 1275px, About 1109px, Projects 1167px, Sponsors 1790px). Photos fill the width and are cropped top and bottom. The hero art is cropped from the top only, so its valley, where the scroll path and story pins sit, stays in view. Content stays its 1440 size and doesn't scale up. About's windows sit in a centred 1440 box, like the Projects stage, and the Projects clouds drift across the full width.

**Why:** Letting sections grow with width (to show each photo whole, and then scaling the content 1.33× to match) made the page much taller on large displays: 11559px at 2560 vs 7230px. Fixed heights were the preferred trade-off.

**Alternatives (tried the same day, then reverted):**
- Section photos at full height, with the strips on the seams: the whole photo shows, but the page grows with width.
- Content scaling with width, capped at 1.33× (`--ui-scale`): looks like a zoomed MacBook layout, but grows height too.
- Scaling by the smaller of width ÷ 1440 and height ÷ 900: not chosen.
- One long background image with the strips baked in: rejected because the hero has parallax layers, the ASCII and folders are placed per section, mobile uses different art, the file would be heavy, and the vector strips would blur.

## 2026-10-02 — Past 1440, sections and elements grow at half the rate of the width

**Decision:** On desktop, past 1440 wide, About, Projects and Sponsors heights and their elements (windows, folders, titles, FAQ, tree stage) grow at half the rate of the screen width: 1 + ½ × (width ÷ 1440 − 1), so 1.17× at 1920 and 1.39× at 2560. Elements stay on the same spot of their photo. Sponsors pins its title, FAQ and window to photo coordinates (`photo-pin.ts`, CSS container units). About keeps each element at its 1440 % position, which follows the full-width photo sideways and scales vertically with the section. The hero is back to its original scene (grows with width, 1.5-screen scroll hold). 1440 and below are unchanged.

**Why:** Fixed heights left content small and off its spot on the photo at wide widths. Proportional growth made the page too tall. Half rate is the middle ground.

**Alternatives:** About grows at the full rate so every element keeps its exact photo spot (About ~2770px at 2560); About elements fully photo-pinned (at 2560 the band they span on the photo, 1582px, is taller than the 1540px section).

## 2026-10-02 — Wide screens keep content in the centred column

**Decision:** Past 1440 wide, About, Sponsors and hero content sits in the same centred column as the Projects stage (1440 × `--ui-scale` wide). Horizontal positions are measured from the screen centre, and vertical positions are unchanged. The hero text and message windows (box and text), and the navbar (via CSS `zoom`), grow with `--ui-scale` too. 1440 and below are unchanged.

**Why:** With elements following the full-width photo, very wide screens spread them to the edges. Keeping one column lines up every section title with "Discover past projects".

## 2026-11-14 — Sponsor dashboard reads the run-of-show sheet and never edits organizer info

**Decision:** The run-of-show Google Sheet is the single source of truth for organizer info on the sponsor dashboard (schedule, locations, speakers, rooms, booths). The site only reads it. Organizer views have an "Edit in Google Sheets" button; sponsors never get the sheet link. Sponsors can still shortlist hackers and book coffee chats on the site (option B). Everything must work well on mobile.

**Why:** One place to edit organizer info means the sheet and the site can't disagree, and organizers already work in the sheet.

**Alternatives:** Two-way sync for everything (conflicts, double bookings); fully read-only for sponsors too (every booking becomes manual organizer work).

## 2026-11-14 — Coffee chats live in the database, tied to a hacker, mirrored to the sheet

**Decision:** Each coffee chat is a database row tied to one hacker (users.hackerId) with a status: pending, accepted, declined, expired. Sponsors create requests on the site; the hacker accepts or declines on the live site. Every booking and status change is copied one way into the Coffee Chats sheet tab so organizers see it there. Declining frees the slot and the sponsor sees "declined". A request with no answer expires 20 minutes before the chat. Notifications: email (Mailjet) and a toast plus Accept/Decline on the hacker portal. No SMS for v1. Slack DM only if the team's existing Slack bot can be found and its token shared. Sponsor shortlist sizes: 20 teams for judging, top 40 interested hackers for coffee chats.

**Why:** Accept/decline is a hacker action with state that changes on the site, which breaks "sheet is the only store". The database gives a real link to the hacker, safe concurrent updates, and reliable expiry; the mirror keeps organizers working from the sheet.

**Alternatives:** Sheet-only with a status column (no link to the hacker record, races when sponsor and hacker act at once). SMS via Twilio (new paid account, opt-in needed; deferred). Auto-offering a declined slot to the next hacker (takes the choice away from sponsors). Expiring 2 hours before (too early during a fast-moving event).

**Capacity (added same day):** A sponsor can run as many chats at once in a room slot as the reps they send (one hacker per rep), capped by the room's seat capacity. Rooms are not shared between sponsors in the same slot. Sponsors enter their rep count on their page (stored in the database); room capacities are organizer info in the run-of-show sheet, read-only on the site. Alternatives: sharing leftover seats with another sponsor (two sponsors in one room); one chat per slot (reps only decide who runs it); organizers entering rep counts in the sheet.

## 2026-11-14 — Coffee chat rules follow the live Coffee Chats tab
- **Decision:** Coffee chats are Saturday only. Each sponsor's row in the run-of-show sheet's Coffee Chats tab sets their window (AVAILABILITY START/END), format (15-min Individual 1-on-1, or 30-min group "with 3 people") and total hackers. The sponsor sets how many reps they send. Each sponsor gets their own room (2241-2243, assigned by organizers); a room fits 6 people, and reps + hackers in the room must fit (1-on-1s: up to 3 at once; groups of 3: one at a time). Every hacker has their own request row (accept/decline alone), so a group is up to 3 rows at the same sponsor and start time. `coffee_chat` stores start time on a 15-min grid plus duration_minutes so a 30-min chat blocks the hacker for both quarter hours.
- **Why:** the live sheet (read through the new hw-run-of-show service account) showed per-sponsor formats and windows starting at 9:00, which the earlier "reps x room capacity, 10:00-4:00" plan didn't cover. Room size (6 people) from Jazz.
- **Alternatives:** sheet sets everything including parallel chats (rejected, Jazz wants sponsor reps); hackers join open groups themselves (not chosen); 1-on-1 only (dropped, the sheet has groups).
- **Also:** migration 0039 was regenerated (old one moved to _to_delete/drizzle/), safe because it was never pushed. Run-of-show sheet uses its own service account (project hackwestern-sheets, hw-run-of-show, Viewer) with fallback to SPONSOR_SHEETS_*.

## 2026-11-14 — No two-way sheet sync for coffee chats
- **Decision:** Keep one owner per fact: the sheet owns setup (schedule, windows, formats, rooms), the app owns bookings and hacker responses and mirrors them to the sheet. Organizers change bookings with Cancel/Move buttons on the organizer page (T26), not by editing the sheet.
- **Why:** 6 days to the event and ~72 chats; two-way sync risks conflicting edits and lets the sheet bypass the room and double-booking rules.
- **Alternatives:** full two-way sync; sheet "action columns" the app reads back and validates (possible later).

## 2026-11-15 — Sponsor help requests go to Slack; first reaction or reply claims them
- **Decision:** Sponsors get a "Need help" button (quick reason + optional note). The site stores the request (one open per sponsor), posts it in the sponsor team Slack channel with a group mention, and the first person to react or reply in the thread claims it; the sponsor's page shows who is coming. Unclaimed requests are re-pinged in the thread at 3 and 6 minutes. Re-pings run when the sponsor's page polls the status, not on a cron. Organizers get a backup queue on /internal/sponsor-schedule. Separate SPONSOR_HELP_SLACK_* env vars, since the sponsor team may use a different workspace from the hacker coffee chat bot.
- **Why:** Jazz wants one person to own every ping, visibly. Reactions are the lowest-effort way to say "I've got it" on a phone. Polling-driven re-pings avoid needing Vercel cron (minute-level cron isn't on every plan).
- **Alternatives:** a Slack button "I've got it" (needs interactivity, more taps than an emoji); SMS/phone call (cost, setup); claiming on the site instead of Slack (team lives in Slack during the event).
- **Design:** all new UI uses the blue dashboard-* system from /live (src/lib/tokens.ts).

## 2026-11-15 — Sponsors offer coffee chats by scanning a hacker's badge
- **Decision:** A sponsor offers a coffee chat by scanning the hacker's badge or /live QR (it holds the hacker's user id) on `/sponsors/[uuid]/scan`, then picking a start time (earliest open one preselected). The hacker still accepts or declines on /live, so they stay in control of their schedule. The hacker no longer has to be on the sponsor's interested list to be offered a chat; meeting in person is the signal. Scanning shows only the hacker's first name; resume and links still need agreeShareWithSponsors.
- **Why:** Jazz: offering should be as simple as scanning the badge. Sponsors meet hackers at the booth, not from a list.
- **Alternatives:** pick from the interested-hackers list (kept as a browse page, T11, not the way to offer); scanning books the chat instantly with no accept step (rejected for now: a hacker can't refuse a time that clashes with their team's plans).

## 2026-11-15 — Coffee chat room is the sheet's label; organizers cancel with a "cancelled" status
- **Decision:** Migration 0040 makes `coffee_chat.room` a nullable text label copied from the sponsor's Coffee Chats row (e.g. "Rm 2241"; null until organizers fill the ROOM column) instead of a required 1-3 room id, and adds a `cancelled` status for organizer cancels (T26). Offers step through the sponsor's window one chat length apart (15-min 1-on-1s every quarter hour, 30-min groups every half hour), so a group's 3 hackers share one start time.
- **Why:** the live sheet has no ROOM values yet, so a required room id would block every offer; a hacker whose chat an organizer cancelled shouldn't see "declined", which reads as their own answer.
- **Alternatives:** keep the id and refuse offers until rooms are set (blocks the event if the column stays blank); store organizer cancels as "declined" (no migration, but misleading on /live and in the sheet mirror).

## 2026-11-15 — Sponsor rooms are not private between sponsors
- **Decision:** Every sponsor can see every company's rooms and times (the Where is everyone page). The schedule page only trims shared locations to the sponsor's own room for readability; the API is not expected to hide other sponsors' rooms.
- **Why:** Jazz asked that sponsors can see where each company is and in what room.
- **Alternatives:** server-side trimming of other sponsors' rooms (unneeded given the shared page).

## 2026-11-15 — Coffee chat notifications: Slack first, email as fallback
- **Decision:** An offer DMs the hacker on Slack first (1.2 s limit). The email goes out only if the DM wasn't sent (no bot token, no Slack account for their email, or a Slack error or timeout). The sheet mirror still runs alongside, all inside the 2.5 s cap.
- **Why:** hackers live in Slack during the event; one notification per offer, no duplicates; /live shows a toast and the chat either way.
- **Alternatives:** both always (duplicates); email only (slower to notice, no buttons).

## 2026-11-15 — Where is everyone is organizer-only
- **Decision:** Sponsors see only their own schedule and rooms; the sponsor team sees every company on /internal/sponsor-schedule. The server trims shared rooms and other sponsors' names from a sponsor's schedule.
- **Why:** Jazz: sponsors don't need it; it's for the sponsor team.
- **Alternatives:** keep it for sponsors (earlier decision today, now reversed).

## 2026-11-16 — Sponsor shortlist lives on the coffee chats page
- **Decision:** Sponsors shortlist interested hackers on /sponsors/[uuid]/coffee-chats (new `sponsor_shortlist` table). The old /hackers page redirects there. The interested list now returns each hacker's user id so the sponsor can shortlist them, but only for admitted hackers who agreed to share and ranked that sponsor. That's the same id the /live QR shows anyone who scans it. No emails. Chat partners get a full profile only if they agreed to share; otherwise the sponsor sees a first name.
- **Why:** Jazz wants one page where sponsors see who's interested, pick their shortlist and follow their chats. Organizers read the shortlist (`sponsorShortlist.forSponsor`) to assign chats.
- **Alternatives:** keep it keyed by hackerId (can be unset); keep a separate read-only page (two places for the same people).
## 2026-11-16 - Coffee chat rooms 2241-2243 are assigned on the site
- **Decision:** Organizers give each sponsor a Saturday coffee chat room (Rm 2241, 2242 or 2243) in the Coffee chats tab of /internal/sponsor-schedule, stored on the sponsor (`coffee_chat_room`). The sheet's ROOM column is only a fallback when nothing is assigned. Two sponsors can't share a room in overlapping windows; changing a room moves that sponsor's live chats under the Move room rules and tells each hacker.
- **Why:** the sponsor team decides rooms during the event and needs the change to reach offers, free times, cards and hackers at once, without a sheet round trip.
- **Alternatives:** keep rooms in the sheet only (no clash check, no moving booked chats); per-slot rooms only (Move room still exists for one-off changes).

## 2026-11-16 - Organizers can add coffee chats ad hoc
- **Decision:** The Coffee chats tab has an "Add a chat" form: pick a sponsor, search admitted hackers by name, email or hacker ID, pick one of that sponsor's free times, optional rep name. It calls the same core as the sponsor's offer (capacity, overlap and room rules), the chat stays pending until the hacker accepts on /live, and the usual notification goes out.
- **Why:** the sponsor team books chats for sponsors who are busy or hackers who ask at the desk, without bypassing the rules sponsors follow.
- **Alternatives:** organizer-created chats auto-accepted (hacker never agrees); editing the sheet (no two-way sync).

## 2026-11-16 - One sponsor-team watcher per sponsor's coffee chats
- **Decision:** Organizers name who on the sponsor team watches each sponsor's coffee chats (and so that sponsor's room), next to the room in the Coffee chats tab. Stored as free text (`coffee_chat_watcher`), with organizer names suggested. Sponsors get the name as `watcherName` from `coffeeChatRequests.freeTimes` and `sponsorChats` ("Your Hack Western contact for chats").
- **Why:** sponsors need one person to ask during chats, and the team needs to know who covers which room.
- **Alternatives:** a user id foreign key to organizers (blocks volunteers without accounts); one watcher per room (sponsors move between rooms).

## 2026-11-16 - Organizer coffee chats default to a sponsor x time table
- **Decision:** The Coffee chats tab opens on a Saturday table: one column per sponsor with a Coffee Chats row (room, watcher, counts in the sticky header), one row per 15-minute slot, 30-minute chats spanning two rows. A cell opens a side panel with Cancel, Move room and "Add a chat here". One new query, `coffeeChatRequests.organizerChatBoard`, builds the board with the same seat rules as offers. The per-sponsor cards stay behind a "List" toggle.
- **Why:** Jazz wants to see every sponsor across the day at once, not one sponsor at a time.
- **Alternatives:** stitch the board on the client from organizerRooms + organizerChats (no seat counts, two queries); drop the list view (loses the general Add a chat form).

## 2026-11-16 — Task reminders: Slack scheduled DMs, synced from the sheet
- **Decision:** Each run-of-show task's owner gets a Slack DM at the task's start time. A task with no owner, or an owner we can't match to a Slack user, goes to the sponsor team channel (`SPONSOR_HELP_SLACK_CHANNEL`) so someone can grab it. The site schedules each message in Slack (`chat.scheduleMessage`) and keeps them in step with the sheet: after each sheet read (at most every 3 minutes) and from the "Re-sync reminders" button on the Team tasks tab, new tasks are scheduled and changed or removed ones are deleted. Organizers match owner names to Slack emails on the same tab.
- **Why:** no cron needed, and Slack delivers on time even if the site is idle. DMs only for owners, per Jazz; the channel is the fallback so unowned tasks still get noticed.
- **Alternatives:** a Vercel cron that posts each task (another moving part, and it only fires when the cron runs); channel posts for every task (noisy, owners miss their own).

## 2026-11-17 — Schedule grid focus, Hackathon events column, and coffee chat rooms as a booking table
- **Decision:** (1) Schedule grid column headers are buttons: clicking one focuses that column (others grey out and shrink, the focused one widens and shows full text); click again, Escape or "Show all columns" returns. View state only. (2) The sheet's Main event items and the /live events share one muted "Hackathon events" column; "Show hackathon events" shows or hides it. (3) Booked coffee chats (DB) show in the schedule's Coffee chats column, one block per sponsor/room/start, polled every 15 s; sponsors get only their own chats. (4) Sheet judging items ("Sponsor Track Judging") get a Judging column. There are no judging room bookings in the DB, only the sheet rows and the Sponsor Info tab's "Judging Room Number" (no times), so the rooms table has no judging column. (5) The Coffee chats rooms table: one column per room (Rm 2241-2243), 15-minute rows, capacity 6 per room counting hackers in live chats plus the sponsor's stated reps. It sits under the run of show and on the Coffee chats tab; "Where is everyone" lands on it. The room map sits beside the schedule and shows now only. Time picking is gone. A sponsor filter drives the tables and totals. (6) The sponsor schedule now trims every per-sponsor room list on the server (`ownLocation`), not just items with more than one matched sponsor.
- **Why:** Jazz asked for readable columns, one place for hackathon-wide events, live bookings on the calendar, and a room booking view instead of the map + where list (which didn't feel clean). Counting reps matches who is actually in the room.
- **Alternatives:** per-room lanes inside the schedule grid (built first, replaced by the compact column + rooms table per Jazz); hackers-only capacity (undercounts the room); keeping the time-picking side panel (Jazz disliked it).

## 2026-11-17 — Sponsor candidates come from the hacker interest form
- **Decision:** A sponsor's "Candidates" list on the coffee chats page (the hackers they can shortlist) is Lucas's interest form ranking: hackers who put the sponsor in their top 3 on the form, by average completed review score. Only admitted hackers count, and the top 40 is cut after matching accounts, so sponsors get a full 40 when there are enough. The server matches each form email to an account (lowercased) and sends only the user id, a rank (1-40) and display fields, never the email. Hackers who agreed to share with sponsors show full name, team, GitHub, LinkedIn, Devpost and resume; everyone else shows first name only. The form's resume and extra link show for everyone. Only candidates can be shortlisted, and organizers' `forSponsor` view uses the same list. If `HACKER_INTEREST_FORM` is unset or the sheet can't be read, the list falls back to the in-app /live ranking, and only a logged-in organizer sees a note about it. The ranking is cached for a minute per sponsor; consent is read fresh every time. "Offer coffee chat" on a shortlisted hacker opens the existing scan offer flow at `/sponsors/[uuid]/scan?hacker=<userId>`.
- **Why:** sponsors asked to review the people who want to meet them and pick who to chat with. Lucas's endpoint already ranks them but returns no id, so it couldn't drive the shortlist. Reusing the scan page's offer flow keeps one set of seat and time rules.
- **Assumption:** hackers typed their resume and extra link into a form meant for sponsors, so showing those links is fine even without the in-app share consent. The name still follows the consent rule (first name only).
- **Alternatives:** a separate procedure next to Lucas's (two rankings to keep in step; his now wraps the shared `fetchRankedInterestRows` and gains a `rank` field instead); hide non-consenting hackers entirely (drops people who asked to meet the sponsor); build a second offer form on the candidates card (duplicates the scan flow).

## 2026-11-17 — One sponsor organizer home at /internal/sponsors
- **Decision:** Lucas's Sponsor dashboard and our organizer run of show are one page. `/internal/sponsors` has tabs Sponsors | Run of show | Coffee chats | Help, kept in the URL (`?tab=`, `?sponsor=<id>`), with the Happening now banner on every tab. Each sponsor row gets a strip: coffee chat room, chats accepted and pending, and the live help request, plus links to View on schedule, Coffee chats and Help, each focused on that sponsor (the existing sponsor filter is set from `?sponsor=`). Those tabs link back to the sponsor's row (`#sponsor-<id>`). The strip comes from one organizer query (`sponsorOrganizer.summary`). `/internal/sponsor-schedule` redirects to the matching tab (`?tab=where` and `#rooms` land on the rooms table), and the "Sponsor team" nav link is gone. The schedule page's tab bodies now live in `src/components/sponsors/organizer/`. On the Run of show tab the sponsor filter also narrows the coffee chats in the grid, not just the rooms table.
- **Why:** Jazz wanted the current dashboard connected to the schedule, coffee chats and help, with a clear end-to-end flow for organizers during the event (docs/flows/sponsor-organizer.md). Two nav links for one job split the team's attention.
- **Alternatives:** keep two pages and cross-link them (still two places to look); fetch chats and help per sponsor row (N queries); a new red token for open help (the open-help style already in the help queue is reused instead, so the token file stays unchanged in this worktree).
