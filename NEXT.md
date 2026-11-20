# NEXT: organizer coffee chat board v12 (worktree `hackwestern-coffee-v12`, branch `coffee-board-v12`, off `coffee-prefs` at 75149112)

## Now
Build the organizer coffee chat board to match mock `hackwestern-sponsor-dash/mocks/organizer-coffee-v12` (http://127.0.0.1:3040/mocks/organizer-coffee-v12/index.html) in full: behaviour, not just the look (Jazz, 2026-11-19: "follow everything"). v12 = v11 + real sponsor data, and v11 builds on v10 and v9, so all of v9–v12 is in scope (read each README). Gap list: `docs/plans/coffee-board-v12-gap.md`. Existing code: `src/components/sponsors/organizer/coffee-sessions/`, `src/server/api/routers/coffee-chat-sessions.ts`.

Check before done: `SKIP_ENV_VALIDATION=1 npx vitest run`, `npx tsc --noEmit`, lint, screenshots at 1280 and 390 (no sideways scroll). Commit to `coffee-board-v12`; merge into `coffee-prefs` from the main folder after it passes.

## Notes
- Mock-only data (made-up reps, phones, free times) is not built; the board uses real data.
- Don't edit shared files (global CSS, Tailwind config, root layout, tokens, schema base) here: the coffee-prefs session has uncommitted changes to tokens.ts and sponsor-shell.tsx. If one needs changing, stop and tell Jazz.
- Dev server: port 3017, own DB copy (`hackwestern_coffeev12`, copied from hackwestern_spon). Command: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_coffeev12 SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret DEV_LOGIN_KEY=coffee-local npx next dev -p 3017`.
- Commits: specific files only, no Co-Authored-By lines.
