import { randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers, preregistrations } from "~/server/db/schema";

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
    .returning({ id: emailSubscribers.id });
  if (subRows.length > 0) return true;
  const subExisting = await db.query.emailSubscribers.findFirst({
    where: eq(emailSubscribers.unsubscribeToken, token),
    columns: { id: true },
  });
  if (subExisting) return true;

  const preRows = await db
    .update(preregistrations)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(preregistrations.unsubscribeToken, token),
        isNull(preregistrations.unsubscribedAt),
      ),
    )
    .returning({ id: preregistrations.id });
  if (preRows.length > 0) return true;
  const preExisting = await db.query.preregistrations.findFirst({
    where: eq(preregistrations.unsubscribeToken, token),
    columns: { id: true },
  });
  return !!preExisting;
}
