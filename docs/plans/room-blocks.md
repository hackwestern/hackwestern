# Plan: coffee chat room blocks

Spec: `docs/flows/coffee-chat-room-blocks.md`. Decision log: docs/decisions.md 2026-11-18 "room blocks".

## Goal
Change the three room ideas (whole-day sponsor room, Move room, hold) into one: a **room block** (sponsor + room + time span) stored in the existing `coffee_chat_hold` table, with every chat placed inside its sponsor's block. Organizers give and release rooms from the rooms table, and sponsors see each block's open slots as "n of m chats filled".

## Ground rules for this build
- **No migration.** `coffee_chat_hold` already has sponsor, room, start, end and note. `coffee_chat.room` stays as it is: it is filled from the block when the offer is made, and block moves already rewrite it (`moveChatsToRoom`). `sponsor_judging_sponsor.coffee_chat_room` stays in the DB but nothing reads it any more. 0050 is not used.
- Keep the code names `hold`, `createHold`, `moveHold`, `deleteHold` and `coffee-chat-holds.ts`. Only comments and copy say "block", which keeps the diff small. Rename later if Jazz wants.
- All new text goes in `src/content/coffee-chat.ts`. Reuse DashboardButton, DashboardChip (length pills), SponsorBadge, HackerAvatar, AddChatHere and the tokens in `src/lib/tokens.ts`.
- To park a file, move it to a `_to_delete/` folder next to it. Never park a `*.test.ts`, because vitest does not skip `_to_delete` (only tsconfig and eslint do). Edit tests where they are.
- Baseline check, used after every step: `npx tsc --noEmit` is clean, and `SKIP_ENV_VALIDATION=1 npx vitest run` passes except the known Apple Wallet test.

## Steps

0. **Merge first, then branch.** Finish NEXT.md items 1-2 (`sd-judging-view` removes the room table legend and touches `coffee-chat-room-table.tsx` and `src/content/coffee-chat.ts`). Then `git checkout -b room-blocks` from `sponsor-dashboard` and commit.
   - Check: baseline passes, and `git log --oneline -3` shows the two merge commits.

1. **Block rules (pure).** Files: `src/lib/coffee-chat-holds.ts` and its test.
   - `HOLD_LENGTHS = [15,30,45,60,75,90]` and `MAX_HOLD_MINUTES = 90`. Labels come from copy: "15 min … 1 hr 15, 1 hr 30".
   - Add `blockSlots(block, format, liveChats)`, which returns slot starts one chat length apart: `{slotTime, booked, needed, chatIds}`. `needed` = hackers per slot (see Q1; the default is `coffeeChatSeats(reps, groupSize)`, which gives 1-on-1 with 1 rep = 1 and a group of 3 = 3).
   - Add `blockFill(...)`, which returns `{filled, total, firstOpen}`.
   - Add `chatsOutsideBlocks(chats, blocks)`.
   - `coffeeChatOfferRoom` becomes "the covering block's room, else null". Remove the moved, assigned and sheet room branches.
   - `holdsForSponsor` adds `filled`, `total` and `firstOpen`. `needsHacker` becomes `filled < total`.
   - Check: in `coffee-chat-holds.test.ts`, rewrite the "room precedence" describe as `describe("room blocks")` with these tests: "1-on-1 15 min block 9:00-10:00 has 4 slots needing 1", "group of 3, 30 min shows 0/3", "holdTimesProblem refuses 105 min", "offer room is the block's room, never the sheet's", "chatsOutsideBlocks finds an old chat with no block". The "holdsForSponsor (privacy)" tests still pass, plus a new "counts 1 of 4 chats filled".

