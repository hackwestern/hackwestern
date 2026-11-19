# Manual test guide: sponsor tool (Hack Western 13)

Written 2026-11-19 from the code, not the briefs. Where a handoff and the code disagree, this guide follows the code and says so.

`coffee-prefs` (HEAD 4ba0a61b) has tracks B (invites), C (coffee board), D (My sponsors, Help, Now and next) and E (sheet). Tracks A (sponsor setup) and F (judging) are still in their own worktrees, with uncommitted review fixes. Flows marked "needs A" or "needs F" only work in that worktree until it merges. Until A merges, `/sponsors/[uuid]/coffee-chats` on `coffee-prefs` still shows the old per-slot screens. While this was being written, someone was wiring Send to invites in the `coffee-prefs` working tree. That work isn't committed yet, and the Send flow covers both versions.

## Setup

1. Start the Docker container `hackwestern_db`.
2. Run the app from the worktree you're testing:

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret NEXTAUTH_URL=http://localhost:3014 npx next dev -p 3014
   ```

   NEXT.md's command leaves out `NEXTAUTH_SECRET`. Sessions are signed with `local-dev-only-secret` (`docs/redesign-brief.md`), and the `.env` secret sends you back to login. Give each worktree its own port.
3. Leave `SHEET_WRITES` unset so nothing writes to the live sheet. The app still reads it through `.env`, which loads the run of show, workshops and HW Contacts.
4. Leave `COFFEE_INVITES_ENABLED` unset (off outside production) unless you're testing invites.

### Signing in

There's no login form for test accounts. Make a session cookie the way `../hackwestern-sponsor-dash/mocks/organizer-sponsors-home-v1/capture-live.mjs` does: `encode({ token: { sub, name, email }, secret: "local-dev-only-secret" })` from `next-auth/jwt`, set as the `next-auth.session-token` cookie for `http://localhost:3014`.

- Organizer: `sub: "redesign-organizer-1"`, email `redesign.organizer@test.local`. It isn't Noah, and it matches nobody in HW Contacts.
- Send: keep that `sub` and put Noah's login email from HW Contacts in `email`. Send checks the cookie's email. Don't write that email in the repo.
- My sponsors: use the `sub` of an organizer whose email in the `user` table appears in HW Contacts' "Login email" column. My sponsors reads the DB email, not the cookie's.
- Hackers: `sub: "demo-hacker-1"` (Alex) or `"demo-hacker-2"` (Sam). Both are confirmed and share with sponsors.

### Sponsor portal links

The portal is `/sponsors/<uuid>`. To list the UUIDs:

```
docker exec hackwestern_db psql -U postgres -d hackwestern_spon -c "select name, id from sponsor_judging_sponsor order by name;"
```

