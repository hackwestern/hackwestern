# Slack bot for coffee chat requests

The bot DMs a hacker when a sponsor requests a coffee chat, with Accept and Decline buttons. Clicks go to our site, which updates the chat (same rules as the /live buttons).

## Create the app (about 10 minutes)
1. Go to https://api.slack.com/apps → **Create New App** → **From a manifest** → pick the HW13 workspace.
2. Paste the manifest below (YAML tab) → **Next** → **Create**.
3. **Install to Workspace.** If the workspace needs admin approval, a workspace admin approves it.
4. Copy two values into the deployment env (Vercel) and your local `.env`. Never commit them.
   - **OAuth & Permissions → Bot User OAuth Token** (starts with `xoxb-`) → `SLACK_BOT_TOKEN`
   - **Basic Information → Signing Secret** → `SLACK_SIGNING_SECRET`
5. For a preview deploy, change **Interactivity → Request URL** to the preview URL while testing, then set it back to production.

## Manifest
```yaml
display_information:
  name: HW13 Coffee Chats
  description: Tells hackers when a sponsor wants a coffee chat.
  background_color: "#0b2238"
features:
  bot_user:
    display_name: HW13 Coffee Chats
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write        # send the DM
      - im:write          # open a DM with the hacker
      - users:read        # needed with users:read.email
      - users:read.email  # find the hacker's Slack account by their HW email
settings:
  interactivity:
    is_enabled: true
    request_url: https://hackwestern.com/api/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

## How it works
- The hacker is found by email (`users.lookupByEmail`). If their Slack email differs from their HW account email, no DM is sent and email plus /live still cover it.
- `/api/slack/interactions` checks Slack's signature with `SLACK_SIGNING_SECRET` before trusting a click, then accepts or declines the chat for the Slack user who clicked (matched back to the hacker by email), never for whoever the payload names.
- If `SLACK_BOT_TOKEN` is missing, Slack is skipped silently. Email and /live still work.
