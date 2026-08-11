import { and, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";

// Exports the sendable email_subscriber list (hw11 + hw12 alumni — not
// unsubscribed, not already bounced) as CSV to stdout, for bulk email
// verification / list cleaning before a re-engagement campaign. The
// preregistrations table is intentionally excluded: those addresses are
// validated at signup and assumed clean.
//
//   npx tsx scripts/export-subscribers.ts > subscribers.csv
//
// Status is written to stderr so stdout stays a clean CSV you can redirect.
// The `source` column lets you filter to just hw11 or hw12 before uploading.

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const rows = await db
    .select({
      email: emailSubscribers.email,
      source: emailSubscribers.source,
    })
    .from(emailSubscribers)
    .where(
      and(
        isNull(emailSubscribers.unsubscribedAt),
        isNull(emailSubscribers.bouncedAt),
      ),
    );

  process.stderr.write(`Exporting ${rows.length} subscriber(s) to CSV...\n`);
  process.stdout.write("email,source\n");
  for (const r of rows) {
    process.stdout.write(`${csvField(r.email)},${csvField(r.source)}\n`);
  }
}

if (process.argv[1]?.includes("export-subscribers")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
