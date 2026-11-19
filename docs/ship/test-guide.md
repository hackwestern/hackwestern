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
- Expected result: the tour's help step describes the new Help. The modal lists "Your Hack Western contact" (the HW lead on Sponsor Day-Of) and "Emergency contact" (Noah Medland, phone from HW Contacts). Each has a phone link and a copy icon. Nothing is sent or tracked.
- Edge cases: no lead assigned ("Your contact hasn't been assigned yet."). HW Contacts unreadable ("Couldn't load the emergency contact. Ask at the sponsor lounge (Rm 2110)."). A missing number ("Number not available…"). The old tracked request API now refuses with "Help requests are switched off…".

### Sponsor · Your team (needs A)
- Goal: add the reps and pick a primary contact.
- Starting point: Test Sponsor's `/sponsors/<uuid>/coffee-chats`. The status card says "Not started".
- Steps: 1. Start "Chatting preferences". 2. Add two reps with names and phones. 3. Tap the second rep's crown. 4. Edit, then remove a rep.
- Expected result: "<name> added." The first rep gets the crown, and a tap moves it ("<name> is now the primary contact."). If you remove the primary, the crown goes to the next rep. The status card changes to "Draft saved, not submitted".
- Edge cases: a blank name or phone, a phone under 7 digits ("That phone number looks too short."), a 13th rep (max 12), and Next with no reps ("Add at least one rep to continue."). There's no email field.

### Sponsor · Chatting preferences (needs A)
- Goal: hackers per chat, when each rep is free, and how many chats each wants.
- Starting point: step 2. Use Sun Life to see its workshop blocked. The workshop comes from the run of show.
- Steps: 1. Pick 1 to 5 hackers per chat. 2. Untick some sessions. 3. Change chats per rep, including 0. 4. Reload.
- Expected result: "1-on-1 · 15 min · 4 hackers an hour per rep" or "Groups of 3 · 30 min · 6 hackers an hour per rep". New reps start at 4 chats with every open session ticked. The workshop session shows "Your workshop <time>", hatched and not tickable. Changes save 0.8 s later ("Saving…", "Saved.") and survive the reload. The totals read "Up to N chats · up to M hackers". A rep at 0 reads "Doesn't chat".
- Edge cases: a rep with nothing ticked ("…isn't free any time Saturday."), more chats than the free sessions hold ("…is free for 2 hours, so up to 8 chats."), and the DB going down mid-edit ("Not saved, retrying…", retried every 3 s). If the run of show is unreadable, nothing is blocked and you see "We can't read the event schedule right now…". A session the workshop buffer only partly touches is blocked whole (see Gaps).

### Sponsor · Review & submit (needs A)
- Goal: check the summary and submit.
- Steps: 1. Open step 3. 2. Tap "Submit preferences".
- Expected result: "Everything checks out." The summary reads like "Groups of 3 · 30 min · up to 6 chats · up to 18 hackers", plus "Organizers call <name> at <phone>." After submitting: "Preferences submitted". The status card says "Submitted, waiting for organizers to schedule", and Shortlist unlocks.
- Edge cases: no chats possible ("No rep has a chat at a time they're free…"), no crown, and no reps. Editing after a submit turns the button into "Submit changes". The preferences stay submitted, and a resubmit moves the submit time forward.

### Sponsor · Scan a hacker (needs A)
- Goal: record a hacker met at the booth so they're invited first.
- Starting point: "Add a hacker" opens `/sponsors/<uuid>/scan`. On a laptop, use "Type their hacker code". A user id like `demo-hacker-1` also works.
- Steps: 1. Look up the hacker. 2. Pick a rep under "Which rep wants to talk to them?" (or Anyone). 3. Tap "Add to Met at Hacker Fair".
- Expected result: "Alex is on your Met at Hacker Fair list. We'll invite them first." The Chats home then shows "1 person you scanned".
- Edge cases: a second scan keeps the first time, and a rep picked later replaces the old one. A non-hacker code shows "That isn't a Hack Western hacker's badge."

