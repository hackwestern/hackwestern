# Simplify decisions (Step 4)

From the walkthrough (`clarity-review.md`) and the build as a whole. Each item names one thing that's too complicated, the simplest fix that still covers the real need, and what the user loses.

### Scan card at the booth
- **What's too complicated:** the scan card still carries the old per-slot model, "Offer a coffee chat" at a time, with "15-minute chat" and "No open times" (bug B1). It also has two filled buttons; "Scan next" looks like the main action and silently drops the hacker.
- **Decision:** the scan card does one job: add the hacker to "Met at your booth", with an optional "Who talked to them?" rep pick. Remove the time offer, chat length and room lines. "Add to my list" is the only filled button; "Scan next" becomes a plain text button and appears after the add.
- **Why:** seats come from the invite rounds (people met at the booth are invited first), so the booth doesn't need its own booking step.
- **What the user loses:** booking a specific time at the booth on Saturday. Instead, the hacker is offered a seat in the next 30-minute round, scanned hackers first.

### One name for the main contact
- **What's too complicated:** "Primary", "primary contact" and an unlabelled crown on different screens and sides.
- **Decision:** "Main contact" everywhere, on both sides. The crown always has that label beside it.
- **Why:** one idea, one word.
- **What the user loses:** nothing.

### One name for booth scans
- **What's too complicated:** "Met at Hacker Fair", "People you scanned" and "First choice" all mean the same list.
- **Decision:** "Met at your booth" everywhere (scan card, shortlist, organizer board). The shortlist heading says "People you met · invited first".
- **Why:** sponsors don't know the event calls it Hacker Fair, and "scanned" names the mechanism, not the meaning.
- **What the user loses:** nothing.

### Chats home: one main button, in the order of the job
- **What's too complicated:** the optional "Add a hacker" sits above the required "Start". After Send, "Your chats" is at the bottom, below setup cards that are now read-only.
- **Decision:**
  - Before submit: "Start" (preferences) is the only filled button at the top; the shortlist card follows, locked until preferences are in.
  - After submit: the status card leads, then the shortlist.
  - After Send: "Your chats" is first, and the setup cards collapse into one "Change your team or times" link, which shows the change warning.
- **Why:** the page should show the one thing to do now.
- **What the user loses:** nothing. Setup is one tap away.

### Changes after invites: one message
- **What's too complicated:** the warning dialog, the status card and the organizer board say three different things, and the dialog overcounts hackers (bug B4).
- **Decision:**
  - One sentence, used by the dialog and the status card: "This affects N invited hackers. Organizers will update their chats, and the hackers will be told." It's true for every edit (a rename re-asks, a removed chat moves or cancels). N counts only invites in the chats being changed.
  - One rule for N (`invitesAffected` in src/lib/coffee-chat-setup.ts). The dialog compares the saved setup with the edit. The status card compares what the sent chats imply with the setup now (`invitesOutOfLine`), so the two agree. A rename counts the rep's invited hackers, since their invites name the rep.
  - The organizer board's flag reads "Changed after invites · <time>".
- **Why:** the same event should read the same everywhere.
- **What the user loses:** nothing.

### Hacker activity as counts, not a change log
- **What's too complicated:** the sponsor's "Last change" can't say "a chat moved" or "a hacker accepted" without keeping an event history.
- **Decision:** after Send, the status card shows live counts: "Invites: 4 accepted · 2 waiting · 2 open". "Last change" covers only what organizers did ("Organizers confirmed your chats · Fri 9:52 PM"; "Organizers moved Dana's 2:00 chat · Sat 10:05 AM" when a sent chat's room or session changed).
- **Why:** counts answer "what's happening now" without a new table.
- **What the user loses:** a per-hacker timeline. Names of hackers who accepted show in "Your chats".

### Board status chips
- **What's too complicated:** "Submitted, needs scheduling" shows even after Send when one rep is unplaced (bug B3), so sent and unsent sponsors look the same.
- **Decision:** the chip shows the stage: "Not submitted", "Needs scheduling", "Scheduled, not sent" or "Sent". Problems show as a second, smaller flag: "1 rep not placed" or "Changed after invites".
- **Why:** one stage per sponsor, and problems listed separately, is easier to scan.
- **What the user loses:** nothing.

### Back-to-back chats in two buildings
- **What's too complicated:** whether to block a rep booked 1–2 in the main building and 2–3 in Ivey (bug B8).
- **Decision:** don't block it. The scheduler prefers keeping a rep's back-to-back sessions in one building. When it can't, the board shows a "Walk to Ivey between chats" note on that rep.
- **Why:** a hard rule could leave reps unplaced to save a 15-minute walk.
- **What the user loses:** nothing; organizers can still move the chat by hand.

### Send: one confirm
- **What's too complicated:** Send messages up to hundreds of hackers with no pause.
- **Decision:** one confirm dialog: "Send N sponsors' schedules and invite up to M hackers? Hackers get a Slack message now." In dry mode, the toast adds "(dry run: nothing was messaged)".
- **Why:** it's the only action in the tool that can't be undone.
- **What the user loses:** one extra tap for Noah, once.

### Digital sponsors stay out of coffee chats
- **What's too complicated:** PCBWay (digital, no portal) shows in coffee chat Needs attention and Presentations (bug B2).
- **Decision:** digital sponsors appear only in judging (organizer entry of their top 3). They're filtered out of coffee chats, Needs attention and Presentations.
- **Why:** they can't act on any of those.
- **What the user loses:** nothing.

### One answer to "who do I contact?"
- **What's too complicated:** the portal home and Help name different Hack Western contacts (bug B11).
- **Decision:** one source, the sponsor's HW lead from Sponsor Day-Of, used by home, Help and the tour. Noah is always shown as the emergency contact.
- **Why:** two different names make a sponsor unsure who to text.
- **What the user loses:** nothing.

### Dead code and old docs
- **What's too complicated:** components nothing imports (`coffee-chat-board.tsx`, `schedule-list.tsx`, `sponsor-map.tsx`), and docs for the old room-block model.
- **Decision:**
  - Move the unimported components to `_to_delete/` next to them.
  - Mark `docs/flows/coffee-chat-room-blocks.md`, `docs/plans/room-blocks.md`, `docs/specs/inline-chat-block-editing.md` and `docs/board.md` as superseded at the top.
  - Leave the hidden room-block editor and the old per-slot router in place; they're switched off and still have tests.
- **Why:** fewer places for the next person to look.
- **What the user loses:** nothing.
