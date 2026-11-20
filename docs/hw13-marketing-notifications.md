# HW13 marketing Slack reminders

From the repo root, preview the schedule and DM text without contacting Slack or the database.

```sh
npm run marketing:notifications -- --preview
npm run marketing:notifications -- --preview=Brittney
```

The supplied CSV produces 66 DMs from 82 tasks. The first DM is Allison's Pilates sign-up reminder on Friday, Nov 20 at **10:55 AM Eastern** (15:55 UTC).

## Start the bot

1. Apply the `0064_marketing_notification_reminders` migration to the target database through the usual deployment workflow.
2. On the runner, configure `DATABASE_URL`, `SLACK_BOT_TOKEN` and `MARKETING_SLACK_EMAILS` from `.env.example`. Fill the four array entries with the organizers’ Slack account emails in order (Allison, Brittney, Anson, Jamie). Use a Slack bot token with `users:read.email`, `im:write`, and `chat:write`. An explicit `MARKETING_*_SLACK_USER_ID` can fill in for an empty email slot. Use a direct PostgreSQL connection or a session-mode pooler for the PostgreSQL advisory lock.
3. Set `MARKETING_NOTIFICATIONS_ENABLED=1` and run the watcher on an always-on runner with access to the schedule file.

```sh
npm run marketing:notifications -- --watch
```

To reconcile once, use `--sync`. A successful first queue operation logs `Queued Allison for 2026-11-20T15:55:00.000Z (tasks 1)`. For an already queued reminder, the next successful sync reports it as unchanged. Confirm the scheduled entry in Slack if you need to verify the queue independently.

## Change the schedule or pause

The watcher rereads the CSV and local `.env` on each pass, 30 seconds after the previous pass ends. Edit `context/HW13_Notification_Schedule.csv` or set `MARKETING_NOTIFICATION_SCHEDULE_PATH` to another CSV file on the runner. Keep task IDs stable across edits and keep the notify column five minutes before the task column. Use `MARKETING_NOTIFICATION_SKIP_IDS=12,34` to omit specific tasks. Set `MARKETING_NOTIFICATIONS_ENABLED=0` while the watcher is still running to cancel queued DMs. Exported environment variables take precedence over the local file.

Slack sends queued DMs at the specified times even if the watcher stops. Slack prevents cancellation within 60 seconds of delivery, so allow time for a sync before that cutoff. The bot reports synchronization errors in the runner logs. A malformed schedule leaves the last valid queue in place. Past reminder times are skipped.

## Check the Slack layout

`npm run marketing:notifications -- --send-test=Brittney` immediately DMs all of Brittney's reminders to Allison, with a test label. `MARKETING_NOTIFICATION_TEST_RECIPIENT` can redirect the test to another configured organizer. For a timed rehearsal, set `MARKETING_NOTIFICATION_TEST_MODE=1` before running a sync. The timed test routes every future reminder to the test recipient while preserving the original organizer's formatting. Reset it to `0` and reconcile to restore live routing.