### Seed and reset

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx tsx src/server/db/seed/coffee-chat-sessions.ts
```

The seed is also the reset. It deletes every placement and room booking, and their invites go with them. Then it rewrites preferences and reps for six sponsors. Sun Life, Canada Life, StarTech, Scotiabank and CSE come out submitted. Commure has reps but hasn't submitted. A "Mentors" booking holds Rm 2241 at 1-2, so Scotiabank's three reps can't all sit near the Sponsor Bay, which gives you a suggested fix. There's no other reset script. Scans and shortlists stay, so clear them yourself:

```
docker exec hackwestern_db psql -U postgres -d hackwestern_spon -c "delete from sponsor_scan; delete from sponsor_shortlist;"
```

Test Sponsor has no seed data. Use it to walk the sponsor flow from the start. Local data is thin: 2 hackers (both interested in Sun Life, Alex also in StarTech) and no teams. For judging, run `src/server/db/seed/sponsor-picks.ts --teams 15 --yes` with the same `DATABASE_URL` prefix.

## Sponsor side

### Sponsor · First visit and Help
- Goal: a rep opens the private link, gets oriented and knows who to call.
- Starting point: `/sponsors/<uuid>` in a fresh browser profile, so the welcome tour runs.
- Steps: 1. Open the link. 2. Go through the tour. 3. Tap "Need help?" (side nav, home or schedule).
- Expected result: Home shows "What to do now" under the banner: a filled "Tell us when your reps can chat" link until preferences are submitted, then "Your coffee chats". The tour's help step describes the new Help, and its Coffee chats step says setting up chats is required. The modal lists "Your Hack Western contact" (the HW lead on Sponsor Day-Of) and "Emergency contact" (Noah Medland, phone from HW Contacts). Each has a phone link and a copy icon. Nothing is sent or tracked.
- Edge cases: no lead assigned ("Your contact hasn't been assigned yet."). HW Contacts unreadable ("Couldn't load the emergency contact. Ask at the sponsor lounge (Rm 2110)."). A missing number ("Number not available…"). The old tracked request API now refuses with "Help requests are switched off…".

### Sponsor · Your team (needs A)
- Goal: add the reps and pick a main contact.
- Starting point: Test Sponsor's `/sponsors/<uuid>/coffee-chats`. The status card says "Not started". The preferences card's "Start" is the only filled button; the shortlist card is locked and "Add a hacker" is an outline button below.
- Steps: 1. Start "Chatting preferences". 2. Add two reps with names and phones. 3. Tap the second rep's crown. 4. Edit, then remove a rep.
- Expected result: "<name> added." The first rep gets the crown, labelled "Main contact"; the others show "Make main contact", and a tap moves it ("<name> is now the main contact."). If you remove the main contact, the crown goes to the next rep. The status card changes to "Draft saved, not submitted". The button to go on reads "Next: When they're free".
- Edge cases: a blank name and phone (both errors show at once), a phone under 7 digits ("That phone number looks too short."), a 13th rep (max 12), and Next with no reps ("Add at least one rep to continue."). There's no email field. Before Send, Remove shows "<name> removed. Undo", and Undo brings the rep back with their times, chats and crown. While on a preferences step before submitting, the status card says "Step N of 3: …".

### Sponsor · Chatting preferences (needs A)
- Goal: hackers per chat, when each rep is free, and how many chats each wants.
- Starting point: step 2. Use Sun Life to see its workshop blocked. The workshop comes from the run of show.
- Steps: 1. Pick 1 to 5 hackers per chat. 2. Untick some sessions. 3. Change chats per rep, including 0. 4. Reload.
- Expected result: "1-on-1 · 15 min · 4 hackers an hour per rep" or "Groups of 3 · 30 min · 6 hackers an hour per rep". New reps start at 4 chats with every open session ticked. Headers read "10–11 AM" … "4–5 PM", and the workshop row is "Your events": its session shows "Your workshop <time>", hatched and not tickable. Under the 1–5 pick: "Each chat: 1 rep + N hackers". Changes save 0.8 s later ("Saving…", "Saved.") and survive the reload. The totals read "Up to N chats · up to M hackers". A rep at 0 reads "Doesn't chat".
- Edge cases: a rep with nothing ticked ("…isn't free any time Saturday.", and "No free time" beside their chats), a rep at 0 chats (row greyed, "Doesn't chat"), more chats than the free sessions hold ("…is free for 2 hours, so up to 8 chats."), and the DB going down mid-edit ("Not saved, retrying…", retried every 3 s). If the run of show is unreadable, nothing is blocked and you see "We can't read the event schedule right now…". A session the workshop buffer only cuts can be ticked and says which part is left, e.g. "1:00–1:30 only" (Sun Life, groups). Switching between 1-on-1s and groups changes that part, and a session with no whole chat left becomes blocked. Below the chats: "Something doesn't fit? Ask an organizer" opens the portal Help. At 390 px the grid scrolls inside its box, with "Scroll for later times →" above it.

### Sponsor · Review & submit (needs A)
- Goal: check the summary and submit.
- Steps: 1. Open step 3. 2. Tap "Submit preferences".
- Expected result: "Everything checks out." The read-only grid shows plain ticks. The summary reads like "Groups of 3 · 30 min · up to 6 chats · up to 18 hackers", plus "Organizers call <name> at <phone>." in bold. After submitting: "Preferences submitted". The status card says "Submitted, waiting for organizers to schedule", and Shortlist unlocks.
- Edge cases: no chats possible ("No rep has a chat at a time they're free…"), no crown, and no reps. Editing after a submit turns the button into "Submit changes". The preferences stay submitted, and a resubmit moves the submit time forward.

### Sponsor · Scan a hacker (needs A)
- Goal: record a hacker met at the booth so they're invited first.
- Starting point: "Add a hacker" opens `/sponsors/<uuid>/scan`. On a laptop, use "Type their hacker code". A user id like `demo-hacker-1` also works.
- Steps: 1. Look up the hacker. 2. Optionally pick a rep under "Who talked to them? (optional)" (or Anyone). 3. Tap "Add to my list", the only filled button. 4. Tap "Scan next".
- Expected result: the card says "Met at your booth · You met Alex", with no times, rooms or chat length. After the add: "Alex is on your list. We'll invite them first." and a text "Scan next". The Chats home then shows "1 person met at your booth".
- Edge cases: a repeat scan shows "Already on your list · added <time> · talked to <rep>" and the button reads "Save"; the first time is kept and a newly picked rep replaces the old one. "Not now" goes back to scanning without adding. A non-hacker code shows "That isn't a Hack Western hacker's badge." With no camera, "No camera found" shows once.

### Sponsor · Shortlist (needs A)
- Goal: pick hackers to invite after the scanned ones.
- Starting point: preferences submitted. Open "Shortlist".
- Steps: 1. Use "One at a time" (Skip / Shortlist) or List. 2. Shortlist a few. 3. Submit. 4. Tap "Edit shortlist".
- Expected result: scanned hackers come first in a read-only block. The block is headed "People you met · invited first". The cap line reads "14 seats · 3 taken by people you met · shortlist up to 11". Submitting shows "Shortlist submitted"; the banner says "Editing un-submits it until you submit again." and the Remove buttons are hidden. Edit reopens the list.
- Edge cases: locked before preferences are submitted. At the cap: "Your shortlist is full. Remove someone to add another." Lowering chats after shortlisting: only "You now have room for 3 on your shortlist. Remove 2." (no "5 of 3"), and the home card reads "5 shortlisted, room for 3. Remove 2.". An empty submit is allowed. With no candidates you see "No hackers to show yet. Check back soon." The handoff says scans don't count against the cap. The code subtracts them, which matches the decisions log.

### Sponsor · Your chats (needs A)
- Goal: see the confirmed schedule.
- Starting point: organizers sent this sponsor (see the hand-off flows).
- Steps: 1. Open the Chats home. 2. Switch between Calendar and List. 3. Filter by rep.
- Expected result: the status card comes first, then "Your chats", then "Your setup" (links: "Change your team or times", "Shortlist" with its count, "Add a hacker" with the booth count). The status card says "Scheduled, invites going out", or "Scheduled, X of Y seats accepted" once a hacker accepts, then "Invites: A accepted · W waiting · O open". "Last change" lists only organizers' actions: "Organizers confirmed your chats · <time>" (each Send or re-send) and, once this device has seen the chats before, "Organizers moved <rep>'s 1:00 chat to 3:00, Rm 1348" or "Organizers removed <rep>'s 1:00 chat". "Next" says hackers answer "by Sat 10 AM" until round 1 closes. The calendar has the six sessions down the side ("10–11 AM" … "4–5 PM") and one column per rep, each chat with its room ("Rm 2241", "Main building" or "Ivey, 15 min walk"), the format, the chat count and invited first names marked Invited or Confirmed. At 390 px all six sessions show; with more reps than fit, "Scroll for later times →" shows above the table with a fade on its right edge.
- Edge cases: a sent chat that organizers move stays here with its new room or time. A session cut by the workshop shows its real times (e.g. "2:30–3:00"), the same times hackers are invited to.

### Sponsor · Change after invites (needs A)
- Goal: an edit after Send needs a strong warning.
- Steps: 1. On a sent sponsor, edit a rep, a session or the chats. 2. Pick "Keep it as is". 3. Do it again and pick "Change anyway".
- Expected result: the dialog says "Invites are already out", then "This affects N invited hackers. Organizers will update their chats, and the hackers will be told." N counts only invites in the chats this edit changes (an unticked session with a sent chat, chats that shrink, a new group size, a renamed rep's chats, or a removed rep's chats). An edit that touches no sent chat (a phone, the crown, ticking an empty session) says "This doesn't affect any invited hackers." Keep changes nothing. Change saves, and that screen doesn't ask again. The status card adds "You changed your setup after invites went out." plus the same sentence, counting invites in sent chats the new setup no longer fits.
- Edge cases: removing a rep moves their invited hackers to another open seat of the sponsor (they must confirm again) or cancels their invite, and tells them. Fewer chats or a new group size re-asks or cancels the invites that no longer fit. With the run of show unreadable, those edits are refused ("We can't read the event schedule right now…"). A submit or a shortlist change doesn't count as an edit. An API call without the confirm flag gets PRECONDITION_FAILED ("Invites are already out. Confirm the change to save it.").

### Sponsor · Judging (needs F)
- Goal: score, shortlist, then rank a top 3.
- Starting point: `/sponsors/<uuid>/picks?preview=judging` for a sponsor whose prize track box is ticked on Sponsor Day-Of, with seeded teams. Without `?preview=judging`, before Sun 9:00 AM the page shows "Judging opens Sunday 9:00 AM", the same as the locked nav item.
- Steps: 1. Pick a name in "Who's judging?" (Your team reps, or "Someone else"). 2. Score in One at a time or in List. 3. Open Rubric. 4. Score as a second rep. 5. Send the shortlist. 6. In round 2, submit exactly 3.
- Expected result: a 1 to 10 strip in half points, dimmed until touched. Each project shows "Dana 9.5 · Kevin 6" and the average. Reps 3 or more points apart get an amber flag. Two reps split the list alphabetically ("Your 2" / "Everyone's 6").
- Edge cases: no prize track, PCBWay ("Digital sponsors don't judge in the portal…"), an empty shortlist, round 2 closed or no presentation slot, and the wrong count ("Submit exactly 3 teams."). A name in different case replaces the score instead of adding one. TinyFish shows "Remote (judges online)".

## Organizer side

### Organizer · Happening now
- Goal: see what needs doing at a glance.
- Starting point: `/internal/sponsors`.
- Steps: 1. Read "Needs attention now" and "Now and next". 2. Follow a link.
- Expected result: items like "<Sponsor> hasn't sent coffee chat preferences", "<Sponsor>: 0 of 3 reps scheduled", "…changed their coffee chat preferences after the schedule was sent", and up to 3 overdue tasks. They're grouped "Your sponsors" / "Other sponsors" (or "All sponsors") / "Run of show tasks". When there's nothing: "All clear". Digital sponsors (PCBWay) never appear. Now and next shows the event and the task now and next, with the owner; before the event the first row reads "Up next". "Open coffee chats" opens the board scrolled to that sponsor's row, opened, with focus on it.
- Edge cases: a task counts as overdue for an hour after its window. `?tab=pings` and `#help` open Sponsors. The Task pings tab is gone.

