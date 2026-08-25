import { env } from "~/env";
import { db } from "~/server/db";
import { emailSubscribers, preregistrations } from "~/server/db/schema";
import { authHeader } from "~/server/mailjet-contacts";
import { normalizeEmail } from "~/server/subscribers";

/**
 * Read-only diff of Mailjet's contacts against our database.
 *
 * Answers "why does Mailjet show ~2.5k contacts when email_subscriber has
 * ~4.9k rows" with an actual set difference rather than an inference, and
 * prints the buckets that explain it. Writes nothing, anywhere.
 *
 * Usage:  npx tsx scripts/reconcile-mailjet-contacts.ts
 */

const PAGE = 1000;

interface MailjetContact {
  Email?: string;
  IsExcludedFromCampaigns?: boolean;
}

/** Every contact on the account, paged. This is the `All Contacts` view. */
export async function fetchAllContacts(creds: {
  apiKey: string;
  secretKey: string;
}): Promise<MailjetContact[]> {
  const all: MailjetContact[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(
      `https://api.mailjet.com/v3/REST/contact?Limit=${PAGE}&Offset=${offset}`,
      { headers: { Authorization: authHeader(creds) } },
    );
    if (!res.ok) {
      throw new Error(`Mailjet contact GET ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { Data?: MailjetContact[] };
    const rows = json.Data ?? [];
    all.push(...rows);
    console.log(`  fetched ${all.length}...`);
    if (rows.length < PAGE) return all;
  }
}

function tally<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

async function main() {
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error("MAILJET_API_KEY / MAILJET_SECRET_KEY not set.");
    process.exit(1);
  }
  const creds = {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  };

  console.log("Fetching Mailjet contacts...");
  const contacts = await fetchAllContacts(creds);
  // Normalized so the comparison matches how we store addresses; Mailjet
  // lowercases but does not collapse gmail dots/plus the way normalizeEmail does.
  const inMailjet = new Set(
    contacts.map((c) => normalizeEmail(c.Email ?? "")).filter(Boolean),
  );
  const excluded = new Set(
    contacts
      .filter((c) => c.IsExcludedFromCampaigns)
      .map((c) => normalizeEmail(c.Email ?? ""))
      .filter(Boolean),
  );
  console.log(
    `Mailjet: ${contacts.length} contacts (${inMailjet.size} unique after normalizing), ${excluded.size} excluded from campaigns.\n`,
  );

  const subs = await db
    .select({
      email: emailSubscribers.email,
      source: emailSubscribers.source,
      unsubscribedAt: emailSubscribers.unsubscribedAt,
      bouncedAt: emailSubscribers.bouncedAt,
      lastSentAt: emailSubscribers.lastSentAt,
    })
    .from(emailSubscribers);
  const pre = await db
    .select({
      email: preregistrations.email,
      unsubscribedAt: preregistrations.unsubscribedAt,
      bouncedAt: preregistrations.bouncedAt,
    })
    .from(preregistrations);

  const rows = [
    ...subs.map((s) => ({
      email: s.email,
      cohort: s.source,
      suppressed: Boolean(s.unsubscribedAt ?? s.bouncedAt),
      everSent: Boolean(s.lastSentAt),
    })),
    ...pre.map((p) => ({
      email: p.email,
      cohort: "prereg",
      suppressed: Boolean(p.unsubscribedAt ?? p.bouncedAt),
      everSent: false,
    })),
  ];

  const missing = rows.filter((r) => !r.suppressed && !inMailjet.has(r.email));
  const present = rows.filter((r) => inMailjet.has(r.email));
  const dbEmails = new Set(rows.map((r) => r.email));
  const orphans = [...inMailjet].filter((e) => !dbEmails.has(e));

  console.log(`Database: ${rows.length} rows across email_subscriber + preregistration.`);
  console.log(`  in Mailjet:            ${present.length}`);
  console.log(`  sendable, NOT in Mailjet: ${missing.length}`);
  console.log(`  in Mailjet, not in DB:    ${orphans.length}\n`);

  console.log("Sendable but missing from Mailjet, by cohort:");
  for (const [cohort, n] of [...tally(missing, (r) => r.cohort)].sort()) {
    const neverSent = missing.filter(
      (r) => r.cohort === cohort && !r.everSent,
    ).length;
    console.log(`  ${cohort.padEnd(8)} ${String(n).padStart(5)}  (${neverSent} never sent to)`);
  }

  console.log("\nPresent in Mailjet, by cohort:");
  for (const [cohort, n] of [...tally(present, (r) => r.cohort)].sort()) {
    console.log(`  ${cohort.padEnd(8)} ${String(n).padStart(5)}`);
  }

  if (orphans.length > 0) {
    console.log("\nIn Mailjet but absent from our tables (first 20):");
    orphans.slice(0, 20).forEach((e) => console.log(`  ${e}`));
  }

  const suppressedButPresent = present.filter((r) => r.suppressed);
  if (suppressedButPresent.length > 0) {
    console.log(
      `\nSuppressed in our DB but still a Mailjet contact: ${suppressedButPresent.length}`,
    );
    const alsoExcluded = suppressedButPresent.filter((r) =>
      excluded.has(r.email),
    ).length;
    console.log(
      `  of which Mailjet also excludes from campaigns: ${alsoExcluded}`,
    );
    console.log(
      `  the remaining ${
        suppressedButPresent.length - alsoExcluded
      } would be mailed by a dashboard campaign if added to a list.`,
    );
  }
}

if (process.argv[1]?.includes("reconcile-mailjet-contacts")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