2. **Copy.** File: `src/content/coffee-chat.ts`.
   - `errors.noBlock` = "Ask the sponsor team for a room at this time".
   - `errors.holdTimes` changes to say "up to 1 hr 30".
   - `errors.blockHasChats` is used when Release or Change length would leave a booked chat outside the block.
   - Add `roomTable.give` (title "Rm 2243 · 9:00 AM · Free", chat type line "1-on-1 · 15 min · 1 rep", length labels, "Give room").
   - Add `roomTable.block` (title, "Needs a hacker", "+ Add a hacker", `n/needed`, "Change length", "Release room", "Outside a room block").
   - Add `roomTable.strip` and `fillFromSheet`.
   - `sponsorHolds.line` → "Rm 2243 · 9:00-10:00 · 1 of 4 chats filled".
   - Remove the legend keys if the merge has not already done it.
   - Check: tsc is clean (old keys still referenced will show up as errors).

3. **Offer rules.** Files: `src/server/api/utils/coffee-chat-capacity.ts` and its test.
   - `offerStartTimes` = block slot starts only. The sheet window no longer makes times offerable.
   - `offerProblem` checks in this order: no own block covers the start → `"noBlock"`, not a slot start → `notInWindow`, then tooLate, full, hackerBusy, roomTaken. `notSetUp` folds into `noBlock`.
   - `offerRoomAt` = the block's room. `sponsorRoomAt` is no longer called, so remove it and its describe.
   - Check: in `coffee-chat-capacity.test.ts`, the "offerProblem" describe gets new tests "sheet window alone → noBlock", "inside a block → null", "block start 9:00, 15 min chats: 9:10 → notInWindow". The "freeStartTimes" describe gets "only block slots, earliest first".

4. **Router.** Files: `src/server/api/routers/coffee-chat-requests.ts` and its test.
   - `problemMessage.noBlock` maps to BAD_REQUEST.
   - `readCoffeeChatSetups` stops calling `applyAssignedRooms`, so `setup.room` is the sheet value and is only read by step 8.
   - `saveHold`: remove `windowRoomUses` from the clash uses (a sheet window no longer takes a room). Refuse a move or length change that would leave a live chat outside the block (`blockHasChats`).
   - `deleteHold`: refuse while live chats are inside (Q2).
   - `freeTimes.room` comes from the block. `sponsorChats.holds` carries the fill data.
   - Remove the `assignCoffeeChatRoom` and `moveRoom` procedures and `windowRoomUses`. `organizerRooms` stays (add-coffee-chat uses it) but loses `assignedRoom`.
   - Test helper: `makeSponsor(..., { block })` inserts a `coffee_chat_hold` row directly over the window with a unique label such as `Test Rm ${n}`. Many sponsors in one PGlite DB would otherwise clash over the three real rooms. Existing offer, freeTimes, respond, T26 and T43 tests then keep passing with `block: true`.
   - Check: replace the "assignCoffeeChatRoom (T41)" and "lock and moving a sponsor's slot" describes with `describe("room blocks (router)")`: "offer with no block is refused with the noBlock copy", "offer inside a block lands in the block's room", "two sponsors can't overlap a room", "a sheet window no longer blocks another sponsor's block", "Change length can't drop a booked chat", "Release refused while a chat is inside", "createHold refuses 105 minutes". Then the baseline.

5. **Board data.** Files: `src/server/api/utils/coffee-chat-board.ts` and its test.
   - `BoardSponsor` drops `assignedRoom` and `room`. It keeps `sheetRoom` (shown, and used for filling) and adds `strip: {durationMinutes, groupSize, reps, blocks, booked, needed}`.
   - `BoardHold` adds `slots` (from `blockSlots`), `filled` and `total`.
   - Table rows still come from sheet windows plus blocks plus chats, so free cells exist before any block. A window only adds rows, never seats.
   - Check: `coffee-chat-board.test.ts` "buildChatBoard with room holds" adds "block slots show booked/needed", "sheet window gives rows but no offerable cells", "strip sums booked/needed over a sponsor's blocks".

