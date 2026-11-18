import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { env } from "~/env";
import {
  PRESENTATION_SLOTS_PER_ROOM,
  gapViolations,
  schedulePresentations,
} from "~/lib/sponsor-presentations";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { runAllTeamChecks } from "~/server/api/utils/cheat-check-runners";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import {
  sendPresentationDm,
  type PresentationDmResult,
} from "~/server/slack/presentation-dm";

const errors = sponsorPresentationsCopy.errors;

/** Slack DMs in flight at once (3 calls each; stays under rate limits). */
const DM_CONCURRENCY = 4;
/** Cheat check runs at once (each calls GitHub and Devpost). */
const CHEAT_CONCURRENCY = 2;

/** Run `fn` over `items`, at most `limit` at a time, results in order. */
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

async function teamNames(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, [...ids]));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Distinct team ids across every sponsor's submitted top list. */
async function topTeamIds() {
  const finals = await db
    .select({ teamIds: sponsorFinalPicks.teamIds })
    .from(sponsorFinalPicks);
  return [...new Set(finals.flatMap((f) => f.teamIds))].sort();
}

/**
 * Sunday sponsor presentations (docs/flows/sponsor-judging.md): organizers
 * schedule every sent shortlist into sponsor rooms, notify hackers on
 * Slack, and send the top teams to the cheat check. Hackers read their own
 * team's times with `mine`.
 */
