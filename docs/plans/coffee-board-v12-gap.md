# Coffee chat board: mock v12 vs the built app (gap list)

Mock (source of truth): `hackwestern-sponsor-dash/mocks/organizer-coffee-v12/` (index.html, verify.mjs), plus the v9, v10 and v11 READMEs it builds on and `mocks/CHANGES.md` rows for v8 to v12.
App: this worktree, branch `coffee-board-v12` at 75149112. No commit on this branch or `coffee-prefs` builds any v9 to v12 item. The newest board work is the v8 build and its follow-ups (30c55111, ae9ae0a6 and earlier).

Paths below are short:
- `tab` = `src/components/sponsors/organizer/coffee-sessions/coffee-sessions-tab.tsx`
- `grid` = `.../coffee-sessions/rooms-grid.tsx`
- `band` = `.../coffee-sessions/sponsors-band.tsx`
- `parts`, `fixes`, `summary`, `help` = the other files in that folder
- `copy` = `src/content/coffee-chat-sessions.ts`
- `router` = `src/server/api/routers/coffee-chat-sessions.ts`
- `invRouter` = `src/server/api/routers/coffee-chat-invites.ts`
- `boardUtil` = `src/server/api/utils/coffee-chat-sessions-board.ts`
- `invUtil` = `src/server/api/utils/coffee-chat-invites.ts`
- `schema` = `src/server/db/schema.ts`