### Organizer · My sponsors
- Goal: see your own sponsors' people and logistics.
- Starting point: the Sponsors tab, signed in as an HW lead (see Signing in).
- Steps: 1. Open a sponsor tab. 2. Copy a phone. 3. Switch to All sponsors (`?list=all`). 4. Tap Arrival or Booth.
- Expected result: "You lead N sponsors". People shows the reps, with the crown and the words "Main contact" beside the main contact. "Their workshop" reads like "Sat 1:00 PM · 2230 · 50 seats". The Coffee chats rows show Preferences, Shortlist, Schedule ("2 of 3 reps placed") and Invites ("0 of 4 accepted" or "Not sent"). With sheet writes off, a pill goes back after the save and the note above the tabs says "<Sponsor>: Not written (sheet writes off)". A digital sponsor (PCBWay) has no Coffee chats block and no presentation rows.
- Edge cases: the test organizer matches nobody and lands on All sponsors. Unreadable HW Contacts shows "Can't read HW Contacts…". The "Came to the Friday coffee chat briefing" pill ticks the "At CC workshop" checkbox on Sponsor Day-Of (with sheet writes off it notes "<Sponsor>: Not written (sheet writes off)"). Without that column it's disabled with "Add an \"At CC workshop\" checkbox column…".

### Organizer · Read the coffee board
- Goal: see who submitted and what to do next.
- Starting point: `/internal/sponsors?tab=coffee`, after the seed.
- Steps: 1. Read the summary card. 2. Open a sponsor row. 3. Copy a phone. 4. Open Help.
- Expected result: "5 sponsors submitted. Run Auto-schedule, then Noah sends schedules and invites by 10 PM. 1 sponsor still hasn't submitted.", with an "Auto-schedule" button in the same card. Each row shows the logo and the name in text. The chip is the stage: "Not submitted", "Needs scheduling", "Scheduled, not sent" or "Sent". Problems show beside it as a separate flag: "1 rep not placed", "1 chat needs a fix" or "Changed after invites". People shows "Asked for 4 chats · 2 h" plus the phone, and "Main contact" beside the crown. The copy icon flips to "Copied". The board refreshes every 15 s. Digital sponsors (PCBWay) aren't on the board.
- Edge cases: "Submitted, no chats asked" (every rep at 0), "Submitted, no availability", and an unreadable run of show ("Can't read the run of show…", which pauses writes).

