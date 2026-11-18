import { TRPCError } from "@trpc/server";
import { eq, isNotNull, sql } from "drizzle-orm";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { db } from "~/server/db";
import {
  sponsorJudgingSettings,
  sponsorPresentations,
} from "~/server/db/schema";

/**
 * Sunday judging switches (one row, id 1; no row = everything closed).
 * Round 2 is open while round2OpenedAt is set (docs/flows/sponsor-judging.md).
 */
const SETTINGS_ID = 1;

/** When organizers opened round 2; null = not open. */
export async function round2OpenedAt(): Promise<Date | null> {
  const row = await db.query.sponsorJudgingSettings.findFirst({
    where: eq(sponsorJudgingSettings.id, SETTINGS_ID),
    columns: { round2OpenedAt: true },
  });
  return row?.round2OpenedAt ?? null;
}

/**
 * Open or close round 2. Opening an open round keeps its first opened
 * time; closing clears it. Returns the stored value. Opening needs a
 * schedule with at least one placed slot (BAD_REQUEST otherwise): round 2
 * ranks teams that presented, so with nothing scheduled nobody could rank.
 * The organizer button is disabled in the same case.
 */
export async function setRound2Open(open: boolean): Promise<Date | null> {
  if (open) {
    const placed = await db.query.sponsorPresentations.findFirst({
      where: isNotNull(sponsorPresentations.startMinute),
      columns: { teamId: true },
    });
    if (!placed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: sponsorPresentationsCopy.errors.round2NoSchedule,
      });
    }
  }
  const now = new Date();
  const [row] = await db
    .insert(sponsorJudgingSettings)
    .values({
      id: SETTINGS_ID,
      round2OpenedAt: open ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sponsorJudgingSettings.id,
      set: {
        round2OpenedAt: open
          ? sql`coalesce(${sponsorJudgingSettings.round2OpenedAt}, now())`
          : null,
        updatedAt: now,
      },
    })
    .returning({ round2OpenedAt: sponsorJudgingSettings.round2OpenedAt });
  return row?.round2OpenedAt ?? null;
}
