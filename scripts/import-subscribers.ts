import { normalizeEmail, isSchoolEmail, generateUnsubscribeToken } from "~/server/subscribers";
import { db } from "~/server/db";
import { emailSubscribers, preregistrations } from "~/server/db/schema";

export const DOMAIN_FIXES: Record<string, string> = {
  "gmaill.com": "gmail.com", "outlook.con": "outlook.com", "uwo.com": "uwo.ca",
  "uwaterloo.caq": "uwaterloo.ca", "sheidancollege.ca": "sheridancollege.ca",
  "mail.utoronto.com": "mail.utoronto.ca", "mail.utoronto": "mail.utoronto.ca",
};
const JUNK = new Set([
  "t1.com", "example.com", "test.com", "email.com",
  "ajfoij.cwe", "fhuef.fhuio", "s.com", "racetoacure.org", "hackwestern.ca",
]);

function fixDomain(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return DOMAIN_FIXES[domain] ? `${local}@${DOMAIN_FIXES[domain]}` : email;
}

export function buildSubscriberRows(
  sources: { emails: string[]; source: string }[],
  exclude: Set<string> = new Set(),
): { email: string; source: string }[] {
  // hw12 should win on overlap: process hw11 first, then hw12 overwrites.
  const order = [...sources].sort((a, b) => a.source.localeCompare(b.source));
  const map = new Map<string, string>(); // email -> source
  for (const { emails, source } of order) {
    for (const raw of emails) {
      const email = normalizeEmail(fixDomain(normalizeEmail(raw)));
      const domain = email.split("@")[1] ?? "";
      if (!email.includes("@") || JUNK.has(domain)) continue;
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) continue;
      if (isSchoolEmail(email)) continue;
      if (exclude.has(email)) continue; // already in preregistration → keep tables disjoint
      map.set(email, source);
    }
  }
  return [...map.entries()].map(([email, source]) => ({ email, source }));
}

// --- I/O wrapper (not unit-tested; exercised via dry-run) ---
async function main() {
  const COMMIT = process.argv.includes("--commit");
  // Emails are extracted upstream from the restored dumps into these files,
  // one email per line (see runbook Task 9, step "extract emails").
  const fs = await import("fs");
  const read = (p: string) =>
    fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];

  // Disjoint-tables invariant: never import an email that's already a
  // preregistration. normalizeEmail so the compare matches stored form.
  const prereg = await db.query.preregistrations.findMany({ columns: { email: true } });
  const exclude = new Set(prereg.map((p) => normalizeEmail(p.email)));

  const rows = buildSubscriberRows(
    [
      { emails: read("/tmp/hw11-emails.txt"), source: "hw11" },
      { emails: read("/tmp/hw12-emails.txt"), source: "hw12" },
    ],
    exclude,
  );
  console.log(`Prepared ${rows.length} subscriber rows (excluded ${exclude.size} preregistration emails).`);
  if (!COMMIT) {
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
  console.log(`Inserted ${inserted} new, skipped ${rows.length - inserted} existing.`);
}

if (process.argv[1]?.includes("import-subscribers")) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
