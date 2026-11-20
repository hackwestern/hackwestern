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

## 2026-11-17 — Sponsor schedule shows less by default

- **Decision:** On the sponsor schedule, "Show hackathon events" is off by default (it turns on only when the sponsor switched it on before). Food (from the sheet or /live) and the opening and closing ceremonies always show, even with it off, in both the sponsor and organizer grids; meals get their own Food column, which is always shown. Sponsors no longer see the ceremony running order: `sponsorSchedule.get` returns only that sponsor's own ceremony segments, and the running order card is gone from the sponsor page (organizers keep it).
- **Why:** Jazz (2026-11-17): sponsors care about their own events, meals and the ceremonies; the rest of the hackathon schedule is noise to them. Who else speaks at a ceremony is organizer information.
- **Alternatives:** keep hackathon events on by default (busy grid for every sponsor); hide food and ceremonies with everything else (sponsors miss meals and their own speaking slot); keep the running order for sponsors (shares other sponsors' slots).

## 2026-11-17 — Organizers can hold a coffee chat room for a sponsor before a hacker is booked
- **Decision:** New `coffee_chat_hold` table (migration 0048): sponsor, room (Rm 2241-2243), Saturday start and end on the 15-minute grid (30 min by default, up to 4 hours), optional organizer note, who created it. Organizers create, move and remove holds from a free cell in the Coffee chats rooms table ("Hold room for a sponsor"). A held cell shows the sponsor and a dashed warning "Needs a hacker" until a pending or accepted chat of that sponsor overlaps the hold. A room can be held by different sponsors at different times; the server refuses a hold that overlaps another sponsor's hold, live chat or room window in the same room, and offers, moves and room assignments now treat other sponsors' holds as taken. The same sponsor may hold adjacent or overlapping times. A hold also adds its start times to the sponsor's offerable times, so a sponsor with no sheet window can still be offered chats there.
- **Room precedence for a new chat:** the sponsor's hold covering that start > the room their live chats already use then (organizer Move room) > organizer per-sponsor room > sheet ROOM > none. Creating or moving a hold moves the sponsor's live chats inside it into the hold's room (hackers are told), and Move room on a chat moves the sponsor's hold around it too, so the two never disagree.
- **Sponsor side:** `sponsorChats` returns the sponsor's own holds only (same UUID scoping, no organizer note). The Coffee chats page lists them ("Rm 2242 · 10:30 AM–11:00 AM · You still need a hacker") with Pick from candidates and Scan a badge; the scan page takes `?time=HH:MM` and preselects that start when it's open. The next-event card shows a held room and the same actions. Both refresh with the existing polling.
- **Why:** Jazz: organizers want to give a sponsor a room even before a hacker is found, and sponsors need to see the room and that they still need someone. Rooms are shared across the day, just never at the same time.
- **Alternatives:** placeholder chat rows with no hacker (breaks the one-hacker-per-row model and the hacker's accept flow); one room per sponsor for the whole day only (the old model; can't share a room by time); holds that don't move chats (a chat and its hold could end up in different rooms).

## 2026-11-17 — One sponsor table on the Sponsors tab; sponsor colours on the rooms table
- **Decision:** The Sponsors tab is one table, one row per sponsor: Sponsor (colour dot) | Status | Booth | Tier | HW contact | Chat type (e.g. "Group of 3 · 30 min · 1 rep") | Chat room (holds included) | Chats (accepted · waiting) | Needs a hacker | Help, with a totals row (accepted, waiting, seats left today, holds needing a hacker, open help) over the sponsors the search and status filter show. A row opens (button, aria-expanded) to that sponsor's live chats with each hacker (photo and full name only when they agreed to share, else first name), room holds, chat room and Watched by (editable, same mutations as before), plus Lucas's sponsor room, company contact, picks, notes, private page link and the View on schedule / Coffee chats / Help links. Under 640px each sponsor is a compact card that opens on tap. It is fed by the one organizer query `sponsorOrganizer.summary`, now with chat type, reps, watcher, rooms, chats, holds and seats left. The Coffee chats tab loses its per-sponsor cards and stats row and keeps the rooms table, By sponsor and List views. Each sponsor gets a stable colour (sorted names, each takes its hash slot or the next free one, so up to six sponsors never share and the same set always maps the same way), used on booked and held cells, the sponsor filter and the table dot. Available cells are neutral grey. Clicking a sponsor's name in the filter, or arriving from the Sponsors table (`?tab=coffee&sponsor=<id>`), highlights that sponsor's cells, dims the rest and scrolls to the first one; Escape or a second click clears it. `?sponsor=` on the Coffee chats tab now highlights instead of filtering.
- **Why:** Jazz wanted one place to see every sponsor at a glance, and the rooms view to show who is where at a glance, with booked and free easy to tell apart.
- **Alternatives:** a second per-sponsor table on the Coffee chats tab (first plan, replaced at Jazz's request: two tables listing the same sponsors); colours by list position (shift whenever a sponsor is added); a pure hash (stable but two of six sponsors can collide).
- **Token need:** only six tellable-apart sponsor colour pairs exist in the dashboard tokens (the four schedule tints, task amber, nav blue). Pink has no strong token, so its dot uses the tint with a ring. More sponsors repeat colours until tokens are added.

## 2026-11-17 — Task pings find owners on Slack by name

- **Decision:** Task pings (T49) no longer need organizers to type each owner's Slack email. The Owner cell is parsed: team tags (`[SPON]`, `[WEB]`, `+`) are dropped, and what's left is one person or "no clear owner" (empty, "All"/"Everyone"/"Team", several names, or a per-company list like "QNX: Noah Scotiabank: Caroline"). One person is matched by name against the Slack workspace directory (`users.list`, cached 10 minutes; bots, deactivated users and guests skipped) on first, real or display name. Exactly one match gets the DM; no match, several matches, or no clear owner posts to the sponsor team channel with SPONSOR_HELP_SLACK_MENTION (default `<!here>`), naming the task, time, place and the owner text from the sheet. Saved emails in `task_owner_contact` still win when present. The "Owners on Slack" table is gone; the panel is one line plus a small status (next ping, Slack not connected). If `users.list` fails, the sync stops and the reminders already in Slack stay as they are.
- **Why:** Jazz (2026-11-17): "I don't want them to manually do this. If there isn't a clear owner it just pings the whole Slack channel." She also doesn't want per-owner lists in the panel.
- **Alternatives:** keep the email table (manual work nobody will do mid-event); match on Slack usernames (handles rarely equal sheet names); DM every name in a multi-owner cell (pings people for other companies' tasks); limit matching to members of the team channel (needs channels:read, which the app doesn't have).

## 2026-11-17 — Task pings get their own tab, and Help moves into it

- **Decision:** The organizer home's tabs are Sponsors, Run of show, Coffee chats and Task pings (`?tab=pings`). The Help tab is gone: the help queue is the first section of Task pings, since it needs action, followed by the last few resolved requests, the next three task pings (time, task, "DM Noah" or "Channel @here"), a ping log (task pings whose time has passed plus sponsor help posts, newest first, 20 at a time with Show more) and one status line (Slack connected or not). `?tab=help`, `#help` and old /internal/sponsor-schedule help links open Task pings scrolled to the help section; the tab keeps the open-help count badge. The panel under the Run of show grid is gone. Slack sends a scheduled message itself and never tells us it went out, so a past task ping shows "Handed to Slack", not "Sent"; only Slack refusing it shows as failed. Task pings aren't recorded at all while Slack isn't connected, so the log can't show "skipped" for them; help requests show "Not posted to Slack".
- **Why:** Jazz (2026-11-17): help pings and task pings are the same job (who gets pinged in Slack), and the panel was hidden under the schedule grid.
- **Alternatives:** keep Help as its own tab (two places for Slack pings); show task pings as "Sent" once their time passes (claims a delivery we never saw); poll `chat.scheduledMessages.list` for delivery (still no receipt, more Slack calls).

## 2026-11-18 — Task pings never double-send, and follow config changes

- **Decision:** Each task reminder row stores a `route_key` (migration 0047): a hash of where it goes (DM user or channel) and its full text, mention included. A kept reminder whose route key changed is rescheduled, so a new channel, mention, location or owner match takes effect; rows from before 0047 are rescheduled once. If deleting the old Slack message fails (other than "already gone"), the new one for that task is held back until a later sync deletes the old one. If `users.list` fails, the last directory copy is used even when expired; a 429 with Retry-After of 5 s or less is retried once. The tab shows the configured mention ("Team channel (@here)", or just "Team channel"). The unused `owners` and `setOwnerEmail` procedures are removed; the `task_owner_contact` table and its email override stay.
- **Why:** Review of sd-auto-owners: a failed delete plus a new schedule sent two messages, and changing SPONSOR_HELP_SLACK_CHANNEL or the mention left old messages in place.
- **Alternatives:** fold the route into `task_key` (no migration, but a failed delete could no longer be tied to its task); abort the sync when the directory is down (every owner falls back to nothing until Slack recovers).

## 2026-11-18 — Organizer dashboard clean-up (Jazz, during review)

- **Decision:** Organizers land on `/internal/sponsors` after login (all organizers; no sponsor-team role exists). Column focus is gentle (focused column about 30% wider, others faded, not collapsed; rows keep their height). The live map panel is replaced by a static floor 2 plan image. Ceremony and workshop info under the run of show follow the picked day. Schedule and room table legends are removed; each cell names its own state. Sponsor badges show the real logo (no circle), initials as fallback; a proportion-fixed copy of the Scotiabank SVG removes its built-in padding. `**/_to_delete/**` is excluded from tsc and eslint.
- **Why:** Jazz found the dashboard too busy: big focus jumps, a clickable map nobody needs, legends that state the obvious, and generic initials instead of brands. Parked files in `src/_to_delete` were silently breaking type checks.
- **Alternatives:** a sponsor-team role for the login redirect (no role exists yet); keep the map with live pins (more UI to maintain, little value); keep legends but smaller (Jazz asked for them gone).

## 2026-11-18 — Coffee chat rooms become "room blocks" (proposed, approved direction)

- **Decision:** One concept replaces whole-day sponsor rooms, holds and per-cell booking: a room block (one sponsor, one room, a stretch of time) that hackers are added into. Slots show hackers booked / hackers the sponsor's chat type needs (1-on-1 = 0/1, group of 3 = 0/3); the 6-person room limit is a server check shown only as a warning. Lengths: 15 min, 30 min, 45 min, 1 hour, 1 hr 15, 1 hr 30. Spec: `docs/flows/coffee-chat-room-blocks.md`. Not built yet.
- **Why:** The room dialog mixed three ideas (assign room, book hacker, hold room) and confused organizers; "1/6" didn't match how sponsors think about their chats.
- **Alternatives:** keep holds and room assignment as separate actions with clearer copy (still two concepts for one job).

## 2026-11-18 — Sponsor track judging view; no app-side room auto-assignment

- **Decision:** No app-side auto-assignment until Jazz provides the allowed judging rooms list. Organizers get a Sunday "Sponsor track judging" panel under the run of show (shown on the day the sheet's judging item falls on, Sunday without one) and a Judging column on the Sponsors table, both from `sponsorOrganizer.summary`. Each registered sponsor's room comes from Lucas's sponsor info sheet ("Room") first, else the run-of-show judging item's "Name: Rm" list, with the source shown; a sponsor with neither is "Missing room". Companies named in the list but not registered (e.g. QNX) are listed as "Not registered". Picks are the judging sheet's chosen teams against 5–20, read through one helper (`PickCount`) so a ranked shortlist can replace it. Sponsors still see only their own room (`ownLocation`).
- **Why:** Most sponsors have no judging room yet, and the team fills rooms into the sheets (Jazz confirmed). Guessing rooms from a made-up pool could send a sponsor to a room nobody booked.
- **Alternatives:** auto-assign free rooms in the app (no list of allowed rooms to pick from); show only the run-of-show list (hides rooms Lucas's sheet already has); a separate procedure for judging (one more poll; the summary already reads both sheets).

## 2026-11-18 — Sponsor judging: score, shortlist, submit a ranked top 5

- **Decision:** Lucas's picks page (`/sponsors/[uuid]/picks`, same URL) is now "Judging". Sponsors browse the teams they can judge, score each 1-10, save some to a shortlist and add an optional private note (280 characters). Every change autosaves. Then they rank the shortlist with up and down buttons and submit exactly `SPONSOR_FINAL_TOP` teams (5, in `src/lib/sponsor-scoring.ts`; it can go up to 10). Submitting asks to confirm first, and they can resubmit any time until judging closes. The close time is the optional `SPONSOR_JUDGING_CLOSES_AT` env var; unset means it never closes (no time decided yet). Reviews go in `sponsor_team_review` and the ranking in `sponsor_final_pick` (migration 0049). The same ids are written to Lucas's judging sheet through `writeChosenTeams`, which is his `setChosenTeams` code moved into `utils/sponsor-judging-teams.ts`. His public `setChosenTeams` route is removed, so `submit` is the only sheet writer. His sheet takes 5 to 20 picks, so 5 fits, and a test fails if the constant ever leaves that range. If the sheet write fails, the submission still counts and shows "Sheet not updated" to the sponsor and organizers; the sponsor's next page load retries the write, or they can resubmit. Sponsors see the same teams as Lucas's `listAllTeams` (submitted or late, in their track), and the server checks that on every write. The portal tile shows when the sponsor has a prize track, a judging room or picks in the sheet. Organizers get a "Sponsor judging" tab (`?tab=judging`, after Coffee chats): each sponsor's status, ranked top 5 with scores and Devpost links, shortlist size and number scored, plus an "All teams" view ranked by how many sponsors put a team in their top 5, then average score.
- **Why:** Jazz asked for sponsors to look through projects, score them out of 10 or save them to a shortlist, then submit their top 5 in order, and for organizers to see what each sponsor chose. Writing to the sheet too keeps Lucas's rotation working without changes.
- **Alternatives:** keep picks in the sheet only (no scores or notes, and every autosave would be a Sheets call); submit from the client through `setChosenTeams` (two requests that can half fail); one row per rank instead of an id array (more joins for a fixed list of 5); require a judging room for the tile (hides judging from sponsors who award a track prize with no room).

## 2026-11-18: Sponsor portal venue map, important info, locked judging tile
- **Decision:** Every sponsor page header has a Map button (floor plans with the sponsor lounge Rm 2110, overnight belongings Rm 2244, Sponsor Bay, coffee chat rooms). The portal home lists "Important things to remember" (lounge, belongings, emergency contact Noah). The Judging tile always shows and stays locked until Sunday 9:00 AM; tapping it says to come to the 8:30 judging debrief. Meals and ceremonies draw full strength on the sponsor schedule.
- **Why:** Jazz: sponsors need the map one tap away, need to know where to rest and store things, and should see judging coming before it opens. Meals and ceremonies are for sponsors too.
- **Alternatives:** Map as its own page (one more tap, loses place); hide the Judging tile until it opens (sponsors don't know it exists); a "coming soon" page behind the tile (an extra screen for one sentence).
- **Confirmed:** Rm 2110 is the sponsor lounge (Jazz, 2026-11-18), even though the floor plan's key calls it hacker space. Noah's number is a placeholder until Jazz adds it in `src/content/sponsor-venue.ts`.

## 2026-11-18 — Sunday presentations: sent shortlists, auto schedule, Slack notify

- **Decision:** "Send shortlist" on `/sponsors/<id>/picks` stores a snapshot of the sponsor's shortlisted team ids (`sponsor_shortlist_send`, migration 0050); sending again replaces it. Organizers press "Schedule presentations" on `?tab=judging`, which runs `schedulePresentations` over every sent snapshot with rooms from the same sheets as the Sunday judging panel, and replaces every row of `sponsor_presentation` (one row per sponsor and team; `start_minute` null = flagged, `room` null = sponsor had no room). A sponsor who re-sends after scheduling is marked "Sent after scheduling"; nothing moves until organizers schedule again. "Notify hackers" DMs each team member on Slack (the same `users.lookupByEmail` helper coffee chats use, now `src/server/slack/dm.ts`) and marks reached teams notified; without `SLACK_BOT_TOKEN` it refuses with a clear message and sends nothing. Hackers see their times on the `/live` home tab only once their team is notified. Once any schedule exists, round 2 ranks and submits only teams with a slot for that sponsor. The judging tab lists every team in a sponsor top 5 with "Run checks" (the existing team cheat checks) and a link to `/internal/cheat-check?teams=...`.
- **Why:** The spec (`docs/flows/sponsor-judging.md`) says sponsors send a shortlist and we build the schedule. A snapshot keeps the schedule stable while sponsors keep clicking. Showing times on /live only after notify keeps the dashboard and Slack in agreement when a schedule is re-run.
- **Alternatives:** schedule from the live shortlist flag (the schedule would shift under sponsors' edits); a `shortlist_sent_at` column on Lucas's sponsor table (no snapshot, and his table); store the schedule as one JSON blob (harder to read per team for /live and notify); show unsent times on /live straight away (can disagree with Slack after a re-run); gate round 2 on the 11:30 clock (breaks if presentations run late).

## 2026-11-18 — Presentation notices are per member and idempotent (review fixes)

- **Decision:** Who was told their presentation times lives in `sponsor_presentation_notice` (one row per user, migration 0050 regenerated before it shipped): the team, the `slotsKey` of the times sent, the last attempt's status (sending, sent, not-found, failed) and `sent_at`. "Notify hackers" claims every member in one upsert and only DMs the rows it got back, so a double click or retry can't DM twice; a claim older than 10 minutes counts as abandoned. By default it skips members already sent their team's current times; `resend: true` ("Notify again", after a confirm) sends everyone. /live shows a team's times once any member was sent those exact times. Re-running the schedule no longer wipes anything: members stay notified while their team's times are unchanged, and a dry run (`schedule({ dryRun: true })`) gives the confirm step the number of hackers who would get new times. The schedule reads the sent shortlists inside its transaction (rooms from the sheets are read just before, since that call is slow) and clamps each room to the 64 character column with `normalizeRoom`.
- **Why:** A code review found that a double click or retry re-DMed everyone, that "notified" was per team so one reached member hid the rest, and that rescheduling marked every team un-notified even when nothing changed for them.
- **Alternatives:** a `notified_at` per schedule row (can't say which member was reached, and a reschedule replaces the rows); a request-level lock (stops parallel clicks but still re-DMs on a retry); carry over per slot instead of per team (the DM lists all of a team's times, so any change means a new DM for the whole team).

## 2026-11-18: Sponsor team availability on the organizer schedule
- **Decision:** The organizer Schedule tab shows the sponsor team's availability from the run-of-show sheet: a "Spon team availability" timetable under the run of show for the picked day (one bar row per organizer, on-call windows as dashed boxes, time away as a hole plus a note, an "Everyone" row for windows everyone must be there), and an "Organizers" switch beside "Show hackathon events" that adds a narrow column of name chips to the hour grid (remembered on the device, off by default). The sheet read widens from `RUN OF SHOW!A1:J200` to `A1:X200`; the run-of-show parser still gets only A:J. The blocks are found by header text ("SPON TEAM AVAILABILITY", "SPON TEAM NECESSARY SHIFTS"), and times are parsed in `src/server/api/utils/spon-availability-parse.ts`, not in `run-of-show-parse.ts` (another branch edits that file). Only the organizer procedure returns it; the sponsor `get` never copies it.
- **Why:** Jazz wanted gaps in sponsor team coverage to be obvious while planning, and the availability was already in the sheet but not shown.
- **Parsing rules:** "All day", "After T", "Before T", "T-T", comma lists, "--" = none. A time with no AM/PM reads 8-11 as morning and 12-7 as afternoon ("Before 2:30, After 3:30" = 2:30 PM, 3:30 PM). "11-11:30AM" shares the end's AM/PM. Overnight windows split at midnight onto both calendar days. On call (remote) wins over "All day" for those hours. Anything else is kept as written and shown as a note, never guessed.
- **Alternatives:** a second range read for K:X (two data blocks for one tab, same result with more code); per-row chips inside every grid row (busier, repeats the same names every half hour); parse inside `run-of-show-parse.ts` (merge conflicts with the Coffee Chats branch).

## 2026-11-18 — Organizers open round 2 by hand; hackers not on Slack get an email

**Decision:** Round 2 (rank the teams that presented and submit a top 5) starts only when an organizer presses "Open round 2" on the Sponsor judging tab, after a confirm. It can be closed again; rankings already submitted are kept. A sponsor is in round 2 when it's open and they have at least one placed slot. Before that, sponsors stay on their sent shortlist with a note that round 2 opens after presentations, and the server refuses a top 5. The open state is one row in `sponsor_judging_setting` (migration 0052). In Notify hackers, a member Slack can't find gets the same times by email through the coffee chat Mailjet path, recorded as status `emailed` with `sentAt`, so a retry or double click never emails twice. No Mailjet, or a rejected send, records `failed`. The organizer tab also shows every scheduled hacker by team with how they heard (By hacker), and the By sponsor view became Final results, with each top team's hackers.

**Why:** Jazz, 2026-11-18. Opening round 2 as soon as a sponsor had a slot meant sponsors could rank before presentations happened. Hackers who never joined Slack weren't getting their times at all.

**Alternatives:** A fixed round 2 time from env (like SPONSOR_JUDGING_CLOSES_AT), rejected because presentations can run late. A channel column on the notice, rejected because the status column already says how a member was reached. Emailing everyone alongside Slack, rejected as a double message for most hackers.

## 2026-11-18 — Coffee chats v2: sponsors request chats, no room capacity, one organizer view

- **Decision:** A sponsor's coffee chat request is either 1-on-1 with N reps (N hackers per slot) or one group chat with M hackers (M per slot), stored as `coffee_chat_style` + `coffee_chat_per_slot` on `sponsor_judging_sponsor`; both null means not answered, and the Coffee Chats sheet row is the default ("Individual" -> 1-on-1 with the NOTES rep count, "based on N" first, else 1; "Groups ... with 3 people" -> a group of 3; a blank row -> "No chat request yet"). The chat length always comes from the sheet. Sponsors "Ask for fewer" for a slot or an hour, down to 0, stored in `coffee_chat_limit` (start, end, hackers); the lowest ask covering a slot wins, asking for the full count again clears it, and an ask below hackers already booked is refused. Migration `0051_coffee_chat_request` (0050 belongs to sd-presentations; renumbering and the snapshot chain need a look at merge). The 6-person room capacity and the chat type x reps formula are gone from UI and server. The organizer Coffee chats tab is one rooms x time view: blocks show the logo only (named in the aria-label), the request summary and each slot's booked/asked; a sponsor strip above it (request and length, hours, room hours booked of CHATTING HOURS, hackers booked of HACKERS CHATTING, a quiet "Sheet numbers don't add up" note, Edit request) replaces By sponsor; the block dialog replaces List (cancel or move each chat there). The old `coffee_chat_reps` column stays in the table but is no longer read.
- **Why:** Jazz: the v1 formula and the room cap didn't match how the day runs. Sponsors say how they run chats, reps come and go, and reps organize themselves in the room. The sheet's numbers disagree with each other (StarTech 24 slots x 3 reps vs 24 hackers; 3 chatting hours of 30-min chats is 6 slots, not 12 or 4), so they're shown as the starting point and flagged, not fixed.
- **Alternatives:** reuse `coffee_chat_reps` for N (can't tell "not answered" from 1, so the sheet default would never apply); store asks per slot start only (an hour ask would break when a block changes); drop `coffee_chat_reps` now (destructive; can go in a later migration once v2 is live); keep the List view next to the grid (two places to cancel a chat).

## 2026-11-18 — Coffee chats: one seat count; review fixes

- **Decision:** Offers (server) and block slots (pages) count a slot's hackers the same way, with one function: chats starting in [slot start, start + chat length) (`chatsInSlot` in `src/lib/coffee-chat-holds.ts`). The old 15-minute overlap count is gone. The sheet's FORMAT chat length must not change once booking opens: chats keep the length they were booked with, and a changed length would put them in the wrong slots. A sponsor's request can't drop below hackers already booked in a slot, and "Ask for fewer" takes one slot or the part of one clock hour inside one of the sponsor's own blocks, at most 200 asks per sponsor; both write under the room-writes lock and the sponsor row lock. Give room / change / release fall back to the sponsor's booked chat length (else 15 min) when the sheet can't be read. The coffee chat migration is `0053_coffee_chat_request` after merging sponsor-dashboard (0050, 0052); the old 0051 is in `drizzle/_to_delete/`.
- **Why:** Code review of sd-room-blocks: the server and the pages could disagree on "full"; unbounded asks could touch other sponsors' times; a sheet outage blocked Give room; and drizzle skips a migration whose `when` is older than the latest applied, so 0051 would have been skipped on any DB with 0052.
- **Alternatives:** keep the overlap count on the server and mirror it in the UI (two functions to keep in sync); let asks cover any span (no way to tell a slot ask from a typo); fail Give room when the sheet is down (blocks organizers on the day for a read they barely need).

## 2026-11-18 — Coffee chats: at most 3 hackers per slot

- **Decision:** A slot has at most 3 hackers, in one of two shapes: 3 hackers with 3 reps (1-on-1s side by side) or a group of 3 with 1 rep. Every sponsor is assumed to bring 3-4 reps, so until they answer the request is 3 per slot (1-on-1 with 3 reps when the sheet says "Individual", else a group of 3; a blank row is "No chat request yet" but still booked as 3). Sponsors and organizers can pick 1 to 3; "Ask for fewer" still goes down to 0. Counts on blocks are per slot only, hackers booked / wanted ("1/3"); the block line shows the request ("1-on-1 · 3 reps"), not a block total. NOTES rep counts are no longer read.
- **Why:** Jazz, 2026-11-18: rooms hold 3 hackers plus reps; a bigger number or a total like "5/12" reads like the old "1/6" capacity and confuses organizers.
- **Alternatives:** keep reps from NOTES (StarTech's "3-4 reps" would still cap at 3); keep the block total next to the request (looked like capacity).

## 2026-11-18 — Coffee chats: the cell dialog shows only what applies

- **Decision:** An empty room/time opens only "Give this room to a sponsor" (sponsor and length). A cell inside a sponsor's block opens that block: the logo and request ("1-on-1 · 3 reps · 15 min"), then each slot in plain words ("Still missing 2 hackers · 1 waiting on approval") with booked/wanted, each hacker with Accepted or Waiting and Cancel or Reject (confirmed once), one "Invite a hacker" per open slot, and Change length / Release room as small links at the bottom. No sponsor picker, no hold, no rep name or organizer note, and no Move room in the block dialog. Strip cards show the logo without the name (the name stays in the accessible label; text only when there's no logo). Design review fixes: `small` buttons instead of `outline`, 44px touch targets (chips with a `disabled` prop, fields, steppers, tertiary buttons), counts only in narrow grid cells, a fixed time column in the dialog.
- **Why:** Jazz, 2026-11-18: "only the option applicable shows". Organizers inside a block are filling it with hackers; assigning a room or naming a rep there was noise.
- **Alternatives:** one dialog with tabs for room and hackers (still shows both); keep Move room per chat (moves the whole block, confusing from one hacker's row; the server procedure stays).

## 2026-11-18: Sponsor portal guided tour and How to flows

- **Decision:** The sponsor portal has a guided tour drawn over the live page: the page dims, the target gets a ring through a cutout, and a callout says "Step n of N" with Back, Next and Skip tour. It is our own small component (`src/components/sponsors/tour/`), not a tour library. Tours are data in `src/lib/sponsor-tours.ts` (page, `data-tour` target, placement, `waitForClick`) with all copy in `src/content/sponsor-tour.ts`; the pure logic (step resolution, progress, placement) is in `src/lib/sponsor-tour.ts` with tests. A "How to" pill sits next to the Map pill on every sponsor page and lists four short flows (offer a coffee chat, ask for help, find your way, judging on Sunday) plus a replay of the portal tour. The portal tour is offered once per sponsor on the home page ("New here?"), never forced; answering either way is remembered in localStorage. Progress lives in sessionStorage so a flow carries on across pages. A step whose target isn't on the page (judging still locked, the picks page not loaded) shows as a centred callout. Steps that wait for a click let the click through to the app, and Next on those steps clicks the target for keyboard users. On phones the callout is a bottom sheet. When the target is inside the venue map dialog, the tour renders inside that dialog so Radix's focus trap and outside click don't close the map.
- **Why:** Jazz asked for a Stepshots-style tour on the real UI, with how-to flows, so sponsors learn the portal in a minute without a video or a call.
- **Alternatives:** a tour library such as Shepherd or driver.js (another dependency to style and keep accessible, and it fights Radix dialogs the same way); Radix Popover for the callout (its dismiss layer closes it on the very click a waitForClick step needs, and it portals outside the map dialog); screenshots or a video (they go stale as the coffee chat and judging pages change).
- **Coffee chats v2:** the coffee chat flow targets the Candidates tab, the Candidates panel and the Your chats tab of the v2 page (merged from sd-room-blocks), not the page header.

## 2026-11-18 — Hackers can give the email their Slack is on; email notices still go to the email they applied with

**Decision:** Hackers set an optional "Email you use on Slack" in the notification center on /live, stored on the user (`user.slack_email`, migration 0056; trimmed and lowercased; blank or the same as their account email is stored as null). Every hacker Slack lookup goes through `dmHacker` (src/server/slack/dm.ts): `users.lookupByEmail` with the Slack email first, then the email they applied with (`user.email`), stopping at the first match. If Slack finds neither, the Mailjet email goes to the email they applied with, never the Slack email. This covers coffee chat offers, cancels and room moves, and the Sunday presentation DMs. The coffee chat Accept/Decline buttons in Slack also accept a click from a Slack account on either email, but only on that hacker's own chat.

**Why:** Many hackers join Slack with a personal email that isn't the one they applied with, so the DM silently fell back to email. The applied-with email is the one we know works, so it stays the email target.

**Kept as it was:** Coffee chats still email when the DM wasn't sent for any reason (not found, Slack failed or slow, no bot token); presentations email only when Slack can't find the hacker and record a Slack failure as "failed" for a retry. The presentation claim and per-member idempotency are unchanged.

**Alternatives:** A unique constraint on the Slack email (rejected: it would let one hacker block another by typing their email first, and matching the click to the chat's owner already covers it); emailing the Slack email too (rejected: the ask was the applied-with email).

**Accepted risk (code review, same day):** The Slack email isn't verified, so a hacker can enter someone else's address, on purpose or by a typo that happens to match. Their coffee chat and judging DMs then go to that person, who could accept or decline their chats from the DM. We kept the lookup order (Slack email first) and chose not to add one-time-code verification, because the stakes are low: it only redirects the hacker's own notices, never anyone else's. Two things narrow it:
- Saving looks the address up on Slack and shows who it found ("Found you on Slack as Jane Doe"), or says nobody uses it and saves anyway, so a wrong address is caught by eye. A Slack outage never blocks the save.
- Accept/Decline clicks only count from a 1:1 DM with the bot (channel id "D…"). The request is signed by Slack, and only the person in that DM can click there, so the clicker is always the person the DM was sent to. A click in a channel or group, or with no channel, is refused. The clicker must also still match the chat's owner by account email or current Slack email, so once the hacker fixes the address, the old DMs stop working.

## 2026-11-18 — The hacker notification center is derived, with a seen-keys list per user

**Decision:** The bell on /live (hackers only; in the mobile top bar and next to the page heading on desktop) lists the hacker's coffee chats (offered, confirmed, declined, expired, cancelled; time and room) and their team's sponsor presentations (sponsor, time, room) once the team has been sent its times. It is built on each request from `coffee_chat` and `sponsor_presentation`/`sponsor_presentation_notice` (src/lib/hacker-notifications.ts); there is no notifications table. Read state is one column, `user.notifications_seen` (text[]), holding the keys of notices the hacker has seen. A coffee chat's key includes its status, time and room, so a confirm, cancel or room move shows as unread again. Opening the bell marks the notices it showed as read: the client sends the keys it displayed, and the server keeps only those that still exist (plus ones already seen), so a notice that arrives after the panel opened stays unread. Each presentation notice shows how the hacker was told (Slack DM or Email) from `sponsor_presentation_notice.status`. Coffee chat notices show no channel, because which channel reached the hacker isn't stored.

**Why:** Both sources already hold everything the list needs, so a table would duplicate them and could drift. A seen-keys list gives per-notice unread state, including changes, without storing the notices.

**Alternatives:** A `notification` table written beside each DM or email (more writes inside the notify paths, and a second source of truth); a single "last opened" timestamp (cancels and room moves have no timestamp, so they wouldn't show as unread); storing the coffee chat channel on `coffee_chat` (left for later, since the notify channels run in parallel and the last event would overwrite it).

## 2026-11-18 — The organizer Sponsors tab follows the event day

- **Decision:** The first tab of `/internal/sponsors` has Fri / Sat / Sun pills (today during the event, Friday outside it, `?day=saturday` opens a day like the sponsor schedule) and shows only that day's columns and totals. **Friday:** status (arrived = any sheet status past "Not arrived"), a "Mark given" / "Link given" pill for the private portal link next to Copy link, booth, HW contact, help; totals are sponsors, arrived, links given, no private link yet. The status filter pills only show on Friday. **Saturday:** chat type, every slot of the sponsor's room blocks as booked/asked ("10:00 2/3", from the same `blockSlots` count the Coffee chats tab uses, so never more than 3 asked), chats accepted · waiting, help; totals are hackers booked of asked, slots still open, waiting, open help. **Sunday:** judging room, round 1 (shortlist sent with time and teams, or scored/shortlisted so far, or not started), round 2 (top 5 sent, not sent yet, or opens after presentations), where the sponsor should be now, help. "Where now" is their presentation room while their slots run (with the team presenting; between two slots, the nearest slot's room), else a run-of-show block on now (their own first, then main events, food), else their next block if it starts before their first presentation, else their presentations if still ahead, else the all-day Sponsor Bay while it's open (also after their presentations), else their next block, else done; nothing is guessed when the data is missing. Saturday slot cells cap booked at the ask and show any extra as "+N over", so cells and totals agree. A repeat "Link given" keeps the first time. The old totals footer is replaced by the day's totals. Sponsors show their real logo or just their name, no initials badge. When the sponsor sheet can't be read, the tab lists registered sponsors from the database with sheet fields shown as unknown, so Saturday and Sunday still work.
- **Link given:** a nullable `portal_link_given_at` on `sponsor_judging_sponsor` (migration `0057_sponsor_portal_link_given`, after `0056_notification_center`; 0054 belongs to another branch, and the first draft numbered 0055 is in `drizzle/_to_delete/`), set by `sponsorOrganizer.setPortalLinkGiven`. Arrival was already stored (the sheet status), so nothing new for it.
- **Why:** Jazz: the first page should change with the day. Friday is about judges arriving and getting their link, Sunday about whether they submitted and where they should be. Showing every day's columns at once was a wide table where most cells didn't apply.
- **Alternatives:** record "link given" automatically on the sponsor's first portal visit (says they opened it, not that we handed it over; could be added later as a second signal); a separate Day tab (the first page is where organizers look); keep every column and only highlight the day's (still the wide table); compute Sunday status from `sponsorScoring.overview` and `sponsorPresentations.overview` on the client (two heavy queries for a few counts, so the summary query reads the counts itself).

## 2026-11-18: One sponsor sheet (Spon Team RUN OF SHOW)
- **Decision:** Lucas's judging sheet tabs (Judging, sponsor info, HW Contacts, Coffee Chats as "Coffee Chat Room Grid") were copied into the Spon Team RUN OF SHOW sheet. The code reads and writes only that sheet (`RUN_OF_SHOW_SHEET`), with the run-of-show login. `SPONSOR_JUDGING_SHEET` is no longer read.
- **Why:** Jazz wants one source of truth; two sheets drift.
- **Alternatives:** keep both sheets (rejected: drift); point `SPONSOR_JUDGING_SHEET` at the same ID (rejected: two settings for one sheet).
- **Needs:** the run-of-show login must be Editor on the sheet for shortlists, sponsor info and the room grid to save.
- Also: availability wins over chatting hours. Chatting hours longer than a sponsor's window are capped at the window (Canada Life: 3 h in 10-12 reads as 2 h).

## 2026-11-18: Prize tracks gate judging, no slot means no round 2, and a Sponsor Judging tab
- **Decision (prize tracks):** Only Scotiabank, Sunlife, Canada Life, QNX, TinyFish and PCBWay have a prize track (Jazz). The list lives in `src/content/sponsor-prize-tracks.ts`. Names match registered sponsors loosely: case, spaces and punctuation are ignored and a longer registered name counts ("Sun Life Financial" matches "Sunlife"). A sponsor without a track doesn't judge. The server refuses their judging calls (`sponsorScoring.get/review/sendShortlist/submit` and `sponsorJudging.listAllTeams`, FORBIDDEN), scheduling ignores their shortlists, and the organizer judging lists leave them out. On the portal they see the Judging tile as a locked "No prize track" tile, and `/picks` shows a short "No prize track" note. PCBWay isn't registered yet; it still gets a row on the sheet tab.
- **Why:** Sponsors without a track have no prize to judge. Showing them a Judging page with every team was confusing and put their shortlists into the presentation schedule.
- **Alternatives:** hide the Judging tile completely (rejected: the portal tour points at that tile, and a quiet note answers "where's judging?"); read the track from the sheet's "Sponsor Track" column (rejected for the gate: it's a team filter, some track sponsors have it blank, and Jazz gave the list directly; the column still filters which teams a sponsor sees).
- **Decision (round 2):** A sponsor with no placed presentation slot can't rank in round 2 (Jazz). `sponsorScoring.submit` refuses them (FORBIDDEN, "Round 2 is locked...") once round 2 is open, and the picks page shows their sent shortlist with a plain locked message and no ranking. Round 2 always ranks only the teams that presented to that sponsor. This replaces the earlier "never lock them out" rule, where a sponsor with no slot ranked their shortlist.
- **Why:** Round 2 picks from teams that presented. With no slot nobody presented, so there's nothing fair to rank.
- **Decision (sheet tab):** The app writes a "Sponsor Judging" tab in the run-of-show sheet (`sponsor-judging-sheet-mirror.ts`), one way from the DB, same pattern as the coffee chat bookings tab: creates the tab if missing, rewrites it in full, writes one at a time with a 5 s timeout, logs a failure once and never blocks the action. It's rewritten after a shortlist is sent, presentations are scheduled (not a dry run), hackers are notified, and a top 5 is submitted, plus an organizer "Sync to sheet" button on the presentations panel that shows whether the write worked. Layout: a note row with the update time, then three tables with a blank row between: Tracks (Sponsor, Has track, Judging room, Round 1 shortlist sent, Round 2 top 5 sent), Chosen teams and presentation schedule (Sponsor, Round, Team, Members, Time, Room, Notified), and Final results (Sponsor, Rank, Team, Members). Rooms come from `judgingRoomsById`, the same read scheduling uses. Time and Room are filled only for a placed slot; Notified is how that team's members got their current times (Slack, Email, failed, or several). Missing data is a blank cell. No migration.
- **Why:** Organizers already live in the run-of-show sheet. The app is the source of truth, so the tab is a read-only view of it, never an input.
- **Alternatives:** write into Lucas's "Judging" tab (rejected: his rotation reads it, and it only holds picks); two-way sync (rejected, same reasons as coffee chats); a fixed-interval cron (rejected: writes on change are simpler and fresher).
- **Needs:** the run-of-show service account must be Editor on the sheet. Until then every write fails and is logged once, and judging keeps working.

## 2026-11-18: Sheet writes only in production; stale mirror writes stop
- **Decision:** The run-of-show service account is now Editor on the live sheet, so `sheetWritesEnabled()` (`run-of-show-sheet.ts`) decides whether this server may write: true only when `NODE_ENV` is production or `SHEET_WRITES=1`, and never under Vitest whatever the env says. When it's false, both mirrors (Sponsor Judging, Coffee Chat Bookings) write nothing and return `{ ok: false, error: "disabled" }` (logged once), and `getSheetsClient` asks for the read-only scope, so Lucas's writes (shortlists, sponsor info status, the Judging tab, the room grid) fail instead of landing on the live sheet. "Sync to sheet" says writes are off on this server.
- **Decision:** Each mirror run gets a generation number. A run that timed out (the queue moved on) stops before its next step once a newer run has started, so it can never clear or overwrite rows the newer run wrote.
- **Decision:** Opening round 2 is refused inside `setRound2Open` while no team has a placed presentation slot ("Schedule presentations before opening round 2..."). The organizer button is disabled in the same case and shows the same sentence. `sponsorJudging.getChosenTeams` is gated on the prize track list like `listAllTeams`.
- **Why:** A dev server or test with the copied `.env` could otherwise write to the live sheet. The stale-run case is real: a write that times out keeps running in the background.
- **Alternatives:** a separate test sheet (rejected for now: another ID and share to manage); a global test mock of both mirrors (rejected: the mirror tests need the real code, and the helper's Vitest check covers every write path, including Lucas's).

## 2026-11-18: Sponsors shortlist; organizers assign coffee chats
- **Decision:** On the sponsor side, coffee chats are three things: shortlist candidates (main view), configure chats (1-on-1 or 3-on-1, 20 or 30 min, reps, availability with "Offer less chats"), and a read-only "Your chats" view (time, room, who they're talking to). Organizers assign shortlisted hackers to slots and rooms. Sponsors no longer invite hackers into slots or cancel individual chats.
- **Why:** Jazz: sponsors care about who they shortlist and how chats run, not room logistics. Assignment is the organizer team's job.
- **Alternatives:** sponsor-driven invites per slot (mock B v3/v4; dropped as more work than sponsors want).
- **Mock:** mocks/sponsor-coffee-chats-v5. App change not built yet.

## 2026-11-18: Coffee chat auto-fill (organizer side)
- **Decision:** Organizers press Auto-fill, see a preview, then press Send invites. Seats fill with manual (booth) picks first, then the rest of the shortlist by interest rank. Extras become the waiting list. On a decline or timeout, the next person on the waiting list is invited, then the next by interest rank. Shortlists have no sponsor ordering.
- **Why:** It's the simplest option: a predictable rule, it reuses the existing invites and notices, and organizers keep control.
- **Alternatives:** sponsor-ranked shortlists (more work for sponsors); a scheduled job instead of a button (less control).

## 2026-11-18: Floor maps are the source of truth for logistics
- **Decision:** The HW13 Level 1 and Level 2 maps decide room logistics. Help desk: the table in front of the Grand Hall. Sponsor Bay: 1235. Storage: 2244. Coffee chats: 2241-2243, Sat 10-5.
- **Why:** Jazz said so; the live site text was out of date (Room 1225).

## 2026-11-18: Sponsor portal side nav
- **Decision:** One shared shell: a side nav on screens 768px and wider, a bottom tab bar on phones, never both. Judging is greyed out and locked until Sun 9 AM for prize-track sponsors, and hidden for the rest. The Home action tiles were removed because they were a second nav. Need help is a single provider per page. Venue is the `#venue` anchor on Home.
- **Why:** Jazz picked the wireframe's "Side nav" variant and flagged the double nav.
- **Alternatives:** keep the tiles plus the nav (rejected: two navs).

## 2026-11-18: Coffee chat rooms and help ping
- Added Rm 1348, 1352, 1354, 1356 and 1358 (Sat 10-5) to the coffee chat rooms. They have no map pins until we know where they are.
- The Need help ping takes an optional Message and Location; the confirmation reads "Someone from the sponsor team will come to you".
- Sponsor mock v7: redesign from Jazz's UX feedback (mocks/sponsor-coffee-chats-v7/FEEDBACK.md). No ranking is shown to sponsors.

## 2026-11-18: Coffee chat preferences, locking, and organizer bookings (Jazz)

**Decision:**
- Sponsors submit coffee chat *preferences* (reps, 1-on-1 and/or group format, 15 or 30 min, availability blocks, per-slot seats, notes, shortlist up to 40). Organizers run auto-fill over all submissions, then assign and approve by hand. Mock: `mocks/sponsor-chat-setup-v1`.
- Preferences live in the Spon Team RUN OF SHOW sheet (a new tab), not only in the DB.
- Rooms run Saturday 10 AM to 5 PM. Max 6 people per room. A 1-on-1 rep gets their own room (intended).
- Sponsors can't request more than their contracted chatting hours. Blocks are at least 1 hour; warn (don't block) past 3 hours without a break.
- Shortlisted hackers are placed directly by organizers. Hackers never learn who shortlisted them; they only get an invite. Shortlist order doesn't matter.
- When room requests exceed rooms, organizers resolve it by hand and can send a message back to the sponsor.
- Confirming the shortlist locks it and also locks that sponsor's chat rooms and times. Organizer mock v4: once invites go out, a booking is locked; moving it takes "Request change", which warns how many hackers get notified.
- Organizers can create their own events ("Organizer" owner, or assigned to a sponsor), book rooms, and add hackers. Auto-fill never double-books a hacker against an event.
- When an organizer scans a hacker's QR code (scavenger hunt, food), show a popup if that hacker has an unanswered coffee chat invite, so the organizer can remind them. (Not built yet.)

**Why:** Sponsors know their people and time; organizers own rooms and fairness. Locking after comms go out keeps hackers' invites true.

**Alternatives:** Sponsors book rooms themselves (rejected: room clashes); capping requests in the form (rejected: sponsors can't see other sponsors' requests); invite-only slots or early booking for shortlisted hackers (rejected for direct placement).

**Open:** the sponsor edit deadline (mock uses Thu Nov 19, 11:59 PM as a placeholder).

## 2026-11-18: Spon Team sheet reorganized around each sponsor's lead (Jazz)

**Decision:** Contract Breakdown is the per-sponsor day-of hub: new columns B-H (HW lead, lead phone looked up from HW Contacts, stage, workshop, coffee chats, judging, "To do / mismatches") inserted before the contract checkboxes, plus a footer for all on-site sponsors. Team Assignments is one row per spon team member, all formulas (sponsors led and count from Contract Breakdown column B, phone from HW Contacts, availability and on-call from RUN OF SHOW). live sponsor info got rows for Canada Life, CSE, Scotiabank, StarTech and Sun Life. RUN OF SHOW, Coffee Chats, Judging, HW Contacts and Coffee Chat Room Grid layouts were not touched.

**Why:** One place per sponsor for the lead on the day, and one source per fact (assignments in Contract Breakdown column B, phones in HW Contacts) so nothing goes stale. The app reads live sponsor info, Judging, Coffee Chats and the room grid by fixed columns or header rows, so their layout stays as is.

**Alternatives:** Rewrite Contract Breakdown from scratch (rejected: loses checkbox validation and tier colours); a new "Sponsor Day-Of" tab (rejected: Jazz wanted it on Contract Breakdown); writing the sheet with the app's service account (rejected: bypasses the SHEET_WRITES guard; edits were made in Jazz's own browser session).

## 2026-11-19: Docs and mocks go in PR #1165; sd-* branches pushed as backups (Jazz)

**Decision:** mocks/, docs/ (incl. decisions.md), NEXT.md and context/ are committed to sponsor-dashboard (force-added; the shared .git/info/exclude is unchanged). _local/ and _to_delete/ stay out. ops-pings and the 14 sd-* worktree branches are pushed to origin as-is, no PRs.

**Why:** A teammate needs to pull the full picture. The repo is public, so files were scanned for secrets, phone numbers, the sheet link and full names first.

**Alternatives:** A companion docs branch (keeps the PR diff app-only); leaving the sd-* branches local.

## 2026-11-19: Spon Team sheet tabs grouped and color coded; "live sponsor info" is now "Sponsor Status" (Jazz)

**Decision:** The Spon Team RUN OF SHOW sheet got a "Start here" tab (what each tab is for, who edits it, whether the app reads it) and a new tab order: Start here, Sponsor Day-Of (was Contract Breakdown), Spon Team (was Team Assignments), then the tabs the app reads (RUN OF SHOW, Workshops, Opening + Closing Ceremonies, Coffee Chats, Coffee Chat Room Grid, Judging, Sponsor Status, HW Contacts). Blue tabs are free to edit, orange tabs are read by the app (change values, never columns, header rows or names). Empty cells that still need info are filled light yellow, never typed as "TBD", because the app reads any text as real data. "Sunlife" and "Tinyfish" were respelled to the registered names. The app finds the sponsor info tab under "Sponsor Status", then the old names ("live sponsor info", "sponsor info"); a missing tab is created as "Sponsor Status". No columns or header rows moved in any tab the app reads.

**Why:** Jazz asked for tabs that make sense and for the app to match the sheet. The sheet is not read by production yet (only the sponsor-dashboard branch and local dev), so renaming was safe the day before the event. An .xlsx backup from before the change is in `_local/` and the sheet's version history has every earlier state.

**Alternatives:** Move the team availability block out of RUN OF SHOW and merge Workshops and Ceremonies into one tab (rejected for now: the parsers find those blocks and tabs by position and name, so it means parser changes the day before the event); reorganize a copy of the sheet (rejected by Jazz); put "TBD" in empty cells (rejected: the app shows it as data, the way booth "TBD" already shows).

## 2026-11-19: The sponsor list comes from the Spon Team sheet, not a separate master sheet (Jazz)

**Decision:** The organizer Sponsors tab (`sponsorDashboard.getSponsors`), "Sync from sponsor sheet" (`syncSponsors`) and the status-row check read the sponsor list from the Spon Team sheet's "Sponsor Day-Of" tab (falls back to "Contract Breakdown"): header row = column A "Sponsor Name", HW lead and "To do / mismatches" found by header name, list ends at the first blank name. `SPONSOR_MASTER_SHEET` is no longer read. Tier, amount and company contact aren't on that sheet, so they show blank. Sponsor Day-Of is now an app-read (orange) tab.

**Why:** Jazz wants one sheet with all the info live. The Sponsors tab sat on "Loading…" because the master sheet ID wasn't set, and that one missing read failed the whole query.

**Alternatives:** keep the master sheet and set its ID (two sheets drift); read the list from Sponsor Status (it only has the 7 registered sponsors, not all 15).

**Also (coffee chats):** on the organizer coffee chat board, "organizer events" means ad hoc room bookings organizers make (for example a sponsor who wants a room last minute), not run-of-show events. Schedule events don't go on the coffee chat board, and ad hoc bookings don't need their own tab.

## 2026-11-19: Sponsors plan coffee chats on one calendar (Jazz)

**Decision:** Sponsor setup is three steps: 1 Calendar (add named reps, plan blocks), 2 Shortlist, 3 Confirm. The calendar (named reps across the top, Sat 10 AM-5 PM in 15-minute rows) replaces the Format, Chat length, Availability and Preview steps. Each block has its own reps, chat length (15 or 30 min) and hackers per chat. Sponsors never see rooms; organizers assign them. Only named reps exist. Full spec: `docs/specs/sponsor-chat-calendar.md`.
- Group size: a room holds 6 people, reps and hackers together, so hackers per chat is at most 6 minus the block's reps.
- Over package hours: allowed and flagged (amber). Organizers send the confirmations and can resize the time.
- No minimum block length. A soft note recommends at least 1 hour. Replaces the old 1-hour minimum.
- Buffer: 30-minute chats run 25 min + 5 min break; 15-minute chats run back to back (Claude's suggestion, pending Jazz's OK). The slot math stays 15/30.
- After invites go out, sponsors can still move or cancel chats, with a strong warning. Changes send hackers an update that needs reconfirming. Replaces "locked once invites go out" for sponsors.
- The organizer dashboard reads the same blocks, so its labels use 15/30-minute chats too (no 20-minute chats).

**Why:** One calendar shows what sponsors are planning without abstract rules ("at least 1 hour", "blocks merge", how hours are counted); the hours strip shows the clock-time rule.

**Alternatives:** the numbered step flow (`mocks/sponsor-chat-setup-steps-v1`) and the modals (a/b/c-v1): more steps, and the rules have to be explained in text.

## 2026-11-19: Setup deadline Friday night; help ping = lead's phone + Slack post with the sponsor's phone (Jazz)

**Decision (deadline):** Sponsors submit their coffee chat setup by Fri Nov 20, 11:59 PM (Jazz: "by Friday night"; exact time pending). Organizers auto-fill and send invites Saturday morning. Later changes are allowed with the strong warning (see the calendar entry).

**Decision (help ping, proposed, pending Jazz's OK):** Sponsors give their phone number in the setup flow. "Need help" shows their HW lead's name and phone (from HW Contacts) for direct contact, and "Send to the sponsor team" posts to the sponsor Slack channel with the sponsor, message, location and the sponsor's phone, @mentioning their HW lead. Whoever takes it reacts in Slack and calls back. The dashboard doesn't track help requests (no status, no queue).

**Why:** Each sponsor has a dedicated lead, but leads get busy; Slack lets the whole team see it while the mention keeps clear ownership. Tracking help on the dashboard was work nobody needs.

**Alternatives:** lead's phone only (fails when the lead is busy, and nobody else knows); Slack only (no clear owner); keep the dashboard help queue (Jazz: doesn't need managing).

**Not pushed:** the sponsor-dashboard commits stay local until Jazz says to push.

## 2026-11-19: Organizers contact sponsors by phone, not Slack nudges (Jazz)

**Decision:** The organizer coffee chat board has no "Nudge on Slack". "Contact" lists the sponsor's named reps (with the phone each gave in "+ Add rep"), the sponsor's main phone (from setup) and their HW lead. Each person has Copy, Message (an `sms:` link that opens Messages with a drafted text the organizer can edit first) and Call (`tel:`). Mock: `mocks/organizer-coffee-cards-grid-v2`.

**Why:** Sponsors aren't on our Slack, so a nudge can't reach them. A drafted text saves typing on a phone at the event.

**Alternatives:** Slack nudge (sponsors aren't there); email (slow on the day). `sms:` does nothing on most Windows laptops, so Copy stays next to it.

## 2026-11-19: Guided tours on the organizer dashboard

**Decision:** Each tab of /internal/sponsors (Sponsors, Run of show, Coffee chats, Sponsor judging, Task pings) has a short tour of 3 to 5 steps, drawn with the sponsor portal's overlay (dim, ring, "Step n of N", bottom sheet on phones, centred callout when a target is missing). A "Tour" button in the dashboard header starts the open tab's tour. The first time an organizer opens a tab, a "New here?" card offers it (Start / No thanks); the answer is remembered per tab in localStorage (`hw-organizer-tour-seen:<tab>`), never forced. Tours are data in `src/lib/organizer-tours.ts`, copy in `src/content/organizer-tour.ts`, targets are `data-tour` attributes on the tabs. Switching tabs ends a running tour. Shared pieces moved out of the sponsor tour without changing it: `useTarget` (use-tour-target.ts), `TourOffer` (tour-offer.tsx) and generic `hasSeen`/`markSeen`.

**Why:** Organizers pick up the dashboard mid-event and need to learn each view in a minute, the same way sponsors learn the portal.

**Alternatives:** one long dashboard tour that switches tabs (longer, and most organizers only use one or two tabs); a How to menu like the sponsor portal's (more to build for five tabs that each need one tour); a tour library (same reasons as the portal tour, 2026-11-18).

## 2026-11-19: Coffee chat rooms are two pools: 3 near rooms and 5 in Ivey (Jazz)

**Fact:** 8 breakout rooms at most at once. Rooms 2241, 2242 and 2243 are next to each other in the main building, near the Sponsor Bay. Rooms 1348, 1352, 1354, 1356 and 1358 are in the Ivey building, a 15-minute walk from the Sponsor Bay. Wording for sponsors and hackers: "Rooms 1348–1358 are in the Ivey building, a 15-minute walk from the Sponsor Bay." On an assigned chat: "Ivey, Rm 1352 · 15 min walk · leave the Sponsor Bay by 9:45". This settles the open question about whether 1348–1358 are in Ivey.

**Planning direction (proposed, pending Jazz's answers):** near rooms for short chats, 1-on-1s, "Met at booth" picks and ad hoc bookings; Ivey for planned blocks of at least 1 hour, 30-minute and group chats. One sponsor stays in one building at a time; a rep needs at least 30 minutes between a near room and Ivey. Offers for Ivey chats expire about 35 minutes before the chat (20 + 15 walking) instead of 20. Calendar columns become rooms ("Room 1, Room 2"), with reps listed on each block. A "Your team" step comes before the calendar. Setup asks how flexible they are and whether Ivey is OK. A busy-times strip shows the near rooms separately.

**Open:** Ivey only when near rooms are full, or the default for long planned blocks? Do Ivey reps still cover the booth? Who wins a clash (package, first to submit, or Jazz decides)?

## 2026-11-19: Coffee chat rooms: organizers decide; live busy strip; availability shown (Jazz)

**Decision:**
- Sponsors never choose or request rooms; organizers decide placement and settle clashes by hand (no automatic tie-break). Planning columns are "Room 1, Room 2" only.
- All 8 rooms (2241-2243 and Ivey 1348-1358) are open Sat 10 AM-5 PM; no special Ivey rules and no Ivey question for sponsors. Sponsors see the building and walk time once assigned.
- Setup asks "If rooms are tight, can we shift your chats?" (Not flexible / Within 1 hour / Anytime 10 AM–5 PM).
- A busy-times strip shows event-wide room use per 30 min, drafts included, updated live (target: within ~5 s) so sponsors planning together in the Friday workshop see each other's plans. Information only, never blocking.
- The planning calendar shows the sponsor's own schedule for the day (their workshop and setup, meals, stage time, from the run of show) as read-only events behind the room columns, so they plan chats around what they're supposed to be doing. Chats may overlap them; an overlap with their own workshop gets an amber note, nothing is blocked.
- Reps chatting in Ivey are not restricted from the booth; nothing enforced.
- New step 1 "Your team" (reps with optional phone/email, sponsor's main phone required) before the calendar. Calendar columns are rooms; a block lists its reps, so a shared room shows once.

**How (build):** autosave every block edit as a draft on the server; a small room-load query polled every ~5 s (react-query refetchInterval). Websockets rejected for now: more to build and run the day before the event for no visible gain at ~10 sponsors.

**Supersedes:** the proposed clash rule, the Ivey-default question and the Ivey question in "two pools" (2026-11-19).

## 2026-11-19: Help requests require a name and call-back phone (Jazz)

**Decision:** "Send to the sponsor team" has two required fields, "Your name" and "Phone we can call back", prefilled from the sponsor's main contact (from setup) and editable. The Slack post carries the sponsor, name, phone, message and location, and @mentions their HW lead.

**Why:** whoever is at the booth may not be the main contact; the team needs to know who to call and on which number.

**Alternatives:** use only the main contact's number (wrong person when someone else is at the booth); optional fields (posts arrive with no way to call back).

## 2026-11-19: Your team starts empty; coffee chat setup is mirrored to a "Coffee Chat Setup" sheet tab (Jazz)

**Decision (Your team):** The "Your team" step starts empty with one blank rep row. No rep is prefilled and there's no "we filled this in" banner on that step: no source has rep names (the sheet's Coffee Chats tab only has rep counts). The calendar mocks' named reps are example data.

**Decision (sheet):** Every save of a sponsor's coffee chat setup (draft or submit) rewrites the app-owned "Coffee Chat Setup" tab of the Spon Team sheet from the database, same pattern as the Sponsor Judging mirror (one writer, generation number, 5 s timeout, logs a failure once, never blocks the save, production or SHEET_WRITES=1 only). The tab was created 2026-11-19 with a note row and four stacked tables:
- Sponsors: Sponsor, Status, Last saved, Main contact, Main phone, Can we shift chats?, Chatting hours (used / package), Chats, Hacker seats, Rooms at busiest time, Overlaps with their schedule, Notes
- Team: Sponsor, Rep, Phone, Email
- Chat blocks: Sponsor, Planning room, Reps, Start, End, Chat length, Hackers per chat, Chats, Hacker seats, Assigned room, Overlaps
- Shortlist: Sponsor, Hacker, Hacker ID, Source (Shortlist / Met at booth)
It's a grey tab (app writes; don't type in it), listed on "Start here". "Start here" rule updated: our team's phones live only in HW Contacts; sponsor phones come from their setup.

**Why:** organizers live in the sheet and want to see what sponsors entered, live during the Friday workshop. The app stays the source of truth, so the sheet can't drift.

**Alternatives:** sponsors fill a sheet directly (no validation, no calendar); two-way sync (rejected before for the same reasons as coffee chat bookings); one tab per table (four tabs to keep in order).

## 2026-11-19: "Met at Hacker Fair" list and picking a rep on scan; hacker-v3 is the final sponsor flow (Jazz)

**Decision:** Chats has two lists: "Shortlist" (picked before the event) and "Met at Hacker Fair" (hackers a sponsor met at their booth and wants to chat with). Met at Hacker Fair picks are offered seats first (same as the earlier "manual (booth) picks first" auto-fill rule). Scanning a hacker asks "Which rep wants to talk to them?" (from Your team), then shows the next open seat with that rep (time, rep, building) with "Offer this seat" or "Add as Met at Hacker Fair". Offers expire 20 minutes before the chat, 35 for Ivey rooms. The final sponsor portal prototype is `mocks/sponsor-portal-flow-hacker-v3` (hacker-v2's look plus every decision from 2026-11-19).

**Why:** sponsors meet people at the booth who weren't on their shortlist; choosing the rep at scan time sends the hacker to the person who actually wants to talk to them.

**Alternatives:** the names "Met at booth", "Walk-ins" ("walk-in" sounds uninvited), "Leads" (sales talk); offering the next seat with any rep (the wrong person may get the chat).

## 2026-11-19: No sponsor chats within 15 minutes of their own workshop; organizer board v6 in v5's look (Jazz)

**Decision:** Sponsors can't plan chats from 15 minutes before their own workshop setup starts to 15 minutes after their workshop ends (Sun Life: 1:45–3:45 PM). The calendar shows it as a blocked band and refuses blocks there. Lunch and dinner stay allowed, shown as dotted outlines. Replaces "chats may overlap their own workshop with an amber note". Coffee chats start at 10:00 AM (nothing before). Organizer board: autofill-v5's look, rooms first, sponsor info on the same page (no side drawer), Contact instead of Slack nudges; three layout versions v6a/b/c. Every mock change and its status is tracked in `hackwestern-sponsor-dash/mocks/CHANGES.md`.

**Why:** reps need time to set up and get to their workshop; meals are flexible. Jazz kept losing track of which mock had which change.

## 2026-11-19: Help = text your lead; off shift = leave a message on Slack for whoever's on call. Task pings stay on Slack (Jazz)

**Decision (help):** The sponsor Help page checks their HW lead against the Spon Team schedule (availability and on-call shifts).
- Lead on shift: main action "Text <lead> (your contact)" opens Messages on the sponsor's phone with a drafted text ("Hi Noah, it's Sun Life at booth 5. …"), plus Call. A small "Send to the whole sponsor team" link posts to Slack if the lead doesn't reply.
- Lead off shift: the main action becomes "Leave a message": "<Lead> is off until <time>. Leave a message and whoever's on call will call you back." The required name + call-back phone + message post to the sponsor Slack channel, @mentioning the person on call at that time (from the on-call shifts).
- One line for urgent in-person help: "Help desk: by the stairs outside the Grand Hall".
Supersedes "lead's phone + Send to the sponsor team" as equal options (2026-11-19).

**Decision (task pings):** automatic task reminders stay Slack DMs to owners (team channel when no clear owner). Overdue tasks on the Pings screen get a "Text" button that opens Messages on the organizer's own phone with a drafted reminder.

**Why:** texting the lead is faster and doesn't depend on anyone watching Slack; off-shift leads shouldn't be woken, and sponsors only ever get their own lead's number. Apps can't send iMessages, and automatic SMS (e.g. Twilio) needs a paid number and business sender registration that can take days, so automatic pings stay on Slack.

**Needs:** leads agree to their number being shown to their sponsors; the team turns on Slack notifications for DMs and the sponsor channel for the weekend.

## 2026-11-19: Sponsor Judging sheet tab is wide, with 1st–5th place columns (Jazz)

**Decision:** The app-owned "Sponsor Judging" tab (created in the sheet 2026-11-19, grey) has one row per sponsor: Sponsor, Prize track, Judging room, Round 1 status, Shortlist sent, Shortlist (team IDs), Round 2 status, Top 5 sent, 1st place, 2nd place, 3rd place, 4th place, 5th place, Notes. Place cells read "<team ID> · <team name>". A Presentations table sits below (Sponsor, Team ID, Team, Members, Time, Room, Notified). `sponsor-judging-sheet-mirror.ts` must be changed to write this layout (it currently writes three stacked tables with a long-format Final results). The existing "Judging" tab is unchanged (fixed layout; Luka's rotation reads it).

**Why:** organizers read one row per sponsor to see each sponsor's ranked picks and team IDs at a glance.

**Alternatives:** add 1st–5th columns to the "Judging" tab (rejected: fixed layout read by the app and the judging rotation); keep the long Rank table (harder to scan).

## 2026-11-19: Digital sponsors: grouped on Sponsor Day-Of, no portal link, top 5 entered by the spon team (Jazz)

**Decision:**
- Sponsor Day-Of has an "In person / Digital" column (column B, dropdown), set from the old "Sponsor Booth" checkbox: Autodesk, Celsius, PCBWay, Shopify and uBit are digital. In-person sponsors sort first; digital rows are a greyed, collapsible group at the bottom. The day-of copy columns (stage, workshop, coffee chats, judging, To do / mismatches) were removed (Jazz); their contents are in version history and the 2026-11-19 xlsx backup.
- Digital sponsors aren't on site and don't get a sponsor portal link. Build: `getSponsors`/`syncSponsors` skip rows marked Digital for private links and the on-site lists.
- Digital sponsors with a prize track (today: PCBWay) give their top 5 to the spon team, who enter it on the organizer dashboard's Sponsor judging page ("Digital sponsors" section: pick 1st–5th from the track's teams). That fills the same 1st–5th place cells on the "Sponsor Judging" tab. RUN OF SHOW has the task at Sun 9:00 AM (owner blank: no digital sponsor has a lead).
- The "Sponsor Judging" tab now lists all 15 sponsors with In person / Digital, Prize track (Yes/No) and judging room (blank + yellow where unknown).

## 2026-11-19: Coffee Chat Room Grid is an app-written, locked view of all 8 rooms; Spon Team tab deleted (Jazz)

**Decision (room grid):** "Coffee Chat Room Grid" was rebuilt: note rows, "Near the Sponsor Bay" (Rm 2241–2243, columns B–D, unchanged positions) and "Ivey building · 15-minute walk" (Rm 1348, 1352, 1354, 1356, 1358, columns E–I), header row 4, 15-minute rows 10:00 AM–4:45 PM in column A. The app writes it from the coffee chat board: one merged block per booking, "sponsor · reps · format · chats", no hacker names; organizer bookings grey. The tab is protected: only the app's service account and jazz.gu2004 can edit (the owner always can). Build: replace the old code that writes sponsor names into cells (`sponsor-coffee-chats.ts`) with this one-way view. The old Manulife placeholders (2241–2242, 10:00–12:30) were removed; Manulife has no coffee chats in its contract.

**Decision (Spon Team):** deleted. Everything on it was copied from other tabs (phones from HW Contacts, sponsors led from Sponsor Day-Of, availability and on-call from RUN OF SHOW). The two "Saturday breaks" notes moved to RUN OF SHOW N6:N7. Recoverable from version history.

## 2026-11-19: Teams show as team ID + Devpost link; digital top 5 entered by Devpost link; judging sheet lists prize-track sponsors only (Jazz)

**Decision:** Everywhere a team appears in judging (sheet and app), show both its team ID and its Devpost link ("a1c3e5f70912 · devpost.com/software/…"). The spon team enters a digital sponsor's 1st–5th place by pasting Devpost links (a team ID also works); the app matches each link to the team via `teams.devpostUrl`, shows the match (name, ID, link) for confirmation, and refuses a link that matches no submitted team in that sponsor's track. The "Sponsor Judging" tab lists only sponsors with a prize track (Canada Life, QNX, Scotiabank, Sun Life, TinyFish, PCBWay); the Prize track column and the no-track rows were removed.

**Why:** the spon team gets Devpost links from digital sponsors, not internal team IDs; organizers need both to award prizes and cross-check.

## 2026-11-19: HW Contacts trimmed to the people the app uses (Jazz)

**Decision:** HW Contacts keeps only the spon team (Noah Medland, Caroline Ge, Daniel Wang, Alice Nguyen, Aniya Liu), the HW contacts still listed on Sponsor Status (Lucas Vanderwielen, Brittney Chong) and Jasmine Gu. The other 20 rows were deleted (recoverable from version history). The tab stays because Sponsor Day-Of's Lead phone, the sponsor portal's lead phone, "Text your lead" and the HW Contact dropdown read it; Aniya leads no sponsor but has an on-call shift, so her number only lives here.

**Alternatives:** delete the tab (breaks every lead phone lookup); type phones into Sponsor Day-Of (duplicates each lead's number per sponsor and loses Aniya).

## 2026-11-19: Sheet cut to 9 tabs; Coffee Chats merged into Coffee Chat Setup; Judging and Start here deleted; spon contacts on RUN OF SHOW (Jazz)

**Decision:**
- "Coffee Chats" was merged into "Coffee Chat Setup" (a copy with the same row-1 headers, plus Status, Main contact, Main phone, Reps (names + phones), Can we shift chats?, Last saved by sponsor, and a Commure row) and deleted. Every row starts as "Pre-confirmed (not confirmed)" and stays editable; a sponsor's portal submission will set "Confirmed by sponsor". The app reads `COFFEE_CHATS_TAB = "Coffee Chat Setup"` (commit on coffee-prefs). Checked through the real parser: 6 coffee chat rows, 35 events, 56 tasks.
- "Judging" was deleted; "Sponsor Judging" replaces it. Its only data (Commure's 6-team shortlist; TinyFish room "Digital") is in a note on Sponsor Judging. **Until the judging build, saving a sponsor shortlist fails** (`sponsor-judging-teams.ts` and `routers/sponsor-judging.ts` write to the Judging tab). Build: store shortlists and top 5 in the database and mirror to Sponsor Judging.
- "Start here" was deleted (Jazz). The colour rules (orange = app reads, grey = app writes, yellow = missing) stay on the tabs.
- RUN OF SHOW rows 89–99 have "SPON CONTACTS": name, phone and sponsors they lead, all formulas from HW Contacts and Sponsor Day-Of (rows past the schedule; the parser ignores them).
- Digital sponsors' 4th and 5th place are optional (some give a top 3).

**Pre-existing, found while checking:** the coffee chat parser ignores the "Length" and "Hacker(s) per chat" columns (Sun Life reads as 15 min, 1 per chat instead of 30 min, 3). Fix in the build.

## 2026-11-19: One coffee chat deadline Friday 11:59 PM, auto-submit, scanned hackers first, one invite batch (Jazz)

**Decision:**
- Sponsors submit their coffee chat setup (Your team + chatting preferences + optional shortlist) by **Fri Nov 20, 11:59 PM**. One deadline, one Submit.
- **Auto-submit:** a sponsor who hasn't submitted by the deadline is submitted automatically from their latest saved draft; with no draft, from their "Pre-confirmed" row in the Coffee Chat Setup tab. Their status shows "Submitted automatically".
- **Scanned hackers are first choice:** anyone a sponsor scanned (at the Sponsor Bay on Friday) is offered a seat before their shortlist, then hackers interested in that sponsor. No separate timing rules.
- **One invite batch:** organizers run auto-fill right after the deadline (Fri ~midnight), check it, and send all Saturday invites at once, so hackers get overnight notice.
- **Saturday:** declines and unanswered invites (20 min before the chat; 35 for Ivey) pass to the next person on the waiting list automatically. Scanning on Saturday is optional and only offers open seats.
- The shortlist stays optional; without one, seats fill from scanned and interested hackers.

**Why:** sponsors doing coffee chats on Saturday are in the chat rooms, not at the Sponsor Bay, so the booth conversations that matter happen Friday evening (Sponsor Bay Fri 5:30–11 PM). One deadline and one sending moment is simpler for sponsors and organizers than rolling or wave-based invites.

**Alternatives:** invites 2–3 hours before each chat (rough notice; nobody's up at 7–8 AM for morning chats); three invite waves (Fri 11 PM shortlist, Sat 9 AM, Sat 12 PM: three schedules to explain); reserving seats when shortlisted (locks out people met at the booth).

**Supersedes:** "Submit by Fri Nov 20, 11:59 PM" applied to the calendar only, the separate "Met at Hacker Fair" priority list timing, and the per-chat lock timing in "Coffee chat preferences, locking, and organizer bookings" (2026-11-18): each sponsor's chats lock when the Friday batch is sent.

## 2026-11-19: Coffee chat deadline 9:30 PM Friday; invites out by 10 PM (Jazz)

**Decision:** Sponsors submit by **Fri Nov 20, 9:30 PM** (auto-submit at 9:30 PM from their latest draft, or their Pre-confirmed row). Organizers run auto-fill, check it and send all Saturday invites **by 10:00 PM Friday**. Everything else in "One coffee chat deadline… one invite batch" stands (scanned hackers first, shortlist optional, Saturday refills automatic, Saturday scans only fill open seats). Friday scanning at the Sponsor Bay runs 5:30–9:30 PM so scans count as first choice.

**Why:** Jazz wants hackers to get invites earlier in the evening, while they're awake and checking Slack, rather than around midnight. 30 minutes is enough for auto-fill plus a quick check.

**Supersedes:** the 11:59 PM deadline and "invites ~midnight" (same day).

## 2026-11-19: Sponsors give chatting preferences at the Friday workshop; no deadline messaging; keep preferences (Jazz)

**Decision:** Sponsors fill in their coffee chat preferences live at the Friday 5 PM sponsor dashboard and coffee chat workshop (Rm 2110), with organizers there. The sponsor UI shows no deadline or auto-submit messaging. Keep the preferences model (reps' chat blocks), not availability: conflicts get sorted in the room at the workshop. Organizers still send all invites Friday evening (by 10 PM); the 9:30 PM cutoff and auto-submit remain an internal fallback for anyone who didn't finish at the workshop, not shown to sponsors.

**Why:** with organizers in the room, preferences can be adjusted on the spot, so the extra complexity of availability isn't needed and a deadline banner just adds noise.

**Alternatives:** collect availability and let auto-fill place chats (rejected for now); show the deadline and auto-submit note (removed as noise).

## 2026-11-19: Coffee chats switch to fixed 1-hour sessions (Daniel's spec), reconciled with Jazz's choices

**Decision:** Adopt `docs/specs/coffee-chat-sessions.md` (Daniel Wang): sponsors answer three questions (hackers per chat 1–5 with a "longer chats" option for 1-on-1s; which fixed 1-hour sessions each rep is free: 10–11, 11–12, 1–2, 2–3, 3–4, 4–5; about how many hours per rep 1/2/3/4+). Organizers pick final sessions (one rep-session = one room for one hour) and send a confirmed schedule; hackers are invited after. Unusual requests go through "Message organizers" and are handled by hand.

Reconciled with Jazz's earlier explicit choices (hers win where they conflict):
- Primary contact = a crowned rep, not separate main-contact fields; rep phone required.
- Reps are only created in "Your team" (no "+ Add rep" in the availability grid).
- "Your day" row shows only their own workshop (and its 15-min travel buffers), no lunch, dinner or snack wagon.
- Two separate flows, each with its own Review & submit: Chatting preferences (required) and Shortlist (optional, capped at their hacker seats; scanned hackers first; auto-assign at 9:30 PM if not submitted).
- No hours totals or package-hours meter; the "hours per rep" question stays (it caps scheduling).
- Figtree only (no pixel font).

**Supersedes:** reps-as-rows chat blocks with inline editing (`docs/specs/inline-chat-block-editing.md`), per-block chat length/size, the flexibility question, shared multi-rep blocks.

**Why:** the simplest model for sponsors to understand and for organizers to schedule; rooms map one-to-one to rep-sessions.

## 2026-11-19: TinyFish judges remotely (Jazz)

**Decision:** TinyFish has a prize track (Sponsor Day-Of "Custom API / Prize Track" ticked) and judges remotely. It stays an in-person sponsor (booth, Saturday workshop, portal link) and submits its own shortlist and top 5 through the portal; its judging room is "Remote (judges online)" and its presentations are online. Unlike PCBWay (digital-only, no portal), whose top 5 the spon team enters.

## 2026-11-19: Coffee chat auto-schedule is a real algorithm with suggested fixes (Jazz asked; design)

**Decision (build):** `src/lib/coffee-chat-schedule.ts`, a pure, tested function: each rep gets min(hours per rep, free sessions) sessions (4+ = no cap), only in sessions they ticked free and not blocked by their own events; most-constrained sponsors placed first; near rooms (2241–2243) before Ivey (1348–1358); a sponsor's reps in the same session stay in one building; organizer edits are pinned and kept on re-run; never double-book a room or a rep; never place a rep in a session overlapping their own sponsor's workshop or its 15-min travel buffers (also enforced on manual moves and applied fixes). Anything unplaced becomes a "Suggested fix" (problem → why → suggested fix → Apply / Contact), computed by trying alternatives (another free session, move the sponsor's reps to Ivey together, fewer hours).
**Production flow:** Auto-schedule writes a draft (invisible to sponsors and hackers) → organizers apply fixes or drag → Send confirms: confirmed sessions saved, Room Grid tab mirrored, each sponsor's primary contact gets the confirmed schedule, hackers invited (scanned, shortlist, interested), by 10 PM Friday.
**Why:** the problem is tiny (~20 reps × 6 sessions × 8 rooms), so a greedy pass with fallbacks is instant and easy to test; organizers keep control through pinning and fixes.
**Mock:** `mocks/organizer-coffee-v8` (algorithm in its JS, described in its README).

## 2026-11-19: HW Contacts has a "Login email" column to match organizers to the sponsors they lead (Jazz)

**Decision:** HW Contacts column C "Login email" holds each spon team member's sign-in email (filled for the spon team and Jasmine; blank and yellow for Lucas and Brittney). The "My sponsors" view matches the signed-in user's email (case-insensitive) to this column, then to Sponsor Day-Of's HW lead name. No match = the All sponsors view only. The emails live only in the private sheet, never in the repo.

## 2026-11-19: HW Contacts shows each organizer's Slack name as "[ORGANIZER] Name" (Jazz)

**Decision:** HW Contacts column D "Slack name" is a formula, `"[ORGANIZER] " & Name`, matching the Slack display-name convention, so it can't drift from column A. It's for people reading the sheet. For @mentions (help "Leave a message", task pings), the app finds the Slack user by email (`users.lookupByEmail`, as the hacker DMs already do) using the "Login email" column, because Slack mentions need a user ID, not a display name. If someone's Slack account uses a different email, add a "Slack email" column then.

## 2026-11-19: "Rationale + Decisions" tab in the sheet (Jazz)

**Decision:** The sheet's first tab, "Rationale + Decisions", is a skimmable table (Area · What we decided · Why · Status) of every sponsor-side decision, grouped by The sheet, Coffee chats, Judging, Comms, Organizer dashboard, and Still to do. Open items are yellow. It's the short version of this log; update both when a decision changes.

## 2026-11-19: "Sponsor requested help" is tracked: Slack DM to the lead with I'm on it, dashboard section, 5-min escalation (Jazz)

**Decision:** Sponsor taps "Get help" (message + required name and call-back phone) → the app DMs their HW lead on Slack (or whoever is on call if the lead is off shift) with [I'm on it] [Text them] buttons → it shows on the dashboard under "Sponsor requested help" with a timer → the lead taps I'm on it (Slack or dashboard): dashboard shows "Noah is on it", the sponsor's portal shows "Noah is on the way" → Resolved moves it to Done today. No response in 5 minutes → re-post to the spon team channel. Use Slack buttons, not emoji reactions (reliable who/when). Visibility: your own sponsors' requests at the top of My sponsors; all open requests visible to everyone in All sponsors so anyone can take one. "Sponsor requested help" is a separate section from "Overdue tasks"; both hide when empty ("All clear"). The portal's quick "Text your lead" stays as an extra. **Supersedes** "Help = text your lead; off shift = leave a message" and "the dashboard doesn't track help requests".

## 2026-11-19: Merge Sponsor Status into Sponsor Day-Of in the build; Coffee Chat Setup loses Status and Other Notes (Jazz)

**Decision:** In the build, Sponsor Status's columns (Status, Booth, Workshop location/time, Track) move into Sponsor Day-Of, the app reads/writes there, and Sponsor Status is deleted (judging room lives in Sponsor Judging; coffee chat minutes are replaced by the session model). Ends the HW-lead conflict. Coffee Chat Setup's "Status" and "Other Notes" columns were deleted (the dashboard shows status; the notes described the old window/hours model). The app still reads the tab (6 rows checked). The rest of Coffee Chat Setup is still the old model (windows, chatting hours, "Main contact", "Can we shift chats?"); rebuild it for sessions (hackers per chat, hours per rep, reps with free sessions, primary rep) in the build.

## 2026-11-19: Chats per rep instead of hours; no rep emails; help popup; shared shortlist (Jazz)

**Decision:** Each rep picks how many chats they want (stepper, time shown, e.g. "6 chats · 1 h 30 min"); this replaces the sponsor-level "hours per rep". Scheduling: a rep needs ceil(chats × chat length / 60) sessions, capped by their free sessions. Rep emails aren't collected (name + phone required). Sponsor help is a modal; the confirmation says "Sent. We'll contact you at <their phone>." with no internal routing text. Shortlisting stays one hacker at a time, with a "Who's shortlisting?" picker; picks go into one shared team shortlist labelled by who picked, updating live; the seat cap is for the team. "Your chats" gets a calendar view (reps × sessions with room and building), filterable by rep.
**Why:** sponsors think in chats, not hours; several reps share one login.

## 2026-11-19: Organizer coffee chat board v8 built in the app

**Decision:** The Coffee chats tab of /internal/sponsors is now the organizer board from `mocks/organizer-coffee-v8`, built on the session model. Built:
- `src/lib/coffee-chat-schedule.ts`: the pure auto-schedule (pins kept, workshop windows ±15 min blocked, most constrained first, near before Ivey, one building per sponsor per session, no double-booking) with suggested fixes (another session, Ivey together, fewer chats). Tested with the mock's demo data and 200 random boards.
- Migration 0058: `coffee_chat_pref` (hackers per chat, longer 1-on-1s, submittedAt), `coffee_chat_rep` (name, phone, primary crown, chats wanted, organizer session cap), `coffee_chat_rep_session`, `coffee_chat_placement` (draft/sent, pinned, sentAt) and `coffee_chat_room_booking` (ad hoc bookings). Sessions and rooms are constants in `src/lib/coffee-chat-sessions.ts`. Dev seed: `src/server/db/seed/coffee-chat-sessions.ts` (fake 555 phones, localhost only).
- `coffeeChatSessions` router (organizers only): getBoard, autoSchedule, applyFix, move/remove a chat, book/move/remove a room, send. Moves refuse a taken room, a rep in two places, a session the rep isn't free and the sponsor's workshop window. Workshop windows come from the run of show's Saturday "Sponsor Workshop" blocks.
- Send marks every draft chat sent and writes the "Coffee Chat Room Grid" tab only when `sheetWritesEnabled()` is true (production or SHEET_WRITES=1), so dev writes nothing. Moving a sent chat puts it back to draft.
- UI: Sponsors band (logos, status chips with counts, crown, Contact with Copy / Text with a drafted sms: / Call), Suggested fixes, Rooms grid (Near / Ivey, Workshops row), inline detail, ad hoc booking on empty cells, Help sheet, sticky Auto-schedule → Re-run → Send bar. Copy is in `src/content/coffee-chat-sessions.ts`. Works at 390 px (grid scrolls in its card, 44 px targets).

**Model change (Jazz, same day):** sponsors no longer give "hours per rep". Each rep has their own number of chats wanted (at least 1). Sessions a rep needs = ceil(chats × chat length / 60), with 15-minute 1-on-1s (30 with the longer option) and 30-minute groups. A rep gets min(that, free unblocked sessions). The board shows each rep as "6 chats · 1.5 h", the "fewer hours" fix is "fewer chats", and rep email isn't collected. The Help text was changed to match ("No more sessions than the rep's chats need").

**Why:** Organizers need to place every rep in a room by 10 PM Friday. The scheduler does the placing and organizers check its work.

**Follow-ups:**
- Sponsor-side preferences flow (Your team with chats per rep, availability grid, Review & submit) writing these tables. Today only the dev seed fills them.
- Hacker invites and each primary contact's confirmed schedule from Send (a TODO in the router's `send`).
- Coffee Chat Setup tab columns for the session model (hackers per chat, reps with chats wanted and free sessions, primary rep).
- Room Grid tab: merged 4-row blocks and grey organizer bookings (needs batchUpdate). Desktop drag to move isn't built yet (tap Move works everywhere). The organizer tour's coffee steps still describe the old board.

**Code-review fixes (same day):**
- If the run of show can't be read, every write (auto-schedule, apply fix, move, book, move booking, send) fails with PRECONDITION_FAILED and the UI turns those buttons off with "Can't read the run of show…". Removing a chat or booking still works.
- All board writes take one Postgres advisory lock (`BOARD_LOCK_KEY`), then re-read and re-check the board in the same transaction, because chats and bookings are separate tables with no shared constraint. Unique violations become CONFLICT ("Someone else just changed the board…"), foreign key violations BAD_REQUEST. bookRoom checks its sponsor exists.
- Every chat on the board (pinned and sent included) is re-checked on each load: sponsor unsubmitted, now in their workshop window, or rep no longer free. Each becomes a "move to … / remove" suggested fix and doesn't count in "Scheduled N of M".
- Every list the scheduler reads is ordered down to id, so the same rows give the same board.
- A submitted sponsor whose reps have no usable session shows "No availability", not "0 of 0".
- Send is labelled "Save & confirm schedule" and its toast says hacker invites aren't sent yet. Removing a sent chat, or moving/removing a booking after Send, re-mirrors the Room Grid tab (only when `sheetWritesEnabled()`).
- Deferred: manual moves can split a sponsor across buildings in one session (when built, a warning only, never a block). A `maxSessions` cap from a "fewer chats" fix stays until someone changes it, by design. The Help sheet's Send paragraph still describes the invite step that isn't built.
## 2026-11-19: Jazz's answers to the full plan (Q1–Q11): simplifications locked in

**Coffee chats, sponsor side:**
- Keep the shortlist. Sponsors submit ONE shortlist by 9:30 PM Fri; hackers they talked to that evening (scanned) are first choice. ALL hacker invites go out at 10 PM Fri.
- Each rep picks a number of chats (0 allowed = that rep doesn't chat); the time breakdown is shown ("6 chats · 1 h 30 min"). No hours anywhere.
- No 30-minute 1-on-1 option: 1-on-1 = 15 min, groups = 30 min.
- Drop the live "hackers free" column counts from the availability grid.
- Sun Life's 1–2 session overlaps its workshop buffer (setup 2:00): the algorithm may use it only until 1:30 (partial session, 1:00–1:30). Note for the algorithm; applies to any session cut by a buffer.
- After Send, the sponsor's portal shows their confirmed schedule ("Your chats" calendar).

**Organizer coffee board:** no Contact button, no Text/Call: each phone number has a copy icon beside it. Show how many chats each rep asked for. Only Noah Medland can press "Send confirmed schedules & invites" on Friday night (matched by his login email; others see it disabled with "Only Noah sends").

**Invites:** invite exactly the number of seats. Round 1 Fri 10 PM, accept by Sat 10:00 AM. Round 2 Sat 10:30 AM for seats still open, 30 minutes to accept; further automatic rounds the same way (30 minutes each) until the chat. (Accepted: 10–11 AM chats are only filled by round 1; most hackers accept the night before, Jazz 2026-11-19.)

**Sponsor help:** scrapped as a tracked feature. Sponsors message their point of contact (their HW lead) directly; if the lead isn't available, Noah Medland is the emergency contact. The portal Help shows the lead's name + number (copy) and Noah as the fallback. No Slack DM, no I'm-on-it, no dashboard section. Supersedes the tracked-help decision (same day).

**My sponsors:** People lists reps only (crown on primary); speakers' and presenters' phones aren't needed. Login matching by login email stays.

**Run of show and task pings:** low priority, future to-do.

**Judging:** no modes. Same experience as judging hackers' projects: one at a time or a list. Sponsors send a ranked top 3 (1st, 2nd, 3rd), not a top 5. The Sponsor Judging tab now has 1st–3rd place only.

**Leads:** Caroline Ge (Manulife) and Alice Nguyen (Commure) are right; Sponsor Status updated.

## 2026-11-19: Turn off task pings for now; show tasks as "Now and next" with the run of show (Jazz)

**Decision:** The task pinging system (automatic Slack DMs to task owners, the Task pings tab, ping log, overdue Text buttons) is turned off and hidden for the event: too confusing. Instead, the organizer dashboard shows "Now and next" under Happening now: the event happening now and the next one, plus the current task and the NEXT task from RUN OF SHOW (with its owner). No pings, no marking done. The pinging code stays in the repo, switched off, for later.
**Why:** organizers only need to glance at what's on and what's next; pings and logs added noise.

## 2026-11-19: Tracked sponsor help removed everywhere; design parked (Jazz)

**Decision:** No "Sponsor requested help" anywhere in the build: no help rows in Now, no help request in Needs attention, no Slack DM / I'm on it / Resolved, no escalation. The sponsor portal's Help shows their HW lead's name + number (copy) and Noah as emergency contact. The full design is kept in docs/specs/parked-sponsor-help-requests.md for a later rebuild.

## 2026-11-19: One person shortlists; no "Who's shortlisting?" picker (Jazz)

**Decision:** The sponsor's shortlist is one list made by one person on the sponsor login. No rep picker, and picks aren't labelled by who made them (no `picked_by` column). The seat cap and 9:30 PM submit are unchanged.
**Why:** simpler for sponsors; several reps shortlisting at once wasn't needed.
**Alternatives:** shared list labelled by rep, updating live (the 2026-11-19 "Chats per rep… shared shortlist" design, now superseded on this point).

## 2026-11-19: Shared base for the 8-hour build (migration 0059, stub routers)

**Decision:** Before the track worktrees, one migration (0059) on coffee-prefs: rep chats wanted may be 0; `coffee_chat_pref.shortlist_submitted_at`; new `sponsor_scan` (sponsor, hacker, rep name, scanned at) for scanned-first invites; `coffee_chat` gains `placement_id`, `round`, `expires_at`, `source` so session invites reuse the existing Slack Accept/Decline flow; new `sponsor_team_score` (sponsor, team, judge name, score in halves 2–20) for several reps scoring in half points. Empty `coffeeChatSetup` (track A) and `coffeeChatInvites` (track B) routers are registered in root.ts. The Task pings tab is hidden by track D, the only track that edits `pages/internal/sponsors.tsx`.
**Why:** schema and router registration conflict when several worktrees edit them; doing them once keeps merges clean.
**Alternatives:** a new invite table (would need new Slack handlers); half-point scores as numeric (integers avoid float rounding).

## 2026-11-19: Needs attention shows every sponsor, your own first (track D review)

**Decision:** "Needs attention now" lists every sponsor's items, with the signed-in organizer's own sponsors first under "Your sponsors", then "Other sponsors" (or "All sponsors" when they lead none). Overdue run-of-show tasks follow: their own (Owner cell names their HW Contacts row) first, then others, still at most 3 and still only for an hour after the window. With an HW Contacts match, the list waits for Sponsor Day-Of so it never flashes in the wrong order.
**Why:** an organizer covering for someone else still needs to see what's urgent; scoping to "yours only" hid it, and "everyone" while loading flashed the wrong list.
**Alternatives:** only your sponsors when you lead some (the first build); a Mine/All switch on the panel (more UI for a glanceable list).

## 2026-11-19: HW lead matching by contact row; HW Contacts cached 90 s (track D review)

**Decision:** My sponsors identifies the organizer as one HW Contacts row (by Login email), and a Day-Of HW lead or task Owner cell matches that row: a full name must fit exactly one row; a first name alone matches only if exactly one row has that first name (else a row whose whole name is that word). A name that fits several rows matches nobody. HW Contacts reads (organizer list and portal phones) are cached 90 s; a failed read keeps the last good value, and if there's none the Sponsors tab says "Can't read HW Contacts" instead of quietly showing All sponsors.
**Why:** the first-name rule could show a sponsor to the wrong Noah; two people with one name were indistinguishable; mySponsors polled the sheet every 15 s per organizer.
**Alternatives:** match every same-named organizer (wrong person sees it); read the sheet on every poll.

## 2026-11-19: Track F judging build: per-rep half-point scores, top 3, wide Sponsor Judging tab, digital entry

**Decision:**
- Each rep's score lives in `sponsor_team_score` (halves 2-20). The shortlist and ranking sort by the team average. `sponsor_team_review.score` is kept at the rounded average so the organizer day board's "scored" count stays right.
- Who's judging lists the reps on Your team plus "Someone else". The name is remembered per phone. With 2+ reps the list is split evenly between them in team-name order (no table numbers in the app yet). Reps 3+ points apart get a "talk it through" flag.
- Portal browsing is One at a time or List only.
- `SPONSOR_FINAL_TOP = 3`. Picks are stored in `sponsor_final_pick` and mirrored to the wide Sponsor Judging tab (one row per prize track sponsor, 1st-3rd place as "team ID · devpost link", then a Presentations table). The writer for the deleted "Judging" tab is removed; `getChosenTeams` reads the database. A failed or disabled sheet write never blocks the save.
- Digital sponsors (PCBWay) are refused in the portal. Organizers enter their 1st-3rd by Devpost link or team ID on the Sponsor judging tab; each must match a different submitted team in the track. A DB row is created for the sponsor on first entry.
- TinyFish's judging room is always "Remote (judges online)".

**Why:** Jazz's 2026-11-19 answers (top 3, one at a time or list, several reps), the sheet-cut decision (Judging tab deleted), and the coordinator's bug report that saving failed against the deleted tab.

**Alternatives:** keep one score per sponsor (loses who gave what); split by table (no table data yet); write picks to a new sheet tab as the record (the DB is the record, the sheet is a view).

## 2026-11-19: Track F review fixes: digital gate, panel picks from the DB

**Decision:**
- One guard (`assertPortalJudge`, src/server/api/utils/sponsor-judging-guard.ts) covers every public judging and scoring procedure, including `sponsorJudging.listAllTeams` and `getChosenTeams`. No prize track or digital = FORBIDDEN. "Digital" is `DIGITAL_JUDGING_SPONSORS`, the content copy of the sheet's In person / Digital column, never whether a DB row exists.
- The Run-of-show "Sponsor track judging" panel counts each sponsor's saved picks from `sponsor_final_pick` (0 until they submit), not the deleted "Judging" tab. `MIN_SPONSOR_PICKS = SPONSOR_FINAL_TOP` (3).
- `submitDigital` works after judging closes (organizer-only; the spon team may enter PCBWay's top 3 late).
- A Devpost link that matches more than one team in the track matches none; the organizer pastes the team ID.

**Why:** code review of track F: PCBWay's UUID could still read the roster and top 3, and the panel always showed picks as unknown after the tab was deleted.

**Alternatives:** read In person / Digital from the Sponsor Day-Of sheet on each call (track E's parser isn't on this branch, and it adds a sheet read to every portal request); keep counting the sheet (always unknown now).

## 2026-11-19: Judging round 1 = 6-minute presentations (up to 15 teams), ranked top 5, live "Judging Scores" sheet (Jazz)

**Decision:**
- In-person sponsors shortlist up to **15** teams for round 1 presentations, 10:00–11:30. Each slot is **6 minutes**: 3 min pitch, 2 min Q&A, 1 min switch (15 slots exactly fill 90 min). A team on several shortlists still gets 10 minutes between its presentations.
- Each rep judges on their own laptop under "Who's judging?" (their own profile on that device) and scores every team they see, 1–10 in half points.
- After the presentations, sponsors submit a **ranked top 5** (1st–5th). This replaces the top 3 from the Q1–Q11 answers, everywhere: portal, organizer judging tab, Sponsor Judging sheet, and digital (PCBWay) entry.
- **Backup:** a "Judging Scores" sheet tab, one block per sponsor with presentation time, team ID + Devpost link, and one score column per rep. The app fills it as reps score (production only). If the app is down, reps type into the same cells. The app only writes cells it has a score for and never blanks one.
**Why:** 3 + 2 minutes plus a switch is the typical hackathon pitch, and 20 teams don't fit 90 minutes. Per-rep scores on their own laptops let several reps judge at once; the sheet covers an outage.
**Alternatives:** 5-min slots for 18 teams (no switch time, so running late compounds); 7-min slots for 12; a longer window for 20 (needs a run-of-show change); keeping top 3; a blank backup sheet the app doesn't fill.
**Supersedes:** "Sponsors send a ranked top 3" (Q1–Q11, 2026-11-19), and the 5-minute slot and 20-team shortlist cap.

## 2026-11-19: Jazz sees Noah's view (HW Contacts "Same view as")

**Decision:** HW Contacts gets a "Same view as" column. When the signed-in organizer's row names another person there, the dashboard uses that person's row: their sponsors in My sponsors, their tasks in Now and next, and their permissions. Jazz's row names Noah Medland, so she sees his My sponsors and can press "Send confirmed schedules & invites". The Send check runs on the server: Noah's login email, plus the login email of any row whose "Same view as" is Noah. The fail-closed rules stay: if HW Contacts can't be read, or Noah's row has no login email, nobody can send. One level only (if A names B and B names C, A gets B's row). A missing or blank column, an unknown name, or a name that fits several rows changes nothing. Send's note now reads "Only Noah (or someone with Noah's view) sends".
**Why:** Jazz runs the dashboard alongside Noah and needs to see and do what he does. Keeping it in the private sheet means no emails in the public repo, and it's undone by clearing one cell.
**Alternatives:** hardcoding Jazz's email in the code (leaks an email into a public repo, and needs a deploy to change); an admin role (a schema and auth change, and broader than "see what Noah sees").

## 2026-11-19: Declines re-send at once; round 1 expires 10 AM and new invites go out then; no open seats shown (Jazz)

**Decision:**
- When a hacker declines, their seat is offered to the next person straight away (met at the booth → shortlist → interested), with the current round's answer-by time.
- Round 1 invites expire at Sat 10:00 AM, and new invites go out at 10:00 (not 10:30). Later rounds stay every 30 minutes.
- There are no open seats: when a sponsor's booth list and shortlist run out, seats fill with hackers interested in them.
- Screens show only Accepted and Waiting. Declined and expired invites are replaced, not shown, and there's no "open seat" count.
**Why:** sponsors and organizers care about who's coming, not who said no. Filling every seat at once keeps chats full.
**Supersedes:** "Friday-night declines wait for round 2 (10:30)" and the round-2 start time of 10:30 (decisions-log, invites D5).
**Still possible:** a seat stays empty only if no eligible hacker is left (nobody interested and free at that time). The board shows that as a problem, not as a normal count.

## 2026-11-19: Phone top bar is logo, title, Help; the How to guides move into Help on phones

**Decision:** At phone widths the sponsor portal's top bar shows only the logo, a left-aligned truncating title and Help, like the v6 mock. The How to tours are listed inside the Help dialog under "Show me how" (every size); tablets and up keep the How to button in the header.
**Why:** logo, title, How to and Help didn't fit at 390px. Help is where a lost sponsor looks first.
**Alternatives:** an icon-only How to button (a bare compass reads as nothing); shortening the title (still overflows on long section names).

## 2026-11-19: Several reps in one chat are handled by hand (Jazz)

**Decision:** The model stays one rep per chat (1 rep + 1–5 hackers). If a sponsor wants two reps together, they ask organizers (Help / "Message organizers") and an organizer handles it by hand: book the room for them on the board, or tell the second rep to join the first rep's room. No co-host feature.
**Why:** one rep-session = one room keeps auto-schedule, room counts and invites simple, and shared chats should be rare.
**Alternatives:** enter the pair as one rep ("Dana & Marcus"); a real co-host field on chats (scheduler and UI work this close to the event).

## 2026-11-19: Coffee Chat Invites tab: read-only mirror, locked (Jazz)

**Decision:** The Spon Team RUN OF SHOW sheet has a grey "Coffee Chat Invites" tab next to "Coffee Chat Room Grid". The app writes it (`src/server/api/utils/coffee-chat-invites-sheet-mirror.ts`): row 1 is the note "Read-only. The app writes this tab. To change an invite, use the coffee chat board (Remove · Put first in line)." (also the cell's note), row 2 "Last updated <time> ET", row 3 the header, then one row per live invite seat (Accepted or Waiting): Sponsor, Rep, Session, Chat time, Room, Hacker (first name + last initial), Hacker ID, Source, Status, Answer by. Sorted by sponsor, rep, then time. No emails or phones. Each run rewrites the whole tab with one clear and one write, no read and no tab listing. It runs in the background (waitUntil) after Send, each invite round (timed or "run now"), a hacker's answer to a session invite (a decline's refill included) and a reconcile that changed invites, at most once every 10 s, with calls in the meantime sharing the waiting run. Only when `sheetWritesEnabled()`.
**Lock:** the whole tab is a protected range, not warning-only, the same way as the Room Grid. The Room Grid's lock was set by hand in the sheet (the Room Grid mirror code doesn't add one), so the live Invites tab was locked by hand too, with the same editors (the owner, Jazz, the app's service account). If the app ever has to create the tab itself (a fresh sheet), it locks it on create with the service account as the only listed editor (the owner can always edit), so no email goes in the repo.
**Why:** organizers need to see who is invited where without opening the dashboard, but invites have rules (one per seat, tiers, answer-by times, no second ask) that a hand edit in the sheet would break. One place to change them keeps the app and the sheet in agreement.
**Alternatives:** an editable tab with two-way sync, where organizers change invites in the sheet and the app reads them back (Jazz chose against it: conflicts, quota-heavy polling, and edits that skip the invite rules); a warning-only lock (people click through warnings); adding invites to the Room Grid (no room for one row per hacker, and the grid shows no hacker names).

## 2026-11-19: Organizer Home = day view (mock organizer-sponsors-home-v3), approved for build (Jazz)

**Decision:** The organizer dashboard's Home becomes the v3 day view: Fri · Sat · Sun tabs, each with Up next, "Your day" (run of show) and that day's sponsor table (only that day's columns, inline flags, "All done" chips), Your sponsors / All sponsors, and sponsor details on click. Nav is Home + a Tools menu (Coffee chat board, Judging board, Full run of show); Sponsors and Run of show stop being separate tabs; Task pings is gone. Jazz's notes for the build: going into Coffee chats must not drop back to the old view, and contacts sit under Up next and Key rooms.
**Why:** organizers need their day and everything about their sponsors in one place, and coffee chats / judging each only matter on certain days.
**Alternatives:** layouts 2 (side by side) and 3 (sponsor first) from v2; separate Sponsors and Run of show tabs (the current build).
**Workflow (Jazz, same day):** every new screen is mocked in HTML first and approved before it's built.

## 2026-11-19: Organizer judging board = mock organizer-judging-board-v2, approved for build with changes (Jazz)

**Decision:** Build v2 with these changes. Team status is only Invite not sent / Waiting / Accepted, and one hacker replying on the Slack bot or the live-site notification accepts for the whole team. No presenting / presented tracking. Phone numbers get a copy icon instead of a Copy button, and each sponsor's head rep number shows with the same icon. Remote teams don't present, so the remote list is out of the presentation flow.
**Why:** organizers only need to know if a team will show up; presenting/presented is noise, and remote teams never present in a room.
**Alternatives:** v2 as mocked (told/not told, presenting now, presented, remote column); requiring every team member to confirm.

## 2026-11-19: Judging board build choices (made while building v2; Jazz to confirm)

**Decision:**
- **Accepting is per team and per set of times.** `sponsor_presentation_confirm` (one row per team) stores which times were confirmed. If a room change gives the team new times, it's Waiting again until someone confirms the new ones. The Slack button carries the times it was sent with, so a button from an older DM is refused ("your times have changed").
- **The schedule rebuilds itself** whenever a sponsor sends a shortlist or an organizer changes a room (the mock has no Schedule button). Times already given never move: a room change keeps every time and only relabels the room, so those teams need telling again.
- **On judging day, new teams only get slots at least 10 minutes from now**, never a slot that already passed. After 11:30 a late team isn't placed and can't be ranked.
- **A sheet outage can't remove a room.** If no source names a sponsor's room during a rebuild, it keeps the room its slots already use.
- **Remote sponsors (TinyFish)** get no slots and no invites. In round 2 they rank their sent shortlist instead of "teams that presented" (otherwise they'd be locked out).
- **Rooms set on the board win** over the sponsor sheet and run of show everywhere, including the run-of-show judging panel.
- **"No scores yet"** shows two slots (12 min) after a sponsor's first presentation; "Top 5 late" after 12:00; shortlist and room to-dos go away at 11:30.
- **The modal skips each member's "role"** from the mock: hackers have no role field anywhere in the data.
- **Round 2, sheet sync and the cheat check** stay in an "After presentations" card under the board (not in the mock, but still needed). The old Presentations panel's schedule, notify and by-hacker views are covered by the board and moved to `_to_delete/`.
**Why:** each keeps a time a team was told from changing under them, or keeps a sponsor from being locked out.
**Alternatives:** a Schedule button organizers press (the old flow; the mock dropped it); per-member confirms (Jazz chose one reply per team).
## 2026-11-19: Organizer Home built from v3: what's in, what waits for data (build)

**Decision:** /internal/sponsors opens on the v3 day view. Columns built from data the app has: Fri (Arrived, Booth, Coffee chat briefing as tap pills that write Sponsor Day-Of; Availability; Chat shortlist; Chats + invites), Sat (Chats by rep from sent placements with ✓/⏳ seats; Workshop with setup at −30; Booth status), Sun (Judging shortlist, Judging room, Top 5). Left out until there's a data source: Opening speaker check-in, Met at booth count, Tonight (staying/leaving), Judging workshop attendance, Closing role, Gifts · departed. Empty sent chats on Saturday show as one flag per sponsor ("5 chats have no hackers yet, first …"), not one per chat. The chat shortlist is never flagged (it's optional since seats fill from interested hackers). Home has no guided tour yet; the tools keep theirs. The old Sponsors board, Needs attention and Task pings code stays in the repo, not rendered; Sync from sheet and search went with the board.
**Why:** every flag must come from real data; inventing columns would show permanent "not yet" cells. One flag per problem keeps "N things need you" honest.
**Alternatives:** add the missing fields to Sponsor Day-Of now (sheet work during event week); flag the shortlist from 9 PM as the mock says (conflicts with the no-open-seats decision).

## 2026-11-19: Sponsors can search every hacker by name and shortlist them (Jazz)

**Decision:** The coffee chat shortlist has a name search over every admitted hacker, not just the sponsor's top 40 candidates. Hackers who share with sponsors match on first, last or full name and show their full profile. Hackers who don't share show, and match on, their first name only, and get no Shortlist button ("Can't be invited: they didn't agree to share with sponsors"), because invite rounds only invite sharers. A hacker already scanned at the booth shows "Met at your booth". A pick found by search is listed after the candidates, counts toward the seat cap, and shows in the organizer forSponsor view. Top-40 candidates from the interest form keep their old rule (they can be shortlisted without the app share box). Up to 20 results, 2+ letters, % and _ match literally.
**Why:** sponsors meet people at the event who never ranked them, and want to shortlist them by name.
**Alternatives:** search only the top 40 (no rule change, but can't find people off the list); include non-sharers as shortlistable (dead picks that use a seat and never get invited).

## 2026-11-19: Sponsor portal = mock sponsor-chats-v3, exactly (Jazz)

**Decision:** The finished sponsor portal follows `hackwestern-sponsor-dash/mocks/sponsor-chats-v3` (its flow, screens and information, with v1/v2's READMEs for what v3 didn't change), replacing what the portal shows today. Approves sponsor-chats-v3 for build. Real data replaces the mock's fake data (contacts from HW Contacts and Noah, tier from the sponsor sheet, hackers from the candidate list).
**Why:** Jazz: "EVERYTHING should look like this, the finished spon portal for sponsors should follow this exact flow."
**Alternatives:** keep the current portal (v6 restyle) and patch pieces in.

## 2026-11-19: Organizer coffee chat board = mock organizer-coffee-v12, approved for build (Jazz)

**Decision:** Build v12 in full, behaviour as well as look ("follow everything"). Because v12 is v11 with real sponsor data, and v11 and v10 build on v9, this approves v9, v10 and v11 as well: drag to highlighted free cells with "Are you sure?" on unavailable drops, a warning before moving a sent chat, fixed-size cells with chat details in a modal (a bottom sheet on phones), per-chat counts, contacting the rep before an unavailable move, editing and removing hackers, and putting someone first in line.
**Why:** Jazz asked to build from v12.
**Alternatives:** the current built board (v8-era).

## 2026-11-19: Coffee board v12 build: answers and defaults

**Jazz decided:**
- **Never during the workshop.** A forced ("isn't free") move can't land in the sponsor's own workshop window or its 15-min buffers. The old rule stands; workshop cells don't light up and can't take a forced drop.
- **Never two places at once.** The "already has a chat in Rm X then" case is refused with an error toast like room-taken. The unique (rep, session) index stays.

**Defaults taken while building (from docs/plans/coffee-board-v12-gap.md, section 4; change any by asking):**
- Newer decisions win over older mock copy: the Send dialog says "invite hackers to N seats" (no open seats), and Help describes round 1 ending at 10 AM with declines re-sent at once.
- "answer by" shows each invite's real expiresAt. Hacker names: first name + last initial (as on the Invites sheet tab). The ID example uses the real format ("brave-otter-kite").
- "Next in line" skips to the first person who can take that seat (free then, under the 2-chat cap, agreed to share). Organizers can't override the share agreement. A removed hacker is not offered that sponsor again (the same as decline).
- Forced chats are never flagged as fixes again, Auto-schedule keeps them, and a normal move clears the mark. The Room Grid sheet doesn't mark them.
- Partial sessions keep their real time ("1:00–1:30") on the format line, and the count is the real one. Walk notes stay in the modal. The "Sent. … Your chats" line is dropped, as in the mock.
- Red buttons use the existing Tailwind `destructive` colours. A red variant on DashboardButton is a shared-component change, made in the main folder first.
- Sponsor order: by name, as now (the mock order is only its data order). "Placed N chats." counts chats added. The Undo toast lasts 5 s.

## 2026-11-19: Coffee board v12 UI build choices

**Decision:**
- A drop the rules never allow (the sponsor's workshop window, or a rep already chatting elsewhere then) is refused with an error toast, like a taken room. Only "didn't tick it" opens the two-step contact dialog.
- Undo after removing a forced draft puts it back forced (placeChat with force), so it keeps its "Not free" mark.
- Red buttons: `destructive-dark` fill with the existing `dashboard.notice.danger` (#b42318) as hover, set by className; the Remove zone uses `notice.danger` and `destructive/10`. No token or DashboardButton change.
- The hacker ID placeholder uses the real format ("brave-otter-kite"); the camera button opens the real scanner (useQrScanner).
- While a drag runs, the board shows the data it started with and stops refetching, so touch targets never leave the DOM.
**Why:** each follows Jazz's "never" answers or keeps the build inside this worktree's rules (no shared files).
**Alternatives:** a dialog for every unlit drop (mock v9); a red DashboardButton variant (shared component, main folder first).


## 2026-11-19: Shortlisted teams are told at once, every member (Jazz)

**Decision:** When a sponsor sends their round 1 shortlist, every member of each shortlisted team gets their presentation times straight away: a Slack DM (email if Slack can't find them) and the /live notification bell. It runs after the send (waitUntil), only for that sponsor's teams, and never messages anyone twice (the same claim as "Notify teams"). Nothing is sent when a team places in the top 5.
**Why:** hackers need to know they were picked, and when to present, without waiting for an organizer to press Notify teams.
**Still manual:** after a room change, the judging board's "Notify teams" to-do tells teams their new room.
**Alternatives:** organizers press Notify teams (the old flow); also messaging winners (Jazz: no).
## 2026-11-19: Sponsor portal built to mock sponsor-chats-v3: judgment calls (build)

**Decision:** The sponsor portal now follows sponsor-chats-v3 (shell, Home, Chats one stage at a time, Send availability, shortlist, Scan, Schedule, Map). Where the mock and the app's data disagree, the build does this:
- **Up next agenda:** the Friday–Sunday steps (times, rooms, "Open your booth"…) live in `src/content/sponsor-home.ts`, copied from the run of show as of today. The sponsor's own workshop row, Saturday's coffee chat rows, done ticks and Sunday's judging room come from their data. Unsent availability stays "Now" after its 5:00 slot instead of reading as done (it's required); the optional shortlist goes by the clock.
- **Tier:** the welcome line reads an optional "Tier" column on Sponsor Day-Of ("Gold", "Gold Sponsor"). The sheet has no such column yet, so every sponsor currently sees "Thank you so much for sponsoring Hack Western 13." Adding the column turns on "for being a Gold sponsor".
- **Guided tour off:** no How to button, no "New here?" offer, no "Show me how" in Help (the mock has none, and its targets were gone). The tour code stays in `src/components/sponsors/tour/`, unused.
- **Status card off:** the "Where things stand" card left the Chats screens (the mock replaces it with the 2-step line and one-line done steps). Organizer moves of sent chats are no longer called out there.
- **Shortlist cards:** show what the app has (name, school, program, year, team, profile links as icons). The mock's skills, interests and "wants …" role have no data source. The list searches the sponsor's candidates by name, school or program, and every other admitted hacker by name (the existing search) under "Other hackers at Hack Western".
- **Scan:** hackers are found by their three-word hacker code (the real badge), so the mock's "Enter a hacker ID instead" reads "Enter a hacker code instead". Picking "Who talked to them?" saves the rep right away.
- **Schedule:** coffee chats now come from the session setup (sent chats with invites), not the old room-booking table, which no longer holds sponsor chats.
- **Map:** uses the mock's floor plans (the /live maps, `public/sponsor-map/v3/`), tap to open full size. No desktop pinch/zoom buttons yet, and no room pins on these images.
**Why:** Jazz asked for the mock's exact flow and information with real data only; each item above is the closest match the data allows.
**Alternatives:** keep the tour and status card alongside the mock's layout; invent skills/tier values (ruled out: no fake data); a schema change for tier (the sheet column is enough).

## 2026-11-19: Notifications are Slack only (Jazz)

**Decision:** Hackers hear about things by Slack DM only (email still covers anyone Slack can't find). /live has no notification bell and no "Sponsor presentations" card, and teams confirm their presentation times with the button in the Slack DM, not on /live. The DM and email no longer link to /live. The bell, the card and the /live Confirm button are in src/components/live/_to_delete/. The coffee chats section on /live stays for now.
**Why:** one place for notifications; hackers already live in Slack during the event.
**Supersedes:** the /live notification center (2026-11-18) and confirming on /live (judging board, 2026-11-19).

## 2026-11-20: Notifications plan (Jazz)

**Hackers (Slack DMs):**
- **Coffee chats, Fri 10 PM:** invites go out. Hackers accept by Sat 10:00 AM. Anyone still waiting at 10:00 has their seat sent to the next hacker.
- **A decline:** the seat goes to the next hacker on the waitlist, and they're notified.
- **No answer 30 min before the chat:** the seat goes to one final hacker.
- **Sun 9:45 AM:** hackers are told to check their Slack for their invite and accept their sponsor judging time if they've been selected.

**Spon team (a task for the whole team, posted to the spon channel):**
- **Fri 10 PM:** sponsors have to go through the coffee chat flow, and the spon team sends out the notifications to hackers.
- **Sat 9:30 AM:** check in with your sponsors' reps to make sure they'll attend their chats.
- **Sun 9:45 AM:** sponsors' shortlists must be submitted by now. Go to the Judging board, give each sponsor a room, then send the room details to hackers (Notify teams).

**Why:** one timeline for when hackers hear from us and what the spon team does at each point.

## 2026-11-20: Sponsors can't pick more coffee chat time than their tier allows (Jazz)

**Decision:** A sponsor's chats (every rep's chats x the chat length) can't add up to more than their tier's chatting hours: Gold 4 h, Silver 3 h, Bronze 2 h (the Tiers tab; Sponsor Day-Of's Chatting hours column). The chats step shows the allowance and how much is picked, the + button stops at the limit, and saving over it is refused with the reason. A rep added when the limit is reached starts at 0 chats. No tier, or the sheet unreadable: no limit, so a Google outage never blocks a sponsor.
**Why:** chat time is part of what each tier buys.

## 2026-11-20: Notifications plan applied (Jazz)

**Decision:**
- **Judging time lock is back:** sponsors' Judging opens Sunday 9:00 AM (nav and page), undoing the Nov 19 removal.
- **Shortlists are due 9:45 AM Sunday** (was 9:30): the sponsor timeline, organizer Home and the judging board's "Text lead" warning all say 9:45.
- **Teams hear their times when the organizer confirms rooms:** an organizer sets the rooms on the judging board and presses Notify teams. A sponsor sending a shortlist no longer messages anyone. Supersedes "Shortlisted teams are told at once" (Nov 19).
- **Nothing on /live:** hackers get everything by Slack DM (email if Slack can't find them).
## 2026-11-20: Every portal and organizer map is Luka's interactive floor plan (Jazz)

**Decision:** The sponsor portal Map tab, and the organizer rooms section under the coffee chat room table, use Luka's venue map from /live (`src/components/live/venue-map.tsx`, data in `src/lib/venue-map.ts`, cherry-picked from main #1186): SEI levels 1 and 2 and the Ivey building, search, room cards with the live schedule. The component gained two optional props that /live doesn't pass, so /live looks the same: `highlights` (rooms outlined in the action blue, labelled on the plan once the room is big enough, and listed under the map as buttons that focus the room) and `initialFloor`. On the Map tab a sponsor sees their booth (the Sponsor Bay, with the Sponsor Bay booth layout still above the map for their exact spot), their workshop rooms, their coffee chat rooms once organizers confirm them (SEI and Ivey), the sponsor lounge (2110) and the belongings room (2244). The organizer map opens on SEI level 2 with no sponsor pins, as Jazz asked on 2026-11-18. The old image floor plans, pin positions and the unused "Where is everyone" occupancy code moved to `_to_delete/`.
**Why:** one map everywhere, with the Ivey building, real room shapes and the same behaviour hackers see, instead of static images with pins placed by eye.
**Alternatives:** keep the static images and add an Ivey image (no search, pins drift); a separate sponsor copy of the map component (two maps to keep in sync).

## 2026-11-20: Sponsors sync automatically; sheet changes (Jazz)

**Decision:**
- **Auto-sync:** a sponsor added to Sponsor Day-Of gets its portal link the next time the organizer dashboard loads its sponsor list; nobody has to press "Sync from sponsor sheet" (Accenture had no link because it was never synced).
- **Sheet (Spon Team RUN OF SHOW, edited directly):**
  - Sponsor Day-Of has Tier (dropdown) and Chatting hours (formula from the new Tiers tab: Gold 4, Silver 3, Bronze 2).
  - Locked (only Jazz, Caroline and the app can edit): Coffee Chat Room Grid, Coffee Chat Invites, Sponsor Judging, Judging Scores, Coffee Chat Setup except column A, Chatting hours, the two (old) tabs.
  - The tab name "Sponsor Day-Of" must not change; the app finds it by name (it was renamed "EDIT HERE" once and broke the app).
  - Run of show tasks for the whole team: Fri 10 PM coffee chat notifications, Sat 9:30 AM check in with reps, Sun 9:45 AM shortlists due, set rooms and Notify teams.
**Why:** fewer manual steps, and nobody types over what the app writes.

## 2026-11-20: One final hacker, 30 minutes before a chat (Jazz)

**Decision:** 30 minutes before a coffee chat, a seat still waiting goes to one last hacker in line. If they don't answer, the seat stays empty. The rounds before that stay as they are.
**Why:** one last try to fill the seat, without chasing hackers right up to the chat.

## 2026-11-20: Sheet reads shared and cached (fix for "1 load in 3 fails")

**Decision:** Sponsor Day-Of, the picks read and the coffee chat grid are each read from Google at most once a minute and shared by every request (sharedSheetRead). When Google refuses (its per-minute read limit, confirmed in the server log: "Read requests per minute per user"), the last good copy is used. A refused read is no longer reported as "tab not found", and the sponsor portal says it couldn't load instead of showing blanks as real ("contact not assigned"). Writes to Sponsor Day-Of read fresh and clear the copy, so changes show at once. Sheet edits show within a minute.
**Why:** every page and every organizer poll read the sheet, which ran past Google's limit; on event day many people have pages open.
**Alternatives:** asking Google for a higher quota (slow, not guaranteed); fewer refreshes only (not enough).

## 2026-11-20: Final call timing (build of "One final hacker")

**Decision:** The final call starts when the rounds can no longer offer a chat: 30 minutes before it (45 for Ivey, the walk). Each seat still waiting then (including one freed later by an earlier invite expiring) gets one invite to the next hacker in line, answered by 10 minutes before the chat (25 for Ivey). A final invite is recognised by its answer-by time being after the chat's normal last call (20 / 35 minutes before), so no migration. Once it's declined or expires, that seat stays empty and the board stops flagging it.
**Why:** Jazz said how long the final hacker gets doesn't matter; 10 minutes before still lets them reach the room.
**Alternatives:** answer by the normal last call (no time left at the 30-minute mark); a new column marking final invites (needs a migration).

## 2026-11-20: TinyFish judges in person (Jazz)

**Decision:** TinyFish is off the remote judging list (REMOTE_JUDGING_SPONSORS is empty). It gets a judging room, presentation slots and notices like the other in-person sponsors.
**Why:** TinyFish is coming in person now. Supersedes "TinyFish judges remotely" (2026-11-19).

## 2026-11-20: Shortlist pool grows with the sponsor's availability (Jazz)

**Decision:** A sponsor shortlists from (hackers per chat x every rep's chats wanted) + 20 hacker profiles, never fewer than 40. 60 hackers wanted gives 80 profiles. Applies to both the interest form ranking and the in-app fallback (sponsorCandidates). The portal no longer says "Up to 40".
**Why:** a fixed 40 runs out for sponsors who want to meet many hackers; 20 spare covers declines and no-shows.

## 2026-11-20: Notify hackers locks chats; Auto-schedule applies its own fixes (Jazz)

**Decision:** The board's Send button is now "Notify hackers", behind a red confirm that says it can't be undone. Once a chat is notified (status "sent") it is locked: its chip can't be dragged, the modal has no Move to or Remove, and the server refuses movePlacement, removePlacement and any fix that would move or replace it. A chat added later stays a draft (movable) until the next Notify, which marks and invites only the new ones. Auto-schedule (and re-run) now applies every suggested fix itself (autoApplyFixes), except "fewer chats" (it lowers what the sponsor asked for) and fixes on a notified chat (locked: call the rep). Those two stay in Suggested fixes. The "Since last time" list under the summary line is gone.
**Why:** the organizer asked for it: clicking each suggested fix was busywork, and a confirmed room shouldn't move once hackers were told. Supersedes "a moved sent chat stays sent and its hackers reconfirm" (Integration 1) for the organizer board. Sponsor-side edits (removing a rep, fewer chats) still reconcile invites as before.
**Alternatives:** keep the Apply buttons; auto-apply "fewer chats" too (would silently cap reps and hide the shortfall); lock only in the UI (the server would still accept a move).

## 2026-11-20: Judging tab review: 18 presentations, auto sheet sync, rooms first (Jazz)

**Decision:** Sponsors shortlist up to 18 teams (was 15). The presentation window is 10:00 to 11:48 (last slot starts 11:42), so ROUND1_OVER, the sponsor agenda and the organizer "top 5 not in" flag move to 11:48; top 5 is still due 12:00. The Sponsor Judging tab syncs itself after every change it shows (now also round 2 open/close and rep scores, with queued calls sharing one write), and the "Sync to sheet" button is gone. Notify teams sits behind a "can't be undone" confirm and stays disabled until every board sponsor has a room (the server refuses too). Each sponsor gets its calendar column up front with a typed room box ("Rm ____", the three rooms as suggestions) instead of "Move to" and the "No room yet" list. Before Notify, teams show no "Invite not sent" chip. The team modal drops "Scores so far" and shows checked in yes/no (one member is enough). The cheat check section and the lead's "Text" link are off the tab. Final results is a table on md and up (cards stay on phones, like All teams), with Devpost and GitHub icon links.
**Why:** organizer review of the Judging tab. 18 doesn't fit 11:30 at 6 minutes, so the end moves rather than the slot length. Teams are told all at once, and a room change after notifying would move times people already have.
**Alternatives:** keep 15 or shorten slots to 5 minutes to fit 11:30; a timed 11:30 sync instead of syncing after each change; swap rooms through Move to (removed: typing a taken room now shows the conflict instead).

## 2026-11-20: Book an event replaces Book a room (Jazz)

**Decision:** An organizer books an event from an empty cell on the coffee board: room and session come from the cell (fixed text), then Sponsor, then one of its reps who is free then, then a hacker. The sponsor's scanned hackers are listed first, newest scan first; searching by name or hacker ID comes second. Only admitted hackers who agreed to share with sponsors are listed or booked. Booking makes a real chat: a placement that is already notified (sent and locked, so it never brings Notify hackers back) and the hacker's coffee chat at the first time in that hour they can take, status accepted, source "organizer". The existing rules apply: the rep is free then and has a session left of the chats they asked for, the cell is empty, the hacker has no chat with that sponsor, nothing else at that time, and fewer than 2 live chats. After the commit it goes through the confirmed-chat notice path (notifyCoffeeChat "accepted": Bookings tab), and the Invites and Room Grid tabs are re-mirrored. The header "Book a room" button, the Note field and the free-text "Who it's for" are gone; older room bookings still show (label only) and can be moved, removed and restored with Undo.
**Why:** Jazz: book "the rep and the hacker on a new event", no Note, room not selectable. Accepted, not a pending invite: they agreed in person, and a pending invite would expire and could be refused too close to the chat.
**Alternatives:** a pending invite with the usual Slack DM (the hacker hears by message, but it can expire, and booking would be refused right before a chat); send booked chats through Notify hackers like other new chats (a draft placement holding an accepted chat could be moved before Notify).

## 2026-11-20: Times before rooms, typed rooms, nothing hidden past 11:48 (Jazz)

**Decision:** The scheduler gives every sponsor its times whether or not it has a room (room null until typed); the board shows each sponsor's column with its slots, and typing the room (a plain text box everywhere, the three known rooms as datalist suggestions) fills it in and keeps every time. A room another sponsor already has is refused with "Rm 2230 is Canada Life's. Pick another." under the box. Slots may run past the 11:48 window end (up to 18 extra slots, used only when needed): the calendar has a "Runs past 11:48 AM" marker row, the schedule view tags each such slot, and one line says how many run over and when the last ends. The room select, Move to and the "doesn't fit in the window" line are gone.
**Why:** each sponsor has one room, so its slots are a column of its own and the room is only a label; organizers wanted to see every team, not a count of hidden ones.
**Alternatives:** keep "no room = not scheduled" (organizers had to set rooms before seeing anything); flag rooms shared by two sponsors instead of refusing (the schedule assumes one sponsor per room); cap at the window and list overflow teams separately.

## 2026-11-20: Coffee chat deadline 10:00 PM Friday; invites out about 10:05 PM (Jazz)

**Decision:** Sponsors' coffee chat availability and shortlist are due **Fri Nov 20, 10:00 PM** (was 9:30 PM). Noah presses Notify hackers at **about 10:05 PM** Friday (was "by 10 PM"); round 1 is still a manual send, so the copy says "about 10:05 PM", not an exact time. Home's Friday column headers, the sponsor agenda (shortlist "By 10:00 PM", confirmation at 10:05 PM), sponsor portal copy, the organizer tour and docs/test-checklist.md now say this. The "Invites aren't out" flag still fires at 10:15 PM. There is no auto-submit in code to move.
**Why:** organizer review of Home: "chat shortlist is due 10pm", "invites go out like 10:05". Supersedes "Coffee chat deadline 9:30 PM Friday; invites out by 10 PM" (2026-11-19).
**Alternatives:** keep 9:30 PM with a 30-minute check window; schedule an automatic 10:05 PM send (round 1 stays Noah's button, so organizers check the board first).

## 2026-11-20: Home sponsor table fits the page; phones get compact rows (Jazz)

**Decision:** From 1024px the Home sponsor table is a fixed-layout table that fits the card (no sideways scroll at 1280px): tighter padding, a narrower sponsor column, no sticky column, text and chat lines wrap inside their column. All of HOME_COLUMNS stays; no column dropped. Under 1024px each sponsor is a compact card with one label | value line per column (two cards per row from 640px). The expanded "Contacts and package" details are label | value rows, one fact per row, with notes as a row. The sponsor page Copy link button is icon-only (full aria-label plus a title tooltip), and the run of show's "Tap a column heading to focus on it." hint is gone.
**Why:** organizer review: "I need it to be a table and I need you to be able to see MOST of the info. There is too much scrolling, especially for mobile", and the details were "really hard to understand and read".
**Alternatives:** keep the horizontal scroll with a pinned sponsor column; merge Arrived into Booth on Friday (not needed once the table fit).

## 2026-11-20: Sponsor Judging page: finalists, one-time final shortlist, auto next (Jazz)

**Decision:** The sponsor Judging page intro is "Select the teams that you want to hear present!". Sponsors see one wording: teams they pick are "finalists" (button "Save as finalist", pressed "Finalist", aria-label "Save <team> as a finalist"), and the list is the "final shortlist" (tab "Submit final shortlist" with its count, button "Submit final shortlist", "You can only submit this once." beside it). Submitting opens a confirm that lists every finalist with Devpost and GitHub icon links, says it can only be submitted once, and focuses Go back. In One at a time, "Next unscored" is replaced by ‹ › buttons, and saving a score moves to the next unscored project in queue order 1.5 s after the rep's last change (a cleared score doesn't); when everything is scored it stays put and says so. No ←/→ shortcut, because the score slider and the step tabs already use those keys.
**Why:** sponsor review of the page: "shortlist" read like a draft, the send was easy to press by mistake, and Next unscored was an extra step after every score.
**Alternatives:** move on the instant a score changes (the slider saves every half point, so it would jump mid-drag); a page-wide ←/→ shortcut (clashes with the slider); keep the text "Devpost"/"GitHub" chips in the confirm (too tall for 18 rows).

## 2026-11-20: Any organizer can press Notify hackers; Friday deadline and invites both 10:00 PM (Jazz)

**Decision:** Notify hackers on the coffee chat board is open to every signed-in organizer, not only Noah (ANY_ORGANIZER_SENDS in coffee-chat-sender.ts; the HW Contacts check stays in the code but no longer gates). Pressing it sends hackers their invites and confirmations as before. The Friday availability and shortlist deadline is 10:00 PM, and the copy says invites go out at 10:00 PM too (supersedes "about 10:05 PM" from earlier today).
**Why:** Jazz wants whoever is on shift to be able to send, and one time for sponsors to remember.

**Update (merge with Lucas, 2026-11-20):** Lucas's "verified slack msgs" changed sponsorCandidates to list every admitted hacker who shares, ordered form preference, then in-app preference, then everyone else. That already covers "hackers wanted + 20, at least 40", and shortlisting someone found by search depends on it, so the cap isn't applied to the list. shortlistPoolSize stays in src/lib for a follow-up that sizes only the review queue. Lucas also removed the Noah-only Send check (coffee-chat-sender.ts moved to _to_delete).

## 2026-11-20: Seats keep filling from the whole interest list (Jazz)

**Decision:** After a sponsor's own line (organizer-first, scanned, shortlist, interested in that sponsor), every sponsor's line continues with everyone who filled out the interest list for any sponsor, best rank first (invite source "anyone", shown as "From the interest list"). The 2-chat cap, no overlapping chats and one chat per sponsor still hold.
**Why:** seats were left empty ("no hacker left in line is free then") while interested hackers were free.

## 2026-11-20: Sponsor Day-Of's "Coffee Chats & Interviews" checkbox decides who does coffee chats (Jazz)

**Decision:** The coffee board and the Coffee Chat Setup mirror read the "Coffee Chats & Interviews" checkbox on Sponsor Day-Of instead of names typed in Coffee Chat Setup column A. Ticked sponsors get a Coffee Chat Setup row written by the app. Column A is only a fallback if the checkbox column is missing or the sheet can't be read. Coffee Chat Setup is fully app-written and locked.
**Why:** two hand-kept lists of the same thing could disagree; the contract checkbox already exists.

## 2026-11-20: Organizer reminders from the HW 13 Run of Show (Jazz)

**Decision:** every organizer gets a Slack DM 15 minutes before each of their tasks on the HW 13 Run of Show "Schedule View" tab, with the cell's details. Slack holds the queue; a GitHub Actions sync every 5 minutes makes it match the sheet, so owner changes move the DM and no database is needed. Slack accounts come from the HW13 Contacts sheet emails; team words (Spon, Web) ping the whole team. The bot never edits the run of show; it DMs Jazz what to fix instead. Shipped as a small PR to main (new files only) so it doesn't depend on the sponsor-dashboard merge.
**Why:** the run of show changes all weekend and people miss their slots. Schedule View is the source (Person View is pasted text and goes stale). Main has no Slack code or reminder tables, and merging sponsor-dashboard on event day is too big.
**Alternatives:** a CSV like the marketing bot (stale after the first edit); a laptop watcher with a database (stops when the laptop does); auto-reformatting the sheet (could overwrite someone's edit); matching first names in the Slack directory (hundreds of hackers share first names).

## 2026-11-20: Slack reminder 15 minutes before each accepted coffee chat (Jazz)

**Decision:** A hacker gets a Slack DM 15 minutes before each accepted coffee chat: "☕ Your Group Coffee Chat (or 1-on-1 Coffee Chat) with *Sponsor* starts in 15 min!", the start time and length, and the room (same room / "room TBA" wording as the invite). No map, rep or /live link. Slack holds it (chat.scheduleMessage), and a new table `coffee_chat_reminder` (migration 0049, one row per chat, no foreign key) keeps the scheduled message id and DM channel. `syncCoffeeChatReminder(chatId)` makes Slack match the chat and is safe to repeat: it runs after every chat change (notifyCoffeeChat: accept on Slack or /live, Book an event, cancel, room move; deliverInviteNotices: re-ask, session move or cancel, line replace, sponsor edits), and the Saturday invite-round workflow (every 10 minutes from 9 AM) plus the organizer `coffeeChatSessions.syncReminders` mutation sweep every accepted chat (the backfill). Accepted under about 17 minutes before the start, it is sent at once with the real minutes left; a chat that started gets nothing; a hacker Slack can't find gets nothing (logged, no email). Group = the sponsor's hackers per chat over 1 (session chats) or coffee_chat_style "group" (old per-slot requests). The invite DM and email now say "Group Coffee Chat" / "1-on-1 Coffee Chat" by the same rule. Off unless VERCEL_ENV is production or COFFEE_CHAT_REMINDERS=1 (0 forces off).
**Why:** after accepting, hackers heard nothing more before the chat, and /live's Coffee chats tab is no longer in the nav. Slack scheduling needs nothing running at send time (Vercel). A separate table, not columns on coffee_chat, so a chat deleted with its placement still leaves the id to delete in Slack, and existing coffee_chat queries never touch the new table (safe if the code deploys a minute before the migration runs).
**Alternatives:** Slack as the only state (chat.scheduledMessages.list per DM, matched by the first line; no migration, but an extra rate-limited call per chat and no safe way to stop two syncs scheduling twice); nullable columns on coffee_chat (lost when a placement delete cascades the chat); a cron that posts at the time (needs something running every minute); an email fallback (left out to keep it simple).

## 2026-11-20: Book an event is a room booking; hackers get a normal invite (Jazz)

**Decision:** Book an event (an empty cell on the coffee board) asks for a Description and Booked by (both required), then an optional sponsor (any registered sponsor, set up for coffee chats or not), any number of its reps (optional; only reps not already in a chat or event that session) and any number of hackers (optional; scanned at the sponsor's booth first, then search). It is stored as an organizer room booking (`coffee_chat_room_booking`: label = description, new `booked_by` and `rep_ids`, migration 0050), so the cell is taken on the board and blocked for Auto-schedule and other bookings like every booking, and the cell and its detail show the description and who booked it. A booking with no sponsor, reps or hackers is a room for the team. Booked by is a dropdown of the sponsorship team from the HW Contacts tab (rows whose Team or Position says Sponsorship; every row when the tab has no such column) and the server checks it when the tab can be read. Each hacker gets a normal **pending** invite (new `coffee_chat.booking_id`) for the whole session hour in that room, with the usual Slack DM (Accept / Decline) or email through deliverInviteNotices and the delivery sweep, answer by 20 minutes before the start (the default expiry), and the 15-minute reminder after they accept. The usual per-hacker rules hold (admitted and shares with sponsors, nothing else then, one chat per sponsor, at most 2 live chats); a hacker who fails one is listed in the result ("Couldn't invite: …") and the rest are still booked. More than one hacker makes it a Group Coffee Chat, one a 1-on-1. Hackers and reps need a sponsor. Removing the booking cancels its live invites and tells those hackers; a booking with live invites can't be moved.
**Why:** the spon team books rooms for things that aren't scheduled chats (their own use, a sponsor with no chat setup, several reps, several hackers). Supersedes "Book an event replaces Book a room" (2026-11-20): an accepted chat made by an organizer skipped the hacker's own yes, and needed a placement for exactly one rep.
**Alternatives:** keep accepted chats (hackers never asked); make each booking a placement (needs a set-up sponsor and one rep); a free-text Booked by (typos, no list to pick from); a hardcoded team list in src/content (goes stale; HW Contacts is already the source).

## 2026-11-20: Book an event lists every rep; busy reps can't be picked (Jazz)

**Decision:** The rep picker lists all of the sponsor's reps. A rep who is busy at the booking's session can't be picked and shows, with a warning icon and announced (aria-live): "{rep} is already in a coffee chat at this time." when the clash is one of their chats, else "{rep} is already booked at this time." (another event, their sponsor's workshop, or a session they didn't tick free). Every rep shows their free time that day ("Free today: 10:00 AM–12:00 PM, 1:00 PM–5:00 PM"). Busy is the board's own rule, in one pure module (src/lib/coffee-chat-book-availability.ts) the form and the server both use; the server refuses a busy rep the same way. A rep of a sponsor with no coffee chat setup has nothing ticked, so only their chats and events count. No suggested other times and no override.
**Why:** organizers couldn't see why a rep was missing from the list, or when they would be free.
**Alternatives:** suggested free cells with click-to-move (dropped by Jazz); an organizer override "Book them anyway" (dropped by Jazz: busy reps stay unselectable).

## 2026-11-20: Ivey chats: 30-minute reminder and a walk note everywhere (Jazz)

**Decision:** Ivey rooms (1348–1358, building "ivey") are a 15-minute walk from the Sponsor Bay. The hacker's Slack reminder for an Ivey chat goes 30 minutes before (others stay 15; accepted later than about 32 minutes before, it goes at once with the real minutes left) and reads "☕ Your … Coffee Chat with *X* is in 30 min!", the time, the room, then "⚠️ This chat is in a different building (Ivey), a 15-minute walk away. Leave now." with a Check map link. Ivey reminders already scheduled at 15 minutes are moved (their content key changed; other reminders keep theirs). One shared wording (src/content/ivey-walk.ts) shows wherever an Ivey chat appears, as a warning icon plus text, with "Check map" opening the map on the Ivey building (?building=ivey): hackers on /live Coffee chats and in the invite DM and email; sponsors on Home (Up next and Key rooms), Your chats, the schedule's chat details and the Map page; the organizer board marks Ivey rows with an icon and tooltip. Non-Ivey reminders still have no map link.
**Why:** hackers and reps were late to Ivey chats; 15 minutes' notice is the whole walk.
**Alternatives:** 45 minutes ahead (too early to act on); the "(15-min walk)" room suffix alone (easy to miss).

## 2026-11-20: Sponsor portal guided tour back on (Jazz)

**Decision:** The portal tour is back, re-targeted at the v3 UI. Supersedes "Guided tour off" (2026-11-19, in "Sponsor portal built to mock sponsor-chats-v3"). It follows the organizers' "Sponsor Dashboard Workshop" deck in order: Home (welcome, Contacts, Up next, Up next's buttons, Key rooms) → Schedule (pick a day, Hackathon events, tap a block) → Map (your booth, building maps) → Chats (how to get there, the two steps, then whichever stage card is showing: Start, shortlist, "check back at 10:00 PM" or Your chats) → Scan a hacker (camera, type the code) → Judging (locked until Sunday's workshop; left out for sponsors without a prize track) → Help. 17 steps, 16 without judging.
- It reuses the old overlay (`src/components/sponsors/tour/`: dim, ring, "Step n of N", Back / Next / Skip tour, bottom sheet on phones). Data in `src/lib/sponsor-tours.ts`, copy in `src/content/sponsor-tour.ts`, logic and tests in `src/lib/sponsor-tour.ts` / `.test.ts`.
- Every step skips itself when its target isn't on the page after 2.5 s (data not loaded, a feature the sponsor doesn't have), in the direction the sponsor was going; Back past a missing first step turns forward, so it never gets stuck. A step can list variants (the Chats stage card), and the first one on the page is shown with its own words.
- Entry points: "Take the tour" on Home under Up next (where Quick links was) and at the bottom of the Help dialog; a one-time "New here? Take a 2-minute tour" card on Home. Starting, finishing, skipping or "Not now" all mark it seen per sponsor in localStorage (`hw-sponsor-tour-seen:<uuid>`, try/catch; blocked storage counts as seen so nobody is nagged). Progress across pages is in sessionStorage.
- Keyboard: focus moves to the callout, → / ← move, Escape skips. Reduced motion: no slide or zoom, scroll jumps instead of gliding.
- The old How to menu and its four how-tos (coffee chat, help, map, judging) are gone; their targets went with the v3 rebuild. The Quick links card (embedded deck) is removed; the tour replaces it.
**Why:** sponsors are using the portal live this weekend and the walkthrough deck is how organizers teach it; a tour on the real page teaches the same thing without a call or a slide deck to open.
**Alternatives:** keep the embedded deck on Home (Quick links; it goes stale and is hard to read on a phone); a tour library such as driver.js (same reasons as 2026-11-18); walking into the Send availability and shortlist flows step by step like the deck does (those are forms with live data; the tour summarises them on the Chats page instead); a centred callout for missing targets, as before (a tour that stops on "this isn't here" reads as broken).

**Update (per-page tours, Jazz, 2026-11-20):** every sponsor page has a "Tour this page" button that runs only that page's steps: the full tour's steps grouped by page (`stepsByPage`, ids `page:<page>`), plus 4 new steps for the Judging page (intro, or "opens Sunday" while locked; the four stages; score a project; submit the final shortlist). Phones show "Tour" next to the logo in the top bar (the bar's title now truncates instead of being absolutely centred, so it can't run into it); tablets and up show "Tour this page" at the top right of the page. The accessible name says which page. Page tours never navigate, end on their page (going elsewhere ends them), and never touch the first-visit "seen" flag. Hidden inside the coffee chat forms (?flow=) and on Judging for sponsors without a prize track.

## 2026-11-20: Sponsor coffee chat setup locks after submit (Jazz, option A)

**Decision:** A sponsor submits their availability (Send availability) and their hacker shortlist once. After either is submitted, the portal can't edit or un-submit it. Supersedes the earlier "Edit shortlist un-submits it until you submit again" and the sponsor's "Change your team or times" after invites.
- **Server:** these sponsor-facing procedures refuse with FORBIDDEN, "Your … is submitted, so it can't be changed here. To change anything, ask your point of contact.": `coffeeChatSetup.addRep / updateRep / removeRep / setPrimary / savePrefs / submitPrefs` once `submittedAt` is set (checked under the existing row lock in `lockForWrite`), and `sponsorShortlist.reopen` once `shortlistSubmittedAt` is set. `sponsorShortlist.submit` refuses a second submit (CONFLICT); `add`/`remove` were already refused while submitted. Helper: `src/server/api/utils/submit-lock.ts`.
- **Organizers keep every path:** a signed-in organizer opening the sponsor's portal link (the "View" button on /internal/sponsors) still gets the forms, Change, Edit shortlist and reopen; the server lets their session through. The coffee chat board's own writes (`coffeeChatSessions`: scheduler, fixes, Send) never used these procedures and are unchanged. `get` and `sponsorShortlist.list` return `canEditSubmitted` so the UI knows.
- **Sponsor UI:** the "Change" / "Edit" links on the Chats page's done lines and "Change your team or times" are gone; in their place, "Submitted. To change anything, ask your point of contact." Opening Send availability after submitting shows a read-only summary (hackers per chat, each rep's chats and free times). The shortlist page shows the submitted banner with no Edit button.
- **Unchanged:** the shortlist stays optional. "Skip for now" is a link back to Chats and never submits; a sponsor who never submits keeps editing, and at 10:00 PM we pick hackers from their interests as before. Booth scans (`recordScan`) keep working all weekend. Sponsors who had already submitted just see the locked view; no data migration.
**Why:** the tour and the forms say "you can only submit this once", and organizers schedule from what was submitted; late sponsor edits moved chats after invites were out.
**Alternatives:** lock only after 10:00 PM (option B: still lets a sponsor change things organizers already planned around); a separate organizer edit screen on /internal (more to build mid-event; the portal link already works for organizers).
