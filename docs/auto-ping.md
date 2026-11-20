# Auto-Ping: Slack DMs for mentors, volunteers and judges

Auto-Ping DMs each HW13 mentor, volunteer and judge on Slack: a check-in before their first shift, a reminder before each later one, a wrap-up between shifts, a Sunday morning note and a final thank you. The plan and spec are in `docs/auto-ping-plan.md`. The code is `scripts/auto-ping.ts`, `src/server/slack/auto-ping-schedule.ts` (parsing and planning) and `src/server/slack/auto-ping-sync.ts` (Slack queue). Copy the bot writes is in `src/content/auto-ping.ts`. The messages themselves are the templates on the Messages tab.

## The sheet

Everything goes through the Auto-Ping sheet. The service account (`RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`) needs Editor on it.

Read:

- **Mentor schedule / Volunteer schedule**: who's in and when. If either shows `#REF!`, the bot stops and changes nothing. Open Auto-Ping and click "Allow access" on the IMPORTRANGE.
- **Mentor / Volunteer / Judge contact info**: name (A) and email (B). Phone (C) is never read.
- **People**: one row per person and role. Columns are found by header, so moving them is fine.
- **Messages**: templates by key, and the fill-ins `{mentor_channel}`, `{volunteer_channel}`, `{judge_channel}` (a Slack channel id like `C0CDZB3DQ2X` becomes a #channel link), `{hackers}`, `{projects}`.

Written by the bot:

- **People Shift (D)** for schedule people, recomputed each sync.
- **People Sent / next (I)**: one line per person, like "2 sent · next: Shift reminder: second shift, Sat 2:45 PM", "Not ticked", "Held: {volunteer_channel} is blank".
- **People Check before sending (J)**: the bot's lines start with 🤖. Anyone else's lines are kept.
- **Planned messages** tab: every message every person will get, ticked or not, with the exact text and a status (Queued, Sent, Held, Not on Slack, Not ticked, Past). Read this before ticking Send?.
- **Log**: one row per change (scheduled, rescheduled, sent, cancelled, held, not on Slack). An unchanged sync logs nothing.
- **Queue**: the bot's memory of what it has scheduled in Slack. Don't edit it.

Never written: Email (C) and the preview (H), which are formulas, and POC, Personal note, Send?, Email override on existing rows.

## Who gets what

A person is their email. Each schedule name is looked up in that role's contact info tab (or an existing People row's email). That lookup is the only place names are matched, loosely ("Batra Saksham" = "Saksham Batra"), and a loose match is flagged in J. A name with no email, or two different emails, gets nothing until someone fills in Email override.

Only rows with Send? ticked, an email and no 🤖 blocking flag get messages. A mentor who also judges (same email, two rows) is one person: one check-in, one final thank you, both roles' shifts. Their first shift's row picks the role and POC.

| Message                               | When                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Check-in                              | 30 min before the first shift. If they join Slack late, it goes as soon as they're found, until their first stretch ends             |
| Shift reminder: second / third / last | 15 min before each later stretch. Last one is "last". A 4th that isn't the last gets nothing, since the "third" text says "Shift #3" |
| After a shift                         | when a stretch ends and another follows                                                                                              |
| Last day                              | 8:00 AM Sunday, if their first shift was before Sunday and they have a Sunday shift starting after 8                                 |
| Final thank you                       | by hand, `--send-final`                                                                                                              |

Shifts less than an hour apart (Sat 9am-3pm and Sat 3pm-8pm) are one stretch, "Sat 9am-8pm": no wrap-up and no reminder in the middle.

If a template uses a fill-in that's blank (or one that doesn't exist), that message is held, not sent with a hole in it. It's logged once and sent on a later sync once filled, if its time hasn't passed. A blank `{note}` just drops its line.

Schedule notes it understands: `(2am start)` and `(12pm start)` (same block, later start), `(3-7pm)` (different times). Any other note blocks that person's timed messages and is flagged in J. Judges and rows with "Manual row (not on a schedule)" ticked use the shift typed in column D, like "Sun 8:30am-1:30pm".

## Commands

Put `AUTO_PING_SNAPSHOT_DIR=src/server/slack/fixtures/auto-ping` in front to use the test fixtures (fake names and example.com emails) instead of the live sheet. That works for `--preview`, `--review` and `--send-test`.

```sh
npm run auto-ping -- --review                    # everyone, their shifts, flags and planned times
npm run auto-ping -- --preview                   # every planned message, as text
npm run auto-ping -- "--preview=Ezra Ng"      # one person's messages, ticked or not
npm run auto-ping -- --plan                      # writes Planned messages and People D/I/J only, no Slack
npm run auto-ping -- "--send-test=Ezra Ng"    # that person's messages, now, to Jasmine, labelled [TEST for ...]
npm run auto-ping -- --sync                      # one sync (what Actions runs)
npm run auto-ping -- --send-final                # the final thank you, now, to everyone ticked
```

`--sync` and `--send-final` only message people when `AUTO_PING_ENABLED=1`. With it off, `--sync` still updates People and cancels anything queued. `--send-final` refuses while `{hackers}` or `{projects}` is blank, and skips anyone it already thanked, so it's safe to run twice.

## Going live

1. Share Auto-Ping with the service account as Editor, and click "Allow access" on both schedule tabs.
2. Repo secrets `SLACK_BOT_TOKEN`, `RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`, `RUN_OF_SHOW_SHEETS_PRIVATE_KEY` (same as the organizer bot).
3. Merge to `main` (scheduled workflows only run from the default branch).
4. `gh variable set AUTO_PING_LIVE --body true`, then run the Auto-Ping workflow once by hand.
5. Sunday, after filling `{hackers}` and `{projects}`: Actions, Auto-Ping, Run workflow, mode `send-final`.

## Pause

`gh variable set AUTO_PING_LIVE --body pause`, then run the workflow once. That cancels every queued Auto-Ping DM. Set it back to `true` to queue them again. Unticking Send? for one person cancels just theirs at the next sync.

Edits to the sheet reach Slack at the next sync (every 5 minutes, sometimes later). A DM within 2 minutes of sending is never touched, because Slack can't cancel it.

Actions logs are public, so CI logs counts only (`AUTO_PING_QUIET=1`): no names, emails or phone numbers.
