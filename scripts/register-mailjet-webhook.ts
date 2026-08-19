import { env } from "~/env";

// Registers our Mailjet Event API webhook (src/pages/api/mailjet-webhook.ts)
// for the three event types the suppression sync needs: hard bounces, Mailjet's
// own pre-block suppression, and spam complaints. One-time manual setup — the
// app never calls this. Idempotent: it lists what Mailjet already has and only
// creates what's missing, so re-running is safe.
//
// Usage:  npx tsx scripts/register-mailjet-webhook.ts                    # dry run (default)
//         npx tsx scripts/register-mailjet-webhook.ts --apply            # create the missing handlers
//         npx tsx scripts/register-mailjet-webhook.ts --base=https://preview.vercel.app --apply

const ENDPOINT = "https://api.mailjet.com/v3/REST/eventcallbackurl";
const DEFAULT_BASE = "https://www.hackwestern.com";
const PATH = "/api/mailjet-webhook";
// Same scope the deleted Cloudflare suppression sync had: hard bounces + spam.
const EVENT_TYPES = ["bounce", "blocked", "spam"] as const;

interface CallbackUrl {
  ID: number;
  EventType: string;
  Url: string;
  Version?: number;
}

/**
 * The URL we register. Mailjet doesn't sign payloads, so the credentials the
 * handler checks ride in the URL's userinfo (Mailjet's own recommendation).
 * Keep the user/password alphanumeric — percent-encoded userinfo round-trips
 * inconsistently across HTTP clients.
 */
export function webhookUrl(
  base: string,
  user: string,
  password: string,
): string {
  const { protocol, host } = new URL(base);
  return `${protocol}//${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}${PATH}`;
}

/** Same URL minus the credentials — for comparing + printing without leaking. */
export function withoutCredentials(url: string): string {
  try {
    const u = new URL(url);
    u.username = "";
    u.password = "";
    return u.toString();
  } catch {
    return url;
  }
}

async function listCallbacks(auth: string): Promise<CallbackUrl[]> {
  const res = await fetch(ENDPOINT, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(
      `Mailjet eventcallbackurl GET ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { Data?: CallbackUrl[] };
  return json.Data ?? [];
}

async function createCallback(
  auth: string,
  eventType: string,
  url: string,
): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    // Version 2 batches every event from the same second into one JSON array,
    // which is the payload shape the handler parses.
    body: JSON.stringify({ EventType: eventType, Url: url, Version: 2 }),
  });
  if (!res.ok) {
    throw new Error(
      `Mailjet eventcallbackurl POST (${eventType}) ${res.status}: ${await res.text()}`,
    );
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const base = baseArg ? baseArg.slice("--base=".length) : DEFAULT_BASE;

  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error(
      "MAILJET_API_KEY / MAILJET_SECRET_KEY not set — cannot reach the Mailjet REST API.",
    );
    process.exit(1);
  }
  if (!env.MAILJET_WEBHOOK_USER || !env.MAILJET_WEBHOOK_PASSWORD) {
    console.error(
      "MAILJET_WEBHOOK_USER / MAILJET_WEBHOOK_PASSWORD not set — these go in the registered URL and must match the deployed handler.",
    );
    process.exit(1);
  }

  const auth = Buffer.from(
    `${env.MAILJET_API_KEY}:${env.MAILJET_SECRET_KEY}`,
  ).toString("base64");
  const target = webhookUrl(
    base,
    env.MAILJET_WEBHOOK_USER,
    env.MAILJET_WEBHOOK_PASSWORD,
  );
  const bare = withoutCredentials(target);
  console.log(`Target webhook: ${bare} (credentials hidden)`);

  const existing = await listCallbacks(auth);
  console.log(`Mailjet has ${existing.length} event callback(s) registered.`);

  const missing: string[] = [];
  for (const eventType of EVENT_TYPES) {
    const match = existing.find(
      (c) => c.EventType === eventType && withoutCredentials(c.Url) === bare,
    );
    if (!match) {
      missing.push(eventType);
      continue;
    }
    console.log(`  ${eventType}: already registered (ID ${match.ID}).`);
    if (match.Url !== target) {
      console.log(
        `    NOTE: registered with different credentials — delete ID ${match.ID} in Mailjet and re-run to rotate.`,
      );
    }
    if (match.Version !== 2) {
      console.log(
        `    NOTE: registered as Version ${match.Version ?? 1}; the handler expects Version 2 (batched array).`,
      );
    }
  }

  if (missing.length === 0) {
    console.log("Nothing to do — every event type already points here.");
    return;
  }
  console.log(`Missing: ${missing.join(", ")}.`);
  if (!apply) {
    console.log("DRY RUN — pass --apply to create them.");
    return;
  }

  for (const eventType of missing) {
    await createCallback(auth, eventType, target);
    console.log(`Created ${eventType} handler.`);
  }
  console.log(`Done. Created ${missing.length} handler(s).`);
}

if (process.argv[1]?.includes("register-mailjet-webhook")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
