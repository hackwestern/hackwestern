# Track E handoff: Google Sheet reads and writes (build-e-sheet)

2026-11-19. Branch `build-e-sheet`, not pushed.

## What changed in the app

1. **Sponsor Status is merged into Sponsor Day-Of.** `fetchAllSponsorInfo` reads Status, Booth location, Workshop room, Workshop time, Judging room, Team track filter, HW lead and the prize track checkbox from Sponsor Day-Of, by exact header name. If Sponsor Day-Of has no "Status" column, it falls back to the old tab ("Sponsor Status", "live sponsor info", "sponsor info"). The retired "(old) Sponsor Status" is never read. The function's shape is unchanged; `SponsorInfoRecord` gained `hasPrizeTrack: boolean | null`, and the sponsor list rows (`fetchSheetSponsors`) gained the same field.
2. **Status writes go to Sponsor Day-Of.** `writeSponsorStatus` in `sponsor-info-tab.ts` writes one cell in the sponsor's own row. It never adds a row and never creates a tab. `ensureSponsorInfoTab`, which created or patched the old tab and set dropdowns on it, is gone (its only caller was `setSponsorStatus`).
3. **Prize tracks come from the Sponsor Day-Of "Custom API / Prize Track" checkbox.** `prizeTrackSponsors()` (`sponsor-prize-track-sheet.ts`) is cached for 60 s. If the sheet can't be read or the column is missing, it logs once and uses the list in `src/content/sponsor-prize-tracks.ts`. Callers pass it to `hasPrizeTrack(name, tracks)` / `prizeTrackOf(name, tracks)`.
4. **Coffee Chat Setup mirror for the session model.** `coffee-chat-setup-sheet-mirror.ts` has a pure row builder (`setupSheetRows`), a DB loader, a writer, and `mirrorCoffeeChatSetup()`, which runs only when `sheetWritesEnabled()` is true. It uses the same queue, generation and timeout rules as the other mirrors. Column A "Sponsor" stays the organizers' column: each run keeps the sponsors listed there in order, adds any sponsor with saved preferences or reps who isn't listed, and rewrites columns B to K. Sheet text is in `src/content/coffee-chat-setup-sheet.ts`.
5. Sponsor Judging writes were not changed. The F track keeps that writer. Judging rooms now come from Sponsor Day-Of's "Judging room" column, through the same `judgingRoomsById` → `fetchAllSponsorInfo` path, so the F track doesn't need a header change.

## Files

- New: `src/server/api/utils/sponsor-prize-track-sheet.ts`, `src/server/api/utils/coffee-chat-setup-sheet-mirror.ts`, `src/content/coffee-chat-setup-sheet.ts`, and tests `src/server/api/utils/sponsor-day-of.test.ts`, `src/server/api/utils/coffee-chat-setup-sheet-mirror.test.ts` (fake data only).
- Owned, changed: `src/server/api/utils/sponsor-sheets.ts`, `src/server/api/utils/sponsor-info-tab.ts`.

### Small changes in other tracks' files (please keep them when merging)

- `src/server/api/routers/sponsor-dashboard.ts` (`setSponsorStatus`): it calls `writeSponsorStatus`. A sponsor missing from Sponsor Day-Of now gets NOT_FOUND instead of a new row on the old tab. The unused `cell` import is removed.
- The prize track checkbox replaces the built-in list. One-line changes: `hasPrizeTrack(x)` → `hasPrizeTrack(x, await prizeTrackSponsors())` (or a `prizeTracks` const):
  - `src/server/api/routers/sponsor-judging.ts` (2 places, F)
  - `src/server/api/routers/sponsor-scoring.ts` (2 places, F)
  - `src/server/api/routers/sponsor-presentations.ts` (2 places, F)
  - `src/server/api/routers/sponsor-portal.ts` (2 places, A)
  - `src/server/api/utils/sponsor-judging-sheet-mirror.ts`: the track rows loop over `prizeTrackSponsors()` instead of `SPONSOR_PRIZE_TRACKS` (F). The row names are now the Sponsor Day-Of spelling, for example "QNX (BlackBerry)" and "Sun Life", which matches what the Sponsor Judging tab already shows.
- **Not wired yet (track A):** call `void mirrorCoffeeChatSetup()` after every save of a sponsor's preferences, reps or shortlist (draft or submit) in the `coffeeChatSetup` router. Don't await it in the request.
- **Track C:** `src/content/coffee-chat-sessions.ts` line ~271 (help "Where data lives") still lists "Sponsor Status" as a tab. It should be removed from that list. I didn't edit the file because it's C's.

## Checks

