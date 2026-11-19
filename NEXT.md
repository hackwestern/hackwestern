# NEXT: sponsor dashboard (worktree `hackwestern-coffee-prefs`, branch `coffee-prefs`)

## Now
1. Wait for / confirm the review-fix subagent finished on `coffee-prefs` (commits "Coffee chat board: …" after 89d41ac1). Then: `npx tsc --noEmit -p .`, `SKIP_ENV_VALIDATION=1 npx vitest run` (baseline: 1 known Apple Wallet failure), and merge `coffee-prefs` into `sponsor-dashboard` (in `~/hackwestern-sponsor-dash`, `git merge --no-edit coffee-prefs`). Don't push.
2. Start the 8-hour parallel build below.

## 8-hour build plan (code freeze ~2 PM Fri; sponsors use setup at the Fri 5 PM workshop)
Read first: docs/decisions.md (all 2026-11-19 entries, esp. "Jazz's answers to the full plan", "Turn off task pings", "Tracked sponsor help removed"), docs/specs/coffee-chat-sessions.md, ../hackwestern-sponsor-dash/mocks/CHANGES.md.
Make shared changes once on the main branch first (schema, router registration, sponsors.tsx tabs), then one worktree + port + code review per track:
A. Sponsor coffee chat setup (portal), mock sponsor-portal-flow-hacker-v6: Your team (name + phone required, crown primary, no email), preferences (hackers per chat 1–5; 1-on-1 = 15 min, groups = 30; availability grid of 1-h sessions, no "hackers free" counts; chats per rep incl. 0 with time shown), Review & submit; separate Shortlist flow (one shared list, cap = seats, scanned first, due 9:30 PM); "Your chats" calendar after Send.
B. Hacker invites from the schedule: exactly one invite per seat; round 1 Fri 10 PM (accept by Sat 10 AM); round 2 Sat 10:30 AM + automatic 30-min rounds; order scanned → shortlist → interested; reuse Slack Accept/Decline + email fallback.
C. Organizer coffee board tweaks (built in app already): copy icon beside phones (no Contact/Text/Call), chats asked per rep, Noah-only Send (login email), partial session for buffer-cut sessions (Sun Life 1:00–1:30), Room Grid sheet mirror, then wire Send → invites (B) and sponsor schedule.
D. My sponsors (mock organizer-my-sponsors-v3, tables): login-email matching, People = reps only, Arrival/Booth/CC workshop pills; NO help-request UI. Portal Help = lead's number (copy) + Noah emergency. "Now and next" under Happening now (event now/next + current task + next task with owner); hide Task pings tab (pings OFF).
E. Sheet: merge Sponsor Status into Sponsor Day-Of; Coffee Chat Setup columns for sessions; Sponsor Judging writes (top 3, team ID + Devpost link); prize tracks from the Sponsor Day-Of checkbox.
F. Saturday: Judging (mock sponsor-judging-redesign-d-v1 minus modes): one at a time or list like hacker judging, Holia 1–10 half-point score + rubric modal, several reps ("Who's judging?"), ranked top 3; digital (PCBWay) entered by Devpost links; TinyFish remote.
Later: task pings, tracked help (parked: docs/specs/parked-sponsor-help-requests.md), portal restyle (Today/Map/Schedule).

## Where things stand (2026-11-19)
- Organizer Coffee chats tab = v8 board in the app (algorithm + 23 tests, migration 0058 applied locally, router + 9 tests, review fixes landing). Send confirms the schedule only; hacker invites not wired yet.
- Earlier on this branch (merged into sponsor-dashboard locally, not pushed): Sponsor Status tab name, sponsor list from Sponsor Day-Of, organizer tours, Coffee Chat Setup tab read, missing-Judging-tab fix.
- Sheet reorganized to 10 tabs incl. "Rationale + Decisions" (first tab, keep in sync with docs/decisions.md). HW Contacts has Login email + Slack name ([ORGANIZER] Name).
- Mocks: gallery http://127.0.0.1:3040/mocks/ ; status in mocks/CHANGES.md.

## Open questions for Jazz
- Which on-call hours are wrong? Sheet (= app) says Noah Sat 1–4 AM, Alice Sat 4–8:30 AM, Aniya Sun 1–4 AM, Caroline Sun 4–7:30 AM, Daniel none; gaps Fri 11 PM–1 AM and Sat 11 PM–Sun 1 AM.
- Who merges PR #1165 and runs production migrations (0058+), and when on Friday?
- Sponsor Bay: SM Atrium or Rm 1235? Sun Life booth spot (layout file says right wall)?
- Commure / Manulife prize tracks (sheet lists tracks, prize list doesn't).
- Lucas's and Brittney's login emails (if they'll use the dashboard). Owner for the Sun 9 AM digital top-3 task.
- Tell the team: leads' numbers are shown to their sponsors; Judging tab was deleted (check with Lucas).

## Local setup
- App: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx next dev -p 3014` (organizer login: dev server signs sessions with `local-dev-only-secret`; see mocks/organizer-sponsors-home-v1/README.md).
- Tests: `SKIP_ENV_VALIDATION=1 npx vitest run`. Real-sheet read checks: `npx tsx --env-file=.env --tsconfig tsconfig.json _local/cc-check.ts` (read-only).
- Keep SHEET_WRITES off locally. Commit specific files only (never `git commit -a`): subagents may be working in the same worktree.

## Files touched this session (2026-11-19)
- App (coffee-prefs): src/server/api/utils/sponsor-sheets.ts, sponsor-info-tab.ts, run-of-show-sheet.ts, routers/sponsor-dashboard.ts, sponsor-portal.ts, schema.ts, content/sponsor-organizer.ts, organizer tours (src/lib/organizer-tours.ts, src/components/sponsors/tour/*, content/organizer-tour.ts), coffee chat board (src/lib/coffee-chat-schedule.ts, coffee-chat-sessions.ts, routers + utils + UI + content, drizzle/0058), docs/decisions.md, docs/specs/*.
- Mocks (sponsor-dash): ~30 new mock folders, mocks/index.html + screenshots.html (build-index.mjs), CHANGES.md, AUDIT-*.md, _data/*.
- Google Sheet "Spon Team RUN OF SHOW": reorganized (see Rationale + Decisions tab).
