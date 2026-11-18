# Ops pings

Slack DMs for the organizer team's run of show. Each task's owners get a DM 10 minutes before it starts and one at its end time. Page: `/internal/ops-pings` (organizers only). Decisions: `docs/decisions.md`, 2026-11-18 "Ops pings".

## Setup

1. Share the organizer run of show sheet with the run-of-show service account (`RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`) as Viewer.
2. Set `OPS_RUN_OF_SHOW_SHEET` to the sheet ID (the part of the URL between `/d/` and `/edit`).
3. `SLACK_BOT_TOKEN` is the same bot as the other Slack features. It needs these scopes, which it already has (`docs/runbooks/slack-app.md`):
   - `users:read`: list people, to find organizers by the `[ORGANIZER]` tag
   - `users:read.email`: fallback, find an organizer's Slack account by their account email
   - `im:write`: open the DM
   - `chat:write`: schedule the DM
4. The spon team for "ALL OF SPON" comes from the Team Assignments tab of the sponsor run of show (`RUN_OF_SHOW_SHEET`), column A under "Team Member".

## Using it

- Every organizer's Slack name has to start with `[ORGANIZER]`. Someone without the tag can still be matched through their organizer account email.
- Press "Refresh from sheet and schedule pings" after the sheet changes. You can press it as often as you like: nothing is sent twice.
- Fix anything under "Needs a look" in the sheet, then refresh. If a name in the sheet isn't the person's Slack name, add it to `src/content/ops-pings-aliases.ts`.
- Without `SLACK_BOT_TOKEN` the page still shows tasks and owners but can't schedule anything.
