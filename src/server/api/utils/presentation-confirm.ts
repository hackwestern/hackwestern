import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import {
  hasCurrentTimes,
  keysByTeam,
} from "~/server/api/utils/presentation-schedule";
import { db } from "~/server/db";
import {
  sponsorPresentationConfirms,
  sponsorPresentationNotices,
  sponsorPresentations,
  users,
} from "~/server/db/schema";

/** Where a team member confirmed: the Slack DM button or /live. */
export type ConfirmVia = "slack" | "live";

/**
 * The team's current times as a slotsKey (null = no placed slot) and
 * whether any member has been sent exactly these times.
 */
export async function teamTimes(teamId: string) {
  const [rows, notices] = await Promise.all([
    db
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        startMinute: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .where(
        and(
          eq(sponsorPresentations.teamId, teamId),
          isNotNull(sponsorPresentations.startMinute),
        ),
      ),
    db
      .select({
        teamId: sponsorPresentationNotices.teamId,
        slotsKey: sponsorPresentationNotices.slotsKey,
        sentAt: sponsorPresentationNotices.sentAt,
      })
      .from(sponsorPresentationNotices)
      .where(eq(sponsorPresentationNotices.teamId, teamId)),
  ]);
  const keys = keysByTeam(rows);
  return {
    key: keys.get(teamId) ?? null,
    told: notices.some((n) => hasCurrentTimes(n, keys)),
  };
}

/**
 * When the team confirmed its current times (`key`), else null. A confirm
 * of older times doesn't count: the team has to confirm the new ones.
 */
export async function teamConfirmedAt(teamId: string, key: string | null) {
  if (!key) return null;
  const row = await db.query.sponsorPresentationConfirms.findFirst({
    where: eq(sponsorPresentationConfirms.teamId, teamId),
  });
  return row && row.slotsKey === key ? row.confirmedAt : null;
}

/**
 * One member confirms their team's current presentation times (Jazz,
 * 2026-11-19: one reply covers the team). Only times the team was sent can
 * be confirmed (CONFLICT otherwise); `expectedKey`, when given, must still
 * be the team's times (a Slack button from before a room change). A second
 * confirm of the same times keeps the first one's time and member.
 */
export async function confirmTeamTimes(
  userId: string,
  via: ConfirmVia,
  expectedKey?: string,
): Promise<{ teamId: string; confirmedAt: Date }> {
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { teamId: true },
  });
  if (!me?.teamId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: sponsorPresentationsCopy.errors.nothingToConfirm,
    });
  }
  const { key, told } = await teamTimes(me.teamId);
  if (!key || !told || (expectedKey !== undefined && expectedKey !== key)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: sponsorPresentationsCopy.errors.nothingToConfirm,
    });
  }
  const c = sponsorPresentationConfirms;
  await db
    .insert(c)
    .values({ teamId: me.teamId, userId, via, slotsKey: key })
    .onConflictDoUpdate({
      target: c.teamId,
      set: {
        userId,
        via,
        slotsKey: key,
        confirmedAt: sql`now()`,
      },
      setWhere: sql`${c.slotsKey} <> excluded.slots_key`,
    });
  const confirmedAt = await teamConfirmedAt(me.teamId, key);
  return { teamId: me.teamId, confirmedAt: confirmedAt ?? new Date() };
}
