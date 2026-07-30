import { and, isNull, or, lt, asc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { sendEmail } from "~/server/mail";
import { campaignTemplate } from "~/server/api/routers/email-templates";
import { editionFromSource } from "~/server/subscribers";
import { env } from "~/env";

const BASE = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://www.hackwestern.com";
const SUBJECT = "Hack Western 13 is coming!";
const DELAY_MS = 500;

type Sub = { email: string; source: string; unsubscribeToken: string };
type SubRow = Sub & { id: number };

/** The eligible-recipients query: the single-send + suppression guarantee. */
export async function selectEligible(
  chunkSize: number,
  campaignStart: Date,
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
        or(
          isNull(emailSubscribers.lastSentAt),
          lt(emailSubscribers.lastSentAt, campaignStart),
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
  return {
    subject: SUBJECT,
    html: campaignTemplate(sub.email, editionFromSource(sub.source), pageUrl),
    headers: {
      "List-Unsubscribe": `<${postUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    } as Record<string, string>,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const SEND = process.argv.includes("--send");
  const chunk = Number(process.argv.find((a) => a.startsWith("--chunk="))?.split("=")[1] ?? 75);
  const campaignStart = new Date(
    process.argv.find((a) => a.startsWith("--start="))?.split("=")[1] ?? "2026-08-01T00:00:00Z",
  );

  const rows = await selectEligible(chunk, campaignStart);

  console.log(`Chunk: ${rows.length} recipient(s). Mode: ${SEND ? "SEND" : "DRY RUN"}.`);
  if (!SEND) { rows.forEach((r, i) => console.log(`${i + 1}. ${r.email}`)); return; }

  let sent = 0, bounced = 0, failed = 0;
  for (const r of rows) {
    const { subject, html, headers } = renderFor(r);
    const { data, error } = await sendEmail({
      from: "Hack Western Team <hello@hackwestern.com>",
      to: r.email, subject, html, headers,
    });
    if (error) {
      failed++;
      console.log(`FAIL ${r.email} — ${error.message}`);
      if (/quota|rate|429/i.test(error.message)) { console.log("Quota/rate hit — stopping early."); break; }
    } else if (data && data.bounced.length) {
      bounced++;
      await db.update(emailSubscribers).set({ bouncedAt: new Date() }).where(eq(emailSubscribers.id, r.id));
      console.log(`BOUNCE ${r.email}`);
    } else {
      sent++;
      await db.update(emailSubscribers).set({ lastSentAt: new Date() }).where(eq(emailSubscribers.id, r.id));
      console.log(`ok ${r.email}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. sent ${sent}, bounced ${bounced}, failed ${failed}.`);
}

if (process.argv[1]?.includes("send-campaign")) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