### Organizer · Schedule and fix
- Goal: place every rep in a room.
- Steps: 1. Auto-schedule. 2. Apply a suggested fix. 3. Move a chat to an empty cell. 4. Remove a chat. 5. Book a room. 6. Re-run Auto-schedule.
- Expected result: "Placed N chats." Scotiabank's fix reads "put all 3 reps in Ivey (…) at 1-2 so they stay together." Moves and fixes are pinned and survive a re-run. Chips change to "Scheduled, not sent". Sponsors and hackers can't see drafts. Picking a chat scrolls its panel into view above the Send bar. "Removed." has an Undo for a draft chat or a booking (not for a sent chat). A rep's back-to-back chats stay in one building when a room is free there; when not, the rep row and the chat panel say "Walk to Ivey between chats (2–3)" (or "Walk back from Ivey…"). It's never blocked.
- Edge cases: a taken room ("Rm 2241 is taken at 1-2."), the workshop window ("That's during Sun Life's workshop."), a rep who isn't free, and a rep already busy. Two organizers editing at once: "Someone else just changed the board…". Partial-session fixes ("3 of 4 chats", "add a session") come from a sponsor ticking a cut session. Moving or fixing a sent chat keeps it "Sent"; its invited hackers are asked to confirm the new room or time.

### Organizer · Send (Noah only)
- Goal: send the schedule.
- Steps: 1. As the test organizer, look at the Send bar. 2. As Noah, press Send.
- Expected result (committed HEAD): others see the button disabled with "Only Noah sends". Noah's button reads "Save & confirm schedule". It marks drafts sent and shows "Schedule confirmed (N chats). Hacker invites aren't sent yet." plus "Sheet writes are off here, so the Room Grid tab wasn't updated." Chips change to "Sent". No invites go out.
- Expected result (uncommitted wiring): the button reads "Send confirmed schedules & invites". Send runs `sendRoundOneInvites` in the same transaction, and the toast reads "Sent N chats. Invited M hackers", with open seats offered again at Sat 10:30 AM. With invites off you get "Invites are switched off on this server, so no hacker was messaged."
- **Fix loop (Step 5):** pressing Send opens one confirm: "Send N sponsors' schedules and invite up to M hackers? Hackers get a Slack message now." (Send now / Cancel). M counts every seat in the draft chats. With `COFFEE_INVITES_ENABLED=dry` the toast adds "(dry run: nothing was messaged)". After Send, a sponsor with an unplaced rep reads "Sent" + "1 rep not placed".
- Send also re-confirms sponsors flagged "Changed after invites" (toast "Re-confirmed N sponsors who changed after invites."), and the flag clears. The Send button stays up while any sponsor is flagged, even with no drafts.
- Edge cases: Noah's login email blank ("…nobody can send. Add it in the sheet."), HW Contacts unreadable, someone else forcing the call (FORBIDDEN), and no drafts ("Nothing new to confirm."). To fake Send without Noah: `update coffee_chat_placement set status='sent', sent_at=now() where status='draft';` (this sends no invites).