6. **Room table data.** Files: `src/lib/coffee-chat-room-table.ts` and its test.
   - Occupants come only from blocks and live chats. Remove `windowRoom` and the `c.room ?? s.room` fallback.
   - Each cell carries `block: {holdId, slotTime, booked, needed} | null`.
   - A live chat with a room but no covering block becomes an occupant with `outsideBlock: true`, so **old DB chats still show** in their stored room and still count for clashes and the 6-person check.
   - A chat with `room = null` has no cell. It shows in the strip as "no room yet" and stays in the Booked chats list.
   - `over` (more than 6 people) stays as a warning only. Remove the `used/capacity` text from cells.
   - `boardStats.roomsInUse` comes from blocks. `needsHacker` = open block slots.
   - Check: `coffee-chat-room-table.test.ts` "buildRoomTable" adds "sheet window alone leaves the room free", "old chat outside any block shows flagged outsideBlock", "group-of-3 slot reads 0/3", "7 people → over warning".

7. **Organizer dialogs.** Files: `src/components/sponsors/coffee-chat-room-table.tsx` and `src/components/sponsors/room-holds.tsx` (rewritten in place: `GiveRoomForm`, `BlockPanel`).
   - Free cell: sponsor `<select>` with a chat type and reps line under it, length pills (DashboardChip), and Give room (`createHold`).
   - Block cell: one row per slot with HackerAvatar, first name, StatusChip and `n/needed`. Open slots get "+ Add a hacker", which expands the existing `AddChatHere` for that slot. Change length reuses the same pills (`moveHold`). Release room (`deleteHold`) asks for confirmation first. Server errors show inline.
   - Outside-block cell: shows the chat and a "Give room" button prefilled to wrap it.
   - Remove `MoveHere`, the bookable-sponsor flow and the "In this room" section. Cells show the badge plus `booked/needed`.
   - Check, browser at `http://localhost:3013/internal/sponsors?tab=coffee` (dev command in NEXT.md): (a) free cell → pick CSE, 1 hour, Give room → 4 rows reading 0/1. (b) "+ Add a hacker" on 9:15 → the row reads 1/1 Pending. (c) Give another sponsor an overlapping room → inline "Rm 2243 is … then". (d) Release with a chat inside → refused. Save screenshots to `mocks/room-blocks-v1/`.

8. **Coffee chats tab strip + fill from sheet.** Files: new `src/components/sponsors/sponsor-chat-strip.tsx`, `src/components/sponsors/coffee-chat-board.tsx`, router (`fillBlocksFromSheet`) and its test.
   - The strip sits above the room table in the Rooms view. Per sponsor it shows the logo, chat type, reps, blocks and booked/needed. Clicking a sponsor highlights it (replacing the filter chips in this view; the By sponsor view keeps SponsorFilter). No legend.
   - `fillBlocksFromSheet` (organizers only, safe to run twice):
     - For each sponsor with **no blocks**, a sheet ROOM that is Rm 2241-2243 and a window, it creates back-to-back blocks of up to 90 minutes.
     - It then wraps each live chat that has a room and no block in a block the length of the chat.
     - It skips clashes and returns `{created, skipped:[{sponsor, reason}]}`.
     - A button in the strip header runs it, and the skipped list shows inline.
   - Check: router test `describe("fillBlocksFromSheet")` with "9:00-12:00 becomes two 90-min blocks", "second run creates nothing", "wraps an old chat outside any block", "skips a sponsor whose sheet room clashes". Browser: the strip shows "1-on-1 · 15 min · 1 rep · 2 blocks · 0/12", and after Fill the table shows blocks where the sheet rooms were.

9. **Remove the whole-day room UI.** Files: `src/components/sponsors/coffee-chat-fields.tsx` (remove `SponsorRoomSelect`, keep `WatcherInput`), `coffee-chat-board.tsx` SponsorHeader, `organizer/sponsors-tab.tsx` SponsorDetails, `organizer/coffee-chats-tab.tsx` (BookedChat loses Move room), `src/lib/sponsor-organizer.ts` (Sponsors table room = block rooms, from `holds`) and its test.
   - Check: "buildSponsorSummaries, combined sponsor table" gains "room column lists block rooms, ignores coffee_chat_room". `rg "assignCoffeeChatRoom|moveRoom|SponsorRoomSelect" src` finds nothing outside `_to_delete`.