- `tsc --noEmit`: clean.
- `vitest run`: 1527 pass, 4 skipped, 1 known failure (Apple Wallet). Baseline was 1507, plus 20 new tests.
- Read-only check against the real sheet (`_local/e-sheet-check.ts`, through the app's own readers, with sheet writes off): every Sponsor Day-Of field was found by header. There are 15 sponsors, and 6 have the prize track box ticked, the same set as the built-in list. Sponsor info gave 15 rows from Sponsor Day-Of: 2 with a status, 7 with a judging room, 4 with a workshop room and time, 2 with a track filter, and 10 with an HW lead. The status cell resolves (nothing written). The run of show reads 6 coffee chat sponsor rows, 35 events and 56 tasks, the same as before. The Coffee Chat Setup header matches the mirror.

## Sheet changes (done directly, 2026-11-19, with Jazz's OK)

Backup first: "Spon Team RUN OF SHOW backup 2026-11-19 pre-build". It's a full copy in the same Drive folder as the sheet. The link is in the track E report, not here, because this repo is public and the copy holds phone numbers. Drive lists the connected Google account as its owner, so check that its sharing suits you. No sharing or permissions were changed on the live sheet.

1. **Sponsor Day-Of:** inserted 6 columns after "Lead phone": E Status, F Booth location, G Workshop room, H Workshop time, I Judging room, J Team track filter. The contract checkboxes moved from E–Q to K–W, and formulas elsewhere shifted on their own. Values were moved cell by cell with paste-values from Sponsor Status (status, judging room, workshop room and time, track) and from Sponsor Judging (judging rooms for QNX, TinyFish and PCBWay, which only lived there). Status has the app's dropdown, and Team track filter has the track dropdown. Every new header has a note. The "Custom API / Prize Track" and "Coffee Chats & Interviews" headers have notes saying what the app does with them. The footer "How to use" text was updated: it no longer mentions the deleted Spon Team tab, and the digital top 5 is now a top 3.
2. **Sponsor Status:** renamed "(old) Sponsor Status", hidden, moved to the end, with a note in A1. Not deleted. Its booth cells only held "TBD", so they weren't moved (blank means not decided). Its HW Contact column matched HW lead for all 7 rows, so nothing was lost there. Coffee Chat Max Minutes wasn't moved: the session model replaced it, and it stays in the hidden tab.
3. **Coffee Chat Setup:** first duplicated as "(old) Coffee Chat Setup" (hidden, at the end), so the old window and hours data is kept. Then the live tab was cleared and rebuilt with header row 1: Sponsor, Preferences, Hackers per chat, Chat length, Primary rep, Primary phone, Reps (chats wanted · free sessions), Chats wanted, Hacker seats, Shortlist, Last saved. It has the same 6 sponsors in column A, each showing "Not started". The "Total" row is gone. The tab is grey now, and the A1 note says column A is the only column to type in.
4. **Rationale + Decisions:** updated the rows "Judging tab", "Sponsor Status tab", "Sheet tabs" (coffee chats), "Who judges" and "Results". The stale top 5 wording is now top 3. Slip, now fixed: one write landed one row too high and overwrote "Changes after invites" and the "JUDGING" heading. Both were restored with their exact earlier text right away, and the row order is checked.

## Decisions made here (for docs/decisions.md)

- **The judging room lives on Sponsor Day-Of, not Sponsor Judging.** Sponsor Judging is app-written and gets rewritten in full, so a room typed there would be wiped on the next mirror run. The app reads the "Judging room" column on Sponsor Day-Of and copies it to Sponsor Judging. Alternative: read it back from Sponsor Judging. Rejected, because it's circular and a grey tab would become an input.
- **Coffee Chat Setup column A is the one organizer column.** It's still what the run-of-show parser reads for "sponsors doing coffee chats". The mirror keeps it and fills the rest. Alternative: take the list from the "Coffee Chats & Interviews" checkbox. Not done, because CSE is listed on Coffee Chat Setup but its box isn't ticked. See the open questions.
- **Sponsor Day-Of headers are matched exactly, not with "contains".** Contract checkboxes like "Dedicated Workshop" and "Custom API / Prize Track" would otherwise be mistaken for the workshop and track columns.

## Open questions for Jazz

- **CSE coffee chats:** CSE is on Coffee Chat Setup, but its "Coffee Chats & Interviews" box on Sponsor Day-Of is unticked. Which is right?
- **Manulife and Commure judging rooms** ("RM 555", "RM 44") and their tracks were moved as they were. Neither has a prize track. Are they test values? Clear them if so.
- **Old coffee chat UI** (chat-setup-card, room blocks, coffee chat summary, the sponsor map) read the old window and hours columns, so they now show nothing for those fields. The sponsor portal's old "max minutes" booking is 0 for everyone. This is expected with the session model, but tracks A and C should remove or replace those pieces.
- **Production timing:** a server still on the old code reads "Sponsor Status", and that tab no longer exists under that name. Ship this branch before anyone relies on the Status, booth or judging room reads in production.

## Review fixes (2026-11-19)

1. **Renamed headers no longer fail silently.** `sponsorInfoFromDayOf` warns once (per process) when Sponsor Day-Of has no "Status", "Booth location" or "Judging room" column, naming the header. A missing Status column still falls back to the old tab names, and `fetchAllSponsorInfo` now warns when that fallback finds no tab either (it never will on the merged sheet, since the old tab is "(old) Sponsor Status").
2. **Failed prize-track reads are cached.** The loader itself catches, logs once and returns the built-in list, so the 60 s cache keeps the fallback too. A broken sheet costs one JWT authorize and two reads a minute instead of on every judging and portal request. Tests: `sponsor-prize-track-sheet.test.ts`.
3. **Coffee Chat Setup is updated in place.** The writer reads A2:Z, then makes one write to B1:K{n}: each listed sponsor's own row gets B to K, matched by the name in that row; other rows get null cells, which the Sheets API leaves alone. Column A of existing rows is never written. Sponsors not listed are appended under the last row that has anything in it, so they can't land beside an organizer note. Nothing is cleared, except that a row whose name an organizer deleted, and whose column B still holds the app's own Preferences text, gets B to K blanked. Duplicate names and "Total" are left alone. `SetupSheet.write` now accepts null cells. New pure planner: `setupSheetWrites`. Tests in `coffee-chat-setup-sheet-mirror.test.ts`.
4. **Prize-track matching takes the sheet's spelling.** A registered name also matches when it contains the entry's name outside brackets, so "QNX" matches "QNX (BlackBerry)". I didn't use a plain "entry contains the name" rule, because "Canada" would then match "Canada Life" (the existing test guards against that). Test in `src/lib/sponsor-prize-tracks.test.ts`.
5. **Status written to the wrong row if the sheet changes between read and write:** accepted risk, noted in a comment in `writeSponsorStatus`.
- `setSponsorStatus` gives the no-tab case its own message. Its error strings moved to `src/content/sponsor-status-sheet.ts`.
- The unused `SPONSOR_INFO_TAB_NAMES` re-export from `sponsor-info-tab.ts` is gone (the constant itself is still in `sponsor-sheets.ts`).

### Every sheet write is gated (found by track D)

Before this, `writeSponsorStatus`, the coffee chat booking grid and the judging picks write relied only on `getSheetsClient` using a read-only scope when writes are off. That's not a gate. Each Sheets write call in `src/server/api/utils/` now sits behind `sheetWritesEnabled()`. There are none outside utils/.

- `sponsor-info-tab.ts` `writeSponsorStatus` (values.update): with writes off it makes no Sheets call and returns `{ ok: true, written: false, reason: "sheet-writes-off" }`. `setSponsorStatus` treats that as success and returns `sheetWritten: false` plus a note ("Not written (sheet writes off)"). Test: `sponsor-day-of.test.ts` checks that no client method is called.
- `sponsor-coffee-chats.ts` `writeCoffeeChatGridFull`, `writeCoffeeChatGridDiff`, and both `batchUpdate` calls in `ensureCoffeeChatTab` (batchUpdate): `assertSheetWritesEnabled()` throws first. So the old portal booking save errors in dev with "not written (sheet writes off)", as it already did through the read-only scope.
- `sponsor-judging-teams.ts` `writeChosenTeams` (values.update ×2, values.append, batchUpdate): `assertSheetWritesEnabled()` throws at the top. `syncFinalToSheet` then logs and leaves the picks unsynced, which is correct.
- `coffee-chat-sheet-mirror.ts` `googleBookingsSheet` (batchUpdate, values.update, values.clear): already throws when writes are off. Its callers `mirrorCoffeeChats`, `mirrorSponsorJudging` (`sponsor-judging-sheet-mirror.ts`, sheet.clear) and `mirrorRoomGrid` (`coffee-chat-room-grid-mirror.ts`) check `sheetWritesEnabled()` first as well.
- `coffee-chat-setup-sheet-mirror.ts` `googleSetupSheet` (values.update, values.clear): already throws when writes are off, and `mirrorCoffeeChatSetup` checks first.

New helper: `assertSheetWritesEnabled(what)` in `run-of-show-sheet.ts`.
