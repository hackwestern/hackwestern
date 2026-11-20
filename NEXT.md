# NEXT: sponsor dashboard (folder `hackwestern-sponsor-dash`, branch `sponsor-dashboard`; ships as PR #1208)

Event: HW13, Fri Nov 20 to Sun Nov 22. Sponsors need the live site by **Friday 5 PM**. Coffee chat deadline and invites: **Friday 10:00 PM**.

## Now (Jazz wakes ~2 PM Friday)
1. **Get #1208 approved and merged.** https://github.com/hackwestern/hackwestern/pull/1208 (branch `sponsor-dashboard-final`, worktree `../hackwestern-sponsor-pr`). One approval from someone with write access (Lucas); admins can't bypass. Squash and merge. GitHub's migrate workflow then applies migration `0048_sponsor_dashboard` to production (written to skip anything that exists; tested on a fresh DB, a DB that has it, and a DB with the old sponsor tables) and Vercel deploys. All CI checks passed at 306f6dbc.
2. **After merge:** check the live sponsor portal and organizer pages load; send one test Slack DM (`docs/slack-bot-setup.md` section 4); then send sponsors their portal links.
3. **#1207 organizer Slack reminders** (the Events "task ping" message was sent): merge it and set `ORGANIZER_NOTIFICATIONS_ENABLED` (and `ORGANIZER_SLACK_IDS` etc.) in Vercel. It shares 4 files with #1208 (`.env.example`, `docs/decisions.md`, `package.json`, `src/server/slack/client.ts`): if it conflicts after #1208 merges, fix those.
4. **Sheet:** tick "Coffee Chats & Interviews" on Sponsor Day-Of for CSE if they do chats (it was in the old Coffee Chat Setup list, box is unticked). TinyFish needs a judging room (now in person). Clear the Judging Scores tab if it has old 15-team blocks (blocks are now 20 rows).
5. **Spon team feedback:** they test the laptop copy and DM Jazz Agentation notes ("Question: …" for questions). Paste them into a new session; answer questions, build the rest.

## Laptop test copy (for the spon team)
- Link https://desktop-h6d0rg9.tailc07d02.ts.net/login (Tailscale Funnel → :3013). Login details: `_local/test-copy-login.md` (git-ignored; test DB only).
- Production build of `sponsor-dashboard` on local DB `hackwestern_spon` (Docker `hackwestern_db`). Restart with:
  `NEXT_PUBLIC_AGENTATION=1 SKIP_ENV_VALIDATION=1 npx next build`, then
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_spon SKIP_ENV_VALIDATION=1 SHEET_WRITES=0 COFFEE_INVITES_ENABLED=dry NEXTAUTH_URL=https://desktop-h6d0rg9.tailc07d02.ts.net npx next start -p 3013`
- Safe: no sheet writes, invites saved but never sent, no Slack. Laptop must stay awake.

## Follow-ups (after Friday 5 PM)
- **Booked coffee chats send the hacker a Slack DM** (Jazz said yes; "Book an event" makes an accepted chat but nobody is messaged).
- **Speed:** measured getSponsors at ~6 s (Google Sheets) vs ~0.25 s for DB-only calls. Approved plan: keep the sheet for editing, but keep a DB copy of each sheet read refreshed in the background so pages never wait on Google (a subagent started it and was stopped before changing anything). Also fewer background refreshes on hidden tabs.
- Shortlist queue size: `shortlistPoolSize` (hackers wanted + 20, min 40) is in `src/lib/coffee-chat-requests.ts` but unused, since Lucas's change lists every sharing hacker; use it to size only the review queue if wanted.
- Open questions: refused-drop pop-up vs dialog on the coffee board; SEI address (1317 Western Rd vs 1151 Richmond St); MLH as a sponsor; meal rooms (portal Home Rm 1230, Schedule Grand Hall, run of show Rm 1110) and Sun Life/Canada Life workshop room (2230 vs 2235).

## Done this session (2026-11-20, details in docs/decisions.md)
Organizer Home judging matches the board; scan back link; final-call invite 30 min before a chat; organizer feedback rounds 1–34 (coffee board locks after Notify hackers, any organizer can notify, Book an event, judging typed rooms + 18 slots + Notify confirm, sponsor judging finalists, Home table rows, 10 PM deadline, TinyFish in person); Lucas's "verified slack msgs" merged; old PRs #1165, #1173–#1176 closed (Lucas's #1143 left for him); seats fill from the whole interest list; Coffee Chats & Interviews checkbox replaces Coffee Chat Setup column A (tab now fully locked); SPON CONTACTS block removed from RUN OF SHOW; A1 notes on every tab the app reads; Rationale + Decisions locked.
