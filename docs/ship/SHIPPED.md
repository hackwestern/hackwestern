# Shipped: sponsor tool build (2026-11-19)

The whole build is done, tested and pushed. It's on PR #1165 with a Vercel preview, but it isn't on the live site yet. Going live means merging into `main`, which also runs the production database migrations, so that's left for you or whoever merges #1165. The steps are below.

## What's live, and where

- **GitHub:** branches `coffee-prefs` and `sponsor-dashboard` are pushed. PR #1165 (sponsor-dashboard → spon-judging, still a draft) has everything.
- **Preview:** Vercel builds a preview for PR #1165. The link is on the PR's checks.
- **Not live:** `main`, the production site and the production database are unchanged.
- **Live Google Sheet:** these changes are already made, after a full backup copy (the link is in the session, not the repo, because the repo is public):
  - Sponsor Status was merged into Sponsor Day-Of.
  - Coffee Chat Setup was rebuilt for sessions.
  - A new "At CC workshop" checkbox column was added.
  - Old tabs were hidden with "(old)" in front, not deleted.

## What changed, in plain language

**Sponsors (portal):**
- **Your team:** add reps with a name and phone, and crown one as the main contact.
- **Preferences:**
  - Pick hackers per chat (1 to 5). 1-on-1 is 15 minutes, groups are 30.
  - Untick the sessions each rep isn't free (all start ticked), and set chats per rep (0 is fine).
  - Their own workshop blocks its sessions. A session it only cuts shows as "1:00–1:30 only".
- **Review & submit, then a separate shortlist:** one person picks, capped at their seats, with people met at the booth listed first.
- **Scanning at the booth** adds a hacker to "Met at your booth". Those hackers are invited first.
- **After organizers send:**
  - "Your chats" shows a calendar of reps and sessions with rooms, plus live invite counts.
  - Changes are still allowed, with one clear warning. The affected hackers are told.
- **Every screen** says where things stand, what changed, whether they need to do anything and what happens next.
- **Help** shows their Hack Western lead's phone and Noah as the emergency contact, each with a copy button. There's no request form.
- **Judging:**
  - Several reps can judge on one login, scoring 1 to 10 in half points, with a rubric.
  - They submit a ranked top 5 (1st to 5th).
  - Reps' scores fill a "Judging Scores" tab in the run-of-show sheet (production only). If the app is down, reps type scores there instead; the app never blanks a cell.
  - The page opens Sunday 9 AM.

**Organizers:**
- **Needs attention and Now and next** sit at the top: what's late, and what's on now and next with its owner. Task pings are off and their tab is gone.
- **My sponsors** shows the sponsors you lead, matched by your login email.
- **Coffee chat board:**
  - Auto-schedule and suggested fixes.
  - Plain status chips, and copy icons on phones.
  - "Walk to Ivey" notes, and a "Changed after invites" flag.
  - Undo after Remove.
- **Send (Noah only):**
  - Asks first, then confirms the schedules and invites hackers: one per seat, people met at the booth first, then the shortlist, then interested hackers.
  - Hackers answer by Sat 10 AM. Open seats are offered again every 30 minutes from 10:30.
- **Judging tab:** top 5, and PCBWay's top 5 entered by Devpost link.

**Safety:**
- Invites can't go out from dev or previews. A kill switch is on only on the production deploy, and there's a dry mode for testing.
- Every sheet write is off outside production.
- Tracked help can't post to Slack.

## Needs you

1. **Going live:** merge PR #1165 down to `main`, the same way as the other sponsor PRs.
   - The push to `main` runs migrations 0059 and 0060 on production. They only add tables and columns.
   - Do it before the Friday 5 PM workshop.
2. **Saturday invite rounds:**
   - Add the Production environment secrets the new workflow needs (the Slack bot token and the run-of-show sheet credentials). The existing workflows don't use them yet.
   - Then arm it on Saturday morning: `gh variable set COFFEE_ROUNDS_LIVE --body true`.
   - Rounds also run whenever someone has the page open, so this is the backup.
3. **Old task pings:** if any were already scheduled in Slack before pings were switched off, cancel them in Slack.
4. **Sheet questions:**
   - CSE is on Coffee Chat Setup, but its coffee chat box on Sponsor Day-Of isn't ticked. Which is right?
   - Manulife's and Commure's judging rooms ("RM 555", "RM 44"): are they test values?
   - Sun Life has no judging room yet, so its presentations and round 2 can't open.
5. **Backup sheet:** it's owned by the account this session used. Share it with the team if they need it.
6. **Open questions from before** (in NEXT.md): wrong on-call hours, the Sponsor Bay room, Commure and Manulife prize tracks, and Lucas's and Brittney's login emails.
7. **Local test data:** the walkthrough left fake data in your local database ("Walkthrough …" names, 555 phones). Re-running the coffee chat seed resets the chats; the cleanup SQL is in `docs/ship/clarity-review.md`.

Every call I made on my own, with what I considered, is in `docs/ship/decisions-log.md`. What was simplified is in `docs/ship/simplify-decisions.md`.

## Known limits

- **Hackers per chat after Send:** the sponsor's status card can't count a change made after Send, because the group size at Send isn't stored. The warning dialog does count it.
- **Move notices:** "Organizers moved Dana's chat" is remembered per device, so a sponsor on a new phone won't see it.
- **Needs attention** lists sponsors with a rep who has no chat. The board also flags reps who have fewer chats than they asked for ("1 rep short of chats").
- **Not tested end to end:** round 2 judging couldn't run, because Sun Life has no judging room on the sheet.

## Run the test guide in 10 minutes

1. Start the database container `hackwestern_db`, then run the app:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret COFFEE_INVITES_ENABLED=dry npx next dev -p 3014
   ```
2. Reset: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx tsx src/server/db/seed/coffee-chat-sessions.ts`
3. Sponsor (3 min): open `/sponsors/<Test Sponsor's id>`. The guide's Setup section says how to list the ids. Add a rep, set preferences, submit, then shortlist two people.
4. Organizer (3 min): sign in as described in the guide's "Signing in". Open `/internal/sponsors?tab=coffee`, press Auto-schedule, then Send, using a cookie with Noah's login email. The toast says "dry run: nothing was messaged".
5. Hand-off (2 min): reopen the sponsor link. "Your chats" shows the calendar and invite counts.
6. Change after invites (2 min): untick a session as the sponsor, read the warning, save, then check the organizer board for "Changed after invites".

The full guide, with every flow and edge case, is `docs/ship/test-guide.md`. The screen-by-screen review is `docs/ship/clarity-review.md`.
