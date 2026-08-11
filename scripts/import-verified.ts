import { readFileSync } from "fs";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { normalizeEmail, generateUnsubscribeToken } from "~/server/subscribers";

// Imports a PRE-VERIFIED deliverable list (e.g. a Kickbox "deliverable" export)
// into email_subscriber, with a per-row source column. Unlike
// scripts/import-subscribers.ts, this intentionally does NOT skip school domains
// (isSchoolEmail): the caller has already verified these addresses are
// deliverable, so the usual "school emails rot" exclusion does not apply here.
// Re-verify periodically (bulk clean + scripts/mark-undeliverable.ts) to prune
// them as students graduate and their .ca/.edu addresses die.
//
//   npx tsx scripts/import-verified.ts <email,source.csv>            # dry run
//   npx tsx scripts/import-verified.ts <email,source.csv> --commit    # insert
//
// CSV: header row "email,source"; source must be hw11 or hw12.

async function main() {
  const file = process.argv.find((a) => a.toLowerCase().endsWith(".csv"));
  if (!file) {
    console.error("Usage: import-verified.ts <email,source.csv> [--commit]");
    process.exit(1);
  }
  const commit = process.argv.includes("--commit");

  // Disjoint-tables invariant: never import an email that is already a
  // preregistration (mirrors import-subscribers.ts).
  const prereg = await db.query.preregistrations.findMany({
    columns: { email: true },
  });
  const exclude = new Set(prereg.map((p) => normalizeEmail(p.email)));

  const seen = new Set<string>();
  const rows: { email: string; source: string }[] = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/).slice(1);
  for (const line of lines) {
    const [rawEmail, rawSource] = line.split(",");
    if (!rawEmail || !rawSource) continue;
    const email = normalizeEmail(rawEmail.replace(/^"|"$/g, "").trim());
    const source = rawSource.trim();
    if (!email.includes("@")) continue;
    if (source !== "hw11" && source !== "hw12") continue;
    if (exclude.has(email) || seen.has(email)) continue;
    seen.add(email);
    rows.push({ email, source });
  }

  console.log(
    `Prepared ${rows.length} verified subscriber row(s) ` +
      `(excluded ${exclude.size} preregistration emails).`,
  );
  if (!commit) {
    console.log("Dry run. Re-run with --commit to insert.");
    return;
  }

  let inserted = 0;
  for (const r of rows) {
    const done = await db
      .insert(emailSubscribers)
      .values({ ...r, unsubscribeToken: generateUnsubscribeToken() })
      .onConflictDoNothing({ target: emailSubscribers.email })
      .returning({ id: emailSubscribers.id });
    if (done.length) inserted++;
  }
  console.log(
    `Inserted ${inserted} new, skipped ${rows.length - inserted} existing.`,
  );
}

if (process.argv[1]?.includes("import-verified")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
