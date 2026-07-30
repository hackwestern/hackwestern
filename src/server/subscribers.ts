import { randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";

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

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const rows = await db
    .update(emailSubscribers)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(emailSubscribers.unsubscribeToken, token),
        isNull(emailSubscribers.unsubscribedAt),
      ),
    )
    .returning({ id: emailSubscribers.id });
  if (rows.length > 0) return true;
  // token exists but already unsubscribed => still a success (idempotent)
  const existing = await db.query.emailSubscribers.findFirst({
    where: eq(emailSubscribers.unsubscribeToken, token),
    columns: { id: true },
  });
  return !!existing;
}