### Sponsor · Shortlist (needs A)
- Goal: pick hackers to invite after the scanned ones.
- Starting point: preferences submitted. Open "Shortlist".
- Steps: 1. Use "One at a time" (Skip / Shortlist) or List. 2. Shortlist a few. 3. Submit. 4. Tap "Edit shortlist".
- Expected result: scanned hackers come first in a read-only block. The cap line reads "14 seats · 3 taken by people you scanned · shortlist up to 11". Submitting shows "Shortlist submitted", and Edit reopens the list.
- Edge cases: locked before preferences are submitted. At the cap: "All N seats are shortlisted…". Lowering chats after shortlisting: "Your shortlist has 5 people but you now have 3 seats. Remove 2." An empty submit is allowed. With no candidates you see "No hackers to show yet. Check back soon." The handoff says scans don't count against the cap. The code subtracts them, which matches the decisions log.

### Sponsor · Your chats (needs A)
- Goal: see the confirmed schedule.
- Starting point: organizers sent this sponsor (see the hand-off flows).
- Steps: 1. Open the Chats home. 2. Switch between Calendar and List. 3. Filter by rep.
- Expected result: the preferences card says "Confirmed". The status card says "Scheduled, invites going out", or "Scheduled, X of Y seats accepted" once a hacker accepts. "Since you were last here" shows "Organizers scheduled your chats · <time>", tracked per device. The calendar shows each rep's room ("Rm 2241", "Main building" or "Ivey, 15 min walk"), the format, the chat count and invited first names marked Invited or Confirmed.
- Edge cases: a sent chat that organizers move turns back into a draft and disappears here until the next Send. The end time is counted from the start of the session, so a partial session that starts late shows the wrong times.

### Sponsor · Change after invites (needs A)
- Goal: an edit after Send needs a strong warning.
- Steps: 1. On a sent sponsor, edit a rep, a session or the chats. 2. Pick "Keep it as is". 3. Do it again and pick "Change anyway".
- Expected result: the dialog says "Invites are already out", then "Changing this will ask N hackers to confirm again…" (N = pending plus accepted invites), or "may ask hackers" when N is 0. Keep changes nothing. Change saves, and that screen doesn't ask again. The status card adds "You changed your setup after invites went out…".
- Edge cases: removing a rep deletes their chats and invites. A submit or a shortlist change doesn't count as an edit. An API call without the confirm flag gets PRECONDITION_FAILED. The router comment says writes are refused after Send, but the code allows them once confirmed. The `confirmedLock` text is never used.

### Sponsor · Judging (needs F)
- Goal: score, shortlist, then rank a top 3.
- Starting point: `/sponsors/<uuid>/picks` for a sponsor whose prize track box is ticked on Sponsor Day-Of, with seeded teams.
- Steps: 1. Pick a name in "Who's judging?" (Your team reps, or "Someone else"). 2. Score in One at a time or in List. 3. Open Rubric. 4. Score as a second rep. 5. Send the shortlist. 6. In round 2, submit exactly 3.
- Expected result: a 1 to 10 strip in half points, dimmed until touched. Each project shows "Dana 9.5 · Kevin 6" and the average. Reps 3 or more points apart get an amber flag. Two reps split the list alphabetically ("Your 2" / "Everyone's 6").
- Edge cases: no prize track, PCBWay ("Digital sponsors don't judge in the portal…"), an empty shortlist, round 2 closed or no presentation slot, and the wrong count ("Submit exactly 3 teams."). A name in different case replaces the score instead of adding one. TinyFish shows "Remote (judges online)".

## Organizer side

