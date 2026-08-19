import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { and, inArray, isNull } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { normalizeEmail } from "~/server/subscribers";

/**
 * Mailjet Event API webhook — the replacement for the deleted Cloudflare
 * suppression sync, with the same scope (hard bounces + spam complaints).
 *
 * Mailjet's Send API never reports a bounce synchronously (see the note on
 * sendViaMailjet), so these asynchronous notifications are the only way we
 * learn an address is bad. Marking email_subscriber.bounced_at is what keeps
 * the drip's selectEligible query from ever re-sending to a known-bad address.
 *
 * Registered by scripts/register-mailjet-webhook.ts; nothing calls this at
 * runtime except Mailjet. Mailjet retries every 30s for up to 24h on any
 * non-200, so data problems are logged and still answered with a 200 — only a
 * failed auth check (401) or a wrong method (405) gets a non-200.
 */

/** One notification from the Event API. Only the fields we act on are typed. */
export interface MailjetEvent {
  event?: string;
  email?: string;
  hard_bounce?: boolean;
  error?: string;
}

/**
 * Mailjet does not sign its payloads. Their own docs recommend embedding HTTP
 * Basic credentials in the registered URL instead, so this header is the only
 * evidence a request actually came from Mailjet.
 */
function isAuthorized(header: string | undefined): boolean {
  if (!header) return false;
  if (!env.MAILJET_WEBHOOK_USER || !env.MAILJET_WEBHOOK_PASSWORD) return false;
  const expected = `Basic ${Buffer.from(
    `${env.MAILJET_WEBHOOK_USER}:${env.MAILJET_WEBHOOK_PASSWORD}`,
  ).toString("base64")}`;
  const got = Buffer.from(header);
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Which events mean "this address is permanently bad":
 *   bounce  — only hard_bounce; soft/transient bounces deliver fine on a retry.
 *   blocked — only "preblocked", i.e. Mailjet's own suppression firing because
 *             the address already bounced. Other block reasons (duplicate in
 *             campaign, etc.) say nothing about the address itself.
 *   spam    — always; a complaint is a complaint.
 * Anything else (sent/open/click/unsub, or a type we don't know) is ignored.
 */
export function isSuppressionWorthy(e: MailjetEvent): boolean {
  if (e.event === "bounce") return e.hard_bounce === true;
  if (e.event === "blocked") return e.error === "preblocked";
  return e.event === "spam";
}

/** Suppression-worthy addresses in a batch, normalized + de-duplicated. */
export function suppressedEmails(events: MailjetEvent[]): string[] {
  const emails = events
    .filter((e) => isSuppressionWorthy(e))
    // email_subscriber.email is stored normalized, so match in that form.
    .map((e) => (typeof e.email === "string" ? normalizeEmail(e.email) : ""))
    .filter(Boolean);
  return [...new Set(emails)];
}

/** Version 2 callbacks POST a JSON array of events batched by the second. */
function parseEvents(body: unknown): MailjetEvent[] | null {
  let payload = body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(payload)) return null;
  return (payload as unknown[]).filter(
    (e): e is MailjetEvent => typeof e === "object" && e !== null,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  if (!isAuthorized(req.headers.authorization)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const events = parseEvents(req.body);
  if (!events) {
    // Retrying a body we can't read would just fail for 24h — take the 200.
    console.error("Mailjet webhook: unparseable payload", typeof req.body);
    return res.status(200).json({ processed: 0, marked: 0 });
  }

  const emails = suppressedEmails(events);
  let marked = 0;
  if (emails.length > 0) {
    try {
      const rows = await db
        .update(emailSubscribers)
        .set({ bouncedAt: new Date() })
        .where(
          and(
            inArray(emailSubscribers.email, emails),
            isNull(emailSubscribers.bouncedAt),
          ),
        )
        .returning({ id: emailSubscribers.id });
      marked = rows.length;
    } catch (err) {
      console.error("Mailjet webhook: failed to mark bounced", emails, err);
    }
  }

  return res.status(200).json({ processed: events.length, marked });
}
