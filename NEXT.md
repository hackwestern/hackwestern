# NEXT — sponsor dashboard (branch `sponsor-dashboard`, not pushed)

## Now
Run the board (`docs/board.md`). Round 1 = verify the 11 tasks in **Review** with checker agents (code-reviewer / design-reviewer / accessibility-tester per card). Pass → Done. That unblocks the Backlog.

## Then (parallel, owns don't overlap)
- T10 auto-shortlist query (deps T08)
- T14 sponsor rep count (deps T13)
- T21 Coffee Chats tab reader — mostly done already: `parseCoffeeChatsTab` in `src/server/api/utils/run-of-show-parse.ts` reads window/format/group size/room; card may just need its check run
- T09 hacker sponsor-interest form (deps T08)
Then T15 → T16 → T17/T18/T19/T20 → T22/T23 → T26, then T11.

## Blocked
- T24: Jazz creates the Slack app (docs/runbooks/slack-coffee-chat-bot.md). T22/T23 must skip silently with no SLACK_BOT_TOKEN.

## Done this session (2026-11-14)
- Live sheet connected: service account `hw-run-of-show@hackwestern-sheets.iam.gserviceaccount.com` (Viewer on the run-of-show sheet), key in `.env` as RUN_OF_SHOW_SHEETS_*; RUN_OF_SHOW_SHEET set. Same three vars still need adding in **Vercel** before deploy.
- Coffee chat table + rules (0039), schedule / where-is-everyone / organizer pages (bd8ea9f). Screens in mocks/sponsor-schedule-v1, v2.
- Not yet run: `npm run build` (run before opening a PR).

## Local setup
- Dev server: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_spon R2_PUBLIC_BASE_URL=http://localhost:3013 NEXTAUTH_SECRET=local-dev-only-secret NEXTAUTH_URL=http://localhost:3013 SKIP_ENV_VALIDATION=1 npx next dev --turbopack -p 3013`
- Local DB has test sponsors StarTech, Sun Life, Canada Life, Scotiabank, Commure, CSE.
- Phone screenshots: body is the scroll box on mobile, so use a tall viewport, not fullPage.
- Editing docs/board.md: write a small script file; inline `node -e` / python escaping has mangled regexes and newlines twice.

## Ask the spon team
- ROOM column in the Coffee Chats tab (rooms per sponsor)
- Canada Life CHATTING HOURS 3 vs a 2-hour window
- Scotiabank, Commure, CSE coffee chat rows are blank
- Room for Sponsor Track Shortlisting
