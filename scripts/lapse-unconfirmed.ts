import { and, eq } from "drizzle-orm";
import { RSVP_DEADLINE, isPastRsvpDeadline } from "~/lib/date";
import { db } from "~/server/db";
import { applications } from "~/server/db/schema";

// Once RSVP closes, moves every application still ACCEPTED (never answered)
// to DECLINED. Run by .github/workflows/after-rsvp.yml. Dry run unless --apply.
//
//   npx tsx scripts/lapse-unconfirmed.ts [--apply]
//
// Every moved row gets the same updated_at, printed at the end, so
// scripts/revert-lapse.ts --at=<that time> undoes exactly this batch.
// Prints counts and that time only: this repo's Actions logs are public.

export function refuseBeforeDeadline() {
  if (!isPastRsvpDeadline()) {
    throw new Error(
      `RSVP hasn't closed yet (it closes ${RSVP_DEADLINE.toISOString()}). Refusing.`,
    );
  }
}

export async function countUnconfirmed() {
  const rows = await db
    .select({ userId: applications.userId })
    .from(applications)
    .where(eq(applications.status, "ACCEPTED"));
  return rows.length;
}

/** ACCEPTED -> DECLINED, all stamped `at`. Returns how many moved. */
export async function lapseUnconfirmed(at: Date) {
  refuseBeforeDeadline();
  const moved = await db
    .update(applications)
    .set({ status: "DECLINED", updatedAt: at })
    .where(eq(applications.status, "ACCEPTED"))
    .returning({ userId: applications.userId });
  return moved.length;
}

/** Undo one batch: DECLINED rows stamped exactly `at` -> ACCEPTED. */
export async function revertLapse(at: Date, apply: boolean) {
  const match = and(
    eq(applications.status, "DECLINED"),
    eq(applications.updatedAt, at),
  );
  if (!apply) {
    const rows = await db
      .select({ userId: applications.userId })
      .from(applications)
      .where(match);
    return rows.length;
  }
  const moved = await db
    .update(applications)
    .set({ status: "ACCEPTED" })
    .where(match)
    .returning({ userId: applications.userId });
  return moved.length;
}

async function main() {
  try {
    refuseBeforeDeadline();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  const APPLY = process.argv.includes("--apply");
  const n = await countUnconfirmed();
  console.log(
    `${n} accepted hacker(s) never RSVP'd. Mode: ${APPLY ? "APPLY" : "DRY RUN"}.`,
  );
  if (!APPLY || n === 0) return;

  const at = new Date();
  const moved = await lapseUnconfirmed(at);
  console.log(`Done. Moved ${moved} to DECLINED at ${at.toISOString()}.`);
  console.log(
    `Undo: npx tsx scripts/revert-lapse.ts --at=${at.toISOString()} --apply`,
  );
}

if (process.argv[1]?.includes("lapse-unconfirmed")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
