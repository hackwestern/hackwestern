import { randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { emailSubscribers, preregistrations } from "~/server/db/schema";
import { manageContact } from "~/server/mailjet-contacts";

const SCHOOL_DOMAINS = new Set([
  "uwo.ca",
  "uwaterloo.ca",
  "mcmaster.ca",
  "utoronto.ca",
  "mail.utoronto.ca",
  "yorku.ca",
  "queensu.ca",
  "ualberta.ca",
  "ubc.ca",
  "mcgill.ca",
  "carleton.ca",
  "uottawa.ca",
  "torontomu.ca",
  "sheridancollege.ca",
]);

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const canonical = local.split("+")[0]!.replace(/\./g, "");
    return `${canonical}@${domain}`;
  }
  return email;
}

export function isSchoolEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  if (domain.endsWith(".edu")) return true;
  if (/\.ac\.[a-z]{2,}$/.test(domain)) return true;
  return SCHOOL_DOMAINS.has(domain);
}

export function generateUnsubscribeToken(): string {
  return randomBytes(20).toString("hex");
}

export function editionFromSource(source: string): string {
  return source.replace(/^hw/, "");
}

/** Read-only lookup for the unsubscribe confirmation page.
 *
 *  Exists so that page can render without writing. It used to call
 *  unsubscribeByToken() from getServerSideProps, which turned every GET — including
 *  the ones link scanners issue — into an unsubscribe. Nothing in here mutates. */
export async function tokenExists(
  token: string,
): Promise<"ready" | "already" | "invalid"> {
  const sub = await db.query.emailSubscribers.findFirst({
    where: eq(emailSubscribers.unsubscribeToken, token),
    columns: { id: true, unsubscribedAt: true },
  });
  if (sub) return sub.unsubscribedAt ? "already" : "ready";

  const pre = await db.query.preregistrations.findFirst({
    where: eq(preregistrations.unsubscribeToken, token),
    columns: { id: true, unsubscribedAt: true },
  });
  if (pre) return pre.unsubscribedAt ? "already" : "ready";

  return "invalid";
}

/**
 * Mirror an opt-out onto the Mailjet contact list.
 *
 * Our unsubscribe link is our own (`/api/unsubscribe`), so a click writes
 * `unsubscribed_at` in Postgres and Mailjet never hears about it. That was
 * harmless while no contact list existed, but the list is now the target of
 * marketing's dashboard campaigns — so without this, someone who unsubscribes
 * from the confirmation email still has `IsUnsubscribed=false` on the list and
 * receives the next campaign.
 *
 * Best-effort by design. The database write has already happened and is what
 * actually honours the request; a Mailjet outage must not turn a successful
 * unsubscribe into a 500, least of all on the RFC 8058 one-click POST that
 * inbox providers expect to answer 200.
 *
 * Fires on the already-unsubscribed path too, so a previously failed mirror
 * heals itself the next time the link is clicked.
 */
async function mirrorUnsubToMailjet(email: string): Promise<void> {
  if (!env.MAILJET_CONTACT_LIST_ID) return;
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) return;
  const res = await manageContact(
    env.MAILJET_CONTACT_LIST_ID,
    email,
    { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
    "unsub",
  );
  if (!res.ok) {
    console.error("Error mirroring unsubscribe to Mailjet:", email, res.error);
  }
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  // The token belongs to exactly one list (email_subscriber or preregistration
  // — kept disjoint by email). Try the campaign list first, then the updates
  // signup list. Already-unsubscribed tokens still return true (idempotent).
  const subRows = await db
    .update(emailSubscribers)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(emailSubscribers.unsubscribeToken, token),
        isNull(emailSubscribers.unsubscribedAt),
      ),
    )
    .returning({ email: emailSubscribers.email });
  if (subRows[0]) {
    await mirrorUnsubToMailjet(subRows[0].email);
    return true;
  }
  const subExisting = await db.query.emailSubscribers.findFirst({
    where: eq(emailSubscribers.unsubscribeToken, token),
    columns: { email: true },
  });
  if (subExisting) {
    await mirrorUnsubToMailjet(subExisting.email);
    return true;
  }

  const preRows = await db
    .update(preregistrations)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(preregistrations.unsubscribeToken, token),
        isNull(preregistrations.unsubscribedAt),
      ),
    )
    .returning({ email: preregistrations.email });
  if (preRows[0]) {
    await mirrorUnsubToMailjet(preRows[0].email);
    return true;
  }
  const preExisting = await db.query.preregistrations.findFirst({
    where: eq(preregistrations.unsubscribeToken, token),
    columns: { email: true },
  });
  if (preExisting) {
    await mirrorUnsubToMailjet(preExisting.email);
    return true;
  }
  return false;
}
