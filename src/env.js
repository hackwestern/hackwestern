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
    // Google Sheets API key for fetching schedule data
    GOOGLE_SHEETS_API_KEY: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    // ISO 8601 datetime strings for the hacking window used in commit-timing cheat checks
    HACK_START: z.string().datetime().optional(),
    HACK_END: z.string().datetime().optional(),
    // ISO 8601 datetime for the project submission deadline. Submissions after
    // this are marked "late". Unset = no deadline, everything counts as on-time.
    PROJECT_SUBMISSION_DEADLINE: z.string().datetime().optional(),
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
    GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    HACK_START: process.env.HACK_START,
    HACK_END: process.env.HACK_END,
    PROJECT_SUBMISSION_DEADLINE: process.env.PROJECT_SUBMISSION_DEADLINE,
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
