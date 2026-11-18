import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { env } from "~/env";
import {
  PRESENTATION_SLOTS_PER_ROOM,
  gapViolations,
  normalizeRoom,
  schedulePresentations,
  slotsKey,
} from "~/lib/sponsor-presentations";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { runAllTeamChecks } from "~/server/api/utils/cheat-check-runners";
import { sendPresentationEmail } from "~/server/api/utils/presentation-email";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import {
  round2OpenedAt,
  setRound2Open,
} from "~/server/api/utils/sponsor-judging-settings";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import { sendPresentationDm } from "~/server/slack/presentation-dm";

const errors = sponsorPresentationsCopy.errors;

/** Slack DMs in flight at once (3 calls each; stays under rate limits). */
const DM_CONCURRENCY = 4;
/** Cheat check runs at once (each calls GitHub and Devpost). */
const CHEAT_CONCURRENCY = 2;
/**
 * A notify claim older than this is treated as abandoned (the server died
 * mid send), so that member can be claimed again.
 */
const STALE_CLAIM = sql`now() - interval '10 minutes'`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/** Each team's slotsKey, for teams with at least one placed slot. */
function keysByTeam(
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
const hasCurrentTimes = (
  notice: { teamId: string; slotsKey: string; sentAt: Date | null },
  keys: ReadonlyMap<string, string>,
) => notice.sentAt !== null && keys.get(notice.teamId) === notice.slotsKey;

/** A blank name falls back to the email. */
const displayName = (m: { name: string | null; email: string | null }) =>
  m.name?.trim() ? m.name : (m.email ?? "");

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
 * Sunday sponsor presentations (docs/flows/sponsor-judging.md): organizers
 * schedule every sent shortlist into sponsor rooms, notify hackers on
 * Slack, and send the top teams to the cheat check. Hackers read their own
 * team's times with `mine`.
 */
export const sponsorPresentationsRouter = createTRPCRouter({
  /**
   * Organizers: who sent a shortlist, every schedule row (placed and
   * flagged) with names, who has been told their times, and the sponsor
   * top teams for the cheat check.
   */
  overview: protectedOrganizerProcedure.query(async () => {
    const [sponsors, sends, rows, topIds, notices, openedAt] =
      await Promise.all([
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
        db.select().from(sponsorPresentationNotices),
        round2OpenedAt(),
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
    const named = (r: (typeof rows)[number]) => ({
      sponsorId: r.sponsorId,
      sponsorName: sponsorName.get(r.sponsorId) ?? "",
      teamId: r.teamId,
      teamName: names.get(r.teamId) ?? r.teamId,
      room: r.room,
    });

    // Per member: reached (has the current times) or why not.
    const keys = keysByTeam(rows);
    const members =
      keys.size > 0
        ? await db
            .select({
              id: users.id,
              teamId: users.teamId,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(inArray(users.teamId, [...keys.keys()]))
        : [];
    const noticeOf = new Map(notices.map((n) => [n.userId, n]));
    const reachedAt: Date[] = [];
    let emailed = 0;
    const notReached: {
      userId: string;
      name: string;
      teamName: string;
      reason: "not-on-slack" | "failed" | "not-sent";
    }[] = [];
    for (const m of members) {
      const n = noticeOf.get(m.id);
      const current =
        n !== undefined &&
        n.teamId === m.teamId &&
        keys.get(n.teamId) === n.slotsKey;
      if (current && n.sentAt) {
        reachedAt.push(n.sentAt);
        if (n.status === "emailed") emailed++;
        continue;
      }
      notReached.push({
        userId: m.id,
        name: displayName(m),
        teamName: names.get(m.teamId!) ?? m.teamId!,
        // The last attempt at these times says why; else never sent.
        reason:
          current && n.status === "not-found"
            ? "not-on-slack"
            : current && n.status === "failed"
              ? "failed"
              : "not-sent",
      });
    }
    notReached.sort(
      (a, b) =>
        a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name),
    );

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
      /** When organizers opened round 2; null = closed. */
      round2OpenedAt: openedAt,
      /**
       * Notices for the scheduled teams' members: how many have their
       * current times (by Slack or, for members not on Slack, by email; and
       * the latest such send), and who neither reached.
       */
      notices: {
        members: members.length,
        reached: reachedAt.length,
        /** Of `reached`, those who got them by email. */
        emailed,
        lastSentAt:
          reachedAt.length > 0
            ? new Date(Math.max(...reachedAt.map((d) => d.getTime())))
            : null,
        notReached,
      },
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
   * Members whose team's times don't change stay notified. With dryRun
   * nothing is stored; `changedTimes` (hackers who already have their
   * times and would get new ones) is for the confirm step.
   */
  schedule: protectedOrganizerProcedure
    .input(z.object({ dryRun: z.boolean().default(false) }).optional())
    .mutation(async ({ input }) => {
      const dryRun = input?.dryRun ?? false;
      // The sheets are slow, so every sponsor's room is read before the
      // transaction; the sends are read inside it, so the stored schedule
      // always matches one consistent set of shortlists.
      const allSponsors = await db
        .select({
          id: sponsorJudgingSponsors.id,
          name: sponsorJudgingSponsors.name,
        })
        .from(sponsorJudgingSponsors);
      const rooms = await judgingRoomsById(allSponsors);

      return db.transaction(async (tx) => {
        const scheduledAt = new Date();
        const sends = await tx
          .select({
            sponsorId: sponsorShortlistSends.sponsorId,
            teamIds: sponsorShortlistSends.teamIds,
          })
          .from(sponsorShortlistSends);
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
        const requests = sends.map((s) => ({
          sponsorId: s.sponsorId,
          // Clamped to the column, so a long sheet value can't abort this.
          room: normalizeRoom(rooms.get(s.sponsorId)),
          teamIds: s.teamIds.filter((id) => existing.has(id)),
        }));
        const result = schedulePresentations(requests);
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
            result.noRoom.reduce((n, r) => n + r.teamIds.length, 0),
          changedTimes,
        };
      });
    }),

  /**
   * Slack DM each member of every scheduled team their rooms and times; a
   * member Slack can't find by email address gets the same times by email
   * instead (status "emailed"). Each member is claimed atomically first,
   * so a double click or retry never messages anyone twice; by default
   * only members who don't have their current times yet (never sent, not
   * reached, failed, or times changed) are sent. `resend` sends everyone again. Once any member of a team has
   * the current times, they show on /live. Without SLACK_BOT_TOKEN nothing
   * is sent and it says so.
   */
  notify: protectedOrganizerProcedure
    .input(z.object({ resend: z.boolean().default(false) }).optional())
    .mutation(async ({ input }) => {
      const resend = input?.resend ?? false;
      const token = env.SLACK_BOT_TOKEN;
      if (!token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: errors.slackOff,
        });
      }
      const rows = await db
        .select({
          sponsorId: sponsorPresentations.sponsorId,
          teamId: sponsorPresentations.teamId,
          room: sponsorPresentations.room,
          startMinute: sponsorPresentations.startMinute,
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.noSchedule,
        });
      }
      const keys = keysByTeam(rows);
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
          start: r.startMinute!,
        });
        byTeam.set(r.teamId, t);
      }
      const members = await db
        .select({
          id: users.id,
          teamId: users.teamId,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.teamId, [...byTeam.keys()]));
      if (members.length === 0) {
        return {
          sent: 0,
          emailed: 0,
          failed: 0,
          notOnSlack: [] as string[],
          skipped: 0,
        };
      }

      // Claim: one upsert; only rows it returns get a DM. Never claimed: a
      // claim still in flight and, unless resending, a member who was
      // already sent these exact times.
      const n = sponsorPresentationNotices;
      const sameTimes = sql`${n.teamId} = excluded.team_id and ${n.slotsKey} = excluded.slots_key`;
      const inFlight = sql`${n.status} = 'sending' and ${n.claimedAt} > ${STALE_CLAIM}`;
      const claimed = await db
        .insert(n)
        .values(
          members.map((m) => ({
            userId: m.id,
            teamId: m.teamId!,
            status: "sending",
            slotsKey: keys.get(m.teamId!)!,
          })),
        )
        .onConflictDoUpdate({
          target: n.userId,
          set: {
            teamId: sql`excluded.team_id`,
            slotsKey: sql`excluded.slots_key`,
            status: "sending",
            claimedAt: sql`now()`,
            // sentAt only ever describes the stored times.
            sentAt: sql`case when ${sameTimes} then ${n.sentAt} else null end`,
          },
          setWhere: resend
            ? sql`not (${inFlight})`
            : sql`not (${inFlight}) and not (${n.sentAt} is not null and ${sameTimes})`,
        })
        .returning({ userId: n.userId, claimedAt: n.claimedAt });
      const claimedIds = new Set(claimed.map((c) => c.userId));
      // now() is fixed for the whole statement, so every row this call
      // claimed shares one claimedAt. Outcomes are written only to rows
      // still holding that claim: a call that outlived the stale window and
      // lost its rows to a newer call can't overwrite the newer outcome.
      const claimAt = claimed[0]?.claimedAt ?? null;
      const targets = members.filter((m) => claimedIds.has(m.id));

      // Slack first; a member Slack can't find is emailed instead.
      const results = await mapPool(targets, DM_CONCURRENCY, async (m) => {
        const team = byTeam.get(m.teamId!)!;
        const dmResult = await sendPresentationDm(
          token,
          m,
          team.name,
          team.slots,
        );
        const result =
          dmResult === "not-found"
            ? await sendPresentationEmail(m, team.name, team.slots)
            : dmResult;
        return { member: m, result };
      });

      // Record each outcome on the rows this call claimed.
      const outcomes = ["sent", "emailed", "not-found", "failed"] as const;
      for (const status of outcomes) {
        const ids = results
          .filter((r) => r.result === status)
          .map((r) => r.member.id);
        if (ids.length === 0) continue;
        const reached = status === "sent" || status === "emailed";
        await db
          .update(n)
          .set(reached ? { status, sentAt: sql`now()` } : { status })
          .where(
            and(
              inArray(n.userId, ids),
              eq(n.status, "sending"),
              claimAt ? eq(n.claimedAt, claimAt) : undefined,
            ),
          );
      }
      return {
        sent: results.filter((r) => r.result === "sent").length,
        /** Not on Slack, so emailed instead. */
        emailed: results.filter((r) => r.result === "emailed").length,
        failed: results.filter((r) => r.result === "failed").length,
        /** Not on Slack and no email address: nobody reached them. */
        notOnSlack: results
          .filter((r) => r.result === "not-found")
          .map((r) => displayName(r.member)),
        /** Members left alone: they already had these times. */
        skipped: members.length - targets.length,
      };
    }),

  /**
   * Open or close round 2 for every sponsor. While open, a sponsor with a
   * placed slot ranks the teams that presented and submits a top
   * SPONSOR_FINAL_TOP (sponsorScoring.submit refuses while closed).
   * Opening needs a schedule with at least one placed slot.
   */
  setRound2: protectedOrganizerProcedure
    .input(z.object({ open: z.boolean() }))
    .mutation(async ({ input }) => {
      if (input.open) {
        const placed = await db.query.sponsorPresentations.findFirst({
          where: isNotNull(sponsorPresentations.startMinute),
          columns: { teamId: true },
        });
        if (!placed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errors.noSchedule,
          });
        }
      }
      return { round2OpenedAt: await setRound2Open(input.open) };
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
   * The signed-in hacker's team's presentations, once any member of the
   * team was sent these exact times (Slack or email) (so /live and Slack agree; a
   * reschedule that changes them hides them until notified again).
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const me = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: { teamId: true },
    });
    if (!me?.teamId) return [];
    const [rows, notices] = await Promise.all([
      db
        .select({
          sponsorId: sponsorPresentations.sponsorId,
          teamId: sponsorPresentations.teamId,
          sponsorName: sponsorJudgingSponsors.name,
          room: sponsorPresentations.room,
          startMinute: sponsorPresentations.startMinute,
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
          ),
        ),
      db
        .select({
          teamId: sponsorPresentationNotices.teamId,
          slotsKey: sponsorPresentationNotices.slotsKey,
          sentAt: sponsorPresentationNotices.sentAt,
        })
        .from(sponsorPresentationNotices)
        .where(
          and(
            eq(sponsorPresentationNotices.teamId, me.teamId),
            isNotNull(sponsorPresentationNotices.sentAt),
          ),
        ),
    ]);
    const keys = keysByTeam(rows);
    if (!notices.some((n) => hasCurrentTimes(n, keys))) return [];
    return rows
      .map((r) => ({
        sponsorName: r.sponsorName,
        room: r.room ?? "",
        start: r.startMinute!,
      }))
      .sort((a, b) => a.start - b.start);
  }),
});
