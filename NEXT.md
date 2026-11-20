# NEXT: organizer judging board (worktree `hackwestern-judging-board`, branch `judging-board`, off `coffee-prefs` at 8fe8a520)

## Now
**Built and committed on `judging-board`; Jazz to look, then merge into `coffee-prefs` from the main folder.** Organizer judging board v2 with all five changes (see docs/decisions.md, "Judging board build choices", for the calls made while building). Checks passed: vitest 1810 (only the Apple Wallet test fails locally, missing signing key, untouched here), tsc, lint (0 errors), screenshots at 1280 and 390 with no sideways scroll in `mocks/judging-board-build-v1/screens/`.

Before merging:
- Migration is `drizzle/0061_judging_board.sql` (2 tables). If coffee-prefs also added a 0061, renumber this one and its snapshot/journal entry.
- Try it: DB `hackwestern_judgeboard` (a copy of hackwestern_spon, migrated + `scripts/seed-judging-board-demo.sql`); server `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_judgeboard SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret DEV_LOGIN_KEY=judgeboard-local npx next dev -p 3015`, sign in at /api/dev/login?key=judgeboard-local, open /internal/sponsors?tab=judging&at=9:20 (`at=` pins the clock in dev only).
- Slack Confirm button needs the app's interactivity URL already used by coffee chats (/api/slack/interactions): nothing new to configure.

## Notes
- A separate session is building the organizer Home in `hackwestern-coffee-prefs` at the same time. Don't edit shared files (global CSS, Tailwind config, root layout, tokens, schema base) here; if you need one changed, stop and tell Jazz.
- If accepting needs a new column or table (team judging confirmation), keep it to one small migration and note it in docs/decisions.md.
- Dev server for this worktree: port **3015** (same command as coffee-prefs' NEXT.md with `-p 3015`). Keep few dev servers running (Google Sheets read quota is tight).
- Tests: `SKIP_ENV_VALIDATION=1 npx vitest run`. Commit specific files only; no Co-Authored-By lines.
