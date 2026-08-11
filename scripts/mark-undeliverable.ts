import { readFileSync } from "fs";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";

// Reconciles a bulk email-verification result back into the DB. Given a Kickbox
// (or NeverBounce) "deliverable" export, marks every sendable email_subscriber
// row that is NOT in that deliverable list as bounced — i.e. the addresses the
// verifier flagged undeliverable/risky/unknown — so the campaign drip never
// sends to them again. Mark, not delete: reversible, and selectEligible already
// excludes bouncedAt.
//
//   npx tsx scripts/mark-undeliverable.ts <deliverable.csv>           # dry run
//   npx tsx scripts/mark-undeliverable.ts <deliverable.csv> --apply    # write
//
// Safety: aborts if it would mark >30% of the list bounced (usually means the
// wrong or a partial deliverable file). Override with --force if you're sure.

const MAX_BOUNCE_FRACTION = 0.3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the first ("email") column from a verifier export, ignoring the header
 * and the other email-ish columns (did_you_mean, email_9, ...). */
function readDeliverable(path: string): Set<string> {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const out = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const first = lines[i]
      ?.split(",")[0]
      ?.replace(/^"|"$/g, "")
      .trim()
      .toLowerCase();
    if (first && EMAIL_RE.test(first)) out.add(first);
  }
  return out;
}

async function main() {
  const file = process.argv.find((a) => a.toLowerCase().endsWith(".csv"));
  if (!file) {
    console.error(
      "Usage: mark-undeliverable.ts <deliverable.csv> [--apply] [--force]",
    );
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  const deliverable = readDeliverable(file);
  console.log(`Loaded ${deliverable.size} deliverable address(es) from ${file}.`);
  if (deliverable.size === 0) {
    console.error("No emails parsed from the file — aborting.");
    process.exit(1);
  }

  const active = await db
    .select({ id: emailSubscribers.id, email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(
      and(
        isNull(emailSubscribers.unsubscribedAt),
        isNull(emailSubscribers.bouncedAt),
      ),
    );

  const dead = active.filter((s) => !deliverable.has(s.email.toLowerCase()));
  const fraction = active.length ? dead.length / active.length : 0;
  console.log(
    `${active.length} sendable subscriber(s); ${dead.length} not in the deliverable list ` +
      `(${(fraction * 100).toFixed(1)}%) -> would mark bounced.`,
  );

  if (fraction > MAX_BOUNCE_FRACTION && !force) {
    console.error(
      `ABORT: that fraction is high — likely the wrong or a partial deliverable file. ` +
        `Double-check the CSV, or pass --force if it's correct.`,
    );
    process.exit(1);
  }

  if (!apply) {
    console.log("DRY RUN — pass --apply to write bouncedAt.");
    return;
  }
  if (dead.length === 0) return;

  await db
    .update(emailSubscribers)
    .set({ bouncedAt: new Date() })
    .where(
      inArray(
        emailSubscribers.id,
        dead.map((s) => s.id),
      ),
    );
  console.log(`Marked ${dead.length} subscriber(s) as bounced.`);
}

if (process.argv[1]?.includes("mark-undeliverable")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
