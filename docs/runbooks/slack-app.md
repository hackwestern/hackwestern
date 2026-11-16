# HW13 Slack app (one app for coffee chats and sponsor help)

Hackers and the sponsor team are in the same Slack workspace, so one app does both jobs:
- DMs hackers coffee chat offers with Accept / Decline buttons (details: slack-coffee-chat-bot.md); the email goes out only if the DM can't be sent (no token, no Slack account for that email, or a Slack error)
- Posts sponsor help requests in the sponsor team channel; the first emoji or thread reply claims it (details: slack-sponsor-help.md)

## Create it (about 10 minutes)
1. https://api.slack.com/apps → **Create New App** → **From a manifest** → HW13 workspace → **YAML** tab → paste the manifest below → **Next** → **Create**.
2. **Install to Workspace** (an admin may need to approve).
3. In the sponsor team channel: `/invite @HW13 Bot`.
4. Add to Vercel (and your local `.env`). Never commit or paste them in chat.
   - `SLACK_BOT_TOKEN`: **OAuth & Permissions** → Bot User OAuth Token (`xoxb-…`)
   - `SLACK_SIGNING_SECRET`: **Basic Information** → Signing Secret
   - `SPONSOR_HELP_SLACK_CHANNEL`: the sponsor team channel ID (channel name → bottom of the About tab, starts with `C`)
   - `SPONSOR_HELP_SLACK_MENTION`: `<!here>`, or a user group as `<!subteam^S…>`
5. **After the new code is deployed:** **Event Subscriptions** → On → Request URL `https://hackwestern.com/api/slack/events` (should turn green) → **Subscribe to bot events**: `reaction_added`, `message.channels`, `message.groups` → Save → reinstall when Slack asks.
   Events are left out of the manifest because Slack checks the URL immediately, which fails until the code is live.

## Manifest
```yaml
display_information:
  name: HW13 Bot
  description: Coffee chat offers for hackers and help pings for the sponsor team.
  background_color: "#0b2238"
features:
  bot_user:
    display_name: HW13 Bot
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write          # post messages and DMs
      - im:write            # open a DM with a hacker
      - users:read          # names (who claimed a help ping)
      - users:read.email    # find a hacker's Slack account by their HW email
      - reactions:read      # an emoji on a help ping claims it
      - channels:history    # thread replies in a public channel claim it
      - groups:history      # same, if the sponsor team channel is private
settings:
  interactivity:
    is_enabled: true
    request_url: https://hackwestern.com/api/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

The help bot also accepts `SPONSOR_HELP_SLACK_BOT_TOKEN` / `SPONSOR_HELP_SLACK_SIGNING_SECRET` if it ever needs its own app; otherwise it uses the shared `SLACK_*` values.