export const sponsorPresentationsRouter = createTRPCRouter({
  /**
   * Organizers: who sent a shortlist, every schedule row (placed and
   * flagged) with names, and the sponsor top teams for the cheat check.
   */
  overview: protectedOrganizerProcedure.query(async () => {
    const [sponsors, sends, rows, topIds] = await Promise.all([
      db
        .select({
          id: sponsorJudgingSponsors.id,
          name: sponsorJudgingSponsors.name,
        })
        .from(sponsorJudgingSponsors)
        .orderBy(sponsorJudgingSponsors.name),
      db.select().from(sponsorShortlistSends),
      db.select().from(sponsorPresentations),
      topTeamIds(),
    ]);
    const names = await teamNames([
      ...new Set([...rows.map((r) => r.teamId), ...topIds]),
    ]);
    const sponsorName = new Map(sponsors.map((s) => [s.id, s.name]));
    const sendBy = new Map(sends.map((s) => [s.sponsorId, s]));
    const scheduledAt =
      rows.length > 0
        ? new Date(Math.max(...rows.map((r) => r.scheduledAt.getTime())))
        : null;
    const placed = rows.filter((r) => r.startMinute !== null);
    const notified = placed
      .map((r) => r.notifiedAt)
      .filter((d): d is Date => d !== null);
    const named = (r: (typeof rows)[number]) => ({
      sponsorId: r.sponsorId,
      sponsorName: sponsorName.get(r.sponsorId) ?? "",
      teamId: r.teamId,
      teamName: names.get(r.teamId) ?? r.teamId,
      room: r.room,
    });

    return {
      slotsPerRoom: PRESENTATION_SLOTS_PER_ROOM,
      finalTop: SPONSOR_FINAL_TOP,
      sponsors: sponsors.map((s) => {
        const sent = sendBy.get(s.id);
        return {
          sponsorId: s.id,
          name: s.name,
          sentAt: sent?.sentAt ?? null,
          sentCount: sent?.teamIds.length ?? 0,
          /** Re-sent after the current schedule was made. */
          sentAfterSchedule:
            sent !== undefined &&
            scheduledAt !== null &&
            sent.sentAt > scheduledAt,
        };
      }),
      scheduledAt,
      /** Every placed slot notified: the latest send; else null. */
      notifiedAt:
        placed.length > 0 && notified.length === placed.length
          ? new Date(Math.max(...notified.map((d) => d.getTime())))
          : null,
      slots: placed
        .map((r) => ({
          ...named(r),
          room: r.room ?? "",
          start: r.startMinute!,
        }))
        .sort(
          (a, b) =>
            a.start - b.start || a.sponsorName.localeCompare(b.sponsorName),
        ),
      unplaced: rows
        .filter((r) => r.startMinute === null)
        .map((r) => ({
          ...named(r),
          reason: r.room ? ("full" as const) : ("no-room" as const),
        }))
        .sort(
          (a, b) =>
            a.sponsorName.localeCompare(b.sponsorName) ||
            a.teamName.localeCompare(b.teamName),
        ),
      topTeams: topIds.map((id) => ({
        teamId: id,
        name: names.get(id) ?? id,
      })),
    };
  }),

  /**
   * Build the schedule from every sent shortlist and replace the stored
   * one. Rooms come from the same sheets as the Sunday judging panel.
   */
  schedule: protectedOrganizerProcedure.mutation(async () => {
    const sends = await db
      .select({
        sponsorId: sponsorShortlistSends.sponsorId,
        teamIds: sponsorShortlistSends.teamIds,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorShortlistSends)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorShortlistSends.sponsorId),
      );
    if (sends.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: sponsorPresentationsCopy.organizer.nothingSent,
      });
    }
    const rooms = await judgingRoomsById(
      sends.map((s) => ({ id: s.sponsorId, name: s.name })),
    );
    // A team deleted since the send can't be scheduled (or stored).
    const existing = await teamNames([
      ...new Set(sends.flatMap((s) => s.teamIds)),
    ]);
    const requests = sends.map((s) => ({
      sponsorId: s.sponsorId,
      room: rooms.get(s.sponsorId) ?? null,
      teamIds: s.teamIds.filter((id) => existing.has(id)),
    }));
    const result = schedulePresentations(requests);
    if (gapViolations(result.slots).length > 0) {
      // The scheduler guarantees this; refuse rather than store a clash.
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    const scheduledAt = new Date();
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
    ];
    await db.transaction(async (tx) => {
      await tx.delete(sponsorPresentations);
      if (values.length > 0)
        await tx.insert(sponsorPresentations).values(values);
    });
    return {
      scheduledAt,
      placed: result.slots.length,
      unplaced:
        result.unplaced.length +
        result.noRoom.reduce((n, r) => n + r.teamIds.length, 0),
    };
  }),

  /**
   * Slack DM every member of every scheduled team with their rooms and
   * times, and mark those teams notified (their times then show on
   * /live). Without SLACK_BOT_TOKEN nothing is sent and it says so.
   */
  notify: protectedOrganizerProcedure.mutation(async () => {
    const token = env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: errors.slackOff,
      });
    }
    const rows = await db
      .select({
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        start: sponsorPresentations.startMinute,
        sponsorName: sponsorJudgingSponsors.name,
        teamName: teams.name,
      })
      .from(sponsorPresentations)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorPresentations.sponsorId),
      )
      .innerJoin(teams, eq(teams.id, sponsorPresentations.teamId))
      .where(isNotNull(sponsorPresentations.startMinute));
    if (rows.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: errors.noSchedule });
    }
    const byTeam = new Map<
      string,
      {
        name: string;
        slots: { sponsorName: string; room: string; start: number }[];
      }
    >();
    for (const r of rows) {
      const t = byTeam.get(r.teamId) ?? { name: r.teamName, slots: [] };
      t.slots.push({
        sponsorName: r.sponsorName,
        room: r.room ?? "",
        start: r.start!,
      });
      byTeam.set(r.teamId, t);
    }
    const members = await db
      .select({ teamId: users.teamId, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.teamId, [...byTeam.keys()]));

    const results = await mapPool(members, DM_CONCURRENCY, async (m) => {
      const team = byTeam.get(m.teamId!)!;
      const result: PresentationDmResult = await sendPresentationDm(
        token,
        m,
        team.name,
        team.slots,
      );
      return { member: m, result };
    });

    const reached = new Set(
      results.filter((r) => r.result === "sent").map((r) => r.member.teamId!),
    );
    if (reached.size > 0) {
      await db
        .update(sponsorPresentations)
        .set({ notifiedAt: new Date() })
        .where(
          and(
            inArray(sponsorPresentations.teamId, [...reached]),
            isNotNull(sponsorPresentations.startMinute),
          ),
        );
    }
    return {
      sent: results.filter((r) => r.result === "sent").length,
      failed: results.filter((r) => r.result === "failed").length,
      notOnSlack: results
        .filter((r) => r.result === "not-found")
        .map((r) => r.member.name?.trim() || r.member.email),
    };
  }),

  /**
   * Run the existing team cheat checks on every team in a sponsor's top
   * list (cached results are kept, as in cheatCheck.runAllTeamChecks).
   */
  cheatCheckTopTeams: protectedOrganizerProcedure.mutation(async ({ ctx }) => {
    const ids = await topTeamIds();
    const runs = await mapPool(ids, CHEAT_CONCURRENCY, (id) =>
      runAllTeamChecks(id, ctx.session.user.id).catch(() => null),
    );
    return {
      teamIds: ids,
      failed: runs.filter((r) => r === null || r.failures.length > 0).length,
    };
  }),

  /**
   * The signed-in hacker's team's presentations, once organizers have
   * notified the team (so /live and Slack always agree).
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const me = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: { teamId: true },
    });
    if (!me?.teamId) return [];
    const rows = await db
      .select({
        sponsorName: sponsorJudgingSponsors.name,
        room: sponsorPresentations.room,
        start: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorPresentations.sponsorId),
      )
      .where(
        and(
          eq(sponsorPresentations.teamId, me.teamId),
          isNotNull(sponsorPresentations.startMinute),
          isNotNull(sponsorPresentations.notifiedAt),
        ),
      );
    return rows
      .map((r) => ({
        sponsorName: r.sponsorName,
        room: r.room ?? "",
        start: r.start!,
      }))
      .sort((a, b) => a.start - b.start);
  }),
});