### Organizer · Invite status and rounds
- Goal: see who's invited and run a round by hand.
- Starting point: the app started with `COFFEE_INVITES_ENABLED=1`, and placements sent.
- Steps: 1. Open `/api/trpc/coffeeChatInvites.status` in the browser. 2. In the console: `await fetch('/api/trpc/coffeeChatInvites.runRoundNow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({json:{}})}).then(r=>r.json())`.
- Expected result: per sponsor and chat you see seats, filled, accepted and open, plus each invite's status, round and source (Met at their booth, Shortlist, Interested). A round writes one invite per open seat: scanned hackers first, then the shortlist, then interested. A hacker holds at most 2 live invites.
- Edge cases: kill switch off (`"disabled"`, nothing written), nothing sent (`"nothingSent"`), and an unreadable run of show (nothing written). Re-running only fills seats not offered this round. Before Sat 10:30 AM it's round 1, answered by Sat 10:00 AM or 20 minutes before the chat (35 for Ivey). To preview a later round, run `npx tsx scripts/run-coffee-invite-round.ts --now=2026-11-21T15:30:00Z`, a dry run that only counts. On the board, a sent sponsor's open row shows "Invites: N accepted · N waiting · N open".

### Organizer · Judging tab (needs F)
- Goal: follow judging and enter PCBWay's top 3.
- Steps: 1. Check per-rep scores. 2. Under "Digital sponsors", paste three Devpost links or team IDs. 3. Save.
- Expected result: each match shows its name, ID and link. Save stays off until all three match different submitted teams in the track.
- Edge cases: no match ("…doesn't match a submitted team…"), two matches ("…Paste the team ID instead."), and a missing PCBWay DB row (one is created). PCBWay never shows under Presentations. Schedule presentations that places nothing keeps its label and says "Nothing scheduled yet. See why below.", with lines like "<team> · Sun Life has no judging room on Sponsor Day-Of".