Status key: DONE = in the app now. PARTIAL = some of it is there (what's missing is listed). MISSING = not there.

Totals: 20 DONE, 15 PARTIAL, 28 MISSING (63 items).

---

## 1. Items

### A. The live board that v9 started from (v9 "Base")

1. **Summary card.** One line saying what to do next, with Auto-schedule beside it before the first run, then "Last new chat 9:41 PM · Last sent 9:52 PM". DONE: `summary:14-33`, `summary:40-78`, `tab:289-307`.
2. **Sponsor rows.** Logo plus the name in text, one stage chip ("Not submitted", "Needs scheduling", "Scheduled, not sent", "Sent"), problem flags like "1 rep short of chats", no Contact button. DONE: `band:293-342`, `parts:85-121`. The app has extra chips and flags the mock doesn't show ("Submitted, no chats asked", "Changed after invites", "N seats couldn't be filled"). Keep them.
3. **Open sponsor.** Legend "■ Scheduled (room) · ✓ Free · ▨ Their event", the availability grid with "6 chats · 3 h" (or "3 of 4 chats" in amber) under each rep, the facts line, People with a crown labelled "Main contact", "Asked for …", and the phone with a copy icon (no Text or Call). DONE: `band:357-479`, `parts:127-187`.
4. **Suggested fixes.** The amber card: problem, why, "Suggested: …", [Apply fix], and the main contact with their phone. DONE: `fixes:142-206`.
5. **Rooms grid frame.** "Near the Sponsor Bay" and "Ivey · 15-min walk" groups, a sticky room column, and the Workshops row at the bottom. DONE: `grid:114-163`, `grid:226-259`. Cell size and contents are items 33 to 39.
6. **Booking form fields.** Room, Session, "Who it's for" (placeholder "e.g. Commure, or Mentors"), Note ("Optional"), [Book] [Cancel], the "Who it's for?" error and the room-taken error. DONE inline: `grid:368-455`. Moving it into the modal is item 42.
7. **Sticky bar.** Before the first run: "Invites go out by 10 PM" + Auto-schedule. After: "Review the rooms, then send" or "N fixes open", a "Re-run auto-schedule" link and "Send confirmed schedules & invites". All sent: a check and "Sent 9:52 PM". DONE: `tab:414-484`. The app also greys out Send for anyone but Noah ("Only Noah (or someone with Noah's view) sends"). The mock has no sender check. Keep the app's.
8. **Help sheet.** "How coffee chats work", a right panel from 640px and a bottom sheet on phones, Esc closes it, focus stays inside. DONE: `help:220-270`. The new line is item 48.
9. **Send asks first.** "Send schedules and invites?" with [Send now] in blue and [Cancel]. DONE: `tab:365-412`. The body copy differs (open question 7).
10. **Chat lengths.** A 1-on-1 is 15 minutes and a group is 30. DONE: `copy:81-84` and `chatsInWindow` in `src/lib/coffee-chat-sessions.ts`.
11. **Removing a draft chat.** Toast "Removed." with Undo, and Undo puts it back ("Put back."). A sent chat gets no Undo. DONE: `tab:97-126`, `router:273-295`. The mock's Undo toast stays 5 s, others 3.2 s. The app uses Sonner's default.
12. **Removing a booking.** Toast "Removed." with Undo. DONE: `tab:127-151`.
13. **Room-taken message.** "Rm 2242 is taken at 10–11." DONE on the server: `boardUtil:527-552`, `copy:320`.

### B. v9: drag to move, warnings, hacker detail

14. **Mouse drag.** Press a chat or booking and move 5px to start. A ghost copy follows the pointer (`rotate(-2deg)`, drop shadow, 0.96 opacity). The source cell fades to 0.4. The cursor is `grab` on chats and bookings and `grabbing` everywhere while dragging. No HTML5 `draggable`, one pointer path for mouse and pen. The click that ends a drag is swallowed, so it doesn't open anything. MISSING. The app only has tap Move, then tap a cell (`tab:196-210`).
15. **Touch drag.** Press and hold 250 ms, then drag, with `navigator.vibrate(10)` at the start. A move of more than 8px before 250 ms cancels the hold, so a quick swipe scrolls the grid. While dragging, `touchmove` is prevented (the page doesn't scroll by itself). The long-press menu is suppressed, `touchcancel` ends the drag with no change, and `touchend` sends no click. MISSING.
16. **Which cells light up.** Exactly the empty cells where that rep is free that session, outside their sponsor's workshop window, with no chat elsewhere then. A booking lights every empty cell. Lit cells read "Drop here" (1.5px dashed primary border, highlight background, the + hidden). The hovered lit cell gets a solid border and the `navSel` background. A hovered cell that isn't lit gets a 2px amber (`t-warn`) outline. PARTIAL: the rule is `moveCheck` (`grid:60-74`) and tap move mode lights those cells (`grid:189-196`). The label is "Move here" (`copy:188`), and there's no hover or "not lit" state.
17. **Remove zone.** While dragging, a fixed red zone covers the whole bottom bar: height max(80px, the bar's height), a 2px dashed red top border, a pale red background, a trash icon and "Drop here to remove". When hovered it turns solid red with white text. Dropping there runs Remove: a draft or booking goes at once with Undo, and a sent chat gets the item 25 warning. MISSING.
18. **Edge scroll.** While dragging, the grid scrolls sideways when the pointer is within 40px of its left or right edge. The page scrolls up within 50px of the top, and down within 50px above the Remove zone, at 6px a frame. MISSING.
19. **Drag safety.** Esc cancels a drag. The grid isn't re-rendered during a drag (touch events stop when their target leaves the DOM). MISSING. The board refetches every 15 s (`tab:34-37`) and would re-render mid-drag.
20. **Drop a draft on a lit cell.** It moves with no question, gets pinned, and the toast says "Moved." DONE through the tap path: `tab:196-210`, `router:228-244`, `copy:298`.
21. **Drop on a taken room.** Refused, with an error toast "Rm 2242 is taken at 10–11." PARTIAL: in tap move mode, tapping a taken cell quietly leaves move mode with no toast (`tab:198-208`). The server message exists (item 13).
22. **Moving a sent chat warns first.** Title "This chat is confirmed.", then the item 46 line, then "Moving it asks them to confirm the new time or room.", with [Move and tell them] (red) and [Cancel] (focused). The same happens from Move to…. Afterwards the toast is "Moved. Hackers invited to this chat were asked to confirm the new time or room." PARTIAL: the toast is there (`copy:299`, `tab:92`). The dialog isn't, so a sent chat moves with no question.
23. **After a sent move, every hacker is back to Waiting** with a new answer-by. DONE on the server: `router:240` calls `reconcileInvitesAfterChange` (`invUtil:634` onward), which re-asks invites whose room or rep changed and re-seats ones whose time changed. See open question 16 for hackers who clash at the new time.
24. **Removing a sent chat warns first.** "This chat is confirmed.", the item 46 line, "Removing it cancels the chat and tells them.", with [Remove and tell them] (red) and [Cancel]. MISSING: it removes at once (`tab:252-257`). The server side (cancel and tell, re-mirror) is DONE: `router:251-267`.
25. **Click a chat to see its hackers.** The v9 version lists each hacker's name, why they were invited, and Accepted or Waiting. v11 regroups this (item 44). PARTIAL: the detail only says "N hackers to invite" (`grid:338-347`, `copy:212`). The data is already in `coffeeChatInvites.status` (`invRouter:31-62`, `invRouter:99-192`).
26. **Draft detail note.** "Not sent yet. Hackers are invited when Noah sends." MISSING.
27. **Only Accepted and Waiting.** No Declined, Expired or open-seat rows anywhere. DONE on the server: `invRouter:125-128`.
28. **Move to… (keyboard fallback).** A [Move to…] button (`aria-expanded`, `aria-controls`) opens a list under the actions: "Free cells for Dana W.", one row per session with its label and a button per free room (text is the room id, aria-label "Move to Rm 2242 at 10–11"). It lists only item 16's cells. When there are none: "No empty room when Dana W. is free." Focus moves to the first button. Picking one goes through the same warnings (items 22 and 51). [Remove] sits beside it. PARTIAL: "Move" puts the grid in tap mode with "Tap an empty cell when Dana W. is free." (`grid:313-321`, `copy:207`), and the lit cells are reachable by Tab.
29. **Sent or Draft on every chat.** MISSING. The app shows a "Sent" pill only in the detail (`grid:345`). The look is item 36.
30. **Grid hint.** "Drag a chat to move it. Click it for details." With `(pointer: coarse)`: "Press and hold a chat, then drag to move it. Tap it for details." It sits above the grid, left of the legend. MISSING.
31. **Hand-forced chats.** A chat moved with "Yes, move the chat" (item 51) is marked forced. The cell gets an amber "Not free" pill at the end of the format line, and the modal says "Moved by hand to a time Dana W. isn't free." The board checks treat a forced chat as allowed (no suggested fix for it), and Auto-schedule keeps it. A normal move clears the mark. MISSING, needs schema and server (section 2).
32. **The "Placed by hand" note.** "Placed by hand: Auto-schedule keeps it here." shows only for a pinned chat that isn't sent and isn't forced. PARTIAL: the app shows it for any pinned chat (`grid:361`).

### C. v10: fixed cells, red warnings, the modal

33. **One fixed cell size.** Every grid cell is 66px tall: empty, chat, booking and workshop cells, and the lit and hovered cells during a drag. Every session column is the same width (about 125px at 1280 and at 390). The table's min width is 860px, with 4px border spacing and a 78px room column. Long names never change a cell's height or the table's width. PARTIAL: `table-fixed` and the 78px column are there (`grid:123`, `grid:140`, `grid:143`), but the min width is 780px and cells are `min-h-[52px]` with `overflow-wrap:anywhere`, so they grow (`grid:140`, `grid:167`).
34. **One line per line, cut with "…".** No line wraps. A cut line ends in "…", and the full text is in the cell's `title`, its `aria-label` and the modal. Nothing spills out of a cell. MISSING (`grid:167` wraps text).
35. **Chat card layout.** Line 1 is the rep name (14px bold) with the Sent or Draft dot after it. Line 2 is the sponsor's name as text (12px, semibold, medium colour, no logo). Line 3 is the format (11.5px, light; item 43) with the "Not free" pill at the end. Padding is 6px 6px 6px 9px, with a 1px outline border and a 3px primary bar inside the left edge. The title is "Dana W. · Sun Life · 2 chats · 3 each · Draft" (plus " · Not free"). The aria-label is "Sun Life · Dana W., 2241, 10–11, 2 chats · 3 each, Draft". PARTIAL: border and left bar are there (`grid:217`). The content is a logo and the rep name (`grid:218-219`), and the label is "Sun Life · Dana W., 2241, 10–11" (`copy:190-191`).
36. **The Sent or Draft dot.** A 14px box holding an 8px dot: filled green (`live`) for Sent, a 1.5px grey ring for Draft. The word is there for screen readers and as a tooltip. A legend above the grid, right of the hint: "● Sent ○ Draft". MISSING.
37. **Empty cell.** A dashed outline with a 16px +, aria-label "Book a room: 2241, 10–11". DONE: `grid:197-201`. Its size is item 33.
38. **Booking cell.** Line 1 is who it's for (bold), line 2 is "Booked by organizers", line 3 is the note. The title is "Mentors · Booked by organizers · <note>". PARTIAL: it shows only the label (`grid:205-211`).
39. **Workshop cell.** Hatched, logo, "workshop · Rm 2230", then the time. DONE: `grid:244-253`. The time change is item 50.
40. **Red warning buttons.** The primary button is red in: step 2 of item 51 ("Yes, move the chat" / "Yes, move and tell them"), "Move and tell them", "Remove and tell them", and "Remove and invite …" (item 54). The fill is `destructive-dark` (`hsl(0 72.2% 50.6%)`, white text, about 4.8:1). In the mock, hover is `#b42318`. Cancel and "No, keep it where it is" stay neutral white outline buttons. Send, "I've contacted …" and "Add to front" stay blue. MISSING: `DashboardButton` has no red variant (`src/components/internals/dashboard-button.tsx:15-43`). Tailwind already has `destructive.dark` (`tailwind.config.ts:110-113`).
41. **Chat detail in a modal.** `role="dialog"`, `aria-modal`, labelled by its h2: logo plus the rep's name. Under it: "Sun Life · Rm 2241 · 10–11" (Ivey rooms read "Ivey, Rm 1348"). Then pills for format ("1-on-1 · 15 min" / "Group of 5"), "✓ Sent" or "Draft", and "Not free". Under 640px it's a bottom sheet: full width, rounded top, a 36×4px grab handle, max height `100dvh - 24px`, scrolls inside. From 640px it's centred: width min(520px, 100% - 32px), max height `100dvh - 64px`, no handle. Focus goes to × on open and Tab stays inside. Esc, × and a tap on the backdrop close it, and focus goes back to the card. After a Move to…, the modal stays open on the chat in its new place, and focus later returns to that card. Removing a chat from the modal closes it and puts focus on the now-empty cell. Nothing renders under the grid, and a drag never opens the modal. MISSING: the detail is inline under the grid (`grid:161`, `grid:261-365`). `help` already uses Radix Dialog with the same bottom-sheet split (`help:220-270`).
42. **Booking in the modal.** Tapping an empty cell or "Book a room" opens the booking form in the same modal, with focus in "Who it's for". After [Book], the modal shows the new booking and the toast says "Room booked." PARTIAL: the form is inline (`grid:368-455`). The toast is there (`tab:152-156`). "Book a room" opens it on the first free cell (`tab:269-282`), the same as the mock.

### D. v11: per-chat counts, contacting the rep, editing hackers

43. **Cell format line.** "2 chats · 5 each", "2 chats · 3 each", "2 chats · 2 each" or "4 chats · 1-on-1" (`T.v10.cellFormat`). MISSING. The mock always uses 2 or 4 chats an hour. The app knows the real number per cell, including a rep's cap and partial sessions: `hackersAt` / `chatsBySession` (`grid:77-85`). Use that (open question 4).
44. **Hackers grouped by chat.** In a sent chat's modal, one block per chat. The header is "<time> · <format> · <counts>", for example "10:00–10:15 · 1-on-1 · 1 accepted" or "11:00–11:30 · Group of 5 · 3 accepted, 2 waiting". Zero counts are left out and the parts are joined with ", ". Then that chat's hackers: name in bold, the reason under it ("Met at your booth", "Shortlist", "Interested", "Added by organizer"), and a pill: green "Accepted", or amber "Waiting" with a small "answer by 10:00 AM". A 1-on-1 hour shows 4 blocks with one hacker each. Rows don't repeat the time. Each block has aria-label "Chat at <time>", and the list "Invited hackers". MISSING in the UI. The data is DONE: `coffeeChatInvites.status` returns one entry per chat (placement plus start), with `slotTime`, `minutes`, `seats` and `invites[]` (name, status, source, expiresAt): `invRouter:31-62`, `invRouter:141-168`.
45. **Modal summary line.** Sent: "10 seats in 2 chats · 6 accepted · 4 waiting" (1-on-1: "4 seats in 4 chats · 3 accepted · 1 waiting"). Draft: "6 seats in 2 chats" above the item 26 note. MISSING: `copy:212` says "N hackers to invite".
46. **Warning line.** "This hour has 4 hackers in 4 chats (3 accepted, 1 waiting)." It's used in the item 22 and 24 dialogs. In item 51 step 2 the line is "4 hackers in 4 chats will be asked to confirm the new time or room." MISSING.
47. **Sponsor invite line.** "Invites: 80 seats · 50 accepted · 30 waiting". PARTIAL: `band:486-501` and `copy:79` show "50 accepted · 30 waiting", with no "Invites:" and no seats. `totals.seats` is already returned (`invRouter:177`).
48. **Help line.** Under "What sponsors give us": "A cell is one rep for one hour. Groups run 2 chats an hour; 1-on-1s run 4." MISSING (`help:249`).
49. **Toasts count chats, not cells.** "Placed N chats." counts the chats Auto-schedule added (the mock counts after minus before). "Sent N chats. Invited N hackers." counts the chats sent. PARTIAL: the copy is there (`copy:296`, `copy:305`), but `autoSchedule` returns placements (`router:134`) and `send` returns `sent.length` placements (`router:428`).
50. **Workshop times.** The cell shows start and end: "2:30–3:30 PM", or "11:30 AM–12:30 PM" when it crosses noon. Title and aria-label: "Sun Life workshop · 2:30–3:30 PM · Rm 2230" (time before room). A workshop over two sessions shows in both. PARTIAL: one cell per session that overlaps is DONE (`grid:233-238`). It shows only `formatClock(start)` (`grid:240`), has no `title`, and the label order is sponsor · room · time (`copy:194-195`).
51. **Moving to a time the rep isn't free takes two steps** in one alert dialog (max width 448px). It replaces v9's single "Are you sure? … [Move anyway]".
    - Step 1. Title "Dana W. isn't free at 2–3". Body: the reason, then "Contact Dana before moving the chat." (first name). The reasons are: "2–3 is during Sun Life's workshop, with travel time." / "They didn't tick 2–3 as free." / "They already have a chat in Rm 2242 then." Under it, a grey box with the rep's full name, their phone (17px semibold), a copy button (44px, turns into a check and "Copied") and a "Call" link (`tel:+1…`, 44px tall, aria-label "Call Dana W., (519) 555-0101"). Buttons: [I've contacted Dana] (blue) and [Cancel] (focused). Step 1 can't move the chat.
    - Step 2. Same title. The first line is "Did Dana confirm they can do 2–3?". For a sent chat, add "4 hackers in 4 chats will be asked to confirm the new time or room.". Three stacked full-width buttons: [Yes, move the chat] or [Yes, move and tell them] (red), [No, keep it where it is] (neutral, focused, closes without moving), [Cancel].
    - Esc cancels at either step and Tab stays inside. The chat hasn't moved after the drop or after step 1. Only Yes moves it, marks it forced (item 31) and pins it. The toast is "Moved." or the sent-move toast.
    MISSING. Server: `movePlacement` refuses all three cases (`router:234` → `boardUtil:555-584`).
52. **Rep phone in the dialog.** Part of 51. MISSING as a dialog piece, but reusable: `PhoneCopy` (`parts:127-161`), `formatPhone` (`parts:34-37`), and `BoardRep.phone` is already on the board (`boardUtil:65-75`).
53. **Edit hackers toggle.** Only on sent chats. A pencil icon button (aria-label and tooltip "Edit hackers", `aria-pressed="false"`) sits beside the summary line. When on, it becomes a small "Done" button (`aria-pressed="true"`, 44px tall). Each row gets a red outline "Remove" button (44px, `destructive-dark` text and border, aria-label "Remove Ada") after its Accepted or Waiting pill. MISSING.
54. **Remove a hacker: who gets the seat?** Title "Remove Ada from this chat?", body "Ada will be told the chat is cancelled.", fieldset legend "Who gets this seat?".
    - Radio 1 (default): "Next in line: Ari · Met at your booth". When the line is empty it's disabled, reads "Next in line: nobody is in line", and radio 2 is picked.
    - Radio 2: "Someone else: scan or enter a hacker ID", then the item 55 picker. Typing in the ID field picks radio 2.
    - Red primary button: "Remove and invite Ari" / "Remove and invite Kim", or a disabled "Remove and invite…" when nobody valid is picked. [Cancel] has focus.
    - On confirm: the old hacker is cancelled and told. The new one takes the same seat in the same chat as Waiting with the usual answer-by. Next-in-line people leave the line. A "Someone else" pick shows as "Added by organizer". The hour still has the same seats. Toast: "Removed Ada. Invited Ari."
    MISSING, needs server (section 2).
55. **Hacker ID picker** (items 54 and 56). A 44px camera button (aria-label "Scan a hacker's badge"), a "Hacker ID" field (label is screen-reader only, placeholder "Hacker ID, e.g. HW-1042", no autocomplete or spellcheck), and a live line under it. A valid ID shows "Kim · goes to the front of the line" (in 56, "Lou will get this sponsor's next free seat (before booth, shortlist and interested hackers)."). Errors are "No hacker with ID HW-9." and "Kim is already invited or in line.", and the primary button stays disabled. MISSING. Reusable: `useQrScanner`, `badgeCodeOf` / `typedBadgeCodeOf` (`src/lib/use-qr-scanner.ts:37-47`), the scanner in `src/components/sponsors/badge-scanner.tsx`, and the hacker lookup `resolveScannedUserId` / `findAdmittedHacker` behind `coffeeChatRequests.hackerByCode` (`src/server/api/routers/coffee-chat-requests.ts:956-961`).
56. **Put someone first in line.** A small button "+ Put someone first in line" under the list opens a dialog: title "Put someone first in line", body "Scan or enter a hacker ID.", the item 55 picker (focus starts in the ID field), [Add to front] (blue, disabled until valid) and [Cancel]. The newest person goes to the very front, ahead of earlier organizer picks. Toast: "Lou is first in line." MISSING, needs schema and server.
57. **Next in line preview.** Under the hacker list: heading "Next in line", an ordered list of the next 3 people with a source tag each ("Added by organizer", "Met at your booth", "Shortlist", "Interested"), or "Nobody is in line.". The order is organizer picks, then booth, shortlist, interested. It updates after a remove or an add. MISSING, needs a server query. Candidate order already exists in `loadCandidates` (`invUtil:317-387`, not exported): scanned, shortlist, interested.
58. **Toasts for hacker edits.** "Removed Ada. Invited Ari." and "Lou is first in line." MISSING.

### E. v12: real sponsor data

59. **Only the 6 coffee chat sponsors** (Sun Life, Canada Life, StarTech, Scotiabank, CSE, Commure): no other sponsor in the list, grid, fixes or Workshops row. PARTIAL: the board is data-driven. It shows any registered sponsor that's in the Coffee Chat Setup tab or has saved preferences or reps (`boardUtil:275-282`), and the Workshops row only uses board sponsors (`grid:227`). Whether QNX or anyone else shows up depends on live data. That's a data check, not code.
60. **Workshops from the run of show** (Scotiabank 10:00–11:00 AM, Canada Life 1:00–2:00 PM, Sun Life 2:30–3:30 PM in both 2–3 and 3–4, all Rm 2230). DONE: read from the run of show (`boardUtil` `readRunOfShow`, `workshopWindows` at `boardUtil:326`).
61. **Counts follow the data** (summary, "short of chats" flags and fixes agree). DONE for summary, flags and fixes (`summary:14-33`, `parts:103-108`, `fixes`). The toast counts are item 49 and the invite line is item 47.
62. **Sponsor row order.** The mock reads Sun Life, Canada Life, StarTech, Scotiabank, Commure, CSE (its data order, not-submitted first). PARTIAL: the app sorts not-submitted first, then by name (`band:270`, `boardUtil:248`), which gives Canada Life, Commure, CSE, Scotiabank, StarTech, Sun Life. See open question 18.

### F. Small extras

63. **Tooltips.** A custom tooltip (dark, 13px) on logos and the Sent or Draft dots on hover. On touch, a 450 ms long-press shows it for 1.6 s (not on draggable cells). Cells use the native `title`. MISSING: the app uses native `title` on logos (`parts:55`, `parts:71`).

---

## 2. Server work for each MISSING or PARTIAL item

"UI only" means existing procedures and data are enough.

| Item | Server? | Reuse / what's needed |
|---|---|---|
| 14–19 drag, remove zone, edge scroll | UI only | `movePlacement`, `moveBooking`, `removePlacement`, `removeBooking`, `placeChat` (Undo). The availability rule is `moveCheck` (`grid:60-74`), which matches `assertRepCanChat` (`boardUtil:555-584`). The 15 s refetch must not re-render the grid mid-drag. |
| 16 lit cells, 21 taken-room toast, 28 Move to… | UI only | `moveCheck`. The server already sends `errors.roomTaken` as a CONFLICT. |
| 22, 24 sent-chat warnings | UI only | `movePlacement` / `removePlacement` already re-ask or cancel invites (`router:240`, `router:257`). The counts come from `coffeeChatInvites.status`. |
| 25, 26, 44, 45, 46 hacker list and counts | UI only | `coffeeChatInvites.status({ sponsorId })` returns per-chat seats, invites, source, status and expiresAt. The draft seat count is `hackersAt` (`grid:77-85`). Source labels map `scanned` → "Met at your booth", `shortlist` → "Shortlist", `interested` → "Interested". |
| 29, 30, 33–36, 38, 43, 50, 63 cells, dots, hint, legend, workshop times | UI only | Board data has `status`, `pinned`, workshop `start` / `end` / `location`. |
| 31 forced chats, 32 pinned note | **Schema + server** | New column on `coffee_chat_placement`, e.g. `forced boolean default false` (migration 0061). `getBoard` must return it. `invalidChats` / `boardFixes` (`src/lib/coffee-chat-schedule.ts:426`) must not turn a forced chat into a "notFree" or "workshop" fix. `pinsOf` / `schedule` must keep it on re-run. `movePlacement` clears it on a normal move. |
| 51 two-step move | **Server** | `movePlacement` needs a force option that skips "not free" (and maybe "workshop" and "busy", open questions 1 and 2) and sets `forced`. The room-free check stays. Invites: `layoutOf` → `repChatStarts` (`invUtil:173-215`, `src/lib/coffee-chat-invites.ts:234`) drops chats inside a workshop window, so a chat forced into one would have 0 seats and reconcile would cancel its invites. That needs a rule if forcing into a workshop is allowed. |
| 40 red buttons | UI only | Needs a red button style. `DashboardButton` is shared (`src/components/internals/dashboard-button.tsx`). The Tailwind `destructive.dark` colour exists. No token edit is needed unless the mock's `#b42318` hover is kept (open question 17). |
| 41, 42 modal | UI only | Radix Dialog, as in `help`. |
| 47 invite line | UI only | `totals.seats` from `coffeeChatInvites.status`. |
| 48 help line | UI only | Copy in `copy` (`help.give`). |
| 49 toast counts | Small server change, or UI | `autoSchedule` and `send` return placement counts (`router:134`, `router:428`). They could return chat counts (from `layoutOf` or `chatsBySession`), or the UI could compute them from the refetched board. |
| 53 edit toggle | UI only | — |
| 54 remove a hacker and fill the seat | **New mutation** | e.g. `coffeeChatInvites.replaceInvite({ chatId, with: "next" \| { code } })`. It takes the board lock (`lockBoard`, `invUtil:141`), cancels the invite (like `coffeeChatRequests.cancel`, `coffee-chat-requests.ts:1210-1223`, which sets `cancelled` and sends the cancel notice), creates an invite in the same placement and slot with the current round's answer-by (`inviteExpiresAt`, `src/lib/coffee-chat-invites.ts:164`), checks the new hacker is free then and under `MAX_LIVE_CHATS_PER_HACKER` (`src/lib/coffee-chat-invites.ts:72`), then `deliverInviteNotices` and `mirrorCoffeeInvitesLater` after the commit. Today's `cancel` doesn't refill a session seat right away and doesn't pick who gets it. |
| 55 ID lookup | **New query, or reuse** | Organizer-only "check this hacker for this sponsor": returns the first name, or "unknown" / "already invited or in line". Can reuse `resolveScannedUserId` + `findAdmittedHacker` (behind the public `hackerByCode`) or `coffeeChatRequests.searchHackers` (`coffee-chat-requests.ts:1470`, matches hacker ID). The "already invited or in line" check is new. |
| 56 first in line | **Schema + new mutation** | New table, e.g. `coffee_chat_front` (sponsor_id, user_id, added_by, created_at), newest first. `loadCandidates` puts it as the first tier. `INVITE_SOURCES` (`src/lib/coffee-chat-invites.ts:258`) gets `"organizer"`, and the tier loop in `planInviteRound` uses it. `coffee_chat.source` is `varchar(16)` (`schema:437`), so the column needs no change. The Invites sheet mirror's Source column needs the label. NEXT.md already flags this ("needs an 'organizer pick' invite source (small migration)"). |
| 57 next in line | **New query** | e.g. `coffeeChatInvites.nextInLine({ sponsorId, limit: 3 })`: `loadCandidates` (export it) minus hackers already invited by this sponsor and blocked pairs, with organizer picks first. |
| 59, 62 sponsor list and order | None, or a data check | The list depends on live data. The order is a UI sort. |

Schema changes, all in one migration (0061 after 0060):
1. `coffee_chat_placement.forced` (boolean). Needed for items 31 and 51.
2. A new table for organizer front-of-line picks. Needed for items 54 ("Someone else" counts as "Added by organizer"), 56 and 57.
3. Only if open question 2 is answered "allow": dropping or narrowing the unique index `coffee_chat_placement_rep_idx` on (rep_id, session_id) (`schema:621`).

No enum change is needed (`source` is varchar).

---

## 3. Mock-only: don't build

- All demo data: rep names, 555 phone numbers formatted "(519) 555-…", free times, 3 reps per sponsor, hackers per chat, chats wanted, the "lead" names in `SPONSORS`, and the `WS` workshop table (the app reads the run of show).
- The fake hackers (Ada, Ben, Cleo, …), the fixed `SEAT_PATTERN` of Accepted and Waiting, and `makeInvites`.
- The fake line (`QUEUE_SEED`: Ari, Gabe, Bo, Dee, Cy, Ezra, Flo, Hal) and the fake badge directory `ID_DIR` (HW-1042 Kim, HW-2077 Lou, HW-3310 Rae).
- The Scan button filling the next unused demo ID (`scanDemo`). The real one opens the camera.
- `seedDemo`: opening pre-scheduled at 9:41 PM with Canada Life, StarTech and CSE sent at 9:52 PM. The fixed "answer by 10:00 AM" for everyone (use each invite's `expiresAt`, open question 9).
- The mock's own scheduler (`schedule`, `findFixes`, `checkBoard`, `applySuggestion`) and the in-page `runScheduleTests`. The app has its own in `src/lib/coffee-chat-schedule.ts`.
- `window.__board` / `window.__tests`, and verify.mjs's long-name renames (CSE → "Communications Security Establishment Canada", Dana → "Dana Wilhelmina Westergaard-Okonkwo"). These are tests, not features.
- All state living in the page. In the app everything goes through the server and the board lock.
- The mock's help text where it's older than the app's (open questions 7 and 8).
- There's no mock control panel in v12.

---

## 4. Open questions

1. **Forcing a chat into the sponsor's own workshop window.** v11 and v12 allow it (Dana W. at 2–3, during Sun Life's workshop, after the contact step). `docs/decisions.md` says the opposite: "never place a rep in a session overlapping their own sponsor's workshop or its 15-min travel buffers (also enforced on manual moves and applied fixes)" (auto-schedule entry), "Moves refuse … the sponsor's workshop window" (v8 build entry), and "No sponsor chats within 15 minutes of their own workshop". The v12 approval entry (last in the log) approves "'Are you sure?' on unavailable drops", which seems to supersede those, but none of them is marked superseded. Also, the invite layout gives a chat inside a workshop window 0 seats (section 2, item 51).
2. **Forcing a rep into two places at once.** Step 1's third reason, "They already have a chat in Rm 2242 then.", leads to a move the DB refuses: unique index `coffee_chat_placement_rep_idx` (`schema:621`). The v9 guess says it's allowed. It also breaks the Help check "never one rep in two places". Allow it (schema change), or refuse that case with the room-taken style toast?
3. **Forced chats and suggested fixes.** The v8 code-review decision says every chat on the board, pinned and sent included, is re-checked on each load and becomes a "move to … / remove" fix. v9 says forced chats are treated as allowed. Is a forced chat ever flagged again, for example if the sponsor later un-ticks something else?
4. **Partial sessions.** The app keeps part of a session that a workshop buffer cuts (for example 1:00–1:30) and shows the time on the cell and a note in the detail (`grid:87-92`, `grid:213-220`, `grid:348`). v12 says "The mock has no cell that uses only part of an hour", so the fixed 3-line cell has no place for it. Where does "1:00–1:30" go, and does the format line show the real count ("1 chat · 3 each")? The same goes for a rep whose cap gives a cell fewer than 2 or 4 chats.
5. **Walk notes.** The app's detail shows "Walk to Ivey between chats (1–2)" (`grid:349-359`). The mock's modal doesn't. Keep them in the modal?
6. **"Sent. Hackers are invited; this sponsor sees it under Your chats."** (`copy:214`, `grid:360`) isn't in the mock's modal. Drop it?
7. **Send dialog copy.** Mock: "Send N sponsors' schedules and fill up to N open seats? …". App: "… and invite hackers to N seats? …" (`copy:249-254`). The app's wording follows the 2026-11-19 "no open seats shown" decision. Keep the app's?
8. **Help Send paragraph.** The mock still says "open seats are offered again from 10:30 AM every 30 minutes". The app says round 1 ends at 10 AM, declines are re-sent at once, and new invites go out every 30 minutes from 10 AM (`copy:377`), per the decision "Declines re-send at once; round 1 expires 10 AM". Keep the app's?
9. **"answer by …".** The mock uses a fixed "answer by 10:00 AM". Real answer-by times vary (round 2 and later, re-asks after a move). Show each invite's `expiresAt`?
10. **Hacker names.** The mock shows first names only ("Ada"). `coffeeChatInvites.status` returns first plus last name. The Invites sheet tab uses first name plus last initial. Which one for the modal and the dialogs?
11. **Hacker ID format.** The placeholder says "Hacker ID, e.g. HW-1042", but real hacker IDs are words joined by dashes like "brave-otter-kite" (`src/lib/use-qr-scanner.ts:34`), and a badge QR may carry the user id. Change the example?
12. **Who can fill a seat.** The next person in line may already have a chat at that time, may be at the 2-live-chat cap, or (for "Someone else") may not have agreed to share with sponsors. `loadCandidates` only includes admitted hackers who agreed. Does "Next in line" skip to the first person who can take that seat? Can an organizer override the share agreement?
13. **"Someone else" wording.** The line says "Kim · goes to the front of the line", but v11 says the person "takes the seat straight away. They don't stay in the line." Is the wording right?
14. **Can a removed hacker come back?** After "Remove Ada", can a later round or "Next in line" offer Ada a seat with this sponsor again? Today declined and cancelled pairs are blocked in `planInviteRound` (`blocked`, `src/lib/coffee-chat-invites.ts:366`, `:381`).
15. **The preview vs the real next invite.** "Next in line" is per sponsor. The hacker who actually gets the next seat depends on who's free at that chat's time, so the preview can differ. Fine as a preview?
16. **Moving a sent chat.** v9 says "every hacker on that chat is back to Waiting". The server may move a hacker to another chat of that sponsor, or cancel them, if they clash at the new time (`invUtil:634` onward). Should the warning or the toast say so when it happens?
17. **Red colours.** The mock's hover red (`#b42318`) and the Remove zone's colours (`--danger #b42318`, `--danger-bg #fdecea`) aren't app tokens. NEXT.md says not to edit tokens or Tailwind config in this worktree. Use `destructive` / `destructive-dark` for both, or add tokens from the main folder first? Adding a red variant to the shared `DashboardButton` also touches a shared component.
18. **Sponsor order.** Is the mock's order (Sun Life, Canada Life, StarTech, Scotiabank, Commure, CSE) meant to be fixed, or is it just the data order? The app sorts by name.
19. **"Placed N chats."** Should it count the chats this run added (the mock counts after minus before) or the chats it placed, including ones it replaced?
20. **v11 guesses still open** (from its README): the title stays "This chat is confirmed." while the body says "This hour has … in 2 chats". The format pill stays "Group of 5" / "1-on-1 · 15 min". Step 2 keeps step 1's title. Workshop-reason wording. Newest organizer pick goes first. Edit mode only on sent chats. The modal's whole-chat "Remove" shares a word with each hacker's "Remove" ("Remove chat" was suggested). At 390px "Met at your booth" wraps.
21. **v10 guesses still open:** "Booked by organizers" is cut to "Booked by organi…" in the cell. "Not free" takes space from the format line. The sponsor shows as text in the cell and as a logo in the modal.
22. **QNX and other sponsors in live data.** Item 59 is only met if the live Coffee Chat Setup tab, prefs and reps hold just the 6 sponsors. Check the data before calling it done.
23. **Room Grid sheet.** Should a forced chat be marked in the "Coffee Chat Room Grid" tab? The mock doesn't say.
24. **Undo toast length.** The mock's Undo toast lasts 5 s (others 3.2 s). The app uses Sonner's default. Match the mock?