### Organizer · Happening now
- Goal: see what needs doing at a glance.
- Starting point: `/internal/sponsors`.
- Steps: 1. Read "Needs attention now" and "Now and next". 2. Follow a link.
- Expected result: items like "<Sponsor> hasn't sent coffee chat preferences", "…sent preferences but only 0 of 3 reps are scheduled", "…changed their coffee chat preferences after the schedule was sent", and up to 3 overdue tasks. They're grouped "Your sponsors" / "Other sponsors" (or "All sponsors") / "Run of show tasks". When there's nothing: "All clear". Now and next shows the event and the task now and next, with the owner.
- Edge cases: a task counts as overdue for an hour after its window. `?tab=pings` and `#help` open Sponsors. The Task pings tab is gone.

### Organizer · My sponsors
- Goal: see your own sponsors' people and logistics.
- Starting point: the Sponsors tab, signed in as an HW lead (see Signing in).
- Steps: 1. Open a sponsor tab. 2. Copy a phone. 3. Switch to All sponsors (`?list=all`). 4. Tap Arrival or Booth.
- Expected result: "You lead N sponsors". People shows the reps, with the crown on "Main contact". The Coffee chats rows show Preferences, Shortlist, Schedule ("2 of 3 reps placed") and Invites ("0 of 4 accepted" or "Not sent"). With sheet writes off, a pill saves and notes "Not written (sheet writes off)".
- Edge cases: the test organizer matches nobody and lands on All sponsors. Unreadable HW Contacts shows "Can't read HW Contacts…". The CC workshop pill says "Not tracked in the app yet".

### Organizer · Read the coffee board
- Goal: see who submitted and what to do next.
- Starting point: `/internal/sponsors?tab=coffee`, after the seed.
- Steps: 1. Read the summary card. 2. Open a sponsor row. 3. Copy a phone. 4. Open Help.
- Expected result: "5 sponsors submitted. Run Auto-schedule, then Noah sends schedules and invites by 10 PM. 1 sponsor still hasn't submitted." Chips read "Not submitted" or "Submitted, needs scheduling", with "0 of 3 reps placed". People shows "Asked for 4 chats · 2 h" plus the phone. The copy icon flips to "Copied". The board refreshes every 15 s.
- Edge cases: "Submitted, no chats asked" (every rep at 0), "Submitted, no availability", and an unreadable run of show ("Can't read the run of show…", which pauses writes).

### Organizer · Schedule and fix
- Goal: place every rep in a room.
- Steps: 1. Auto-schedule. 2. Apply a suggested fix. 3. Move a chat to an empty cell. 4. Remove a chat. 5. Book a room. 6. Re-run Auto-schedule.
- Expected result: "Placed N chats." Scotiabank's fix reads "put all 3 reps in Ivey (…) at 1-2 so they stay together." Moves and fixes are pinned and survive a re-run. Chips change to "Scheduled (draft)". Sponsors and hackers can't see drafts.
- Edge cases: a taken room ("Rm 2241 is taken at 1-2."), the workshop window ("That's during Sun Life's workshop."), a rep who isn't free, and a rep already busy. Two organizers editing at once: "Someone else just changed the board…". Partial-session fixes ("3 of 4 chats", "add a session") can't be reached with real sponsor input (see Gaps).

### Organizer · Send (Noah only)
- Goal: send the schedule.
- Steps: 1. As the test organizer, look at the Send bar. 2. As Noah, press Send.
- Expected result (committed HEAD): others see the button disabled with "Only Noah sends". Noah's button reads "Save & confirm schedule". It marks drafts sent and shows "Schedule confirmed (N chats). Hacker invites aren't sent yet." plus "Sheet writes are off here, so the Room Grid tab wasn't updated." Chips change to "Sent". No invites go out.
- Expected result (uncommitted wiring): the button reads "Send confirmed schedules & invites". Send runs `sendRoundOneInvites` in the same transaction, and the toast reads "Sent N chats. Invited M hackers", with open seats offered again at Sat 10:30 AM. With invites off you get "Invites are switched off on this server, so no hacker was messaged."
- Edge cases: Noah's login email blank ("…nobody can send. Add it in the sheet."), HW Contacts unreadable, someone else forcing the call (FORBIDDEN), and no drafts ("Nothing new to confirm."). To fake Send without Noah: `update coffee_chat_placement set status='sent', sent_at=now() where status='draft';` (this sends no invites).

