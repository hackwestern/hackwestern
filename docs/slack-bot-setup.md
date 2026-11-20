# Slack bot setup

The app talks to hackers only through Slack DMs (email if Slack can't find them). This page sets up the bot, the buttons in its messages, and every setting the app needs. Values in `<angle brackets>` are yours to fill in. Never commit real values.

## What the bot does

- Coffee chat invites: a DM with Accept / Decline, sent when an organizer presses Send on the coffee board, then in later rounds.
- Sponsor judging: a DM with each team's presentation times when its sponsor sends a shortlist (and when an organizer presses Notify teams), with a "Confirm our times" button.
- Clicks on those buttons come back to the app at `/api/slack/interactions`.

## 1. Create the Slack app (5 minutes)

1. Go to https://api.slack.com/apps and click **Create New App**, then **From a manifest**.
2. Pick the Hack Western workspace.
3. Paste the manifest below (YAML), replacing `<SITE>` with where the app runs:
   - production: `https://www.hackwestern.com`
   - Lucas's testing: his public link (see step 4)
4. Click **Create**, then **Install to Workspace** and allow.

```yaml
display_information:
  name: Hack Western
  description: Coffee chat invites and sponsor judging times
features:
  bot_user:
    display_name: Hack Western
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - im:write
      - users:read
      - users:read.email
settings:
  interactivity:
    is_enabled: true
    request_url: <SITE>/api/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Why each permission: `chat:write` sends and updates messages, `im:write` opens the DM, `users:read` and `users:read.email` find a hacker's Slack account from their email.

If the app already exists, open it, go to **App Manifest**, and check the scopes and the interactivity URL match the above.

## 2. Copy the two Slack values

- **Bot token:** OAuth & Permissions, then Bot User OAuth Token (starts with `xoxb-`).
- **Signing secret:** Basic Information, then App Credentials, then Signing Secret.

## 3. Environment variables

Paste this into Vercel (Settings, then Environment Variables, Production) or into a local `.env`, and fill in the values.

```bash
# Slack bot: DMs to hackers and the Accept / Decline / Confirm buttons
SLACK_BOT_TOKEN=<xoxb-...>
SLACK_SIGNING_SECRET=<signing secret>

# Coffee chat invites: 1 = send for real, 0 = off, dry = save invites but message nobody.
# Unset = on only on the Vercel production deploy, off everywhere else.
COFFEE_INVITES_ENABLED=1

# Email for hackers Slack can't find (Mailjet)
MAILJET_API_KEY=<mailjet api key>
MAILJET_SECRET_KEY=<mailjet secret key>
MAILJET_WEBHOOK_USER=<mailjet webhook user>
MAILJET_WEBHOOK_PASSWORD=<mailjet webhook password>

# The Spon Team RUN OF SHOW Google Sheet (sponsor list, run of show, rooms, mirrors)
RUN_OF_SHOW_SHEET=<sheet id: the long code in the sheet's link, between /d/ and /edit>
RUN_OF_SHOW_SHEETS_CLIENT_EMAIL=<service account email>
RUN_OF_SHOW_SHEETS_PRIVATE_KEY="<-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY----->"

# When sponsor judging closes (optional; unset = never closes)
SPONSOR_JUDGING_CLOSES_AT=<e.g. 2026-11-22T12:30:00-05:00>
```

Only for a local or preview server, never in production:

```bash
# Let a non-production server write to the Google Sheet. Careful: it writes the LIVE sheet.
SHEET_WRITES=1
```

Notes:
- The service account email must be an Editor on the Spon Team RUN OF SHOW sheet (it already is).
- The private key goes in quotes, with its line breaks written as `\n`.
- After changing settings on Vercel, redeploy so they take effect.

## 4. Testing it (Lucas)

Test so that only your own Slack account gets messages:

1. Pull `sponsor-dashboard`, run `npm install`, then `npm run db:migrate` (needs migrations 0059 to 0063).
2. In your local database, use test hacker accounts with **your own email** (the one on your Slack account). Never real hackers.
3. Put the variables above in your `.env`, with `COFFEE_INVITES_ENABLED=1`. Leave `SHEET_WRITES` unset unless you mean to write the live sheet.
4. Give your machine a public link so Slack can reach the buttons, for example `tailscale funnel 3000`, and use that link as `<SITE>` in the app's interactivity URL. Change it back to `https://www.hackwestern.com` when you're done.
5. Run the flows in `docs/test-checklist.md` (Notifications section):
   - Coffee chats: a test sponsor sends availability, an organizer presses Send on the coffee board, and you get a DM. Accept, Decline (the next person gets a DM), and no answer (the seat moves on when the round ends).
   - Judging: a test sponsor sends a shortlist, and every member of each team gets their times. Confirm in the DM, and the judging board shows Accepted. Change a room, press Notify teams, and the old DM's Confirm is refused.
   - Send twice: nobody gets the same DM twice.

## 5. Before the event (production)

- [ ] Slack app installed, interactivity URL `https://www.hackwestern.com/api/slack/interactions`
- [ ] `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, Mailjet and sheet variables set on Vercel Production
- [ ] `COFFEE_INVITES_ENABLED` unset or `1` on production
- [ ] Migrations 0059 to 0063 run on the production database
- [ ] One real end-to-end test DM to yourself on production
