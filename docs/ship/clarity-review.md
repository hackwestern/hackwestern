# Clarity review: sponsor tool walkthrough (ship run, Steps 2–3)

Walked 2026-11-19 on `coffee-prefs` (34af01bf), local DB, `COFFEE_INVITES_ENABLED=dry`, sheet writes off, Playwright headless at 1280 and 390 px. Each flow follows `docs/ship/test-guide.md` in order. Screenshots and the scripts that took them are in `docs/ship/walkthrough/` (`NN-side-flow-step.png`; `-390` = phone width).

Two readers throughout: a **UX specialist** and a **5-year-old**, who reads only big text, skips small grey text, knows no jargon and presses the most button-looking thing. Hand-offs were read from a fresh browser on the receiving side.

Privacy: phones that aren't fake 555 numbers are covered with a grey block. A few board shots (`09-organizer-board*.png` from before 10:20) also have a grey block over the room grid. That came from an early, too-broad mask, and the later board shots show the grid. The full organizer Sponsors tab lists real organizer names, so it's kept out of the repo.

Tracks A and F are merged on this branch, so every flow marked "needs A/F" in the guide ran here.

---

## Sponsor side

### Sponsor · First visit and Help · Step 1 · Portal home
- What to do: unclear. The page has no main task. The biggest blue thing is the welcome banner, which has no button, and the main job (coffee chat preferences, due Friday) isn't mentioned.
- What's happening: clear. "Welcome, Test Sponsor!"
- 5-year-old says: "It says welcome. I press the big blue Map button."
- UX feedback:
  - The banner says "…and pick your top projects", and the grey line right under it says "No prize track: you're not judging this weekend." They contradict each other.
  - Event details says "Your Hack Western contact: Hack Western Organizer Team · On-site support", but Help says "Your contact hasn't been assigned yet." Same question, two answers.
  - The footer says "Reach out to your HW contact." "HW" is jargon.
  - The tour doesn't start by itself. It's a small "New here?" card in the bottom-right corner, over the Sponsor Bay map.
- Fix: add a "What to do now" card under the banner that links to Chats ("Tell us when your reps can chat · due Fri 5 PM"). Hide "pick your top projects" when there's no prize track. Show the same lead name (or the same "not assigned yet") in Event details and in Help.
- Plain wording:
  - "Use this portal to check your booth and judging details and pick your top projects." → "Use this portal to set up coffee chats, find your booth and, if you have a prize track, judge projects."
  - "Reach out to your HW contact." → "Text or call your Hack Western contact."
- Screens: `01-sponsor-firstvisit-home.png`, `01-sponsor-firstvisit-home-390*.png`
- **Fixed:** a "What to do now" card sits under the banner. Before preferences are submitted it's the filled, full-width "Tell us when your reps can chat · Required · at the Friday 5 PM workshop" link to Chats; after, it's a white "Your coffee chats" link. The banner reads "…set up coffee chats, find your booth and, if you have a prize track, judge projects.", so it no longer contradicts "No prize track". The footer reads "Need help during the hackathon? Text or call your Hack Western contact." The contact is fixed under B11. Still as before: the tour starts from the "New here?" card, not by itself. (`after/portal-01-home*.png`, `after/portal-01-home-not-submitted*.png`)

### Sponsor · First visit and Help · Step 2 · Welcome tour (8 steps)
- What to do: clear. Big "Next" button, "Step N of 8".
- What's happening: clear. Each step highlights the thing it describes.
- 5-year-old says: "I press Next until it says Done."
- UX feedback: step 2 describes the new Help correctly (as the guide expects). Step 4 "Coffee chats: Your booked chats and the hackers who want to meet you" doesn't say that setting up chats is required.
- Fix: rewrite step 4.
- Plain wording:
  - "Your booked chats and the hackers who want to meet you." → "Tell us when your reps can chat (required), then see your chats here."
- Screens: `01-sponsor-firstvisit-tour-01..08.png` (and `-390`)
- **Fixed:** step 4 reads "Tell us when your reps can chat (required), then see your chats here." Step 3 no longer promises a chat offer: "Scan their badge to add them to your list. We invite them to a coffee chat first." The "How to" coffee chat guide was still the old per-slot flow (pick a time, Candidates tab, targets that no longer exist); it's now "Coffee chats": set up on Chats, scan, point at the badge, Add to my list.

### Sponsor · First visit and Help · Step 3 · Need help? dialog
- What to do: clear.
- What's happening: clear. Lead first, then Noah as the emergency contact, each with a phone and a copy icon. Nothing is sent. Matches the guide. The no-lead case shows "Your contact hasn't been assigned yet."
- 5-year-old says: "I call the person it says."
- UX feedback: Escape closes the dialog, but focus goes back to the page body, not to the "Need help?" button.
- Fix: return focus to the button that opened the dialog.
- Screens: `01-sponsor-firstvisit-help.png`, `01-sponsor-firstvisit-help-390.png`
- **Fixed:** Help remembers the button that opened it, and Escape or Close puts focus back on it.

### Sponsor · Your team · Step 1 · Chats home, Not started
- What to do: unclear. "Add a hacker" is the first and boldest button, but the required job is "Start" on the Chatting preferences card further down.
- What's happening: clear. "Not started. You need to: add your team and give us your chatting preferences."
- 5-year-old says: "I press Add a hacker."
- UX feedback: the optional scan button sits above the required task. "Two separate jobs…" is a long grey line that nobody will read.
- Fix: while preferences aren't submitted, make "Start" the only filled button, and turn "Add a hacker" into an outline button under the cards.
- Plain wording:
  - "Two separate jobs: tell us when your reps can chat (required), then shortlist hackers you'd like to meet (optional)." → "First, tell us when your reps can chat. Then, if you like, pick hackers to meet."
- Screens: `02-sponsor-team-chats-home.png`
- **Fixed:** before submit, the preferences card comes first and its "Start"/"Continue" is the only filled button; the shortlist card follows (locked), and "Add a hacker" is an outline button under the cards. After submit the status card leads, then the shortlist, then preferences. The intro reads "First, tell us when your reps can chat. Then, if you like, pick hackers to meet." (`after/portal-02-chats-home-not-submitted*.png`, `after/portal-02-chats-home-submitted*.png`)

### Sponsor · Your team · Step 2 · Add reps (step 1 of 3)
- Expected: blank Save gives an error, a short phone gives "That phone number looks too short.", "<name> added.", the first rep gets the crown. **Happened:** all as expected.
- What to do: clear. Name, Phone, "Save rep".
- What's happening: unclear. The status card above changes to "Draft saved, not submitted · You need to: review and submit your chatting preferences" after one rep, while you're still on step 1 of 3.
- 5-year-old says: "I type a name and a phone and press Save rep."
- UX feedback:
  - With one field empty, only the first error shows ("Add their name."). The phone error appears only after the next press.
  - "Since you were last here: You saved changes" describes what you did ten seconds ago in this same visit.
  - At 390 the rep name wraps mid-word ("Walkthr / ough Dana") because Primary, Edit and Remove take the row.
  - The page has two `<main>` landmarks (site wrapper and `#sponsor-main`).
- Fix: show both field errors at once. While the user is still in the setup steps, have the status card say "Step 1 of 3: add your team". Put the rep's actions on their own line at phone width. Drop the outer `<main>`.
- **Fixed ("Since you were last here"):** the sponsor's own saves and submits are never listed under "Since you were last here", only as "Last change".
- **Fixed (the rest):** a blank Save shows both "Add their name." and "Add a phone number we can call or text." at once, each field marked invalid. Until preferences are submitted, the status card on a preferences step reads "Step 1 of 3: add your team" (then "say when they're free", "review and submit") with no "You need to" line. The portal shell's content area is now a `div` with the same `#sponsor-main` id, so the page has one `main` landmark (the app root's). (`after/portal-07-team-both-errors*.png`)
- Plain wording:
  - "Next: Chatting preferences" (button) → "Next: When they're free"
- Screens: `02-sponsor-team-step1-empty.png`, `02-sponsor-team-blank-save.png`, `02-sponsor-team-short-phone.png`, `02-sponsor-team-added-first.png`, `02-sponsor-team-two-reps-dana-primary-390.png`
- **Fixed (wording, phone row):** the button reads "Next: When they're free". At 390 the crown, Edit and Remove sit on their own line under the name, so "Walkthrough Dana" no longer breaks mid-word. (`after/portal-02-team-390.png`)

### Sponsor · Your team · Step 3 · Move the crown, edit, remove
- Expected: "Walkthrough Kevin is now the primary contact.", edit saves, removing the primary passes the crown on. **Happened:** all as expected.
- What to do: unclear for the crown. On a non-primary rep it's an empty outline icon with no label (only "Make … the primary contact" for screen readers).
- What's happening: clear. The message appears above the list.
- 5-year-old says: "I don't know what the little crown box does."
- UX feedback: "Remove" deletes at once, with no confirm and no undo. Before Send that's harmless, but the button is right next to "Edit".
- Fix: label the empty crown "Make main contact" (text or tooltip). Add an "Undo" link to the "<name> removed." message.
- Plain wording:
  - "Primary" (badge) → "Main contact"
  - "The crown marks your primary contact. Organizers use their name and phone…" → "The crown marks your main contact. Organizers call this person."
