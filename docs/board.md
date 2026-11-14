# Sponsor dashboard board

Branch `sponsor-dashboard` (based on `spon-judging`, PR #1112). Vision: docs/vision.md.
Checks: `npm test` (vitest), `npm run lint`, `npm run build`. Screenshots at 375px and 1280px.

## Milestones
- **M1 Synced schedule (walking skeleton):** a sponsor opens their link on a phone and sees their schedule and rooms from the run-of-show sheet, updated within about a minute. Organizers see the same data with an "Edit in Google Sheets" button.
- **M2 Interested hackers and auto-shortlist:** hackers rank sponsors on the live site, and each sponsor sees a shortlist of interested, consenting hackers with their links.
- **M3 Coffee chat booking:** sponsors book shortlisted hackers into the existing rooms × slots grid, tier cap from the master sheet, no double booking. Organizers assign reps and add chats in the sheet.
- **M4 Sponsor map:** booth and room markers on Pranav's floor plans (#1135). Nice to have.
- **M5 Sponsor judging:** sponsors score in Ethan's judge app (#1129) once it merges. Portal links to it.

## Backlog
- [ ] T02 Run-of-show Sheets reader with 60s cache · owns: src/server/api/utils/run-of-show-sheet.ts, src/server/api/utils/run-of-show-sheet.test.ts, src/env.js (RUN_OF_SHOW_SHEET only) · check: `npm test run-of-show-sheet` passes; test proves a second read within 60s does not call Sheets · deps: T01 · build: main · verify: code-reviewer
- [ ] T03 `sponsorSchedule.get` procedure (UUID input, returns that sponsor's rows plus all-hands events) · owns: src/server/api/routers/sponsor-schedule.ts, src/server/api/root.ts · check: `npm test sponsor-schedule` passes; name input returns 400; another sponsor's rows never returned · deps: T02 · build: main · verify: code-reviewer
- [ ] T05 Sponsor schedule page, phone first · owns: src/pages/sponsors/[uuid]/schedule.tsx, src/components/sponsors/schedule-list.tsx · check: `npm run build` passes; screenshot at 375px shows no sideways scroll and every item has a time and room · deps: T03 · build: main · verify: design-reviewer + accessibility-tester
- [ ] T06 Organizer run-of-show view with Edit in Google Sheets button · owns: src/pages/internal/sponsor-schedule.tsx · check: build passes; button href is the sheet URL; page redirects non-organizers (curl returns 307) · deps: T03, T04 · build: main · verify: code-reviewer
- [ ] T09 Hacker sponsor-interest form on the live site · owns: src/components/live/sponsor-interest.tsx, src/server/api/routers/sponsor-interest.ts · check: test that a hacker can save a ranking of the 6 sponsors and only their own; screenshot at 375px · deps: T08 · build: main · verify: code-reviewer + accessibility-tester
- [ ] T10 Auto-shortlist query · owns: src/server/api/utils/sponsor-shortlist.ts (+ test) · check: `npm test sponsor-shortlist` passes: excludes `agreeShareWithSponsors=false`, orders by rank, caps at 40 (`COFFEE_CHAT_SHORTLIST_SIZE`), returns hackerId, team, resume, GitHub, LinkedIn, Devpost · deps: T08 · build: main · verify: code-reviewer
- [ ] T11 Sponsor "Interested hackers" page with shortlist toggle (writes to sponsor-owned sheet column) · owns: src/pages/sponsors/[uuid]/hackers.tsx, src/server/api/routers/sponsor-shortlist.ts · check: build passes; toggling writes only that sponsor's column (test with mocked Sheets); screenshot at 375px · deps: T10 · build: main · verify: code-reviewer + design-reviewer

## Ready

## In progress

## Review
- [ ] T12 Sponsor judging shortlist goes up to 20 teams · owns: src/lib/sponsor-picks.ts · check: `MAX_SPONSOR_PICKS` is 20; `npm test` and `npm run build` pass; picks page lets you select a 20th team and blocks a 21st · deps: none · build: main · verify: code-reviewer · result: cap 20, sponsor home text now reads the constants
- [ ] T04 `SheetEditButton` component (opens the sheet in a new tab, "Edit in Google Sheets", read-only note) · owns: src/components/sponsors/sheet-edit-button.tsx · check: `npm run lint` passes; renders an `<a target="_blank" rel="noopener">` with the sheet URL · deps: none · build: main · verify: accessibility-tester · result: organizer-only, 44px tap target on phones
- [ ] T07 Coffee chat time grid fits a phone · owns: src/pages/sponsors/[uuid]/coffee-chats.tsx · check: screenshot at 360px shows no clipped or overflowing time chips · deps: none · build: main · verify: design-reviewer · result: 0 of 72 chips overflow at 360 and 375px (2 still clip at 320px); chips show 10:45, screen readers hear 10:45 AM
- [ ] T08 `sponsor_interest` table (user_id, sponsor_id, rank) and migration 0038 · owns: src/server/db/schema.ts (new table only), drizzle/ · check: migrates on a fresh DB and on a DB at main's 0037; `drizzle-kit generate` reports no changes · deps: none · build: main · verify: code-reviewer · result: 0038 migrates on a DB at 0037 and a fresh DB; no drift

## Done

## Blocked
- [ ] T01 Run-of-show row types and column map · owns: src/lib/run-of-show.ts (+ test with fixture rows) · check: `npm test run-of-show` parses fixture rows from the real header row · deps: none · **blocked on:** the sheet shared with the `SPONSOR_SHEETS_CLIENT_EMAIL` service account, and the tab names and header rows · build: main · verify: code-reviewer
