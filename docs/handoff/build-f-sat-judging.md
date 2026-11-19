# Track F handoff: sponsor judging (2026-11-19)

Branch `build-f-sat-judging`. Not pushed.

## What's built

- **One at a time or a list.** The portal's Browse step has a two-way switch, like hacker judging. One at a time shows one project with Previous, Next unscored and Next, plus "4 of 6" and "2 of 6 scored by you". List keeps search, filters and sort. No quick pass, no "5 at a time". The phone remembers the choice.
- **Score 1 to 10 in half points.** It's a scroll-snap strip of 1, 1.5 … 10 (Holia's slider). You can swipe it, tap a number, use − / +, or use the arrow keys (Home/End, PageUp/PageDown). It's an ARIA slider. It stays dimmed and reads "–" until you touch it. **Rubric** opens the four newest criteria in a modal. Esc, the scrim or Close puts focus back on that Rubric button. The rubric text is in `src/content/sponsor-judging.ts` (`rubric`).
- **Several reps on one login.** "Who's judging?" lists the sponsor's reps from Your team (`coffee_chat_rep`), plus a "Someone else" name field. The phone remembers the name. Each rep's score goes in `sponsor_team_score` (halves 2–20). Every project shows who gave what ("Dana 9.5 · Kevin 6", avg 7.8). Reps 3 or more points apart get an amber "talk it through" flag. With two or more reps, the list is split evenly between them in name order ("Your 2" / "Everyone's 6"), and other reps' projects carry a "Kevin's list" tag. Anyone can still score any project.
- **Ranked top 3.** `SPONSOR_FINAL_TOP = 3`. The ranking shows 1st / 2nd / 3rd. Submit takes exactly 3. The copy, the organizer tab, the presentations copy, the organizer day-board labels ("Top 3 sent") and the sheet all use 3.
- **Sponsor Judging sheet tab.** It's rewritten in the wide layout: one row per prize track sponsor (Sponsor, In person / Digital, Judging room, Round 1 status, Shortlist sent, Shortlist (team IDs), Round 2 status, Top 3 sent, 1st, 2nd, 3rd place, Notes). Under it is a Presentations table (Sponsor, Team ID, Team, Members, Time, Room, Notified). Teams show as "team ID · devpost link". It only writes when `sheetWritesEnabled()`. Nothing was written to the live sheet.
- **Digital sponsors (PCBWay).** The portal refuses them. The organizer Sponsor judging tab has a "Digital sponsors" section where the spon team pastes a Devpost link (or team ID) for 1st to 3rd. Each match shows its name, ID and link under the field. Save stays off until all three match different submitted teams in that sponsor's track, and the server checks the same rule. If PCBWay has no `sponsor_judging_sponsor` row yet, one is created to store the result.
- **TinyFish judges remotely.** It uses the portal like any other sponsor. Its judging room is always "Remote (judges online)" (from `judgingRoomsById`), so the presentation schedule, hackers' notices and the sheet say so.
- **Coordinator bug (deleted "Judging" tab).** Submits no longer write to the deleted tab. `writeChosenTeams` is removed, and `sponsorJudging.getChosenTeams` now reads the database (`sponsor_final_pick`). A failed or disabled sheet write never blocks the save: it's stored first, `sheetSynced` stays false, and the next `get` retries. Tests cover this.

## Files

- Lib and content: `src/lib/sponsor-scoring.ts`, `src/lib/sponsor-prize-tracks.ts`, `src/content/sponsor-judging.ts`, `src/content/sponsor-prize-tracks.ts`, `src/content/sponsor-presentations.ts`, `src/content/sponsor-organizer.ts` (two labels only)
- Server: `src/server/api/routers/sponsor-scoring.ts`, `src/server/api/routers/sponsor-judging.ts`, `src/server/api/utils/sponsor-judging-sheet-mirror.ts`, `src/server/api/utils/sponsor-judging-teams.ts`, `src/server/api/utils/sponsor-judging-board.ts`
- Portal: `src/pages/sponsors/[uuid]/picks.tsx`, `src/components/sponsors/judging/` (new: `browse-projects.tsx`, `judge-picker.tsx`, `rubric-dialog.tsx`; changed: `score-control.tsx`, `project-card.tsx`, `shortlist-ranking.tsx`, `shortlist-send.tsx`, `use-sponsor-judging.ts`)
- Organizer: `src/components/sponsors/organizer/judging-tab.tsx`, new `digital-judging.tsx`
- Tests: `src/lib/sponsor-scoring.test.ts`, `src/server/api/routers/sponsor-scoring.test.ts`, `src/server/api/utils/sponsor-judging-sheet-mirror.test.ts`
- Check: `docs/handoff/build-f-check.mjs` (Playwright, screenshots in `docs/handoff/build-f-screens/`)

No schema, drizzle, root.ts, sponsors.tsx, coffee chat or sponsor-sheets/sponsor-info-tab files were touched.

## Decisions I made (for docs/decisions.md)

