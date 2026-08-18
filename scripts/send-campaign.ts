import { and, isNull, or, lt, asc, eq } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
// Drip sends via Mailjet directly (NOT the shared ~/server/mail, which is the
// Cloudflare transactional transport). Keeping the marketing stream on its own
// provider isolates its sending reputation from password-reset/verify email.
import { sendViaMailjet } from "~/server/mail-mailjet";
import {
  campaignTemplate,
  campaignText,
} from "~/server/api/routers/email-templates";
import { editionFromSource } from "~/server/subscribers";

// Email links must be canonical + permanent — never a per-deployment preview
// URL — so hardcode the public domain rather than the deployment's env.
const BASE = "https://www.hackwestern.com";
const SUBJECT = "Hack Western 13 is coming!";
const DELAY_MS = 500;

type Sub = { email: string; source: string; unsubscribeToken: string };
type SubRow = Sub & { id: number };

/** The eligible-recipients query: the single-send + suppression guarantee. */
export async function selectEligible(
  chunkSize: number,
  campaignStart: Date,
  source?: string,
  only?: string,
): Promise<SubRow[]> {
  return (await db
    .select({
      email: emailSubscribers.email,
      source: emailSubscribers.source,
      unsubscribeToken: emailSubscribers.unsubscribeToken,
      id: emailSubscribers.id,
    })
    .from(emailSubscribers)
    .where(
      and(
        isNull(emailSubscribers.unsubscribedAt),
        isNull(emailSubscribers.bouncedAt),
        // --only: target one address (test mode) — ignores the last-sent gate
        // so it's re-runnable. Otherwise: normal single-send eligibility + cohort.
        only
          ? eq(emailSubscribers.email, only)
          : and(
              or(
                isNull(emailSubscribers.lastSentAt),
                lt(emailSubscribers.lastSentAt, campaignStart),
              ),
              source ? eq(emailSubscribers.source, source) : undefined,
            ),
      ),
    )
    .orderBy(asc(emailSubscribers.id))
    .limit(chunkSize)) as SubRow[];
}

export function unsubscribeUrl(token: string): string {
  return `${BASE}/unsubscribe?token=${token}`;
}

export function unsubscribePostUrl(token: string): string {
  return `${BASE}/api/unsubscribe?token=${token}`;
}

export function renderFor(sub: Sub) {
  const pageUrl = unsubscribeUrl(sub.unsubscribeToken); // visible footer link
  const postUrl = unsubscribePostUrl(sub.unsubscribeToken); // one-click header
  const edition = editionFromSource(sub.source);
  return {
    subject: SUBJECT,
    html: campaignTemplate(sub.email, edition, pageUrl),
    // Purpose-built plain-text part (not an HTML strip) so filters see real text.
    text: campaignText(sub.email, edition, pageUrl),
    headers: {
      "List-Unsubscribe": `<${postUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    } as Record<string, string>,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SendOutcome = "ok" | "bounce" | "quota" | "fail";

/**
 * Classify a `sendEmail` result. A single-recipient permanent bounce surfaces
 * as an error whose message contains "permanently bounced" (see mail.ts), so it
 * must be treated as a bounce — not a generic failure — or the address is never
 * suppressed and gets retried forever.
 */
export function classifyResult(res: {
  data: { bounced: string[] } | null;
  error: { message: string } | null;
}): SendOutcome {
  if (res.error) {
    if (/permanently bounced/i.test(res.error.message)) return "bounce";
    if (/quota|rate|429/i.test(res.error.message)) return "quota";
    return "fail";
  }
  if (res.data && res.data.bounced.length > 0) return "bounce";
  return "ok";
}

async function main() {
  const SEND = process.argv.includes("--send");
  const chunk = Number(
    process.argv.find((a) => a.startsWith("--chunk="))?.split("=")[1] ?? 75,
  );
  const campaignStart = new Date(
    process.argv.find((a) => a.startsWith("--start="))?.split("=")[1] ??
      "2026-08-01T00:00:00Z",
  );
  const source = process.argv
    .find((a) => a.startsWith("--source="))
    ?.split("=")[1];
  if (source && source !== "hw11" && source !== "hw12") {
    console.error(
      `Invalid --source "${source}" — use hw11 or hw12 (or omit for both).`,
    );
    process.exit(1);
  }
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

  const rows = await selectEligible(chunk, campaignStart, source, only);

  const scope = only
    ? ` [only=${only}]`
    : source
      ? ` [source=${source}]`
      : " [all sources]";
  console.log(
    `Chunk: ${rows.length} recipient(s)${scope}. Mode: ${SEND ? "SEND" : "DRY RUN"}.`,
  );
  if (!SEND) {
    rows.forEach((r, i) => console.log(`${i + 1}. ${r.email}`));
    return;
  }

  // Live send needs the Mailjet marketing creds. Fail loud rather than looping
  // through recipients returning a config error for every one.
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error(
      "MAILJET_API_KEY / MAILJET_SECRET_KEY not set — cannot send the drip.",
    );
    process.exit(1);
  }
  const mjCreds = {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  };

  let sent = 0,
    bounced = 0,
    failed = 0;
  for (const r of rows) {
    const { subject, html, text, headers } = renderFor(r);
    const res = await sendViaMailjet(
      {
        // Bulk campaign sends from an isolated subdomain so a spam/bounce hit
        // can't poison transactional (password-reset/verify) deliverability on
        // the root domain. Replies still route to the monitored inbox (reply_to).
        from: "Hack Western <updates@mail.hackwestern.com>",
        replyTo: "hello@hackwestern.com",
        to: r.email,
        subject,
        html,
        text,
        headers,
      },
      mjCreds,
    );
    const outcome = classifyResult(res);
    if (outcome === "quota") {
      console.log(`FAIL ${r.email} — ${res.error?.message}`);
      console.log("Quota/rate hit — stopping early.");
      break;
    } else if (outcome === "fail") {
      failed++;
      console.log(`FAIL ${r.email} — ${res.error?.message}`);
    } else if (outcome === "bounce") {
      bounced++;
      await db
        .update(emailSubscribers)
        .set({ bouncedAt: new Date() })
        .where(eq(emailSubscribers.id, r.id));
      console.log(`BOUNCE ${r.email}`);
    } else {
      sent++;
      await db
        .update(emailSubscribers)
        .set({ lastSentAt: new Date() })
        .where(eq(emailSubscribers.id, r.id));
      console.log(`ok ${r.email}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. sent ${sent}, bounced ${bounced}, failed ${failed}.`);
}

if (process.argv[1]?.includes("send-campaign")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