## Hand-offs between the two sides

### Both · Sponsor submits → organizer finds it (needs A)
- Goal: an organizer arriving cold sees the new submit.
- Starting point: Test Sponsor's portal in one window, the board in another.
- Steps: 1. The sponsor submits. 2. Wait up to 15 s.
- Expected result: Test Sponsor joins the board (it does once it has reps) as "Needs scheduling". "Since last time" lists "Test Sponsor submitted · <time>". Needs attention says "Test Sponsor: 0 of N reps scheduled". Every setup save starts the Coffee Chat Setup mirror; with dev sheet writes off it logs once and writes nothing.
- Edge cases: edits before scheduling show "edited reps or times since the last new chat". A sponsor with reps but no submit stays "Not submitted".

### Both · Organizer schedules → sponsor sees the schedule (needs A)
- Steps: 1. Auto-schedule. 2. The sponsor reloads. 3. Send (or the SQL). 4. The sponsor reloads.
- Expected result: after step 2 the sponsor still sees "Submitted, waiting for organizers…". After step 4 they see "Scheduled, invites going out", "Invites: 0 accepted · N waiting · M open", "Organizers confirmed your chats · <time>" and the calendar. The main contact gets no message (not built).
- Edge cases: moving a sent chat keeps it on the portal with its new room or time, and a device that saw it before shows "Organizers moved <rep>'s <time> chat to …" under "Since you were last here" (then "Last change"). Removing one takes it off right away ("Organizers removed …"), and its hackers move to another seat or are told it's cancelled.

### Both · Sponsor changes after invites → organizer notices (needs A)
- Steps: 1. On a sent sponsor, untick a session that has a sent chat and pick "Change anyway". 2. Look at the board.
- Expected result: the flag "Changed after invites". The summary says "1 sponsor changed after invites. Check their chats, then Noah sends again." "Since last time" shows "<Sponsor> edited reps or times after Send · <time>". A fix appears: "Dana W.'s chat at 2-3 is at a time Dana W. isn't free anymore." with "move to … / remove." Lowering chats gives "…is one more than Dana W. now wants." Needs attention lists the change too.
- Edge cases: the sponsor's save already updates invites (re-asked hackers get a new answer-by time; with `COFFEE_INVITES_ENABLED=dry` nothing is sent). Noah's next Send re-confirms the sponsor and clears the flag, even when there's no draft.