10. **Sponsor side.** Files: `src/components/sponsors/sponsor-holds.tsx`, `src/pages/sponsors/[uuid]/coffee-chats.tsx`, `src/lib/sponsor-next-event.ts` (+test), the scan page's empty times state, and `src/server/api/routers/sponsor-schedule.ts` (stop `applyAssignedRooms`; the window event shows no room, blocks carry the room).
    - The line reads "Rm 2243 · 9:00-10:00 · 1 of 4 chats filled". Pick from candidates and Scan a badge show while any slot is open, and Scan links `?time=<firstOpen>`.
    - Check: `sponsor-next-event.test.ts` adds "a block with an open slot needs a hacker"; `sponsor-schedule.test.ts` "sponsorSchedule.get" is updated. Browser at `/sponsors/<id>/coffee-chats`: the line and both buttons appear. Scan a badge preselects the first open slot. A sponsor with no block sees "Ask the sponsor team for a room at this time" on scan.

11. **Clean up and log.** Remove the functions nothing calls any more (`applyAssignedRooms`, `resolveCoffeeChatRoom`, `coffeeChatRoomClash`, `coffeeChatWindowsOverlap`) and their tests in `src/lib/coffee-chat-requests.test.ts`. Park `src/components/sponsors/_to_delete/coffee-chat-rooms.tsx` (already parked, leave it). Update the docs/decisions.md 2026-11-18 entry from "proposed" to built, with the Q1 and Q2 answers. Update NEXT.md.
    - Check: baseline, `npx next lint` has no new warnings, and screenshots of steps 7, 8 and 10 are in `mocks/room-blocks-v1/`.

## What goes away or is parked
- Gone: per-sponsor assigned room (`assignCoffeeChatRoom`, `SponsorRoomSelect`, Sponsors-table room picker), Move room on a chat (`moveRoom`), sheet ROOM and window as room occupancy (`windowRoomUses`, `applyAssignedRooms`), room table legend, `used/6` cell text, 2 h and 4 h lengths.
- Left in place, unused: column `sponsor_judging_sponsor.coffee_chat_room` (drop it in a later migration if wanted).

## Risks (commit before steps 3, 4, 6 and 7)
- **Offers break for every sponsor until blocks exist.** Times now come only from blocks. Run Fill from sheet (step 8) on the real DB right after deploy, before sponsors start offering. Steps 3-4 land before 8 on the branch, but only the branch, never prod.
- **Router tests depend on window-based offers.** The `block: true` helper with fake room labels is what keeps them meaningful. If PGlite's shared DB still clashes, give each describe its own times.
- **Merge conflicts** with `sd-judging-view` in `coffee-chat-room-table.tsx` and `content/coffee-chat.ts`. Step 0 removes them by merging first.
- Old holds longer than 90 min still load. Change length offers the pills plus the current length (as `room-holds.tsx` does today). Saving a new length over 90 is refused.
- Chats with `room = null` (sponsor never had a room) don't appear on the room table. Fill from sheet can't wrap them, so the strip flags them and an organizer gives a room at that time by hand. Giving the room moves them in, because `saveHold` already moves the sponsor's chats.
- Lock order stays the same: room-writes lock, then sponsor row, then hold or chat. `fillBlocksFromSheet` must take the room-writes lock first, like `saveHold`.

## Open questions for Jazz
1. **Hackers per slot with more than one rep.** A 1-on-1 sponsor with 3 reps today can run 3 chats at once. Should a slot need 3 (shows 0/3, keeps today's capacity) or 1 (one chat per slot, less capacity)? The plan assumes 3, which still shows 0/1 for a 1-rep sponsor.
2. **Release room or shorten a block that has booked hackers.** Should it be refused until the chats are cancelled (plan default), or allowed, with those chats kept in the room and flagged "Outside a room block"?
3. **"A whole day is one long block" against the 1 hr 30 cap.** The plan caps blocks at 90 minutes and lets Fill from sheet chain back-to-back blocks for long windows. Is that right, or should Fill (or Change length) be allowed to go longer than 1 hr 30?
