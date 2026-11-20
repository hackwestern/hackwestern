import { TRPCError } from "@trpc/server";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import {
  gapViolations,
  normalizeRoom,
  schedulePresentations,
  slotsKey,
} from "~/lib/sponsor-presentations";
import {
  hasPrizeTrack,
  isDigitalJudging,
  remoteJudgingRoom,
} from "~/lib/sponsor-prize-tracks";
import { judgingDayMinutes } from "~/lib/judging-board";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { mirrorJudgingScoresLater } from "~/server/api/utils/sponsor-judging-scores-mirror";
import { mirrorSponsorJudgingSoon } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import { db } from "~/server/db";
import {
  sponsorJudgingRooms,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One schedule rebuild (or room change) at a time, across servers. */
export const scheduleLock = (tx: Tx) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('sponsor_presentation_schedule'))`,
  );

/** Each team's slotsKey, for teams with at least one placed slot. */
export function keysByTeam(
  rows: readonly {
    sponsorId: string;
    teamId: string;
    room: string | null;
    startMinute: number | null;
  }[],
) {
  const slots = new Map<
    string,
    { sponsorId: string; room: string; start: number }[]
  >();
  for (const r of rows) {
    if (r.startMinute === null) continue;
    const list = slots.get(r.teamId) ?? [];
    list.push({
      sponsorId: r.sponsorId,
      room: r.room ?? "",
      start: r.startMinute,
    });
    slots.set(r.teamId, list);
  }
  return new Map(
    [...slots].map(([teamId, list]) => [teamId, slotsKey(list)] as const),
  );
}

/**
 * The member was sent their team's current times. sentAt is cleared when
 * a claim changes the stored key, so a set sentAt always belongs to it.
 */
export const hasCurrentTimes = (
  notice: { teamId: string; slotsKey: string; sentAt: Date | null },
  keys: ReadonlyMap<string, string>,
) => notice.sentAt !== null && keys.get(notice.teamId) === notice.slotsKey;

/**
 * Members who have their current times but whose times `next` (the new
 * slotsKey per team) would change, including teams it no longer places.
 */
async function countChangedTimes(tx: Tx, next: ReadonlyMap<string, string>) {
  const [current, notices] = await Promise.all([
    tx
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        startMinute: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations),
    tx
      .select({
        teamId: sponsorPresentationNotices.teamId,
        slotsKey: sponsorPresentationNotices.slotsKey,
        sentAt: sponsorPresentationNotices.sentAt,
        memberTeam: users.teamId,
      })
      .from(sponsorPresentationNotices)
      .innerJoin(users, eq(users.id, sponsorPresentationNotices.userId))
      .where(isNotNull(sponsorPresentationNotices.sentAt)),
  ]);
  const keys = keysByTeam(current);
  return notices.filter(
    (n) =>
      n.memberTeam === n.teamId &&
      hasCurrentTimes(n, keys) &&
      next.get(n.teamId) !== n.slotsKey,
  ).length;
}

/**
 * The in-person prize track sponsors that present in a room: not digital
 * (PCBWay, Devpost only) and not remote (TinyFish judges online, so its
 * teams don't present; Jazz, 2026-11-19).
 */
export async function presentingSponsors() {
  const prizeTracks = await prizeTrackSponsors();
  return (
    await db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors)
  ).filter(
    (s) =>
      hasPrizeTrack(s.name, prizeTracks) &&
      !isDigitalJudging(s.name) &&
      remoteJudgingRoom(s.name) === null,
  );
}

/**
 * How much notice a team added on judging day gets: its first slot starts
 * at least this long from now.
 */
export const NEW_SLOT_NOTICE_MINUTES = 10;

/**
 * The earliest start a newly placed team may get: no limit before judging
 * day; on it, now plus NEW_SLOT_NOTICE_MINUTES (so never a slot that
 * already passed); after it, nothing.
 */
export function newSlotsFrom(now: Date) {
  const minutes = judgingDayMinutes(now);
  return minutes < 0 ? -Infinity : minutes + NEW_SLOT_NOTICE_MINUTES;
}

/**
 * Build the presentation schedule from every sent shortlist and replace
 * the stored one. Times already given stay where they are (in the
 * sponsor's current room); new teams fit around them. Rooms come from the
 * Judging board first, then the sheets. Members whose team's times don't
 * change stay notified. With dryRun nothing is stored; `changedTimes`
 * (hackers who already have their times and would get new ones) is for a
 * confirm step. Throws BAD_REQUEST when no shortlist was sent.
 */
export async function rebuildPresentationSchedule({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  // The sheets are slow, so every sponsor's room is read before the
  // transaction; the sends are read inside it, so the stored schedule
  // always matches one consistent set of shortlists.
  const trackSponsors = await presentingSponsors();
  const trackIds = new Set(trackSponsors.map((s) => s.id));
  const rooms = await judgingRoomsById(trackSponsors);

  const result = await db.transaction(async (tx) => {
    await scheduleLock(tx);
    const scheduledAt = new Date();
    const sends = (
      await tx
        .select({
          sponsorId: sponsorShortlistSends.sponsorId,
          teamIds: sponsorShortlistSends.teamIds,
        })
        .from(sponsorShortlistSends)
    ).filter((s) => trackIds.has(s.sponsorId));
    if (sends.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: sponsorPresentationsCopy.organizer.nothingSent,
      });
    }
    // A team deleted since the send can't be scheduled (or stored).
    const sentIds = [...new Set(sends.flatMap((s) => s.teamIds))];
    const existing = new Set(
      sentIds.length > 0
        ? (
            await tx
              .select({ id: teams.id })
              .from(teams)
              .where(inArray(teams.id, sentIds))
          ).map((t) => t.id)
        : [],
    );
    const kept = await tx
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        start: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .where(isNotNull(sponsorPresentations.startMinute));
    // A room the schedule already uses stays when no source names one now
    // (a sheet read failing mid-event must never wipe teams' times).
    const usedRoom = new Map(kept.map((k) => [k.sponsorId, k.room]));
    // Rooms read before the lock may be stale: an organizer's change that
    // committed since wins (re-read here, under the lock).
    for (const p of await tx.select().from(sponsorJudgingRooms)) {
      if (trackIds.has(p.sponsorId)) rooms.set(p.sponsorId, p.room);
    }
    const requests = sends.map((s) => ({
      sponsorId: s.sponsorId,
      // Clamped to the column, so a long sheet value can't abort this.
      room: normalizeRoom(rooms.get(s.sponsorId) ?? usedRoom.get(s.sponsorId)),
      teamIds: s.teamIds.filter((id) => existing.has(id)),
    }));
    const result = schedulePresentations(requests, undefined, {
      keep: kept.map((k) => ({ ...k, start: k.start! })),
      notBefore: newSlotsFrom(scheduledAt),
    });
    if (gapViolations(result.slots).length > 0) {
      // The scheduler guarantees this; refuse rather than store a clash.
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    const roomOf = new Map(requests.map((r) => [r.sponsorId, r.room]));
    const values = [
      ...result.slots.map((s) => ({
        sponsorId: s.sponsorId,
        teamId: s.teamId,
        room: s.room,
        startMinute: s.start,
        scheduledAt,
      })),
      ...result.unplaced.map((u) => ({
        sponsorId: u.sponsorId,
        teamId: u.teamId,
        room: roomOf.get(u.sponsorId) ?? null,
        startMinute: null,
        scheduledAt,
      })),
      ...result.noRoom.flatMap((n) =>
        n.teamIds.map((teamId) => ({
          sponsorId: n.sponsorId,
          teamId,
          room: null,
          startMinute: null,
          scheduledAt,
        })),
      ),
      // Past SHORTLIST_MAX on an old send: kept, flagged, never placed.
      ...result.overCap.flatMap((o) =>
        o.teamIds.map((teamId) => ({
          sponsorId: o.sponsorId,
          teamId,
          room: roomOf.get(o.sponsorId) ?? null,
          startMinute: null,
          scheduledAt,
        })),
      ),
    ];

    const changedTimes = await countChangedTimes(tx, keysByTeam(values));
    if (!dryRun) {
      await tx.delete(sponsorPresentations);
      if (values.length > 0)
        await tx.insert(sponsorPresentations).values(values);
    }
    return {
      scheduledAt,
      placed: result.slots.length,
      unplaced:
        result.unplaced.length +
        result.noRoom.reduce((n, r) => n + r.teamIds.length, 0) +
        result.overCap.reduce((n, r) => n + r.teamIds.length, 0),
      changedTimes,
    };
  });
  // Both tabs; the Judging Scores tab gets each sponsor's new team rows.
  if (!dryRun) {
    mirrorJudgingScoresLater();
    await mirrorSponsorJudgingSoon();
  }
  return result;
}

/**
 * Rebuild after a shortlist send or a room change, never throwing: no
 * shortlist yet is normal, and a failure is logged (the board still shows
 * the last schedule, and the next change rebuilds again). True when it
 * rebuilt (and so already rewrote the Sponsor Judging tab).
 */
export async function rebuildPresentationScheduleQuietly(): Promise<boolean> {
  try {
    await rebuildPresentationSchedule();
    return true;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
      return false;
    }
    console.error(
      "presentation schedule rebuild failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
