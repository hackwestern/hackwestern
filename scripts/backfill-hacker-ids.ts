import { and, eq, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { getOrCreateHackerId } from "~/server/api/utils/hacker-id";

/** Confirmed hackers who don't have a hacker ID yet. */
export async function findConfirmedWithoutHackerId(): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(
      and(
        eq(applications.status, "CONFIRMED"),
        eq(users.type, "hacker"),
        isNull(users.hackerId),
      ),
    );
  return rows.map((r) => r.id);
}

// Dry run by default; --apply writes. Safe to re-run: existing IDs are kept.
async function main() {
  const apply = process.argv.includes("--apply");
  const ids = await findConfirmedWithoutHackerId();
  console.log(`${ids.length} confirmed hackers without a hacker ID.`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to assign IDs.");
    return;
  }
  for (const id of ids) await getOrCreateHackerId(id);
  console.log(`Assigned ${ids.length} hacker IDs.`);
}

if (process.argv[1]?.includes("backfill-hacker-ids")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