### Both · Sponsor asks for help → organizer contact
- Steps: 1. The sponsor opens "Need help?". 2. They call or text the lead, or Noah.
- Expected result: the sponsor sees the lead's name and number, then Noah's. The organizer gets a normal call or text, and nothing appears on the dashboard. To call back, use the reps' phones on My sponsors or on the board row.
- Edge cases: "Something doesn't fit? Ask an organizer" on the preferences step opens the same Help.

### Both · Invites: hacker invited → answers → both sides see it
- Starting point: `COFFEE_INVITES_ENABLED=1` and Sun Life sent (both demo hackers are interested), or scan `demo-hacker-1` first. Check `.env` has no `SLACK_BOT_TOKEN` or Mailjet keys. Dev normally has neither.
- Steps: 1. Run a round (Send with the wiring, or runRoundNow). 2. As `demo-hacker-1`, open `/live`. 3. Accept on `/live?tab=coffee-chats`. 4. As `demo-hacker-2`, decline. 5. Check the status endpoint and the sponsor's Your chats.
- Expected result: nothing is really sent, because with no token or keys Slack and email are skipped. To see invites, use `/live` (toast "<Sponsor> wants to chat with you", with Accept / Decline), the status endpoint, or `select user_id, status, round, source, slot_time, expires_at from coffee_chat where placement_id is not null;`. The uncommitted work adds `COFFEE_INVITES_ENABLED=dry`, which saves invites, sends nothing, and logs "[coffee invites] dry run: N notice(s) not sent". After Alex accepts, the sponsor sees "Scheduled, 1 of N seats accepted" and "Confirmed" next to Alex. Sam's seat waits for the next round, and that sponsor won't invite Sam again.
- Edge cases: past `expires_at` shows Expired. A hacker who already holds 2 live invites gets no third. Moved or removed chats update the invite (re-asked, moved or cancelled).

## Gaps

- Not merged: A (sponsor setup) and F (judging). Every sponsor coffee chat flow and judging change waits on them.
- Send → `sendRoundOneInvites`: not committed. HEAD returns `invites: "not-built"` with the old label and toast. The wiring and the "dry" mode exist only in the uncommitted working tree. Sending each primary contact their schedule isn't built.
- ~~Reconcile after a change~~ **Closed (Integration 1):** `reconcileInvitesAfterChange` isn't called from `movePlacement`, `removePlacement`, `applyFix` or A's rep and preference writes. Removing a rep deletes invites without notice, and moved chats leave stale invite details.
- ~~`mirrorCoffeeChatSetup` after setup saves~~ **Closed (Integration 3):** only TODO comments in A's `coffee-chat-setup.ts` and `sponsor-shortlist.ts`. The Coffee Chat Setup tab never updates.
- ~~"Message organizers" → Help~~ **Closed (Integration 4):** a TODO in A's preferences step. Nothing renders the text.
- ~~CC workshop pill~~ **Closed (Integration 8; live column K added):** was disabled. The planned "At CC workshop" column on Sponsor Day-Of has no read or write.
- ~~Seat times from `usableWindow`~~ **Closed (Integration 6):** B works out its own seat times. A's Your chats counts from the start of the session, so a late-starting partial session shows the wrong time. Both should use C's `usableWindow`.
- ~~Partial sessions can't come from sponsors~~ **Closed (Integration 5).** A's grid blocks any session the buffer touches, and `savePrefs` drops it, so the 1:00-1:30 part for Sun Life is never offered. At merge, A's `blockedFor` calls `blockedSessions` without chat minutes.
- ~~Invite status has no board UI~~ **Closed (Integration 7):** had, only the tRPC endpoint.
- ~~A moved sent chat leaves the sponsor's Your chats~~ **Closed (Integration 1):** it until the next Send and can flip the sponsor back to "waiting".
- ~~A sponsor-only edit after Send leaves~~ **Closed (Integration 2):** it "Changed after invites" up with nothing for Noah to re-send.
- Leftovers (`confirmedLock` copy and A's router comment fixed in Integration 1/4): the old per-slot portal, and the run-of-show judging panel that counts picks from the deleted tab (to be fixed at F's merge). The "no portal link for digital sponsors" rule still needs checking at merge.
- Local data is thin (2 hackers, no teams), so invites and judging need extra seeding.