- Screens: `02-sponsor-team-crown-moved.png`, `02-sponsor-team-edit-open.png`, `02-sponsor-team-remove-confirm.png`, `02-sponsor-team-after-remove.png`
- **Fixed (crown and wording):** the crown button says "Main contact" on the main contact and "Make main contact" on everyone else. "Main contact" replaces "Primary" / "primary contact" everywhere on the sponsor side (badge, review, errors, "<name> is now the main contact."). The hint reads "The crown marks your main contact. Organizers call this person…". (`after/portal-02-team*.png`)
- **Fixed (Undo):** before Send, "Walkthrough Kevin removed. Undo" shows above the list; Undo adds the rep back with the same name, phone, free sessions and chats (and the crown, if they had it). After Send there's no Undo: the warning dialog already asked, and their invites were moved or cancelled. (`after/portal-07-team-undo*.png`)

### Sponsor · Chatting preferences · Step 1 · Hackers per chat
- Expected: "Groups of 3 · 30 min · 6 hackers an hour per rep" and an autosave ("Saving…", "Saved."). **Happened:** the summary line is right. **"Saved." never appears**, and "Saving…" flashes for under a second in the footer (bug B6).
- What to do: clear. Five big number buttons.
- What's happening: unclear. There's no sign that the choice was saved.
- 5-year-old says: "I press 3."
- UX feedback: the grey line "Up to 6 people a chat: 1 rep and up to 5 hackers." stays the same whatever you pick and reads like a second rule.
- Fix: show "Saved" next to the footer after each autosave (the copy already exists). Delete the grey line, or change it to fit the pick ("Each chat: 1 rep + 3 hackers").
- Screens: `03-sponsor-prefs-step2.png`, `03-sponsor-prefs-groups-of-3.png`
- **Fixed (grey line):** it now follows the pick: "Each chat: 1 rep + 3 hackers".
- **Fixed (B6):** the footer shows "Saving…", then "Saved." once the autosave lands, until the next edit. The footer note is now a live region, so both are read out. (`after/portal-03-prefs-saved*.png`)

