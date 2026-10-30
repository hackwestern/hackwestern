import { and, inArray, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import { teamFinderCards } from "~/server/db/schema";
import { RETENTION_DATE } from "~/lib/team-finder";
import {
  deletePhoto,
  photosConfigured,
} from "~/server/storage/team-finder-photos";

// After the event, deletes every team finder card and its photo.
// Dry run unless --apply.
//
//   npx tsx scripts/delete-team-finder-cards.ts [--apply]
//
// Refuses before RETENTION_DATE even with --apply. If photo storage isn't
// configured the rows are still deleted; the private bucket's lifecycle rule
// expires the photos on the same date. Prints counts only: this repo's
// Actions logs are public.

export function refuseBeforeRetention(now = new Date()) {
  if (now < RETENTION_DATE) {
    throw new Error(
      `Cards are kept until ${RETENTION_DATE.toISOString()}. Refusing.`,
    );
  }
}

export async function countCards() {
  const rows = await db
    .select({ userId: teamFinderCards.userId })
    .from(teamFinderCards);
  return rows.length;
}

/**
 * Deletes each photo, then the card rows: every card, or only `userIds`'
 * (tests use that to stay off other rows). Returns the counts.
 */
export async function deleteAllCards(now = new Date(), userIds?: string[]) {
  refuseBeforeRetention(now);
  const scope = userIds ? inArray(teamFinderCards.userId, userIds) : undefined;
  const withPhotos = await db
    .select({ photoKey: teamFinderCards.photoKey })
    .from(teamFinderCards)
    .where(and(isNotNull(teamFinderCards.photoKey), scope));
  const keys = withPhotos.map((r) => r.photoKey!);

  let photosDeleted = 0;
  let photosSkipped = 0;
  if (photosConfigured()) {
    for (const key of keys) {
      await deletePhoto(key);
      photosDeleted++;
    }
  } else {
    photosSkipped = keys.length;
  }

  const removed = await db
    .delete(teamFinderCards)
    .where(scope)
    .returning({ userId: teamFinderCards.userId });
  return { cards: removed.length, photosDeleted, photosSkipped };
}

async function main() {
  try {
    refuseBeforeRetention();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  const APPLY = process.argv.includes("--apply");
  const n = await countCards();
  console.log(
    `${n} team finder card(s). Mode: ${APPLY ? "APPLY" : "DRY RUN"}.`,
  );
  if (!APPLY || n === 0) return;

  const r = await deleteAllCards();
  console.log(
    `Done. Deleted ${r.cards} card(s), ${r.photosDeleted} photo(s); ${r.photosSkipped} photo key(s) skipped (storage not configured).`,
  );
}

if (process.argv[1]?.includes("delete-team-finder-cards")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
