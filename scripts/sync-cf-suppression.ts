import { inArray, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { env } from "~/env";

// Pulls Cloudflare Email Sending's suppression list (hard bounces + spam
// complaints) and marks the matching email_subscriber rows as bounced, so the
// campaign drip — which excludes rows with a bouncedAt via selectEligible —
// never re-sends to a known-bad address. Cloudflare already suppresses these on
// its side; this keeps our own DB in sync. Idempotent: only rows not already
// marked are touched, so it is safe to run on a schedule.
//
// Usage:  npx tsx scripts/sync-cf-suppression.ts           # dry run (default)
//         npx tsx scripts/sync-cf-suppression.ts --apply    # write bouncedAt

const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/suppressions`;

interface Suppression {
  email: string;
  reason: string;
}

/** Fetch every suppressed address from Cloudflare, following cursor pagination. */
export async function fetchSuppressions(): Promise<Suppression[]> {
  const items: Suppression[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(ENDPOINT);
    url.searchParams.set("per_page", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(
        `Cloudflare suppressions API ${res.status}: ${await res.text()}`,
      );
    }
    const json = (await res.json()) as {
      result?: Suppression[];
      result_info?: { next_cursor?: string | null };
    };
    for (const s of json.result ?? []) {
      if (s.email) items.push({ email: s.email, reason: s.reason });
    }
    cursor = json.result_info?.next_cursor ?? undefined;
  } while (cursor);
  return items;
}

/**
 * Given the suppressed addresses and the not-yet-bounced subscribers, return the
 * subscriber ids to mark. Matching is case-insensitive so it survives any casing
 * differences between the sent address and the stored row.
 */
export function idsToMark(
  suppressedEmails: string[],
  subscribers: { id: number; email: string }[],
): number[] {
  const suppressed = new Set(suppressedEmails.map((e) => e.toLowerCase()));
  return subscribers
    .filter((s) => suppressed.has(s.email.toLowerCase()))
    .map((s) => s.id);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const suppressions = await fetchSuppressions();
  console.log(
    `Fetched ${suppressions.length} suppressed address(es) from Cloudflare.`,
  );
  if (suppressions.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  const active = await db
    .select({ id: emailSubscribers.id, email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(isNull(emailSubscribers.bouncedAt));

  const ids = idsToMark(
    suppressions.map((s) => s.email),
    active,
  );

  console.log(
    `${ids.length} subscriber(s) match Cloudflare suppressions and are not yet marked bounced.`,
  );
  const emailById = new Map(active.map((s) => [s.id, s.email]));
  ids.forEach((id) => console.log(`  ${emailById.get(id)}`));

  if (!apply) {
    console.log("DRY RUN — pass --apply to write bouncedAt.");
    return;
  }
  if (ids.length === 0) return;

  await db
    .update(emailSubscribers)
    .set({ bouncedAt: new Date() })
    .where(inArray(emailSubscribers.id, ids));
  console.log(`Marked ${ids.length} subscriber(s) as bounced.`);
}

if (process.argv[1]?.includes("sync-cf-suppression")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
