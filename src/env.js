import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      (str) => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string(),
    // Mailjet (Send API v3.1) — the only email transport now. Drip
    // (scripts/send-campaign.ts) sends from mail.hackwestern.com; transactional
    // (signup/verify/reset/application confirmations, src/server/mail-mailjet.ts)
    // sends from the apex hackwestern.com. Different sending domains keep the
    // drip's reputation isolated from password-reset/verify even on one account.
    MAILJET_API_KEY: z.string(),
    MAILJET_SECRET_KEY: z.string(),
    // Mailjet Event API webhook (src/pages/api/mailjet-webhook.ts). Mailjet
    // doesn't sign its payloads, so these credentials are embedded in the
    // registered webhook URL and verified as HTTP Basic auth on every inbound
    // event POST — they are the only thing keeping the endpoint private.
    MAILJET_WEBHOOK_USER: z.string(),
    MAILJET_WEBHOOK_PASSWORD: z.string(),
    // Mailjet contact list the marketing team sends dashboard campaigns to.
    // The Send API files contacts under no list, so anyone who should be
    // reachable from the dashboard has to be added explicitly — new signups by
    // preregistration.create, the existing audience by scripts/sync-mailjet-list.ts.
    // Optional: unset simply skips the list write, so a missing value can never
    // fail a signup or a build.
    MAILJET_CONTACT_LIST_ID: z.string().optional(),
    // Kickbox email-verification API key (optional). When set, signup emails are
    // verified against Kickbox as the final validation layer; unset = skipped.
    KICKBOX_API_KEY: z.string().optional(),
    APPLE_CERT_PASS: z.string().optional(),
    APPLE_WWDR_CERT: z.string(),
    APPLE_SIGNER_CERT: z.string(),
    APPLE_SIGNER_KEY: z.string(),
    GOOGLE_WALLET_CLIENT_EMAIL: z.string(),
    GOOGLE_WALLET_PRIVATE_KEY: z.string(),
    GOOGLE_WALLET_ISSUER_ID: z.string(),
    // Cloudflare R2 / S3-compatible storage
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_ACCESS_KEY: z.string(),
    // Endpoint like https://<accountid>.r2.cloudflarestorage.com
    R2_ENDPOINT: z.string().url(),
    R2_BUCKET_NAME: z.string(),
    // Public base URL where objects are accessible, e.g. https://pub-XXXXXXXX.r2.dev or a custom domain
    R2_PUBLIC_BASE_URL: z.string().url(),
    // Private bucket for team finder photos; unset disables photo upload
    TEAM_FINDER_R2_BUCKET: z.string().optional(),
    TEAM_FINDER_R2_ACCESS_KEY_ID: z.string().optional(),
    TEAM_FINDER_R2_SECRET_ACCESS_KEY: z.string().optional(),
    // ISO 8601 datetime the team finder opens for hackers; unset = when RSVP
    // closes. Only for smoke testing on Vercel Preview, never production.
    TEAM_FINDER_OPENS_AT: z.string().datetime({ offset: true }).optional(),
    // Where the live-site checklist sends hackers to join Slack / Devpost.
    // Unset = that step's button is disabled.
    ONBOARDING_SLACK_URL: z.string().url().optional(),
    ONBOARDING_DEVPOST_URL: z.string().url().optional(),
    // Google Sheets API key for fetching schedule data
    GOOGLE_SHEETS_API_KEY: z.string().optional(),
    // Sponsor judging Google Sheet ("Judging" tab: sponsor id in column A,
    // comma-separated chosen team ids in column B)
    SPONSOR_JUDGING_SHEET: z.string().optional(),
    // Master sponsor sheet (source of truth for sponsor names). Column A is
    // "Company Name"; sponsorDashboard.syncSponsors reads it to seed private links
    SPONSOR_MASTER_SHEET: z.string().optional(),
    // Tab on the master sponsor sheet holding the acquired-sponsors table
    // (default "HW 13 Sponsors"; header row is found by scanning for
    // "Company Name" in column A)
    SPONSOR_MASTER_SHEET_TAB: z.string().optional(),
    // Dedicated service account for sponsor judging Sheets access
    SPONSOR_SHEETS_CLIENT_EMAIL: z.string().optional(),
    SPONSOR_SHEETS_PRIVATE_KEY: z.string().optional(),
    // Spreadsheet id that mirrors judging results live ("Results" + "Marks"
    // tabs, rewritten on every mark). Share it with SPONSOR_SHEETS_CLIENT_EMAIL.
    // Unset = no sync.
    JUDGING_RESULTS_SHEET: z.string().optional(),
    // Run-of-show sheet (sponsor schedule). Its own service account so it can
    // differ from the sponsor judging one; falls back to SPONSOR_SHEETS_*.
    RUN_OF_SHOW_SHEET: z.string().optional(),
    RUN_OF_SHOW_SHEETS_CLIENT_EMAIL: z.string().optional(),
    RUN_OF_SHOW_SHEETS_PRIVATE_KEY: z.string().optional(),
    // "1" lets a non-production server write to the Google Sheets (mirrors,
    // shortlists, room grid). Unset = writes only in production; never in
    // tests (sheetWritesEnabled in run-of-show-sheet.ts).
    SHEET_WRITES: z.string().optional(),
    // Coffee chat session invites kill switch: "1" on, "0" off. Unset = on
    // only on the Vercel production deploy (VERCEL_ENV), never previews or a
    // local `next start`; off in tests unless set (invitesEnabled in
    // src/server/api/utils/coffee-chat-invites.ts).
    COFFEE_INVITES_ENABLED: z.string().optional(),
    // Set by Vercel: "production", "preview" or "development".
    VERCEL_ENV: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    // ISO 8601 datetime strings for the hacking window used in commit-timing cheat checks
    HACK_START: z.string().datetime().optional(),
    HACK_END: z.string().datetime().optional(),
    // ISO 8601 datetime for the project submission deadline. Submissions after
    // this are marked "late". Unset = no deadline, everything counts as on-time.
    PROJECT_SUBMISSION_DEADLINE: z.string().datetime().optional(),
    // ISO 8601 datetime when sponsor judging closes (/sponsors/[uuid]/picks):
    // after it sponsors can't score, shortlist or submit. Unset = never closes.
    SPONSOR_JUDGING_CLOSES_AT: z.string().datetime({ offset: true }).optional(),
    // Bearer token for /api/cheat-check/sweep, which the sweep worker also uses
    // to re-invoke itself. Leave unset to disable automated sweeps entirely.
    CHEAT_SWEEP_SECRET: z.string().optional(),
    // Vercel cron for the Slack ping bots (src/pages/api/cron/pings.ts).
    CRON_SECRET: z.string().optional(),
    // "off" (default), "dry-run" or "live"; checked in the route, so a typo
    // can't fail the site's build.
    PINGS_CRON: z.string().optional(),
    // Slack DMs to each sponsor's HW lead (src/server/slack/sponsor-lead-*.ts).
    // "1" sends, "dry" only logs what would be sent, unset (or anything
    // else) sends nothing. SPONSOR_LEAD_FEED: one line per organizer change
    // to the sponsor. SPONSOR_LEAD_PINGS: 15 minutes before each of the
    // sponsor's action items (30 for an Ivey chat).
    SPONSOR_LEAD_FEED: z.string().optional(),
    SPONSOR_LEAD_PINGS: z.string().optional(),
    // The Hack Western Slack app (hackers and the sponsor team share one
    // workspace and one app). Unset = Slack features are skipped.
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    // Sponsor help requests (docs/runbooks/slack-sponsor-help.md). The token
    // and signing secret override SLACK_* only if help ever needs its own
    // app. No token or no channel = Slack is skipped; requests still show on
    // /internal/sponsor-schedule.
    SPONSOR_HELP_SLACK_BOT_TOKEN: z.string().optional(),
    SPONSOR_HELP_SLACK_SIGNING_SECRET: z.string().optional(),
    SPONSOR_HELP_SLACK_CHANNEL: z.string().optional(),
    // Who to ping, e.g. <!subteam^S0123ABCD> or <!here>.
    SPONSOR_HELP_SLACK_MENTION: z.string().optional(),
    // Marketing notification bot (HW13). Use explicit Slack user IDs.
    MARKETING_NOTIFICATIONS_ENABLED: z.string().optional(),
    MARKETING_NOTIFICATION_TEST_MODE: z.string().optional(),
    MARKETING_NOTIFICATION_TEST_RECIPIENT: z.string().optional(),
    MARKETING_NOTIFICATION_SKIP_IDS: z.string().optional(),
    MARKETING_NOTIFICATION_SCHEDULE_PATH: z.string().optional(),
    MARKETING_ALLISON_SLACK_USER_ID: z.string().optional(),
    MARKETING_BRITTNEY_SLACK_USER_ID: z.string().optional(),
    MARKETING_ANSON_SLACK_USER_ID: z.string().optional(),
    MARKETING_JAMIE_SLACK_USER_ID: z.string().optional(),

    // Hacker interest form Google Sheet ID
    HACKER_INTEREST_FORM: z.string().optional(),
    // Bearer token guarding /api/docs/app (the generated API map). Unset
    // disables the endpoint (503).
    HW_NETWORK_REQUESTS_APP_MAP_TOKEN: z.string().optional(),
    // Cloudflare Worker that stores request events in D1 (see
    // workers/hw-network-requests). Leave either unset to disable event logging.
    HW_NETWORK_REQUESTS_INGEST_URL: z.string().url().optional(),
    HW_NETWORK_REQUESTS_INGEST_TOKEN: z.string().optional(),
    // Local dev only records events when this is "true" (deployed Vercel
    // builds always record while the URL + token are set).
    HW_NETWORK_REQUESTS_TRACK_LOCAL: z.enum(["true", "false"]).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    MAILJET_API_KEY:
      process.env.MAILJET_API_KEY ??
      (process.env.NODE_ENV === "test" ? "mock-mailjet-api-key" : undefined),
    MAILJET_SECRET_KEY:
      process.env.MAILJET_SECRET_KEY ??
      (process.env.NODE_ENV === "test" ? "mock-mailjet-secret-key" : undefined),
    MAILJET_WEBHOOK_USER:
      process.env.MAILJET_WEBHOOK_USER ??
      (process.env.NODE_ENV === "test"
        ? "mock-mailjet-webhook-user"
        : undefined),
    MAILJET_WEBHOOK_PASSWORD:
      process.env.MAILJET_WEBHOOK_PASSWORD ??
      (process.env.NODE_ENV === "test"
        ? "mock-mailjet-webhook-password"
        : undefined),
    MAILJET_CONTACT_LIST_ID:
      process.env.MAILJET_CONTACT_LIST_ID ??
      (process.env.NODE_ENV === "test" ? "mock-contact-list-id" : undefined),
    KICKBOX_API_KEY: process.env.KICKBOX_API_KEY,
    APPLE_CERT_PASS: process.env.APPLE_CERT_PASS,
    APPLE_WWDR_CERT: process.env.APPLE_WWDR_CERT,
    APPLE_SIGNER_CERT: process.env.APPLE_SIGNER_CERT,
    APPLE_SIGNER_KEY: process.env.APPLE_SIGNER_KEY,
    GOOGLE_WALLET_CLIENT_EMAIL: process.env.GOOGLE_WALLET_CLIENT_EMAIL,
    GOOGLE_WALLET_PRIVATE_KEY: process.env.GOOGLE_WALLET_PRIVATE_KEY,
    GOOGLE_WALLET_ISSUER_ID: process.env.GOOGLE_WALLET_ISSUER_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    TEAM_FINDER_R2_BUCKET: process.env.TEAM_FINDER_R2_BUCKET,
    TEAM_FINDER_R2_ACCESS_KEY_ID: process.env.TEAM_FINDER_R2_ACCESS_KEY_ID,
    TEAM_FINDER_R2_SECRET_ACCESS_KEY:
      process.env.TEAM_FINDER_R2_SECRET_ACCESS_KEY,
    TEAM_FINDER_OPENS_AT: process.env.TEAM_FINDER_OPENS_AT,
    ONBOARDING_SLACK_URL: process.env.ONBOARDING_SLACK_URL,
    ONBOARDING_DEVPOST_URL: process.env.ONBOARDING_DEVPOST_URL,
    GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY,
    SPONSOR_JUDGING_SHEET: process.env.SPONSOR_JUDGING_SHEET,
    SPONSOR_MASTER_SHEET: process.env.SPONSOR_MASTER_SHEET,
    SPONSOR_MASTER_SHEET_TAB: process.env.SPONSOR_MASTER_SHEET_TAB,
    SPONSOR_SHEETS_CLIENT_EMAIL: process.env.SPONSOR_SHEETS_CLIENT_EMAIL,
    SPONSOR_SHEETS_PRIVATE_KEY: process.env.SPONSOR_SHEETS_PRIVATE_KEY,
    JUDGING_RESULTS_SHEET: process.env.JUDGING_RESULTS_SHEET,
    RUN_OF_SHOW_SHEET: process.env.RUN_OF_SHOW_SHEET,
    RUN_OF_SHOW_SHEETS_CLIENT_EMAIL:
      process.env.RUN_OF_SHOW_SHEETS_CLIENT_EMAIL,
    RUN_OF_SHOW_SHEETS_PRIVATE_KEY: process.env.RUN_OF_SHOW_SHEETS_PRIVATE_KEY,
    SHEET_WRITES: process.env.SHEET_WRITES,
    COFFEE_INVITES_ENABLED: process.env.COFFEE_INVITES_ENABLED,
    VERCEL_ENV: process.env.VERCEL_ENV,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    HACK_START: process.env.HACK_START,
    HACK_END: process.env.HACK_END,
    PROJECT_SUBMISSION_DEADLINE: process.env.PROJECT_SUBMISSION_DEADLINE,
    SPONSOR_JUDGING_CLOSES_AT: process.env.SPONSOR_JUDGING_CLOSES_AT,
    CHEAT_SWEEP_SECRET: process.env.CHEAT_SWEEP_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    PINGS_CRON: process.env.PINGS_CRON,
    SPONSOR_LEAD_FEED: process.env.SPONSOR_LEAD_FEED,
    SPONSOR_LEAD_PINGS: process.env.SPONSOR_LEAD_PINGS,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    SPONSOR_HELP_SLACK_BOT_TOKEN: process.env.SPONSOR_HELP_SLACK_BOT_TOKEN,
    SPONSOR_HELP_SLACK_SIGNING_SECRET:
      process.env.SPONSOR_HELP_SLACK_SIGNING_SECRET,
    SPONSOR_HELP_SLACK_CHANNEL: process.env.SPONSOR_HELP_SLACK_CHANNEL,
    SPONSOR_HELP_SLACK_MENTION: process.env.SPONSOR_HELP_SLACK_MENTION,
    MARKETING_NOTIFICATIONS_ENABLED:
      process.env.MARKETING_NOTIFICATIONS_ENABLED,
    MARKETING_NOTIFICATION_TEST_MODE:
      process.env.MARKETING_NOTIFICATION_TEST_MODE,
    MARKETING_NOTIFICATION_TEST_RECIPIENT:
      process.env.MARKETING_NOTIFICATION_TEST_RECIPIENT,
    MARKETING_NOTIFICATION_SKIP_IDS:
      process.env.MARKETING_NOTIFICATION_SKIP_IDS,
    MARKETING_NOTIFICATION_SCHEDULE_PATH:
      process.env.MARKETING_NOTIFICATION_SCHEDULE_PATH,
    MARKETING_ALLISON_SLACK_USER_ID:
      process.env.MARKETING_ALLISON_SLACK_USER_ID,
    MARKETING_BRITTNEY_SLACK_USER_ID:
      process.env.MARKETING_BRITTNEY_SLACK_USER_ID,
    MARKETING_ANSON_SLACK_USER_ID: process.env.MARKETING_ANSON_SLACK_USER_ID,
    MARKETING_JAMIE_SLACK_USER_ID: process.env.MARKETING_JAMIE_SLACK_USER_ID,

    HACKER_INTEREST_FORM: process.env.HACKER_INTEREST_FORM,
    HW_NETWORK_REQUESTS_APP_MAP_TOKEN:
      process.env.HW_NETWORK_REQUESTS_APP_MAP_TOKEN,
    HW_NETWORK_REQUESTS_INGEST_URL: process.env.HW_NETWORK_REQUESTS_INGEST_URL,
    HW_NETWORK_REQUESTS_INGEST_TOKEN:
      process.env.HW_NETWORK_REQUESTS_INGEST_TOKEN,
    HW_NETWORK_REQUESTS_TRACK_LOCAL:
      process.env.HW_NETWORK_REQUESTS_TRACK_LOCAL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
