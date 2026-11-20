# HW13 organizer Slack reminders

Every organizer gets a Slack DM 15 minutes before each of their tasks on the HW 13 Run of Show sheet ("Schedule View" tab). The DM has the task title in bold, everything else in the cell (Starts, Location, Notes), who they're with, and what's next for them.

Slack holds the queue of DMs. A sync reads the sheet and makes that queue match it, so there's no database. GitHub Actions runs a sync every 5 minutes over the weekend (`.github/workflows/organizer-reminders.yml`).

## How it reads the sheet

- **Title** is the first line of the cell.
- **Owners** come from lines starting `Owner:`, `Owners:`, `Dock crew:`, `Emcees:` or `Horses:`, plus lines like `Jasmine: run the judging platform`. Typos it knows: Brittany, Lucus, Luca.
- **Teams:** `Spon`, `Sponsorship`, `Web`, `Events`, `Marketing`, `Design` in an owner line pings that whole team (Position column of the HW13 Contacts sheet). A team word in brackets, like "Caroline (Spon track winners)", is a note and doesn't count.
- **Everyone / All organizers** pings everyone in the "Free" column. `Everyone except Sarina, Daniel` leaves those two out.
- **Names it doesn't know are ignored.** A task with no name it knows is skipped, and you get told (below).
- The same task repeated on the next rows (Celsius Run at 1:00 and 2:00) is one reminder.
- Overnight notes are read too. "Holia takes over from 4:00" pings Holia before 4:00, not midnight.
- Slack accounts come from the Contacts sheet emails. Lillian's Slack email is different, so her Slack id is pinned in `KNOWN_SLACK_IDS`. "Jess" is Jessica Xing (her Slack name is "Jess Xing") and "Jessica" is Jessica Wang (`NICKNAMES`).

## Commands

Put `ORGANIZER_RUN_OF_SHOW_PATH=context/HW13_Run_of_Show_snapshot.csv ORGANIZER_CONTACTS_PATH=context/HW13_Contacts.local.csv` in front to use local copies instead of the live sheets.

```sh
npm run organizer:notifications -- --review          # every task and who gets pinged, plus problems to fix
npm run organizer:notifications -- --preview=Noah    # Noah's DMs, as text
npm run organizer:notifications -- --who             # each person's Slack account
npm run organizer:notifications -- --send-test=Noah  # all of Noah's DMs to the test person now
npm run organizer:notifications -- --rehearse=Noah   # 5 of Noah's DMs to the test person, one a minute from 2 min from now
npm run organizer:notifications -- --sync            # one sync (what Actions runs)
npm run organizer:notifications -- --dry-run         # what one sync would change, changing nothing
npm run organizer:notifications -- --watch           # sync every 30 seconds from a laptop
```

The test person is Jasmine unless `ORGANIZER_NOTIFICATION_TEST_RECIPIENT` says otherwise.

## Going live

1. Share both sheets with `hw-run-of-show@hackwestern-sheets.iam.gserviceaccount.com` as a Viewer: HW 13 Run of Show and HW13 - Contacts.
2. Add repo secrets `SLACK_BOT_TOKEN`, `RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`, `RUN_OF_SHOW_SHEETS_PRIVATE_KEY`.
3. Merge this to `main` (scheduled workflows only run from the default branch).
4. `gh variable set ORGANIZER_REMINDERS_LIVE --body true`, then run the workflow once by hand to queue everything.

## Live changes

Change an owner and the old person's DM is cancelled and the new person's is queued, at the next sync. Same for a new time, title or note. GitHub runs every 5 minutes but can run late, so leave about 10 minutes. A DM within 2 minutes of sending is never touched.

## Sheet check

When live, the sync DMs Jasmine (`ORGANIZER_NOTIFICATION_ADMIN`, blank turns it off) a list of what to fix whenever it changes: tasks with no owner, owner names it doesn't know, and people with no contact or Slack account. When it's all fixed it says so once.

## Pause or skip

- Pause: `gh variable set ORGANIZER_REMINDERS_LIVE --body pause` and run the workflow once. That cancels every queued organizer DM. Set it back to `true` to queue them again.
- `ORGANIZER_NOTIFICATION_SKIP_NAMES=Daniel,Emily` stops DMs to those people.
- `ORGANIZER_SLACK_IDS='{"Name":"U123"}'` fixes someone's Slack account by id or email.
- `ORGANIZER_NOTIFICATION_TEST_MODE=1` sends every live DM to the test person instead, labelled.

Marketing reminders (Lucas's) are a separate bot; organizer syncs never touch them.

Running from Vercel instead of a laptop: see `docs/vercel-pings.md`.