### Sponsor · Chatting preferences · Step 2 · When is each rep free (grid)
- Expected: every session ticked for new reps, the workshop hatched and not tickable, edge messages. **Happened:** as expected. Sun Life shows "Your workshop 2:30–3:30" hatched (the live run of show now says 2:30, so the guide's "1:00–1:30 only" example doesn't show up today). "…isn't free any time Saturday." and "…is free for 1 hour, so up to 2 chats." both show. Changes survived a reload.
- What to do: clear.
- What's happening: clear, apart from the legend.
- 5-year-old says: "I click the boxes to take ticks off."
- UX feedback:
  - Session headers ("10–11", "1–2") have no AM/PM.
  - The legend "Your workshop · Buffer · travel time" is tiny, and it lists buffer and travel time even when neither is on the grid.
  - At 390 (and in Sun Life's wide workshop columns) the 3–4 and 4–5 columns are off to the right, with no sign that the grid scrolls.
  - A rep at 0 chats still shows a fully ticked row and "6 of 6 sessions".
- Fix: header "10–11 AM" … "4–5 PM". Show a legend item only when it appears on the grid. Add a right-edge fade on the grid to hint that it scrolls. Grey out the row of a rep at 0 chats.
- Plain wording:
  - "Your day" (row label) → "Your events"
- Screens: `03-sponsor-prefs-sunlife-workshop.png`, `03-sponsor-prefs-sunlife-workshop-390-b.png`, `03-sponsor-prefs-dana-not-free.png`, `03-sponsor-prefs-too-many-chats.png`, `03-sponsor-prefs-after-reload.png`
- **Fixed (headers, row label, scroll):** headers read "10–11 AM" … "4–5 PM", the row label is "Your events", and when the grid is wider than its box a "Scroll for later times →" line and a right-edge fade show (390 px; 1280 now fits). (`after/portal-03-prefs-grid*.png`)
- **Fixed (legend, 0 chats):** the legend shows only when the grid has a hatched cell, as one readable item: "Your workshop, with 15 minutes' travel time either side". A rep at 0 chats has their row greyed with "Doesn't chat" in place of "6 of 6 sessions". (`after/portal-07-prefs-zero-chats*.png`)

### Sponsor · Chatting preferences · Step 3 · How many chats
- Expected: 4 chats each to start, 0 gives "Doesn't chat", totals "Up to N chats · up to M hackers". **Happened:** as expected.
- What to do: clear. Minus and plus buttons.
- What's happening: clear.
- 5-year-old says: "I press plus or minus."
- UX feedback: a rep free for no sessions still shows "4 chats · 2 h" next to the red "isn't free any time" message.
- Fix: when a rep has no free time, show "No free time" in place of the chats-and-hours label.
- Plain wording: "Need something different? Contact organizers" → "Something doesn't fit? Ask an organizer". It opens Help, as the guide expects.
- **Fixed (wording):** "Something doesn't fit? Ask an organizer", still opening Help.
- **Fixed (no free time):** a rep with chats but no free session shows "No free time" (in the warning colour) in place of "4 chats · 2 h". (`after/portal-07-prefs-zero-chats*.png`)

### Sponsor · Review & submit · Step 1 · Review (step 3 of 3)
- Expected: "Everything checks out.", "Groups of 3 · 30 min · up to 6 chats · up to 18 hackers", "Organizers call <name> at <phone>." **Happened:** as expected.
- What to do: clear. "Submit preferences" is the only filled button.
- What's happening: clear.
- 5-year-old says: "I press Submit."
- UX feedback: the read-only grid uses the same filled checkboxes as the editable one, so it looks clickable. "Organizers call … at …" is small grey text but it's the key fact.
- Fix: show the review grid as plain ticks (no box). Make the call line normal body text.
- Screens: `04-sponsor-review-step3.png`, `04-sponsor-review-390*.png`
- **Fixed:** the read-only grid shows plain ticks with no box, and "Organizers call <name> at <phone>." is bold body text. (`after/portal-07-review*.png`)

### Sponsor · Review & submit · Step 2 · Submitted
- Expected: "Preferences submitted", status card "Submitted, waiting for organizers to schedule", Shortlist unlocks. **Happened:** as expected.
- What to do: clear. "Next: Shortlist hackers".
- What's happening: clear.
- 5-year-old says: "It says submitted. I'm done."
- UX feedback: the status card line "Next: organizers confirm chat times Friday evening, then invite hackers." is good. Nothing to fix.
- Clear, no changes.
- Screens: `04-sponsor-review-submitted.png`, `04-sponsor-chats-home-submitted.png`

### Sponsor · Scan a hacker · Step 1 · Look up a hacker
- Expected: a non-hacker code gives "That isn't a Hack Western hacker's badge." **Happened:** "Not a hacker badge. That code isn't a Hack Western hacker's badge. Try scanning again." Close enough.
- What to do: clear on a laptop ("Type their hacker code"). The "No camera found" message shows twice (as a banner and as a heading).
- What's happening: clear.
- 5-year-old says: "I type the three words and press Look up."
- Fix: show "No camera found" once.
- Screens: `05-sponsor-scan-open.png`, `05-sponsor-scan-not-a-hacker.png`
- **Fixed:** the heading says "No camera found" once; the box under it says only what to do, and the live region no longer repeats the title. (`after/portal-05-scan-open.png`)

### Sponsor · Scan a hacker · Step 2 · Hacker card and rep picker
- Expected: "Which rep wants to talk to them?" plus "Add to Met at Hacker Fair". **Happened:** shown, **but the card also says "15-minute chat" and "No open times"**, from the old per-slot model. Test Sponsor runs 30-minute groups (bug B1).
- What to do: unclear. "Add to Met at Hacker Fair" and "Scan next" are both full-width blue buttons, and "Scan next" is darker. Pressing it moves on without adding the hacker.
- What's happening: unclear. "Offer a coffee chat" and "No open times" suggest you're booking a time, which you aren't.
- 5-year-old says: "I press the big dark Scan next button." (The hacker is lost.)
- UX feedback: rescanning Alex shows the same "add" card, with no "Already on your list (added 10:12)".
- Fix: remove the chat length and the open-times line from this card. Make "Add to list" the only filled button and "Scan next" a text link. On a repeat scan, show "Already on your list" and let them change the rep.
- Plain wording:
  - "Offer a coffee chat" → "Met at your booth"
  - "Add to Met at Hacker Fair" → "Add to my list"
  - "Met at Hacker Fair" (everywhere) → "Met at your booth"
- Screens: `05-sponsor-scan-found.png`, `05-sponsor-scan-found-390.png`, `05-sponsor-scan-again.png`
- **Fixed:** the card does one job ("Met at your booth" · "You met Alex"), with an optional "Who talked to them?" and "Add to my list" as the only filled button (a picked rep is tinted, not filled). The time offer, chat length, room and "No open times" are gone. "Not now" is a text button; "Scan next" appears only after the add. A repeat scan shows "Already on your list · added Thu 10:12 AM · talked to Walkthrough Kevin" and the button reads "Save". (`after/portal-05-scan-found*.png`, `after/portal-05-scan-again*.png`)

### Sponsor · Scan a hacker · Step 3 · Added
- Expected: "Alex is on your Met at Hacker Fair list. We'll invite them first." and the Chats home count. **Happened:** as expected ("2 people you scanned" after two scans). A second scan kept the first time and cleared the rep (DB checked).
- What to do: clear.
- What's happening: clear.
- 5-year-old says: "It says Alex is on my list."
- Clear, no changes (apart from the wording above).
- Screens: `05-sponsor-scan-added.png`, `05-sponsor-scan-chats-home-390.png`
- **Fixed (wording):** "Alex is on your list. We'll invite them first." as the card's heading, with a text "Scan next" under it. (`after/portal-05-scan-added*.png`)

### Sponsor · Shortlist · Step 1 · Shortlist hackers
- Expected: scanned hackers first and read-only; "N seats · M taken by people you scanned · shortlist up to N−M". **Happened:** "18 seats · 2 taken by people you scanned · shortlist up to 16". As expected.
- What to do: clear. Big Skip and Shortlist buttons.
- What's happening: clear.
- 5-year-old says: "I press Shortlist on people I like."
- UX feedback: the 3-step box puts "Scan hackers at your booth Friday night" in the middle of the shortlist steps. "People you scanned · First choice": "First choice" is vague. The "<name> shortlisted." message stays up after you leave for the next step.
- Fix: take the scan line out of the steps box. Clear the message when the step changes.
- Plain wording:
  - "People you scanned · First choice" → "People you met · invited first"
- Screens: `06-sponsor-shortlist-open.png`, `06-sponsor-shortlist-one-at-a-time.png`, `06-sponsor-shortlist-list.png`
- **Fixed (wording, steps box):** the block is "People you met · invited first", each row "Met at your booth · Talked to <rep>", and the cap line "N seats · M taken by people you met · shortlist up to K". The scan line is out of the steps box (two steps now).
- **Fixed (message):** the "<name> shortlisted." announcement is cleared when the step changes.

### Sponsor · Shortlist · Step 2 · Review, submit, edit
- Expected: "Shortlist submitted", Edit reopens. **Happened:** as expected.
- What to do: clear.
- What's happening: unclear after Edit. "Edit shortlist" quietly un-submits the shortlist. If the sponsor leaves without resubmitting, the home card no longer says "Submitted".
- 5-year-old says: "I press Submit shortlist."
- UX feedback: in the submitted view, the Remove buttons look half-disabled next to the line "Tap Edit shortlist to change it."
- Fix: say it up front: "Editing un-submits your shortlist until you submit again." Hide the Remove buttons while it's submitted.
- Screens: `06-sponsor-shortlist-review.png`, `06-sponsor-shortlist-submitted.png`, `06-sponsor-shortlist-submitted-390.png`
- **Fixed:** the submitted banner says it up front: "Your shortlist is submitted. Editing un-submits it until you submit again." The Remove and Shortlist buttons are hidden while it's submitted. (`after/portal-07-shortlist-submitted*.png`)

### Sponsor · Shortlist · Step 3 · Over the cap (edge)
- Expected: "Your shortlist has 5 people but you now have 3 seats. Remove 2." **Happened:** "3 of 1 shortlisted", "Your shortlist has 3 people but you now have 1 seat. Remove 2." **and** "All 1 seats are shortlisted…" at the same time. The home card reads "3 of 1 seats" (bug B5).
- What to do: clear ("Remove 2").
- What's happening: unclear. There are 3 seats and 1 shortlist place, but the text calls the 1 a "seat".
- 5-year-old says: "3 of 1? That's broken."
- Fix: when over the cap, show only the over-cap line, and say "shortlist place" rather than "seat".
- Plain wording:
  - "Your shortlist has 3 people but you now have 1 seat." → "You now have room for 1 on your shortlist. Remove 2."
  - "All 1 seats are shortlisted." → "Your shortlist is full."
- Screens: `06-sponsor-shortlist-over-cap.png`, `06-sponsor-shortlist-over-cap-home.png`
- **Fixed:** over the cap, the big line is only "You now have room for 1 on your shortlist. Remove 2." ("…no room… Remove 3." at 0); "3 of 1" and "Your shortlist is full" no longer show with it. The home card reads "3 shortlisted, room for 1. Remove 2." even after a submit. At the cap: "Your shortlist is full. Remove someone to add another." (`after/portal-06-shortlist-over-cap*.png`, with the shortlist answer patched in the browser, so the shared DB wasn't changed)

### Sponsor · Your chats · Step 1 · Chats home after Send
- Expected: preferences card "Confirmed"; status "Scheduled, invites going out", then "Scheduled, 1 of N seats accepted"; calendar with rooms, format, count and first names marked Invited or Confirmed. **Happened:** as expected ("Scheduled, 1 of 18 seats accepted", "Alex · Confirmed").
- What to do: clear ("Nothing to do. Your chats are below.").
- What's happening: clear in the title. Unclear in "Last change", which always says "Organizers scheduled your chats", even after a hacker accepts or a chat moves.
- 5-year-old says: "It has a green tick. My chats are… somewhere down there."
- UX feedback: "Your chats", the thing they came for, is the last section, under two setup cards and "Add a hacker". At 1280 the calendar shows only 10–11 to 2–3. The 3–4 and 4–5 columns sit behind a sideways scroll with no cue. With several hackers per hour, the names stack into a tall narrow cell.
- Fix: once Sent, put "Your chats" first and shrink the setup cards into one line of links. Default to List at phone width. Fade the calendar's right edge.
- Screens: `14-sponsor-yourchats-after-send.png`, `14-sponsor-yourchats-list.png`, `14-sponsor-yourchats-filter-kevin.png`, `20-sponsor-yourchats-after-answers.png`
- **Fixed (order and columns):** after Send, "Your chats" comes right after the status card, and the setup cards fold into one "Your setup" list: "Change your team or times", "Shortlist" and "Add a hacker". The calendar now has sessions down the side and reps across, so all six sessions show at 1280 and at 390 with two reps (no sideways scroll); a wider team scrolls with a "Scroll for later times →" line and a fade on the right edge. Session labels have AM/PM. The selected rep filter is tinted, not filled. "Last change" is covered in the status-card fix below. (`after/portal-02-chats-home-sent*.png`)
- **Fixed (status card):** after Send the card adds live counts ("Invites: 1 accepted · 8 waiting · 9 open"), and "Last change" lists only what organizers did: "Organizers confirmed your chats · Thu 10:28 AM" (every Send or re-send) and "Organizers moved Walkthrough Dana's 1:00 chat to 3:00, Rm 1348" (or "…removed…") when a sent chat's session or room changed. Moves are worked out on the device by comparing the sent chats it saw last time (no move history in the DB, no schema change), so they show without a time. "Next" now says "hackers answer their invites by Sat 10 AM" until round 1 closes. (`after/portal-14-status-card*.png`)

### Sponsor · Your chats · Step 2 · List and rep filter
- Expected: List and Calendar switch, and filtering by rep works. **Happened:** as expected.
- Clear, no changes.

### Sponsor · Change after invites · Step 1 · Warning dialog
- Expected: "Invites are already out" and "Changing this will ask N hackers…" (N = pending plus accepted). **Happened:** shown with N = 9 (every invite the sponsor has). The edit (unticking Dana's 1–2) touched one chat with 3 hackers.
- What to do: clear. "Change anyway" and "Keep it as is".
- What's happening: unclear. The dialog says the change **will ask 9 hackers** to confirm again. After "Change anyway", nobody was re-asked (DB: all 9 still pending, answer-by times unchanged). The status card then says "Organizers will check it and ask affected hackers to confirm again." Three different stories (bug B4).
- 5-year-old says: "Uh oh, 9 people. I press Keep it as is."
- Fix: count only the hackers in chats this edit touches, and say who acts next. If the edit only makes a chat invalid (the chat stays until organizers move it): "Dana's 1–2 chat has 3 invited hackers. Organizers will move it and tell them."
- Screens: `15-sponsor-change-dialog.png`
- **Fixed:** the dialog counts only invites in the chats this edit changes (an unticked session, chats that shrink, a new group size, or a removed rep's chats) and uses the one shared sentence: "This affects 3 invited hackers. They'll be told and asked to confirm again." An edit that touches no sent chat says "This doesn't affect any invited hackers." (`after/portal-15-change-dialog*.png`)

### Sponsor · Change after invites · Step 2 · Keep / Change anyway
- Expected: Keep changes nothing. Change saves and doesn't ask again on that screen. The status card adds "You changed your setup after invites went out…". **Happened:** as expected.
- What's happening: clear.
- Clear, no changes (beyond B4).
- Screens: `15-sponsor-change-saved.png`
- **Fixed (B4):** the status card now uses the dialog's sentence: "You changed your setup after invites went out. This affects N invited hackers. They'll be told and asked to confirm again.", where N is the invites in sent chats the new setup no longer fits.

### Sponsor · Judging · Step 1 · Who's judging?
- Expected: pick a name or "Someone else". **Happened:** as expected. Picking a name goes straight in. "Start judging" is only for "Someone else".
- What to do: clear.
- What's happening: clear ("This phone remembers your name.").
- 5-year-old says: "I press my name."
- UX feedback: Sun Life's side nav shows "Judging · Sun 9 AM" with a lock, yet the page opens fine from the link.
- Fix: either open the page from the nav, or show a "Opens Sun 9 AM" screen. Don't do one in the nav and the other on the page.
- Screens: `21-sponsor-judging-whos-judging.png`, `21-sponsor-judging-whos-judging-390*.png`
- **Fixed:** the page follows the nav. Before Sunday 9:00 AM `/picks` shows "Judging opens Sunday 9:00 AM", the debrief note and "Back to Home"; `?preview=judging` (which the nav keeps) still opens it for testing. The judging components weren't changed. (`after/portal-07-judging-locked*.png`)

### Sponsor · Judging · Step 2 · Score, rubric, second rep, list
- Expected: 1–10 strip in half points, dimmed until touched; "Dana 9.5 · Kevin 6", the average, an amber flag; split "Your N / Everyone's N". **Happened:** all as expected ("avg 7.8", "Dana 9.5 · Kevin 6: talk it through", "Your 5 / Everyone's 14").
- What to do: clear.
- What's happening: clear.
- 5-year-old says: "I press plus to make the number bigger."
- Clear, no changes.
- Screens: `21-sponsor-judging-one-at-a-time.png`, `21-sponsor-judging-scored.png`, `21-sponsor-judging-rubric.png`, `21-sponsor-judging-two-reps.png`, `21-sponsor-judging-list.png`

### Sponsor · Judging · Step 3 · Send shortlist
- Expected: the shortlist sends. **Happened:** "Sent 10:32 AM · 2 teams". The button becomes "Send again" after more saves.
- What to do: clear.
- What's happening: clear.
- Clear, no changes.
- Screens: `21-sponsor-judging-shortlist.png`, `21-sponsor-judging-shortlist-sent.png`

### Sponsor · Judging · Step 4 · Round 2 top 3: **not run**
- Schedule presentations placed 0 teams ("Sponsor has no room"). Sun Life has no judging room on the live Sponsor Day-Of sheet, so "Open round 2" stays disabled. Sheet writes are off, so I couldn't add one.

---

## Organizer side

### Organizer · Happening now · Step 1 · Needs attention and Now and next
- Expected: unsubmitted, unscheduled and changed items, grouped; Now and next with owner. **Happened:** as expected ("Canada Life sent preferences but only 0 of 2 reps are scheduled", "Commure hasn't sent coffee chat preferences", "Your sponsors / Other sponsors" for a lead). **But** once a PCBWay DB row existed, it appeared as "PCBWay hasn't sent coffee chat preferences" (bug B2).
- What to do: clear. Each row has "Open coffee chats".
- What's happening: clear.
- 5-year-old says: "Lots of yellow warning signs. I press Open coffee chats."
- UX feedback: "Event now: Hack Western starts Fri 4:00 PM" is a future event labelled "now". The whole Now and next table is a live region, so screen readers re-read it on every refresh.
- Fix: when nothing is on, show "Nothing on now · Next: …". Make only the changing sentence live, or none of it.
- Plain wording:
  - "Canada Life sent preferences but only 0 of 2 reps are scheduled" → "Canada Life: 0 of 2 reps scheduled"
  - "Event now" (when nothing is on) → "Up next"
- Screens: `07-organizer-happening-now.png`, `22-organizer-judging-no-room.png` (PCBWay row)
- **Fixed** (Step 5): PCBWay is gone from Needs attention (B2). The row reads "Canada Life: 0 of 2 reps scheduled". Before the event the first row is "Up next". The table is no longer a live region. After: `after/o5-happening-now.png`.

### Organizer · Happening now · Step 2 · Follow a link
- Expected: the board opens on that sponsor. **Happened:** the URL changed to `?tab=coffee&sponsor=…`, but the view stayed at the top of the page with focus still on the link. The board is off-screen.
- What's happening: unclear.
- 5-year-old says: "I pressed it and nothing happened."
- Fix: scroll to the sponsor's row, open it, and move focus there.
- Screens: `07-organizer-happening-now-link.png`
- **Fixed** (Step 5): the link opens the board scrolled to that sponsor's row, opened, with focus on it. It happens once per link, so the 15 s refresh doesn't jump. After: `after/o7-open-coffee-chats.png`, `-390`.

### Organizer · My sponsors · Step 1 · Lead view
- Expected: "You lead N sponsors", People with the crown, logistics pills, Coffee chats rows. **Happened:** as expected for a local user with Noah's login email ("You lead 3 sponsors"). The test organizer sees All sponsors only.
- What to do: clear.
- What's happening: clear.
- 5-year-old says: "I see my sponsors' people and phones."
- UX feedback: the crown has no label (the guide says "Main contact"). "Coffee chat workshop: Not attended" is jargon to anyone who missed the briefing. "Their workshop: Sat 1:00 PM · 2230 (50)": the "(50)" isn't explained.
- Fix: put "Main contact" text next to the crown. Rename the row. Drop "(50)" or write "50 seats".
- Plain wording:
  - "Coffee chat workshop" → "Came to the Friday coffee chat briefing"
- Screens: `08-organizer-mysponsors-lead.png`
- **Fixed** (Step 5): the crown always has "Main contact" beside it (My sponsors and the board). The row reads "Came to the Friday coffee chat briefing". "2230 (50)" reads "2230 · 50 seats". Re-walked as Noah; screenshots kept private (real organizer names).

### Organizer · My sponsors · Step 2 · Copy a phone
- Expected: "Copied". **Happened:** the label flips to "Copied (519) 555-0104", and the clipboard holds the number. As expected.
- Clear, no changes.

### Organizer · My sponsors · Step 3 · Arrival / Booth / CC workshop pills
- Expected: the pill saves and notes "Not written (sheet writes off)". **Happened:** the pill flicks forward, then **snaps back to "Not arrived" with no message**. The server returns the note, but the client never shows it (bug B7). With writes on (production) the sheet would update. Locally it looks broken.
- What's happening: unclear.
- 5-year-old says: "I pressed it and it didn't change."
- Fix: show the server's `note` in the tab's note area after a status or CC-workshop save.
- Screens: `08-organizer-mysponsors-arrival.png`, `08-organizer-mysponsors-cc-workshop.png`
- **Fixed** (Step 5, B7): after the save, the note area says "Canada Life: Not written (sheet writes off)", from the router's `sheetWritten: false`. Same for the briefing pill. Re-walked as Noah; screenshot private.

### Organizer · My sponsors · Step 4 · All sponsors
- Expected: `?list=all`. **Happened:** as expected. Clear, no changes.

### Organizer · Read the coffee board · Step 1 · Summary card
- Expected: "N sponsors submitted. Run Auto-schedule, then Noah sends… 1 sponsor still hasn't submitted." **Happened:** "6 sponsors submitted…" plus "Test Sponsor submitted · 10:09 AM". As expected.
- What to do: clear. The sentence names the next action.
- What's happening: clear.
- 5-year-old says: "It says press Auto-schedule."
- UX feedback: "Auto-schedule" is in the sticky bar at the bottom, not near the sentence that tells you to press it.
- Fix: put an "Auto-schedule" button inside the summary card while nothing is scheduled.
- Screens: `09-organizer-board.png`, `09-organizer-board-390*.png`
- **Fixed** (Step 5): the summary card has its own "Auto-schedule" button while sponsors have submitted and nothing is placed. Not re-walked in the browser: the shared DB is already scheduled and sent, and clearing it would break the sponsor-side walk.

### Organizer · Read the coffee board · Step 2 · Sponsor rows
- Expected: "Not submitted" / "Submitted, needs scheduling" chips, "0 of 3 reps placed", "Asked for 4 chats · 2 h" plus a phone. **Happened:** as expected.
- What to do: clear.
- What's happening: unclear for some sponsors. Most rows show only the sponsor's logo, and Canada Life's is about 20 px wide and unreadable.
- 5-year-old says: "Which one is Canada Life?"
- Fix: always show the sponsor name in text next to the logo.
- Screens: `09-organizer-board-row-open.png`
- **Fixed** (Step 5): every row shows the name beside the logo. The chip is the stage ("Not submitted", "Needs scheduling", "Scheduled, not sent", "Sent"), with problems as a separate flag ("1 rep not placed", "1 chat needs a fix", "Changed after invites"). After: `after/o8-board-rows.png`, `-390`, `after/o1-board-chips.png`.

### Organizer · Read the coffee board · Step 3 · Copy a phone
- Expected: the copy icon flips to "Copied". **Happened:** as expected. Clear, no changes.

### Organizer · Read the coffee board · Step 4 · Help
- What to do: clear.
- What's happening: clear, but long.
- UX feedback: Help says "Sun Life sets up at 2:00, so its 1–2 runs 1:00–1:30". Today's run of show has Sun Life at 2:30, so the example is out of date (bug B10).
- Fix: drop the fixed example, or describe the rule without a sponsor's name.
- Screens: `09-organizer-board-help.png`
- **Fixed** (Step 5, B10): the rule reads "a workshop with setup at 2:00 leaves 1:00–1:30 of its 1–2 for 30-minute chats", with no sponsor named. Help also says a sponsor's "Confirmed" means the organizer's "Sent", and lists the back-to-back building rule. After: `after/o5-board-help.png`.

### Organizer · Schedule and fix · Step 1 · Auto-schedule
- Expected: "Placed N chats.", chips "Scheduled (draft)", Scotiabank's Ivey fix. **Happened:** "Placed 22 chats." (a toast at the bottom). The Scotiabank fix reads "put all 3 reps in Ivey (1352, 1354, 1356) at 1–2 so they stay together." As expected.
- What to do: clear.
- What's happening: clear.
- 5-year-old says: "Boxes filled in."
- Screens: `09-organizer-board-after-auto.png`, `09-organizer-board-rerun-toast.png`

### Organizer · Schedule and fix · Step 2 · Apply a fix
- Expected: Scotiabank goes to Ivey together and its chip changes. **Happened:** as expected. A "Fix applied." toast shows (seen on the later fix).
- Clear, no changes.
- Screens: `09-organizer-board-fix-applied.png`

### Organizer · Schedule and fix · Step 3 · Move a chat
- Expected: the move works and survives a re-run. Taken rooms, the workshop window and busy reps are refused. **Happened:** select chat, press "Move", "Tap an empty cell when Walkthrough Kevin is free.", "Move here" cells, the move works and stays put after a re-run. The refusal messages can't be reached from the board, because invalid cells aren't offered. That's fine.
- What to do: clear once you find "Move". The panel opens below the grid, partly under the sticky Send bar.
- What's happening: clear.
- 5-year-old says: "I press a chat, then Move, then a blue Move here box."
- Fix: open the chat panel next to the clicked cell, or scroll it into view.
- Screens: `09-organizer-board-chat-open.png`, `10-organizer-schedule-move-mode.png`, `10-organizer-schedule-moved.png`
- **Fixed** (Step 5): the panel scrolls into view above the sticky Send bar when a cell is picked. After: `after/o8-chat-panel.png`, `-390`.

### Organizer · Schedule and fix · Step 4 · Remove a chat
- Expected: the chat is removed. **Happened:** removed at once, with no confirm and no toast. The CSE chip went back to "Submitted, needs scheduling".
- What's happening: clear on the grid.
- Fix: add an "Undo" toast. It's cheap insurance before Send.
- **Fixed** (Step 5): "Removed." has an Undo for a draft chat (put back pinned, through a new `placeChat`) and for a booking. A sent chat has no Undo, because its hackers were already told. Re-walked with a booking.

### Organizer · Schedule and fix · Step 5 · Book a room
- Expected: the room is held. **Happened:** a form (Room, Session, "Who it's for", Note, Book). The cell shows "Walkthrough booking" and holds after a re-run.
- Clear, no changes.
- Screens: `10-organizer-schedule-book-form.png`

### Organizer · Schedule and fix · Step 6 · Re-run Auto-schedule
- Expected: moves and fixes stay pinned. **Happened:** they stay. **But** the re-run moved Test Sponsor's Dana from Ivey to Rm 2242 for 1–2 and left her 2–3 chat in Ivey 1348. She's booked back to back in buildings a 15-minute walk apart (bug B8).
- Screens: `10-organizer-schedule-rerun.png`, `14-sponsor-yourchats-after-send.png` (the sponsor's view of it)
- **Fixed** (Step 5, B8): the scheduler keeps a rep's back-to-back chats in one building when a room is free there. When it can't, the rep row and the chat panel say "Walk to Ivey between chats (2–3)" (or "Walk back from Ivey…"). Never blocked. After: `after/o2-walk-note.png`.

### Organizer · Send · Step 1 · Not Noah
- Expected: disabled, "Only Noah sends". **Happened:** as expected. Clear, no changes.
- Screens: `13-organizer-send-not-noah.png`

### Organizer · Send · Step 2 · Noah presses Send
- Expected (wired version): "Sent N chats. Invited M hackers", open seats offered again at Sat 10:30 AM, chips "Sent". **Happened:** "Sent 23 chats. Invited 12 hackers; 142 seats still open, offered again Saturday 10:30 AM." plus "Sheet writes are off here, so the Room Grid tab wasn't updated." Chips went to "Sent". The dry run logged "12 notice(s) not sent".
- What to do: clear.
- What's happening: unclear in two places:
  - There's **no confirm** before the single most consequential button (it messages every invited hacker).
  - In dry mode the toast still says "Invited 12 hackers" with no mention that nothing went out.
- 5-year-old says: "I pressed the big blue button. It says sent."
- UX feedback: Sun Life's chats were sent and its hackers invited, but its chip still says "Submitted, needs scheduling" (one rep unplaced) (bug B3).
- Fix: add a confirm: "Send 23 chats to 6 sponsors and invite their hackers now?" In dry mode, add "(dry run: nothing was messaged)".
- Screens: `13-organizer-send-noah-before.png`, `13-organizer-send-after.png`, `13-organizer-send-board-after.png`
- **Fixed** (Step 5): Send asks once, e.g. "Send 1 sponsor's schedules and invite up to 6 hackers? Hackers get a Slack message now." (Send now / Cancel). Send's result carries `invites.dryRun`, read from `COFFEE_INVITES_ENABLED=dry` on the server, and the toast adds "(dry run: nothing was messaged)". Sun Life's chip reads "Sent" + "1 rep not placed" (B3). Re-walked to the dialog and Cancel; Send wasn't pressed again on the shared DB. After: `after/o6-send-confirm.png`, `-390`.

### Organizer · Send · Step 3 · Re-confirm after a change
- Expected: "Re-confirmed 1 sponsor who changed after invites." and the flag clears. **Happened:** as expected.
- Clear, no changes.
- Screens: `17-organizer-resend-after.png`

### Organizer · Invite status and rounds · Step 1 · Status endpoint
- Expected: seats, filled, accepted and open per chat, plus each invite's status, round and source. **Happened:** as expected (Kevin's 10:00 chat: seats 3, filled 3, accepted 1; sources scanned and shortlist).
- This is a raw JSON endpoint, not a screen, so it's left out of the 5-year-old reading. The board line "Invites: 0 accepted · 9 waiting · 9 open" is the readable version and is clear.

### Organizer · Invite status and rounds · Step 2 · Run a round now
- Expected: only seats not offered this round get an invite. **Happened:** `created: 0` (round 1 seats were already offered). Sam's declined seat waits for round 2. As expected.

### Organizer · Judging tab · Step 1 · Per-rep scores and presentations
- Expected: per-rep scores. **Happened:** counts only ("1 scored · 3 shortlisted · 2 reps scoring"), no per-rep breakdown.
- What's happening: unclear after Schedule presentations failed. The button changed to "**Schedule again**" and the status reads "**Scheduled 10:33 AM · 0 slots**", although nothing was scheduled. The reason, "Sponsor has no room", doesn't say where to fix it (bug B9).
- 5-year-old says: "It says scheduled, so it worked?"
- Fix: on 0 placed, keep the button "Schedule presentations" and show "Nothing scheduled: Sun Life has no judging room on Sponsor Day-Of."
- Screens: `22-organizer-judging-no-room.png`
- **Fixed** (Step 5, B9): with 0 slots the button stays "Schedule presentations", the status reads "Nothing scheduled yet. See why below.", and each team line says "Sun Life has no judging room on Sponsor Day-Of". PCBWay is no longer listed (B2). **Still unclear:** scores are counts only, with no per-rep breakdown; not changed in this run. After: `after/o4-judging-presentations.png`.

### Organizer · Judging tab · Step 2 · PCBWay digital top 3
- Expected: a no-match link shows "…doesn't match a submitted team…" and Save stays off. **Happened:** "No submitted team in this track has that link." and Save stays disabled. As expected.
- Not run: a valid three-team save. The seeded teams' tracks don't include PCBWay's.
- Screens: `22-organizer-judging-digital-nomatch.png`

---

## Hand-offs

### Both · Sponsor submits → organizer finds it · Organizer side, fresh
1. State: "6 sponsors submitted… Run Auto-schedule". Test Sponsor's chip: "Submitted, needs scheduling".
2. What changed and who: "Test Sponsor submitted · 10:09 AM" (the sponsor did it). Clear.
3. Act or wait: act. Run Auto-schedule. Clear.
4. Next: "Noah sends schedules and invites by 10 PM." Clear.
- Expected: as the guide says. Matches.

### Both · Organizer schedules → sponsor sees it · Sponsor side, fresh
- After Auto-schedule (draft): "Submitted, waiting for organizers to schedule". Drafts are hidden. As expected. (`12-handoff-sponsor-after-autoschedule.png`)
- After Send:
  1. State: "Scheduled, invites going out". Clear.
  2. What changed and who: "Organizers scheduled your chats · 10:24 AM". Clear.
  3. Act or wait: "Nothing to do. Your chats are below." Clear.
  4. Next: "hackers answer their invites. If someone can't make it, we invite the next person on your list." Clear, but it gives no time ("by Sat 10 AM").
- After an organizer moved Dana's chat and Noah re-sent: "Last change" still reads "Organizers scheduled your chats · 10:28 AM". It doesn't say **Dana's 1–2 chat moved to 3–4**. Question 2 is unclear. (`18-handoff-sponsor-after-move-resend.png`)
- Fix: write moves into "Last change" ("Organizers moved Dana's chat to 3–4, Rm 1348"). Add "Hackers answer by Sat 10 AM" to Next.
- **Fixed:** "Last change" shows "Organizers confirmed your chats · <time>" for each Send and "Organizers moved <rep>'s 1:00 chat to 3:00, Rm 1348" when a sent chat moved (detected per device, no time shown); "Next" says "by Sat 10 AM". Question 2 is answered. (`after/portal-14-status-card*.png`)

### Both · Sponsor changes after invites → organizer notices · Organizer side, fresh
1. State: the summary says "1 sponsor changed after invites. Check their chats, then Noah sends again." The chip shows "Changed after invites". Clear.
2. What changed and who: "Test Sponsor edited reps or times after Send · 10:27 AM". Clear.
3. Act or wait: act. The fix reads "Walkthrough Dana's pinned chat at 1–2 is at a time Walkthrough Dana isn't free anymore… Suggested: move to 3–4 (Rm 1348) / remove." Clear, apart from "pinned".
4. Next: "Noah sends again." Clear.
- Unclear: the chip also says "Submitted, needs scheduling · 1 of 2 reps placed", although both reps still have chats on the grid.
- Fix: for a sent sponsor with a broken chat, show "Sent · 1 chat needs a fix".
- Plain wording: "pinned chat" → "chat you placed by hand"
- **Fixed** (Step 5): a sent sponsor with a broken chat shows "Sent" + "1 chat needs a fix". The fix text reads "Dana's sent chat at 1–2…" for a sent chat and "…chat you placed by hand at 1–2…" for one an organizer moved or fixed.
- Screens: `16-handoff-organizer-sees-change.png`, `16-handoff-organizer-test-sponsor-row.png`, `17-organizer-fix-applied-sent-chat.png`

### Both · Sponsor asks for help → organizer contact
- The sponsor sees the lead (or "not assigned yet") and Noah. Nothing reaches the dashboard. As expected. The organizer calls back from My sponsors or the board row (phones with copy icons work).
- Gap: the Home page's "Event details" names a different contact than Help (see First visit, Step 1).
- **Fixed (B11):** Home, Help and the tour now name the same lead (or the same "hasn't been assigned yet"), with Noah as the emergency contact on Home and in Help.

### Both · Invites: hacker invited → answers → both sides see it
- Hacker side (`/live`): toast "Test Sponsor wants to chat with you · Sat 10:00 AM, 30 min · View". The Coffee chats tab shows "Needs your answer · Reply by 9:25 AM · 46 h 55 min left" with Accept and Decline. Accepting gives "Accepted. You're chatting with Test Sponsor at 10:00 AM." Declining asks inline ("Decline Sun Life's chat? The time goes to another hacker. Yes, decline / Keep"). Clear on both counts. (`19-hacker-*.png`)
- Sponsor side: "Scheduled, 1 of 18 seats accepted", "Alex · Confirmed". As expected. "Last change" doesn't mention the acceptance (same fix as above).
- **Fixed (by decision):** acceptances show as live counts on the status card ("Invites: 1 accepted · 8 waiting · 9 open") and as names in "Your chats", not as change-log lines.
- Organizer side: "Invites: 0 accepted · 9 waiting · 9 open" before the answers. The status endpoint shows the accept.

---

## Bugs

**B1 · The scan card shows the old chat model ("15-minute chat", "No open times").**
- Steps: Test Sponsor (groups of 3, 30 min, submitted) → Scan → type `demo-otter-kite` → Look up.
- Expected: the hacker's name, the rep picker and "Add to Met at Hacker Fair".
- Actual: also "15-minute chat" and the pill "No open times". Both come from the old per-slot `freeTimes` query and the Coffee Chat Setup sheet, not the session model.
- Where: `src/components/sponsors/badge-scanner.tsx:402` (`freeTimes` query), `:437`, `:515` (`timesHint`); copy `src/content/sponsor-scan.ts:53`, `:61-62`.
- Screen: `05-sponsor-scan-found.png`
- **Fixed:** the card no longer reads `freeTimes` or offers a time; it records the scan only (`HackerStep` in `badge-scanner.tsx`, new read-only `coffeeChatSetup.scanOf` for the "Already on your list" line). The scan page checks the link with `coffeeChatSetup.get`.

**B2 · Digital sponsors (PCBWay) show up in coffee-chat "Needs attention" and in Presentations.**
- Steps: open the judging tab's Digital sponsors and type a link for PCBWay (this creates its DB row), then open Sponsors.
- Expected: PCBWay doesn't use the portal, so no coffee-chat item and no presentations chip.
- Actual: "PCBWay hasn't sent coffee chat preferences", and "PCBWay · Not sent" under Presentations.
- Where: `src/lib/sponsor-organizer.ts:768-806` (`needsAttention` flags every sponsor without preferences); the presentations list has the same gap.
- Screen: `22-organizer-judging-no-room.png`
- **Fixed** (Step 5): digital sponsors (`isDigitalJudging`) are left out of Needs attention, the coffee board, Presentations (overview and scheduling), and My sponsors' coffee chat and presentation rows. Judging (top 3 entry) is unchanged. Test in `sponsor-organizer.test.ts`.

**B3 · The board chip says "Submitted, needs scheduling" for a sponsor whose chats are sent and hackers invited.**
- Steps: Auto-schedule with one Sun Life rep unplaced → Noah sends.
- Expected: the chip shows the chats are out (for example "Sent · 1 rep not placed").
- Actual: "Submitted, needs scheduling · 2 of 3 reps placed". Sun Life's 3 invites already went out.
- Where: `src/server/api/utils/coffee-chat-sessions-board.ts:349-361` (`sent` only when every rep is placed).
- Screen: `13-organizer-send-board-after.png`
- **Fixed** (Step 5): the status is the stage (nothing placed / drafts not sent / all sent), with `broken` and `total - done` shown as a separate flag. Sun Life reads "Sent · 1 rep not placed". After: `after/o1-board-chips.png`.

**B4 · The change-after-invites dialog counts every invite and promises a re-ask that doesn't happen.**
- Steps: sent Test Sponsor → Preferences → untick Dana 1–2 (3 invited) → dialog → Change anyway.
- Expected: N = hackers this change affects. What the dialog says should match what happens.
- Actual: "Changing this will ask 9 hackers to confirm again". All 9 stay pending with unchanged answer-by times. The status card then says "Organizers will check it and ask affected hackers to confirm again."
- Where: copy `src/content/sponsor-coffee-setup.ts:112-116`, `:361-362`, `:106`; the count is passed in by the preferences step.
- Screens: `15-sponsor-change-dialog.png`, `15-sponsor-change-saved.png`
- **Fixed:** the dialog's N comes from `invitesAffected` (`src/lib/coffee-chat-setup.ts`), comparing the saved setup with the edit, per chat. The status card's N comes from `coffeeChatSetup.get` (`seats.changed`). Both use `afterInvitesEffect` in `sponsor-coffee-setup.ts`. The server's refusal without the confirm flag now says "Invites are already out. Confirm the change to save it." with no count.

**B5 · Shortlist over-cap text: "3 of 1 shortlisted", "All 1 seats", "1 seat".**
- Steps: shortlist 3 (with 2 scanned), then lower chats to 3 seats.
- Expected: "…you now have 3 seats. Remove 2." (the guide's pattern).
- Actual: "3 of 1 shortlisted", "Your shortlist has 3 people but you now have 1 seat. Remove 2.", and "All 1 seats are shortlisted…" both show. Home: "3 of 1 seats".
- Where: `src/content/sponsor-coffee-setup.ts:290`, `:373`, `:376`.
- Screens: `06-sponsor-shortlist-over-cap.png`, `06-sponsor-shortlist-over-cap-home.png`
- **Fixed:** `overCap`, `full`, `shortlistFull` and the home card's line say "shortlist", not "seats"; the shortlist step shows the over-cap line in place of the count.

**B6 · Preferences autosave never shows "Saved."**
- Steps: step 2 → change anything → wait.
- Expected: "Saving…", then "Saved." (guide).
- Actual: "Saving…" for a moment, then nothing. `copy.saved` is never rendered.
- Where: `src/components/sponsors/coffee-setup/prefs-step.tsx:330-336`.
- **Fixed:** `prefs-step.tsx` keeps a `saved` flag set after a save with nothing newer waiting, cleared on the next edit; the footer renders `copy.saved`.

**B7 · My sponsors status and CC-workshop pills snap back with no note when sheet writes are off.**
- Steps: My sponsors (as a lead) → tap "Not arrived" or "Not attended".
- Expected: it saves and shows "Not written (sheet writes off)".
- Actual: the pill flicks, then reverts on refetch. The server's `note` is dropped.
- Where: `src/components/sponsors/organizer/sponsors-tab.tsx:427` (`setSponsorStatus` has no `onSuccess` reading `note`) and `:472` (CC workshop); server `src/server/api/routers/sponsor-dashboard.ts:189`, `:230`.
- Screen: `08-organizer-mysponsors-arrival.png`
- **Fixed** (Step 5): both mutations show the server's note ("<Sponsor>: Not written (sheet writes off)") in the note area.

**B8 · Auto-schedule can book one rep back to back in two buildings.**
- Steps: Test Sponsor's Dana free 1–4, 4 chats. Run Auto-schedule, move another chat, re-run.
- Expected: no back-to-back chats a 15-minute walk apart.
- Actual: Dana in Rm 2242 (main building) at 1–2, then Ivey 1348 at 2–3. The sponsor sees both on Your chats.
- Where: the scheduler's building rule covers reps in the same session only (Help: "A sponsor's reps in the same session stay in one building"). This needs a decision: add a same-rep, next-session rule, or accept it.
- **Fixed** (Step 5, per the simplify decision): `pickRoom` prefers the building of the rep's chat right before or after, and never blocks. `buildingSwitches` lists the rest, and the board shows "Walk to Ivey between chats". Tests in `coffee-chat-schedule.test.ts`.
- Screens: `10-organizer-schedule-rerun.png`, `14-sponsor-yourchats-after-send.png`

**B9 · Schedule presentations reports success when it placed nothing.**
- Steps: Sun Life sends a shortlist → organizer presses Schedule presentations.
- Expected: a clear failure.
- Actual: "3 teams couldn't be scheduled… Sponsor has no room", then the button reads "Schedule again" and the status "Scheduled 10:33 AM · 0 slots".
- Where: `src/content/sponsor-presentations.ts:22`, `:34`, `:128`.
- Screen: `22-organizer-judging-no-room.png`
- **Fixed** (Step 5): "scheduled" now means at least one slot. With none, it says "Nothing scheduled yet. See why below." and names where to fix it.

**B10 · The organizer Help sheet's partial-session example is out of date.**
- Help: "Sun Life sets up at 2:00, so its 1–2 runs 1:00–1:30". The live run of show has Sun Life's workshop at 2:30, and the grid doesn't cut 1–2.
- Where: the coffee board help sheet copy (`src/components/sponsors/organizer/coffee-sessions/help-sheet.tsx` and its content).
- Screen: `09-organizer-board-help.png`
- **Fixed** (Step 5): the example names no sponsor.

**B11 · The portal gives two different "Your Hack Western contact" answers.**
- Steps: Test Sponsor (no lead) → Home.
- Expected: one answer.
- Actual: Event details says "Hack Western Organizer Team · On-site support". Help says "Your contact hasn't been assigned yet."
- Screens: `01-sponsor-firstvisit-home.png`, `01-sponsor-firstvisit-help.png`
- **Fixed:** Event details reads the same `useHelpContacts` as Help (the HW lead from Sponsor Day-Of; Noah from HW Contacts), so both say "Your contact hasn't been assigned yet." for Test Sponsor, and the lead's name and phone when there is one. The "Hack Western Organizer Team · On-site support" fallback is gone. (`after/portal-01-home*.png`, `after/portal-01-help*.png`)


### Review fixes after the fix loop

- **Fixed · Own rep removal read as an organizer change.** After the sponsor's own Remove, Edit or preferences save, the page refetches and stores the new chats as seen before showing them (`useRefreshOwn` in `coffee-setup/shared.tsx`), so no "Organizers removed …" note is recorded. `chatChanges` also skips a missing chat whose rep is gone from the team, since only the sponsor removes reps.
- **Fixed · Two definitions of "affected invites".** `coffeeChatSetup.get` counts `seats.changed` with `invitesAffected` (through `invitesOutOfLine`, from what the sent chats imply to the setup now), so the dialog and the status card agree. The shared sentence now reads "This affects N invited hackers. Organizers will update their chats, and the hackers will be told." Known limit: hackers per chat isn't kept from Send, so the card can't count a group-size change after Send; the dialog does.
- **Fixed · A rep rename didn't reach invites.** `updateRep` reconciles invites in the same transaction when the name changes after Send, and delivers the notices after commit. The dialog counts that rep's invited hackers for a rename.
- **Fixed · Judging nav disagreed with the page.** The nav shows Judging locked while the page is locked. A comment on the page says the Sunday 9 AM lock is UI-only by design (the server enforces only the close time).
- **Fixed · Judging lock computed once.** The page reads the lock from `useNow()`, so it unlocks at 9:00 without a reload.
- **Fixed · Malformed stored chats.** `parseSeenChats` (`src/lib/coffee-chat-setup.ts`) drops bad JSON, non-objects and malformed chats or notes.
- **Fixed · Undo after a Send in between.** Undo refetches first and goes through the "Invites are already out" warning when the setup is now sent. The removed rep stays offered until every step succeeds, and a retry doesn't add them twice.

---

## Wording changes (every replacement, one place)

| Where | Current | Replace with |
|---|---|---|
| Portal home banner | "…check your booth and judging details and pick your top projects." | "…set up coffee chats, find your booth and, if you have a prize track, judge projects." |
| Portal home footer | "Reach out to your HW contact." | "Text or call your Hack Western contact." |
| Tour step 4 | "Your booked chats and the hackers who want to meet you." | "Tell us when your reps can chat (required), then see your chats here." |
| Chats home intro | "Two separate jobs: tell us when your reps can chat (required), then shortlist hackers you'd like to meet (optional)." | "First, tell us when your reps can chat. Then, if you like, pick hackers to meet." |
| Team step button | "Next: Chatting preferences" | "Next: When they're free" |
| Team, sponsor and organizer | "Primary" / "primary contact" / unlabelled crown | "Main contact" (same on both sides) |
| Team hint | "The crown marks your primary contact. Organizers use their name and phone…" | "The crown marks your main contact. Organizers call this person." |
| Preferences grid | "Your day" | "Your events" |
| Preferences grid headers | "10–11" … "4–5" | "10–11 AM" … "4–5 PM" |
| Preferences | "Up to 6 people a chat: 1 rep and up to 5 hackers." | delete, or "Each chat: 1 rep + N hackers" |
| Preferences | "Need something different? Contact organizers" | "Something doesn't fit? Ask an organizer" |
| Scan card | "Offer a coffee chat" | "Met at your booth" |
| Scan card button | "Add to Met at Hacker Fair" | "Add to my list" |
| Everywhere (scan, shortlist, organizer) | "Met at Hacker Fair" | "Met at your booth" |
| Shortlist | "People you scanned · First choice" | "People you met · invited first" |
| Shortlist over cap | "Your shortlist has 3 people but you now have 1 seat. Remove 2." | "You now have room for 1 on your shortlist. Remove 2." |
| Shortlist full | "All N seats are shortlisted. Remove someone to add another." | "Your shortlist is full. Remove someone to add another." |
| Change dialog | "Changing this will ask N hackers to confirm again, and some may drop off." | "This affects N invited hackers (in the chats you changed). Organizers will move those chats and tell them." |
| Status card after change | "Organizers will check it and ask affected hackers to confirm again." | keep, and use the same words in the dialog |
| Sponsor "Last change" after a move | "Organizers scheduled your chats" | "Organizers moved <rep>'s chat to <time>, <room>" |
| Needs attention | "<Sponsor> sent preferences but only 0 of 3 reps are scheduled" | "<Sponsor>: 0 of 3 reps scheduled" |
| Now and next | "Event now" (when nothing is on) | "Up next" |
| My sponsors row | "Coffee chat workshop" | "Came to the Friday coffee chat briefing" |
| Board fix | "pinned chat" | "chat you placed by hand" |
| Board chip, sent with a gap | "Submitted, needs scheduling" | "Sent · 1 rep not placed" |
| Send toast, dry mode | "Invited 12 hackers" | "Invited 12 hackers (dry run: nothing was messaged)" |
| Judging, schedule failed | "Schedule again" / "Scheduled 10:33 AM · 0 slots" | "Schedule presentations" / "Nothing scheduled yet" |
| Judging, reason | "Sponsor has no room" | "<Sponsor> has no judging room on Sponsor Day-Of" |
| Scan page | "No camera found" (shown twice) | show once |

Keep "Confirmed" (sponsor) and "Sent" (organizer) as they are, but say once in organizer Help that they mean the same thing.

---

## Top 10 fixes (ranked)

1. **B1:** remove the old "15-minute chat" / "No open times" lines from the scan card. Sponsors see wrong facts at the booth.
2. **B4:** make the change-after-invites dialog count only the affected hackers, and say the same thing the status card says.
3. **B3:** the board chip must show when a sponsor's chats are already sent ("Sent · 1 rep not placed"), not "needs scheduling".
4. **B2:** keep digital sponsors (PCBWay) out of coffee-chat Needs attention and Presentations.
5. **B8:** decide on, then block (or warn about), one rep booked back to back in two buildings.
6. **B5:** fix the over-cap shortlist text ("3 of 1", "All 1 seats").
7. **B11, B6, B7, B9:** one contact answer on the portal; show "Saved." after autosave; show the "Not written" note on pills; don't report "Scheduled · 0 slots" as success.
8. **Blocks a task:** on the scan card, make "Add to my list" the only filled button. Today "Scan next" looks like the main action and silently drops the hacker.
9. **Blocks a task:** on the Chats home, make the required "Start" the main button (not "Add a hacker"). After Send, put "Your chats" first and stop hiding 3–4 and 4–5 behind an unmarked sideways scroll.
10. **What's happening:** add a confirm before Send. Write moves and acceptances into the sponsor's "Last change". Make "Open coffee chats" scroll to the sponsor's row.

---

## Coverage

- 21 flows from the guide (9 sponsor, 7 organizer, 5 hand-offs), 70 steps reviewed. Screens at 1280 for every step, and at 390 for most sponsor screens and the board.
- Not run, or only partly run:
  - Judging round 2 / top 3 (Sun Life has no judging room on the live sheet, and sheet writes are off).
  - A valid PCBWay top-3 save (no seeded team in its track).
  - Two organizers editing at once.
  - DB-down autosave retry.
  - Unreadable run of show or HW Contacts.
  - A Noah login email that's blank on the sheet.

---

## Final walkthrough (Step 6)

Run on 2026-11-19 on `coffee-prefs` at `20d93053`, from a clean start, at 1280 and 390 px. The dev server ran on :3070 with `COFFEE_INVITES_ENABLED=dry` and sheet writes off. Scripts and screenshots are in `walkthrough/final/` and use fake data only. Real phones and organizer names are masked.

**Clean start.** I removed the earlier walkthrough data from the local DB: `walkthrough-%` users, the "Walkthrough booking", the "Walkthrough …" reps, and Test Sponsor's scans, shortlist, placements, invites and preferences. Then I re-ran `coffee-chat-sessions.ts` and `sponsor-picks.ts --teams 15 --yes`. I recreated only fake data: 8 hackers (`walkthrough-hacker-1..8`, "Walkthrough Ada…Hana", example.test emails, 519-555 phones, interested in Test Sponsor and 2 in Sun Life), and the organizer `walkthrough-noah`. Its email was read from HW Contacts at runtime and never printed or written to a file. The walk itself created the reps Walkthrough Dana and Kevin (519-555-0142/3/4) and the "Walkthrough booking" (Rm 1358, 10–11).

### Flows

| Flow | Result |
|---|---|
| Sponsor · First visit and Help | Pass. The tour's Coffee chats step says "(required)". With no lead assigned, Help says "Your contact hasn't been assigned yet." |
| Sponsor · Your team | Pass. Next with no reps is disabled and shows "Add at least one rep to continue." A blank save shows both errors. Remove / Undo brings the rep back with the crown. (13th rep not tried.) |
| Sponsor · Chatting preferences | Pass. Groups of 3, 0 chats, "isn't free any time Saturday", "free for 1 hour, so up to 2 chats", reload and Ask an organizer all work as described. Sun Life's workshop cells read "Your workshop 2:30–3:30". The guide's "1:00–1:30 only" example doesn't come up with today's run of show. |
| Sponsor · Review & submit | Pass. Edit after submit gives "Submit changes", and the submit time moves forward. |
| Sponsor · Scan a hacker | Pass, with one bug (F1). |
| Sponsor · Shortlist | Pass. "21 seats · 3 taken by people you met · shortlist up to 18". Over the cap it shows only "You now have room for 3 on your shortlist. Remove 2." On the home card: "5 shortlisted, room for 3. Remove 2." |
| Sponsor · Your chats | Pass. Order, rooms, real partial times ("1:00–1:30"), List and rep filter all work. At 390 all 6 sessions show. |
| Sponsor · Change after invites | Pass. The counts are right: 6 for Kevin's sent 10–11, and "doesn't affect any invited hackers" for an empty session. Keep changes nothing. Change saves and isn't asked again. |
| Sponsor · Judging | Pass for steps 1–5: locked text, Who's judging, half-point strip, Rubric, "Dana 9.5 · Kevin 6 · avg 7.8 · talk it through", and shortlist sent. Step 6 (round 2 top 3) **not run**: Sun Life still has no judging room on the live sheet. |
| Organizer · Happening now | Pass, with one inconsistency (F3). |
| Organizer · My sponsors | Pass. "You lead 3 sponsors", groups, copy, and both pills show "Canada Life: Not written (sheet writes off)". |
| Organizer · Read the coffee board | Pass. |
| Organizer · Schedule and fix | Pass, with two small bugs (F2, F4). Placed 23. The Scotiabank Ivey fix, move, remove + Undo, booking and re-run all work, and pins are kept. |
| Organizer · Send (Noah only) | Pass. Others see "Only Noah sends". Confirm: "Send 6 sponsors' schedules and invite up to 162 hackers? Hackers get a Slack message now." Toast: "Sent 24 chats. Invited 12 hackers; 145 seats still open, offered again Saturday 10:30 AM. (dry run: nothing was messaged)". The re-send toast reads "Re-confirmed 1 sponsor who changed after invites." and the flag clears. |
| Organizer · Invite status and rounds | Pass. The status endpoint shows seats, filled, accepted, open, and each invite's round and source. runRoundNow gives `created: 0` twice (every eligible fake hacker already holds invites), and nobody holds more than 2 live invites. |
| Organizer · Judging tab | Pass. "Nothing scheduled yet. See why below." plus "<team> · Sun Life has no judging room on Sponsor Day-Of". Open round 2 is disabled. PCBWay no-match shows "No submitted team in this track has that link." and Save is off. The guide quotes the server's wording ("…doesn't match a submitted team…"). |

### Hand-offs (answered from the receiving side, fresh context)

**1. Sponsor submits → organizer** (`h1-*.png`)
1. State: Test Sponsor is "Needs scheduling", and Needs attention says "Test Sponsor: 0 of 2 reps scheduled".
2. What changed: "Test Sponsor submitted · 11:51 AM" (the sponsor).
3. Act: yes, the summary says "Run Auto-schedule".
4. Next: "Then Noah sends schedules and invites by 10 PM." "Open coffee chats" lands on the open row with focus on it. Clear.

**2. Organizer schedules → sponsor** (`h2-*.png`, same sponsor device throughout)
- After Auto-schedule the sponsor still sees "Submitted, waiting for organizers to schedule", so drafts are hidden.
1. State: "Scheduled, invites going out · Invites: 0 accepted · 9 waiting · 12 open", with the calendar.
2. What changed: "Organizers confirmed your chats · Thu 12:03 PM". After the fix and re-send: "Organizers moved Walkthrough Kevin's 10:00 chat to 11:00, Rm 1352" under "Since you were last here".
3. Act: "Nothing to do. Your chats are below."
4. Next: "hackers answer their invites by Sat 10 AM. If someone can't make it, we invite the next person on your list." Clear. The main contact gets no message (not built, as the guide says).

**3. Sponsor changes after invites → organizer** (`h3-*.png`)
1. State: Test Sponsor "Sent" with the flags "Changed after invites" and "1 chat needs a fix". Needs attention: "Test Sponsor changed their coffee chat preferences after the schedule was sent".
2. What changed: "Test Sponsor edited reps or times after Send · 12:05 PM" (the sponsor).
3. Act: yes. The fix reads "Walkthrough Kevin's sent chat at 10–11 is at a time Walkthrough Kevin isn't free anymore… Suggested: move to 11–12 (Rm 1352) / remove." The summary says "Check their chats, then Noah sends again."
4. Next: Noah's Send re-confirms. Applying the fix kept the chat "Sent" and moved its 6 invites to 11:00 / 11:30 in Rm 1352. Clear.

**4. Sponsor asks for help → organizer** (`h4-sponsor-help-lead-390.png`, masked)
1. State (sponsor): Help lists the lead's name and number, then the emergency contact, each with a phone link and a copy icon. "Ask an organizer" on the preferences step opens the same dialog.
2. What changed: nothing is sent or tracked. The organizer dashboard shows nothing new, as designed.
3. Act: the sponsor calls or texts. The organizer answers the phone and can call back using the rep phones on the board row or in My sponsors.
4. Next: a normal phone conversation. Clear.

**5. Hacker answers → both sides** (`h5-*.png`)
1. State: Alex's `/live` shows the toast "Test Sponsor wants to chat with you · Sat 11:00 AM, 30 min" (already the moved time) with "Reply by 10:00 AM". After Accept: "Accepted. You're chatting with Test Sponsor at 11:00 AM." Sam's decline uses an inline "Yes, decline", then shows "Declined Sun Life's chat."
2. What changed: the sponsor (fresh device) sees "Scheduled, 1 of 21 seats accepted · Invites: 1 accepted · 8 waiting · 12 open" and "Alex · Confirmed". Sun Life's seat counts in the status endpoint go to 2 pending · 28 open.
3. Act: nobody.
4. Next: Sam's seat is offered again in the next round. Clear. Data note: Alex also has an old pre-session Sun Life chat "With Priya" (Canada Life's rep) left from earlier demo data. It isn't from this flow.

### Bugs found

- **F1 · A repeat scan shows "Anyone" selected, not the rep already credited.** Steps: scan `demo-otter-kite`, pick Walkthrough Kevin, Add. Scan it again. Expected: Kevin is pre-selected, as the line "…talked to Walkthrough Kevin" suggests. Actual: "Anyone" is selected, and Save keeps Kevin (in the DB, the rep name stays Kevin). A sponsor who picks "Anyone" to clear the rep sees no effect. Where: `src/components/sponsors/badge-scanner.tsx:382` (`repId` starts as `null` and ignores `scanOf`'s rep); the server keeps the old rep on null (`src/server/api/routers/coffee-chat-setup.ts:621-626`).
- **F2 · Moving a chat on the board gives no confirmation.** Steps: select any chat, Move, then "Move here". Expected: "Moved." (the copy exists). Actual: no toast or status text; only the chip moves. For a sent chat this also re-asks invited hackers, with no word to the organizer. Where: `src/components/sponsors/organizer/coffee-sessions/coffee-sessions-tab.tsx:91-92` (`movePlacement` / `moveBooking` have no `onSuccess`); `copy.toast.moved` (`src/content/coffee-chat-sessions.ts:294`) is never used.
- **F3 · "1 rep not placed" on the board, but Happening now leaves the sponsor out.** Steps: seed, Auto-schedule, Send. Sun Life's Kevin T. has 1 of the 2 sessions he needs. Expected: both views agree. Actual: Sun Life's row and fix say "1 rep not placed (at 11–12)", but Needs attention doesn't list Sun Life, because it counts reps with any chat. Where: `src/lib/sponsor-organizer.ts:813` (`repsPlaced < repsChatting`) vs the board's per-session count. Fix one of them: count reps who are short a session, or word the flag "1 rep short a chat".
- **F4 · Rep names break mid-word on the board at 390 px.** Steps: open the board at 390 and open Test Sponsor. Actual: "Walkthroug / h Dana". Where: `src/components/sponsors/organizer/coffee-sessions/sponsors-band.tsx:162` (`[overflow-wrap:anywhere]`; `break-words` keeps whole words).
- Wording notes (not bugs): after Send, the summary still says "1 sponsor needs scheduling. Then Noah sends schedules and invites by 10 PM." even though Noah has sent and only Sun Life's gap is left. The Send confirm says "invite up to 162 hackers" when 12 were invited (pool-limited), and in dry mode it still says "Hackers get a Slack message now." The PCBWay no-match line differs from the guide's quote.

### Not run
Round 2 top 3 (no judging room on the live sheet), a valid PCBWay save, two organizers editing at once, the 13th rep, DB-down retry, and an unreadable run of show or HW Contacts.

### Fake data left in the local DB
`walkthrough-hacker-1..8` and `walkthrough-noah` (users); Test Sponsor's reps Walkthrough Dana and Kevin, its submitted preferences, 3 scans, 5 shortlisted (submitted); "Walkthrough booking" (Rm 1358, 10–11); 24 sent placements across the 6 seeded sponsors and 12 dry-run invites (Alex accepted Test Sponsor, Sam declined Sun Life); Canada Life's Priya S. moved to Rm 2243 10–11; Sun Life judging: 2 scores and 1 sent shortlist on seeded `sp…` teams. Re-running the coffee seed resets placements and invites.
