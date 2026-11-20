# Sponsor dashboard test checklist (Nov 19)

Go through each line, tick it when it works, and write what broke next to it. Each line says where to try it and what should happen.

**Where:** your server http://localhost:3013, or the public link https://desktop-h6d0rg9.tailc07d02.ts.net. Sign in as an organizer with /api/dev/login?key=snap-local.

**Notifications locally:** Slack DMs and emails don't really send on :3013 (no Slack token, invites in dry mode). To test real Slack DMs, use the Vercel preview or production once their database is migrated (0059 to 0062).

## Before you start

- [ ] Lucas's latest push (Nov 19, about 2 minutes before this was written) breaks the build: 43 type errors, mostly `sponsor-shell.tsx` and the sponsor judging pages. The Vercel preview won't build until it's fixed. Your local :3013 doesn't have his push.
- [ ] Sponsor Day-Of tab is called exactly "Sponsor Day-Of". Renaming it breaks the app.
- [ ] Tiers are filled in on Sponsor Day-Of, and Chatting hours shows 4 / 3 / 2.
- [ ] Scotiabank's "Custom API / Prize Track" box is ticked (otherwise it's left off judging).

## Notifications (hackers)

- [ ] **Shortlist → every member told.** A sponsor sends a round 1 shortlist (sponsor portal, Judging). Every member of each shortlisted team gets a Slack DM with their presentation times, and an email if Slack can't find them. Nobody gets two.
- [ ] **Confirm on Slack.** One team member taps "Confirm our times" in the DM. The DM changes to "Thanks! Your team's times are confirmed." The judging board shows the team as Accepted.
- [ ] **One confirm covers the team.** After one member confirms, the others' DMs don't need a reply, and the board stays Accepted.
- [ ] **Nothing on /live.** /live has no notification bell and no presentations card (Slack only).
- [ ] **Old button refused.** After a room change, tapping Confirm in the old DM says the times changed.
- [ ] **Room change.** Changing a sponsor's room on the judging board keeps every time, and those teams go back to "Invite not sent" until "Notify teams" is pressed.
- [ ] **Coffee chat invites.** Send on the coffee board invites hackers by Slack DM with Accept / Decline. Accepting and declining work from Slack. A decline offers the seat to the next person at once.
- [ ] **Nothing on top 5.** No message goes out when a team places in a sponsor's top 5.

## Organizer dashboard (/internal/sponsors)

- [ ] **Home, Fri / Sat / Sun tabs.** Up next, Your day (run of show grid), that day's sponsor table.
- [ ] **Your sponsors / All sponsors** toggle shows the right sponsors for the signed-in lead.
- [ ] **Portal link.** The ↗ next to each sponsor's name opens their portal in a new tab.
- [ ] **Sponsor details.** Clicking a sponsor opens its details, with Copy link.
- [ ] **Under the table:** spon team availability, Sunday's judging rooms, ceremony order, the day's workshops, "Edit in sheet". (The old Full run of show tool is gone.)
- [ ] **Tools menu** has Coffee chat board and Judging board only.

## Coffee chat board (Tools → Coffee chat board)

- [ ] Rooms × hours grid, every cell the same size, long names cut with "…", Sent / Draft dot on each chat.
- [ ] Drag a draft chat (mouse) to a lit "Drop here" cell: it moves, toast "Moved."
- [ ] On a phone: press and hold, then drag.
- [ ] Drag onto a taken room: error toast, nothing moves.
- [ ] Drag onto the sponsor's own workshop time, or where the rep already has a chat: refused.
- [ ] Drag a sent chat: "This chat is confirmed." warning first, red "Move and tell them".
- [ ] "Isn't free" move: first a step to contact the rep (phone, copy, Call), then a red confirm. The chat gets a "Not free" pill.
- [ ] Drop on the red bar at the bottom removes a chat (Undo for drafts, a warning for sent chats).
- [ ] Click a chat: modal with hackers grouped by chat, Accepted / Waiting, answer-by times.
- [ ] Edit hackers: remove one and choose who gets the seat (next in line, or someone by hacker ID).
- [ ] Put someone first in line; the next-in-line preview updates.
- [ ] Re-run auto-schedule keeps hand-placed and "Not free" chats.
- [ ] Send: schedules and invites go out (see Notifications).
- [ ] Sunday: the board still loads (it used to crash after midnight Saturday).

## Judging board (Tools → Judging board)

- [ ] To do comes first: missing shortlist (Text lead with a drafted SMS), sponsor without a room (room select right there), "Notify teams".
- [ ] Sponsor rows: one status line each, lead's phone with a copy icon, expand for all reps and phones.
- [ ] Room select: Rm 2230, Rm 2235, Rm 2110, Other…. A taken room is greyed out; typing a taken room says whose it is.
- [ ] TinyFish shows "Remote (judges online)": no room, no slots.
- [ ] Calendar: times down the side, rooms across. Cells show Invite not sent (dashed), Waiting, Accepted (green). "2 sponsors" tag on shared teams.
- [ ] "Move to" in a room header swaps with the sponsor already there.
- [ ] Schedule view lists each room's teams in order.
- [ ] Tap a team: modal with Devpost and GitHub, check-in count, members, times, scores so far.
- [ ] A shortlist arriving late places new teams around times already given, never moving them.
- [ ] After presentations: Open round 2, Sync to sheet, Cheat check.
- [ ] PCBWay: Enter top 5 by Devpost links.

## Sponsor portal (/sponsors/<id>)

- [ ] Home: greeting, welcome card with tier, contacts, Up next, key rooms.
- [ ] Chats step 1: Send availability (all hours start ticked).
- [ ] Chats step 2: optional shortlist of hackers, met-at-booth first.
- [ ] After 10 PM Friday: Your chats calendar with Accepted / Waiting hackers.
- [ ] Scan a hacker: camera, or type a code.
- [ ] Schedule: the rep's chats as blocks, rep filter.
- [ ] Map: booth spot and floor plans.
- [ ] Judging (prize track sponsors only, opens Sun 9 AM): score teams, shortlist up to 15, send by 9:30, then rank a top 5 by 12 PM. TinyFish ranks its shortlist (no presentations).

## The sheet (Spon Team RUN OF SHOW)

- [ ] Locked: Coffee Chat Room Grid, Coffee Chat Invites, Sponsor Judging, Coffee Chat Setup (except column A), Chatting hours, the two (old) tabs.
- [ ] Open: Judging Scores (backup if the app is down) and the tabs people maintain.
- [ ] After a coffee board Send, the Coffee Chat Invites and Room Grid tabs update (production only).
- [ ] After a shortlist or top 5, Sponsor Judging updates (production only).

## Before Friday 5 PM

- [ ] Lucas's broken push fixed and PR #1165 builds on Vercel.
- [ ] PR #1165 merged to main.
- [ ] Production migrations run: 0059, 0060, 0061 (judging), 0062 (coffee board).
- [ ] Production has the Slack token and run-of-show sheet login; coffee invite rounds switched on Saturday morning.
