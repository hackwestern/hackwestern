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
- The planning calendar shows the sponsor's availability (prefilled from sponsor info, editable) as shaded bands; blocks outside it get a note, not a block.
- Reps chatting in Ivey are not restricted from the booth; nothing enforced.
- New step 1 "Your team" (reps with optional phone/email, sponsor's main phone required) before the calendar. Calendar columns are rooms; a block lists its reps, so a shared room shows once.

**How (build):** autosave every block edit as a draft on the server; a small room-load query polled every ~5 s (react-query refetchInterval). Websockets rejected for now: more to build and run the day before the event for no visible gain at ~10 sponsors.

**Supersedes:** the proposed clash rule, the Ivey-default question and the Ivey question in "two pools" (2026-11-19).
