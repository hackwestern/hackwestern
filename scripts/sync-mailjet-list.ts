import { and, isNull, asc, inArray } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { emailSubscribers, preregistrations } from "~/server/db/schema";
import { getContactList, manageContact } from "~/server/mailjet-contacts";

/**
 * Files our sendable audience into a Mailjet contact list so the marketing
 * team can target it from the dashboard.
 *
 * Background: every contact Mailjet knows about was created implicitly by the
 * Send API, which files contacts under no list. `My contact lists` therefore
 * showed 0 for every list while `All Contacts` showed thousands, and a
 * dashboard campaign — which can only send to a list or to a segment built on
 * one — had nothing to target. Cohorts the drip never sent to (hw11) and
 * preregistration signups from before the Cloudflare→Mailjet cutover were not
 * in Mailjet at all.
 *
 * Suppression stays authoritative in our database on the way IN: rows with
 * unsubscribed_at or bounced_at are never uploaded. Mailjet's own per-list
 * unsubscribe state is authoritative from then on, which is why every write
 * uses `addnoforce` — see the note in src/server/mailjet-contacts.ts.
 *
 * Usage:  npx tsx scripts/sync-mailjet-list.ts --list=10532038
 *         npx tsx scripts/sync-mailjet-list.ts --list=10532038 --apply
 *         npx tsx scripts/sync-mailjet-list.ts --list=10532038 --sources=hw11,hw12 --apply
 */

const DEFAULT_SOURCES = ["hw12"];
/** Mailjet REST is generous, but a 2.7k-contact backfill is not worth hammering. */
const DELAY_MS = 100;

export interface Candidate {
  email: string;
  origin: "subscriber" | "preregistration";
}

/**
 * The audience: sendable `email_subscriber` rows in the given cohorts, plus
 * every sendable `preregistration` row. Deduplicated on email — the two tables
 * are meant to be disjoint but one overlapping address exists in production,
 * and Mailjet would treat a repeat as a second write rather than an error.
 */
export async function selectCandidates(sources: string[]): Promise<Candidate[]> {
  const subscribers = await db
    .select({ email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(
      and(
        isNull(emailSubscribers.unsubscribedAt),
        isNull(emailSubscribers.bouncedAt),
        inArray(emailSubscribers.source, sources),
      ),
    )
    .orderBy(asc(emailSubscribers.id));

  const prereg = await db
    .select({ email: preregistrations.email })
    .from(preregistrations)
    .where(
      and(
        isNull(preregistrations.unsubscribedAt),
        isNull(preregistrations.bouncedAt),
      ),
    )
    .orderBy(asc(preregistrations.id));

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const row of subscribers) {
    if (seen.has(row.email)) continue;
    seen.add(row.email);
    out.push({ email: row.email, origin: "subscriber" });
  }
  for (const row of prereg) {
    if (seen.has(row.email)) continue;
    seen.add(row.email);
    out.push({ email: row.email, origin: "preregistration" });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apply = process.argv.includes("--apply");
  const listId =
    process.argv.find((a) => a.startsWith("--list="))?.slice("--list=".length) ??
    env.MAILJET_CONTACT_LIST_ID;
  const sources = (
    process.argv
      .find((a) => a.startsWith("--sources="))
      ?.slice("--sources=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? DEFAULT_SOURCES
  ).sort();

  if (!listId) {
    console.error(
      "No list ID — pass --list=<id> or set MAILJET_CONTACT_LIST_ID. Find it under Contacts → Contact lists.",
    );
    process.exit(1);
  }
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error("MAILJET_API_KEY / MAILJET_SECRET_KEY not set.");
    process.exit(1);
  }
  const creds = {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  };

  // Confirm the list before writing 2.7k contacts into whatever that ID is.
  const list = await getContactList(listId, creds);
  if (!list) {
    console.error(`Mailjet has no contact list with ID ${listId}.`);
    process.exit(1);
  }
  console.log(
    `List ${list.id} "${list.name}" — ${list.subscriberCount} contact(s) today.`,
  );

  const candidates = await selectCandidates(sources);
  const fromPrereg = candidates.filter(
    (c) => c.origin === "preregistration",
  ).length;
  console.log(
    `Audience: ${candidates.length} (${
      candidates.length - fromPrereg
    } subscriber [${sources.join(", ")}] + ${fromPrereg} preregistration). Mode: ${
      apply ? "APPLY" : "DRY RUN"
    }.`,
  );

  if (!apply) {
    console.log("DRY RUN — pass --apply to write. First 10:");
    candidates.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c.email} (${c.origin})`);
    });
    return;
  }

  let added = 0;
  const failures: string[] = [];
  for (const [i, c] of candidates.entries()) {
    const res = await manageContact(listId, c.email, creds, "addnoforce");
    if (res.ok) {
      added++;
    } else {
      failures.push(`${c.email}: ${res.error}`);
      console.log(`FAIL ${c.email} — ${res.error}`);
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  ...${i + 1}/${candidates.length}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Done. added ${added}, failed ${failures.length}.`);
  // addnoforce is idempotent, so the fix for failures is to re-run the script.
  if (failures.length > 0) {
    console.log("Re-run to retry the failures — repeat writes are no-ops.");
  }
}

if (process.argv[1]?.includes("sync-mailjet-list")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
