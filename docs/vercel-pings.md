# Ping bots on Vercel

The organizer run-of-show reminders and Auto-Ping (mentors, volunteers, judges) can sync from a Vercel cron instead of a laptop. Once a minute Vercel calls `/api/cron/pings`, which runs the same `--sync` the laptop runs, for both bots. Slack still holds the queue, so nothing about the messages changes. Only where the sync runs.

The code: `src/pages/api/cron/pings.ts` (the route), `src/server/slack/pings-cron.ts` (the rules), `src/server/slack/organizer-run.ts` and `src/server/slack/auto-ping-run.ts` (the two syncs, shared with the CLIs), `vercel.json` (the schedule).

## The switch: PINGS_CRON

| Value | What it does |
|---|---|
| unset or `off` | Nothing. The default, so merging this changes nothing. |
| `dry-run` | Reads the sheets and Slack, changes nothing, and logs what a sync would do. It acts as if both bots are on, so the on-switches can stay off. |
| `live` | Syncs for real. |

Live refuses to run unless `ORGANIZER_NOTIFICATIONS_ENABLED=1` and `AUTO_PING_ENABLED=1`. Both bots treat "disabled" as "cancel everything I queued", so a missing setting would otherwise wipe the whole queue. To pause, set `PINGS_CRON=off`: syncing stops and already queued DMs still go out.

A Postgres advisory lock stops two syncs running at once (Vercel can fire a cron twice). The organizer bot keeps its sheet-check message, heartbeat DMs and a Slack id cache in the `bot_state` table (migration 0051), since Vercel has no lasting disk. Auto-Ping keeps everything in its sheet, as before.

## Vercel settings (Production)

- `CRON_SECRET`: any long random string. Vercel sends it on cron calls; anything else gets a 401.
- `PINGS_CRON`: `dry-run` first, `live` at the switch.
- `SLACK_BOT_TOKEN`: the P.O.N.Y token (the same one the laptop uses). The old token in the sponsor-dash env file is rejected by Slack.
- `RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`, `RUN_OF_SHOW_SHEETS_PRIVATE_KEY`: the hw-run-of-show service account. It needs Editor on the Auto-Ping sheet (it writes Planned messages, Queue and Log) and Viewer on the run of show and Contacts sheets.
- `ORGANIZER_NOTIFICATIONS_ENABLED`, `AUTO_PING_ENABLED`: **leave these off on Vercel while the laptop is the sender**, so nothing on Vercel can double-ping. Set both to `1` only at the switch (step 4).

The laptop sets nothing else (checked 2026-11-20), so no other `ORGANIZER_*` or `AUTO_PING_*` values are needed.

## Switching over from the laptop

1. Merge, then set `CRON_SECRET`, the Slack token and sheet keys, and `PINGS_CRON=dry-run`, and redeploy. Leave the two on-switches off.
2. Watch a few cron runs in Vercel's logs (search `[pings]`). The organizer line should say `0 queued ... 0 cancelled` and Auto-Ping `0 queued, 0 sent now ... 0 cancelled`, the same counts the laptop logs. Anything else is a difference to explain first.
3. Turn the laptop off as a sender: in Task Scheduler disable "HW Auto-Ping" and "HW Organizer Reminders", then end both tasks.
4. Set `ORGANIZER_NOTIFICATIONS_ENABLED=1`, `AUTO_PING_ENABLED=1` and `PINGS_CRON=live`, and redeploy. The next run should show `0 queued ... 0 cancelled` again.
5. The laptop's last heartbeat DM ("the bot hasn't checked in") arrives about 10 minutes after step 3. That one is expected. If another comes later, the cron has stopped.

Never run both at once. To go back, set `PINGS_CRON=off` and both on-switches off, redeploy, then re-enable the two scheduled tasks.

## The final thank you

From Sunday 6:00 PM ET each run tries Auto-Ping's `--send-final`. It refuses while `{hackers}` or `{projects}` is blank and never re-thanks anyone, so it waits for the counts and then goes once. After it goes, `bot_state` row `auto-ping:final-sent` stops further tries.

## Dry run from a laptop

`npm run organizer:notifications -- --dry-run` and `npm run auto-ping -- --dry-run` do the same read-only pass. Unlike the cron, these use your `.env` as is: set the bot's `*_ENABLED=1` first, or the dry run reports what turning it off would cancel.