### Organizer · Invite status and rounds
- Goal: see who's invited and run a round by hand.
- Starting point: the app started with `COFFEE_INVITES_ENABLED=1`, and placements sent.
- Steps: 1. Open `/api/trpc/coffeeChatInvites.status` in the browser. 2. In the console: `await fetch('/api/trpc/coffeeChatInvites.runRoundNow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({json:{}})}).then(r=>r.json())`.
- Expected result: per sponsor and chat you see seats, filled, accepted and open, plus each invite's status, round and source (Scanned, Shortlist, Interested). A round writes one invite per open seat: scanned hackers first, then the shortlist, then interested. A hacker holds at most 2 live invites.
- Edge cases: kill switch off (`"disabled"`, nothing written), nothing sent (`"nothingSent"`), and an unreadable run of show (nothing written). Re-running only fills seats not offered this round. Before Sat 10:30 AM it's round 1, answered by Sat 10:00 AM or 20 minutes before the chat (35 for Ivey). To preview a later round, run `npx tsx scripts/run-coffee-invite-round.ts --now=2026-11-21T15:30:00Z`, a dry run that only counts. There's no board UI for this yet.

### Organizer · Judging tab (needs F)
- Goal: follow judging and enter PCBWay's top 3.
- Steps: 1. Check per-rep scores. 2. Under "Digital sponsors", paste three Devpost links or team IDs. 3. Save.
- Expected result: each match shows its name, ID and link. Save stays off until all three match different submitted teams in the track.
- Edge cases: no match ("…doesn't match a submitted team…"), two matches ("…Paste the team ID instead."), and a missing PCBWay DB row (one is created).

## Hand-offs between the two sides

### Both · Sponsor submits → organizer finds it (needs A)
- Goal: an organizer arriving cold sees the new submit.
- Starting point: Test Sponsor's portal in one window, the board in another.
- Steps: 1. The sponsor submits. 2. Wait up to 15 s.
- Expected result: Test Sponsor joins the board (it does once it has reps) as "Submitted, needs scheduling". "Since last time" lists "Test Sponsor submitted · <time>". Needs attention says "…only 0 of N reps are scheduled". The Coffee Chat Setup sheet tab stays the same: the mirror isn't called, and dev writes are off.
- Edge cases: edits before scheduling show "edited reps or times since the last new chat". A sponsor with reps but no submit stays "Not submitted".

### Both · Organizer schedules → sponsor sees the schedule (needs A)
- Steps: 1. Auto-schedule. 2. The sponsor reloads. 3. Send (or the SQL). 4. The sponsor reloads.
- Expected result: after step 2 the sponsor still sees "Submitted, waiting for organizers…". After step 4 they see "Scheduled, invites going out", "Confirmed" and the calendar. The primary contact gets no message (not built).
- Edge cases: moving a sent chat sends it back to draft, and it leaves the portal until the next Send. Removing one takes it off right away.

