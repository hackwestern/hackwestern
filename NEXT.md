# NEXT: sponsor dashboard (folder `hackwestern-sponsor-dash`, branch `sponsor-dashboard` = PR #1165, behind :3013)

## Now
Fix the run-through's problems, in this order (full report: the session of 2026-11-20; screenshots were in the session scratchpad, not kept):
1. **Duplicate QNX.** The sheet says "QNX (BlackBerry)", the app's database says "QNX". The new auto-sync (d0825e8d) registered "QNX (BlackBerry)" as a second sponsor with no data, so Noah's "Your sponsors" shows the empty one (no tier, lead or workshop, so no coffee chat limit). Fix: pick one name (rename the database row or the sheet cell), remove the empty duplicate, and make auto-sync match names the way the rest of the app does (loose match) so this can't happen again.
2. **Sheet reads fail about 1 load in 3.** `findTabTitle` (src/server/api/utils/sponsor-sheets.ts, ~line 586) turns any Google error into "tab not found", so the organizer list 500s and the sponsor portal shows wrong defaults ("contact not assigned", no tier). Likely the Sheets per-minute quota: Sponsor Day-Of reads aren't cached. Fix: rethrow real API errors, cache the Day-Of read (like the 60 s loaders), and have the portal show "couldn't load" instead of blanks.
3. **Phone: the sponsor Chats calendar zooms the page out** (791 px wide on a 390 screen). `src/components/sponsors/coffee-setup/your-chats.tsx` ~line 105: make the calendar's scroll wrapper `relative` so its sr-only labels stay inside (same fix as the judging calendar).
4. **Sunday table on organizer Home disagrees with the judging board:** rooms (Scotiabank Rm 2110 vs free), TinyFish "Missing room" vs remote, and "Picks 0 of 5–15" for every sponsor even when shortlists are in.
5. **Scan page link** "Back to Coffee chats" builds `/sponsors//coffee-chats` before the sponsor ID is read (same fix as 5de1b754).
6. **Meal rooms disagree** in three places (portal Home is typed into `src/content/sponsor-home.ts`: Rm 1230; portal Schedule: Grand Hall; run of show: Rm 1110), plus a duplicate Friday bubble tea snack. Sun Life / Canada Life workshop rooms differ between Sponsor Day-Of (2230) and the run of show (2235). Data: ask Jazz which is right.
Smaller: organizer table splits names mid-word ("Commur e"); the site's top nav "Sponsors" link is off-screen on phones; "Re-run auto-schedule" and "Notify teams" run with no confirm step.

Checks before done: `SKIP_ENV_VALIDATION=1 npx vitest run` (only Apple Wallet fails locally), `npx tsc --noEmit -p .`, `SKIP_ENV_VALIDATION=1 npx eslint src --quiet` (0 errors, or Vercel's build fails), a look at :3013 at 1280 and 390. Commit and push to `sponsor-dashboard`.

## Where things stand (2026-11-20)
- Everything below is pushed to PR #1165 and the Vercel build passes (as of f3c41efb).
- Built: organizer Home (day view), judging board, coffee board v12, sponsor portal v3, maps on Luka's interactive floor plan (Ivey included), notifications by Slack only, tier cap on coffee chats, judging lock back (Sun 9 AM), shortlists due 9:45 AM, teams told when the organizer presses Notify teams, new sponsors auto-registered, Lucas's judging work merged and fixed (his top 5 draft table is migration 0063).
- Sheet (Spon Team RUN OF SHOW): Tier + Chatting hours + Tiers tab; app-written tabs locked; run of show tasks added. Never rename the "Sponsor Day-Of" tab.
- Guides: `docs/test-checklist.md`, `docs/slack-bot-setup.md`. Local server :3013 (public link https://desktop-h6d0rg9.tailc07d02.ts.net via Tailscale Funnel; off: `tailscale funnel --https=443 off`).

## Before Friday 5 PM (Jazz / Lucas)
- Slack settings on Vercel (see `docs/slack-bot-setup.md`), production migrations 0059 to 0063, merge PR #1165 to main, one real test DM.
- Lucas tests the Slack pings with his own account (guide, section 4).

## Open questions for Jazz
1. **Final hacker 30 min before a chat:** how long does the final hacker get to answer (invites close 20 min before a chat, 35 for Ivey), and does it replace the 30-minute rounds or add one last offer?
2. **Coffee Chat Setup column A:** keep ticking which sponsors do chats by hand, or take it from Sponsor Day-Of's "Coffee Chats & Interviews" checkbox?
3. **Coffee board:** refused drops as a small pop-up (now) or a dialog? "Goes to the front of the line" or "gets the seat" when an organizer picks a hacker by ID?
4. **SEI address:** Luka's map says 1317 Western Rd, the portal says 1151 Richmond St. Which is right?
5. **MLH** isn't in the app's sponsor list at all (so no portal link). Should it be?
6. **Meal and workshop rooms** (Now, item 6): which values are right?

## Files touched this session (main ones)
- Judging: `src/components/sponsors/organizer/judging-board/*`, `src/lib/judging-board.ts`, `src/server/api/utils/{judging-board-data,presentation-schedule,presentation-confirm}.ts`, `src/server/api/routers/{sponsor-presentations,sponsor-scoring}.ts`, `src/server/slack/presentation-*`
- Coffee chats: `src/server/api/{routers,utils}/coffee-chat-setup.ts`, `src/components/sponsors/coffee-setup/prefs-step.tsx`, `src/lib/coffee-chat-invites.ts` (Sunday crash fix)
- Portal / organizer: `src/components/sponsors/sponsor-shell.tsx`, `src/pages/sponsors/[uuid]/{picks,coffee-chats,map}.tsx`, `src/components/sponsors/organizer/{organizer-home,organizer-nav,run-of-show-tab}.tsx`, `src/lib/sponsor-organizer.ts`, `src/pages/live.tsx`
- Sheet reads: `src/server/api/utils/sponsor-sheets.ts`, `src/server/api/routers/sponsor-dashboard.ts`
- Migrations 0061 to 0063; `docs/decisions.md`, `docs/test-checklist.md`, `docs/slack-bot-setup.md`
- Other worktrees, all merged here (safe to remove): `hackwestern-judging-board`, `hackwestern-coffee-v12`, `hackwestern-maps`, `hackwestern-demo` (demo switcher, local only, NOT merged; Jazz said the demo isn't needed).
