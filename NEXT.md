# NEXT: organizer judging board (worktree `hackwestern-judging-board`, branch `judging-board`, off `coffee-prefs` at 8fe8a520)

## Now
Build the organizer Judging board from mock `hackwestern-sponsor-dash/mocks/organizer-judging-board-v2` (http://127.0.0.1:3040/mocks/organizer-judging-board-v2/index.html, read its README) into the organizer Judging board (existing code: `src/components/sponsors/organizer/judging-tab.tsx`, `judging-panel.tsx`, `src/server/api/utils/sponsor-judging-board.ts`, spec `docs/specs/judging-room-board.md`). Jazz approved v2 on 2026-11-19 with these changes (see docs/decisions.md, last entry):

1. **Team status is only three states: "Invite not sent", "Waiting", "Accepted".** "Accepted" = at least ONE hacker on the team replied to the Slack bot or to their live-site notification confirming their judging time. One reply covers the whole team.
2. **No presenting / presented tracking.** Drop "Presenting now" and "Presented" from cells, legend, modal and schedule view. We only track whether the team has accepted.
3. **Phone numbers get a copy icon** instead of the "Copy" text button (icon button with an aria-label, like the mock's other icon buttons).
4. **Show the sponsor's head rep (lead) phone number with the same copy icon** on each sponsor (row / details), not only inside the "Text lead" warning.
5. **Remote teams don't present.** Take the remote list (TinyFish, "Remote (judges online)", striped cells) out of the presentation flow entirely: no slots, no invites, no remote column in the calendar or schedule. Assumption made when writing this: "remote" means the remote-judging sponsor's list from the mock. If the code shows remote *hackers'* teams are a separate thing, ask Jazz before guessing.

Everything else as the v2 mock. Copy goes in content files (`src/content/`), not components. Check before done: `SKIP_ENV_VALIDATION=1 npx vitest run`, `npx tsc --noEmit`, lint, and screenshots at 1280 and 390. Commit to `judging-board`; don't push or merge (merge into `coffee-prefs` from the main folder after it passes).

## Notes
- A separate session is building the organizer Home in `hackwestern-coffee-prefs` at the same time. Don't edit shared files (global CSS, Tailwind config, root layout, tokens, schema base) here; if you need one changed, stop and tell Jazz.
- If accepting needs a new column or table (team judging confirmation), keep it to one small migration and note it in docs/decisions.md.
- Dev server for this worktree: port **3015** (same command as coffee-prefs' NEXT.md with `-p 3015`). Keep few dev servers running (Google Sheets read quota is tight).
- Tests: `SKIP_ENV_VALIDATION=1 npx vitest run`. Commit specific files only; no Co-Authored-By lines.