### Both · Sponsor changes after invites → organizer notices (needs A)
- Steps: 1. On a sent sponsor, untick a session that has a sent chat and pick "Change anyway". 2. Look at the board.
- Expected result: the flag "Changed after invites". The summary says "1 sponsor changed after invites. Check their chats, then Noah sends again." "Since last time" shows "<Sponsor> edited reps or times after Send · <time>". A fix appears: "Dana W.'s chat at 2-3 is at a time Dana W. isn't free anymore." with "move to … / remove." Lowering chats gives "…is one more than Dana W. now wants." Needs attention lists the change too.
- Edge cases: hackers get no notice, and their invites keep the old details (reconcile isn't wired). Removing a rep deletes invites silently. A re-Send only confirms drafts, so a sponsor-only edit leaves the flag up with nothing to send.

### Both · Sponsor asks for help → organizer contact
- Steps: 1. The sponsor opens "Need help?". 2. They call or text the lead, or Noah.
- Expected result: the sponsor sees the lead's name and number, then Noah's. The organizer gets a normal call or text, and nothing appears on the dashboard. To call back, use the reps' phones on My sponsors or on the board row.
- Edge cases: "Need something different? Message organizers" on the preferences step isn't wired.

### Both · Invites: hacker invited → answers → both sides see it
- Starting point: `COFFEE_INVITES_ENABLED=1` and Sun Life sent (both demo hackers are interested), or scan `demo-hacker-1` first. Check `.env` has no `SLACK_BOT_TOKEN` or Mailjet keys. Dev normally has neither.
- Steps: 1. Run a round (Send with the wiring, or runRoundNow). 2. As `demo-hacker-1`, open `/live`. 3. Accept on `/live?tab=coffee-chats`. 4. As `demo-hacker-2`, decline. 5. Check the status endpoint and the sponsor's Your chats.
- Expected result: nothing is really sent, because with no token or keys Slack and email are skipped. To see invites, use `/live` (toast "<Sponsor> wants to chat with you", with Accept / Decline), the status endpoint, or `select user_id, status, round, source, slot_time, expires_at from coffee_chat where placement_id is not null;`. The uncommitted work adds `COFFEE_INVITES_ENABLED=dry`, which saves invites, sends nothing, and logs "[coffee invites] dry run: N notice(s) not sent". After Alex accepts, the sponsor sees "Scheduled, 1 of N seats accepted" and "Confirmed" next to Alex. Sam's seat waits for the next round, and that sponsor won't invite Sam again.
- Edge cases: past `expires_at` shows Expired. A hacker who already holds 2 live invites gets no third. Moved or removed chats don't update the invite.

## Gaps

- Not merged: A (sponsor setup) and F (judging). Every sponsor coffee chat flow and judging change waits on them.
- Send → `sendRoundOneInvites`: not committed. HEAD returns `invites: "not-built"` with the old label and toast. The wiring and the "dry" mode exist only in the uncommitted working tree. Sending each primary contact their schedule isn't built.
- Reconcile after a change: `reconcileInvitesAfterChange` isn't called from `movePlacement`, `removePlacement`, `applyFix` or A's rep and preference writes. Removing a rep deletes invites without notice, and moved chats leave stale invite details.
- `mirrorCoffeeChatSetup` after setup saves: only TODO comments in A's `coffee-chat-setup.ts` and `sponsor-shortlist.ts`. The Coffee Chat Setup tab never updates.
- "Message organizers" → Help: a TODO in A's preferences step. Nothing renders the text.
- CC workshop pill: disabled. The planned "At CC workshop" column on Sponsor Day-Of has no read or write.
- Seat times from `usableWindow`: B works out its own seat times. A's Your chats counts from the start of the session, so a late-starting partial session shows the wrong time. Both should use C's `usableWindow`.
- Partial sessions can't come from sponsors. A's grid blocks any session the buffer touches, and `savePrefs` drops it, so the 1:00-1:30 part for Sun Life is never offered. At merge, A's `blockedFor` calls `blockedSessions` without chat minutes.
- Invite status has no board UI, only the tRPC endpoint.
- A moved sent chat leaves the sponsor's Your chats until the next Send and can flip the sponsor back to "waiting".
- A sponsor-only edit after Send leaves "Changed after invites" up with nothing for Noah to re-send.
- Leftovers: the unused `confirmedLock` copy, the old per-slot portal, A's router comment that says writes are refused after Send, and the run-of-show judging panel that counts picks from the deleted tab (to be fixed at F's merge). The "no portal link for digital sponsors" rule still needs checking at merge.
- Local data is thin (2 hackers, no teams), so invites and judging need extra seeding.
