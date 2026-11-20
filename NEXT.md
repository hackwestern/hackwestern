# NEXT: organizer coffee chat board v12 (worktree `hackwestern-coffee-v12`, branch `coffee-board-v12`, off `coffee-prefs` at 75149112)

## Now
Build the organizer coffee chat board to match mock `hackwestern-sponsor-dash/mocks/organizer-coffee-v12` in full (gap list: `docs/plans/coffee-board-v12-gap.md`).

**Done (2026-11-19):** server (4dfeb183), pure board view + tests (175e0cb8), the UI (3b1352f7): mouse drag and 250 ms touch-hold drag with "Drop here" cells, amber outline on non-lit cells, Remove zone over the bar, edge scroll, Esc cancels, board frozen (no refetch) during a drag; fixed 66px cells, rep first, Sent/Draft dot + legend, "N chats · N each", "Not free" pill, booking lines, workshop start–end; the grid hint; chat modal (bottom sheet on phones) with hackers grouped by chat, summary line, draft note, Move to… list; sent-chat move/remove warnings (red); the two-step "isn't free" dialog (contact, then confirm); workshop and two-places drops refused with toasts; Edit hackers (red Remove per row), remove a hacker with next in line / someone else by ID (camera or typed), Put someone first in line, next-in-line preview; toasts count chats; Undo toast 5 s. Demo seed: `scripts/seed-coffee-board-v12-demo.sql` (rerunnable, local only).

**Left:**
- Browser check: not done (Jazz skipped screenshots). `mocks/coffee-board-v12-build/verify.mjs` drives every flow against the seed but has never been run. The dev server needs the worktree's own `.env` (none here: R2 and run-of-show sheet vars are missing, so the page 500s and the board is locked without the sheet).
- Gap item 59 (only the 6 coffee sponsors) is a live-data check.

**Questions for Jazz:**
- OK that drops into the workshop window or onto a rep's other chat just show an error toast (no dialog)? That's how I read "never".
- The "Someone else" line says "goes to the front of the line" (mock wording) though they take the seat at once. Keep?

## Notes
- Mock-only data (made-up reps, phones, free times) is not built; the board uses real data.
- Don't edit shared files (global CSS, Tailwind config, root layout, tokens, schema base) here: the coffee-prefs session has uncommitted changes to tokens.ts and sponsor-shell.tsx. If one needs changing, stop and tell Jazz.
- Dev server: port 3017, own DB copy (`hackwestern_coffeev12`, copied from hackwestern_spon). Command: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_coffeev12 SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret DEV_LOGIN_KEY=coffee-local npx next dev -p 3017`.
- Commits: specific files only, no Co-Authored-By lines.
