# Slack bot for sponsor help requests

A sponsor taps **Need help** on their page. The bot posts in the sponsor team channel and pings the sponsor team group. The first person who reacts with any emoji or replies in the thread claims it. The sponsor's page then shows who is on the way.

If nobody claims it, the bot pings again in the thread after 3 minutes, then once more after 6 minutes with `@here`. Organizers can also see and resolve requests on `/internal/sponsor-schedule` if Slack is down.

## Which workspace
Install this in the workspace where the sponsor team talks. If that is the same workspace as the coffee chat bot (docs/runbooks/slack-coffee-chat-bot.md), you can add the scopes and event below to that app and reuse its token. Otherwise create this second app. The site reads its own `SPONSOR_HELP_SLACK_*` vars either way.

## Create the app (about 10 minutes)
1. Go to https://api.slack.com/apps → **Create New App** → **From a manifest** → pick the sponsor team workspace.
2. Paste the manifest below (YAML tab) → **Next** → **Create**.
3. **Install to Workspace.** A workspace admin may need to approve it.
4. In Slack, open the sponsor team channel and type `/invite @HW13 Sponsor Help`.
5. Put these in Vercel and your local `.env`. Never commit them.
   - **OAuth & Permissions → Bot User OAuth Token** (starts with `xoxb-`) → `SPONSOR_HELP_SLACK_BOT_TOKEN`
   - **Basic Information → Signing Secret** → `SPONSOR_HELP_SLACK_SIGNING_SECRET`
   - The channel ID (channel name → **View channel details** → bottom of the About tab, starts with `C`) → `SPONSOR_HELP_SLACK_CHANNEL`
   - Who to ping: a user group like `<!subteam^S0123ABCD>` (the group's ID is in its profile link) or `<!here>` → `SPONSOR_HELP_SLACK_MENTION`
6. **Event Subscriptions** checks the Request URL when you save. Deploy the site with the vars set first, or Slack's check fails.

## Manifest
```yaml
display_information:
  name: HW13 Sponsor Help
  description: Pings the sponsor team when a sponsor needs help.
  background_color: "#0b2238"
features:
  bot_user:
    display_name: HW13 Sponsor Help
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write          # post and update the help message
      - reactions:read      # see who reacted to claim it
      - channels:history    # see thread replies in a public channel
      - groups:history      # same, if the channel is private
      - users:read          # show the claimer's name to the sponsor
settings:
  event_subscriptions:
    request_url: https://hackwestern.com/api/slack/events
    bot_events:
      - reaction_added
      - message.channels
      - message.groups
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

## How it works
- `/api/slack/events` checks Slack's signature with `SPONSOR_HELP_SLACK_SIGNING_SECRET` before trusting anything.
- A reaction or thread reply only counts on a help message the bot posted, and only from a person, never from a bot.
- First claim wins. The database update only succeeds while the request is still open, so two people reacting at once can't both claim it.
- Re-pings are sent when the sponsor's page checks the status (it polls every 15 seconds while a request is open), so there is no scheduled job to run.
- If `SPONSOR_HELP_SLACK_BOT_TOKEN` is missing, Slack is skipped. The request still shows on the organizer page.