- **Old one-score column kept in step.** `sponsor_team_review.score` is set to the rounded team average on every rep score. That way the organizer day board's "scored" count (`sponsor-organizer.ts`, track D) stays right without editing that router. The real per-rep scores live in `sponsor_team_score`.
- **Split order.** The split uses the reps listed on Your team, plus whoever is judging on this phone if they aren't listed. With no reps listed, it uses everyone who has scored. Teams are split in name order, because teams have no table numbers in the app yet.
- **Same rep, different spelling.** Names are compared ignoring case and spacing, so "dana w." replaces "Dana W.", not a second score.
- **Digital sponsor rows.** A digital sponsor gets a DB row when its top 3 is first entered. Track E's "no portal link for Digital" needs to filter by the sheet's In person / Digital column, not by whether a DB row exists.
- **Lucas's pick limits.** `MIN_SPONSOR_PICKS = 5` in `src/lib/sponsor-picks.ts` is left alone. Top 3 no longer depends on it, since that tab is gone.

## Open questions for Jazz

1. Sheet status words: Round 1 is "Not started / Scoring / Shortlist sent". Round 2 is "Not open / Ranking / Locked: no presentations / Top 3 sent", and digital sponsors get "Waiting for the spon team / Entered by the spon team". OK? I also kept an "In person / Digital" column after Sponsor. Drop it if the tab no longer has one.
2. Should the split be by table once teams have tables? It's alphabetical for now.
3. Anyone on the login can send the shortlist and submit the top 3. That's the same as the mock. Is that fine?
4. Should the run-of-show judging panel stop showing "picks (5–20)" from the deleted Judging tab? It reads the old tab through `sponsor-sheets.ts` (track E), so it always shows unknown now. The fix belongs with track E or a follow-up: count `sponsor_final_pick` instead.
5. The Who's judging list only shows reps the sponsor entered on Your team. Anyone else uses "Someone else". OK?

## How I checked

- `SKIP_ENV_VALIDATION=1 npx tsc --noEmit -p .`: clean.
- `SKIP_ENV_VALIDATION=1 npx vitest run`: 1529 pass, 4 skipped, 1 fail (the known Apple Wallet test, failing before this branch too). Baseline was 1507 pass.
- `node docs/handoff/build-f-check.mjs http://localhost:3036 <sun life uuid>`: 28 of 28 checks pass.
- Chrome didn't respond, so I used headless Playwright against the dev server on port 3036 (3026 belongs to the hackwestern-sd-notify-center server). The script picks a rep, scores with + and the keys, opens and closes the rubric, adds a second rep who disagrees, switches to the list, and checks for sideways scroll and page errors at 1280 and 390 px. The organizer tab needs an organizer login, so I checked it through router tests instead (digital entry, overview with per-rep scores).
- Six "F demo:" teams (`fdemo000000x`) were added to the shared local DB for the check and removed afterwards.

## Review fixes (2026-11-19)

1. **Digital sponsors blocked everywhere.** New `assertPortalJudge` in `src/server/api/utils/sponsor-judging-guard.ts` is the one gate for every public judging and scoring call, including `sponsorJudging.listAllTeams` and `getChosenTeams`. No prize track or digital = FORBIDDEN. Digital comes from `isDigitalJudging` (`DIGITAL_JUDGING_SPONSORS`, the content copy of the In person / Digital column), not from a DB row. Track E's Sponsor Day-Of parser reads that column (`format`) on coffee-prefs, but it isn't on this branch, so the guard doesn't read the sheet live.
2. **Score races.** `score` now does the read, delete, upsert (`onConflictDoUpdate` on sponsor, team, judge name) and `syncReviewScore` in one transaction, behind a per-sponsor-and-team advisory lock. Three saves at once all succeed and leave one score. The test fails on the old code.
3. **Sheet retry storm.** `get` no longer awaits the mirror. It starts a background retry at most once a minute per sponsor (`SHEET_RETRY_GAP_MS`, module-level map), and a later `get` reads the synced mark.
4. **Organizers after close.** `submitDigital` no longer calls `assertOpen()`.
5. **Ambiguous Devpost links.** `matchTeamByLink` returns null when two teams share a link, and `linkIsAmbiguous` says why. The server and the organizer field both show "paste the team ID instead" (copy in `src/content/sponsor-judging.ts`).
6. **"top 5" comments** now say top 3 at the listed lines. Other "top 5" text is still there: `docs/flows/sponsor-judging.md` (lines 12, 37-58, including the old Tracks layout), `src/server/api/routers/sponsor-organizer.ts:39`, and `src/server/db/schema.ts:859` (schema is off limits).
7. **Run-of-show judging panel** counts saved picks from `sponsor_final_pick` (`savedPicksByName` in `sponsor-judging-board.ts`). A registered sponsor that hasn't submitted shows 0, not unknown. `MIN_SPONSOR_PICKS = SPONSOR_FINAL_TOP` (3). `MAX_SPONSOR_PICKS` is still 20, so the cell reads "3 of 3–20". The UI is unchanged. Sponsors without a prize track also show "too few picks". `fetchAllChosenTeams` (track E's file) is still used by `sponsor-dashboard` and `sponsor-portal`.
8. **Hidden characters in rep names.** `cleanJudgeName` strips `\u200b-\u200d\ufeff`, and `judgeKey` is built from it. A name made only of those characters is refused (BAD_REQUEST).
9. **Check script** rejects anything but a UUID before it reaches psql.
