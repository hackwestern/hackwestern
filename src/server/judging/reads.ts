/**
 * Read models for the screens: the organizer console and table map, a judge's
 * own stops, and a hacker's judging status.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";

import { ratingsFromColumns } from "~/lib/judging-criteria";
import { db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingTables,
  teamMarks,
  teams,
  users,
} from "~/server/db/schema";
import { snakePosition } from "~/server/judging/layout";
import { getRoundState, settleRound } from "~/server/judging/rounds";
import {
  ELIGIBLE_SUBMISSIONS,
  JUDGE_TEAM_COLUMNS,
  type StopStatus,
  getSettings,
  isJudgingStarted,
} from "~/server/judging/shared";

// Drizzle types a one() relation as always present when it joins on a
// non-null column, but a table with nobody seated has no team. Widen it.
const orNull = <T>(value: T): T | null => value ?? null;

/**
 * Everything the organizer console and table map need: the layout, every
 * table with its team, status and judges, every judge's section, floaters,
 * and totals.
 */
export async function getProgress() {
  const [settings, started, tables, stops, judgeRows, submitted] =
    await Promise.all([
      getSettings(),
      isJudgingStarted(),
      db.query.judgingTables.findMany({
        orderBy: asc(judgingTables.number),
        with: { team: { columns: { id: true, name: true } } },
      }),
      db
        .select({
          id: judgingAssignments.id,
          judgeId: judgingAssignments.judgeId,
          judgeName: users.name,
          judgeEmail: users.email,
          tableId: judgingAssignments.judgingTableId,
          position: judgingAssignments.position,
          status: judgingAssignments.status,
          startedAt: judgingAssignments.startedAt,
          completedAt: judgingAssignments.completedAt,
        })
        .from(judgingAssignments)
        .innerJoin(users, eq(users.id, judgingAssignments.judgeId))
        .where(ne(judgingAssignments.status, "cancelled"))
        .orderBy(
          asc(judgingAssignments.judgeId),
          asc(judgingAssignments.position),
        ),
      db
        .select({
          id: judges.id,
          type: judges.type,
          noShow: judges.noShow,
          marksCount: judges.marksCount,
          createdAt: judges.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(judges)
        .innerJoin(users, eq(users.id, judges.id))
        .orderBy(asc(judges.createdAt), asc(judges.id)),
      db
        .select({ id: teams.id, judgingTableId: teams.judgingTableId })
        .from(teams)
        .where(inArray(teams.submissionStatus, [...ELIGIBLE_SUBMISSIONS])),
    ]);

  const numberOf = new Map(tables.map((t) => [t.id, t.number]));
  const stopsByTable = new Map<number, typeof stops>();
  const stopsByJudge = new Map<string, typeof stops>();
  const totals = { assigned: 0, in_progress: 0, done: 0, team_absent: 0 };
  for (const s of stops) {
    stopsByTable.set(s.tableId, [...(stopsByTable.get(s.tableId) ?? []), s]);
    stopsByJudge.set(s.judgeId, [...(stopsByJudge.get(s.judgeId) ?? []), s]);
    if (s.status !== "cancelled") totals[s.status]++;
  }

  return {
    settings,
    started,
    teams: {
      submitted: submitted.length,
      seated: submitted.filter((t) => t.judgingTableId !== null).length,
    },
    totals,
    tables: tables.map((t) => {
      const here = stopsByTable.get(t.id) ?? [];
      return {
        id: t.id,
        number: t.number,
        zone: t.zone,
        isActive: t.isActive,
        status: t.status,
        ...snakePosition(t.number, settings.perRow),
        team: orNull(t.team),
        judgesDone: here.filter((s) => s.status === "done").length,
        judges: here.map((s) => ({
          assignmentId: s.id,
          judgeId: s.judgeId,
          name: s.judgeName ?? s.judgeEmail,
          status: s.status,
          startedAt: s.startedAt,
          position: s.position,
        })),
      };
    }),
    judges: judgeRows.map((j) => {
      const mine = stopsByJudge.get(j.id) ?? [];
      const current = mine.find((s) => s.status === "in_progress");
      return {
        id: j.id,
        name: j.name ?? j.email,
        email: j.email,
        type: j.type,
        noShow: j.noShow,
        marksCount: j.marksCount,
        isFloater: mine.length === 0,
        current: current
          ? {
              assignmentId: current.id,
              tableNumber: numberOf.get(current.tableId)!,
              startedAt: current.startedAt,
            }
          : null,
        stops: mine.map((s) => ({
          assignmentId: s.id,
          tableNumber: numberOf.get(s.tableId)!,
          position: s.position,
          status: s.status,
        })),
      };
    }),
  };
}

/** The roster: every judge with their account, and the team they're judging now. */
export async function getAllJudges() {
  const [judgeRows, current] = await Promise.all([
    db
      .select({
        id: judges.id,
        type: judges.type,
        track: judges.track,
        noShow: judges.noShow,
        marksCount: judges.marksCount,
        marksSum: judges.marksSum,
        createdAt: judges.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(judges)
      .innerJoin(users, eq(users.id, judges.id))
      .orderBy(asc(judges.createdAt), asc(judges.id)),
    db
      .select({
        judgeId: judgingAssignments.judgeId,
        teamId: teams.id,
        tableNumber: judgingTables.number,
      })
      .from(judgingAssignments)
      .innerJoin(
        judgingTables,
        eq(judgingTables.id, judgingAssignments.judgingTableId),
      )
      .leftJoin(teams, eq(teams.judgingTableId, judgingTables.id))
      .where(eq(judgingAssignments.status, "in_progress")),
  ]);
  const byJudge = new Map(current.map((c) => [c.judgeId, c]));
  return judgeRows.map((j) => ({
    ...j,
    currentTeamId: byJudge.get(j.id)?.teamId ?? null,
    currentTableNumber: byJudge.get(j.id)?.tableNumber ?? null,
  }));
}

/**
 * A judge's own stops in walking order, each with its table, grid position,
 * the team seated there and their score if given. `nextStopId` is the stop in
 * progress, else the first one still assigned.
 */
export async function getMyStops(judgeId: string) {
  await settleRound();
  const [settings, stops] = await Promise.all([
    getSettings(),
    db.query.judgingAssignments.findMany({
      where: and(
        eq(judgingAssignments.judgeId, judgeId),
        ne(judgingAssignments.status, "cancelled"),
      ),
      orderBy: asc(judgingAssignments.position),
      columns: { assignedBy: false, judgeId: false, judgingTableId: false },
      with: {
        table: {
          columns: { id: true, number: true, zone: true },
          with: { team: { columns: JUDGE_TEAM_COLUMNS } },
        },
      },
    }),
  ]);

  const teamIds = stops.flatMap((s) => {
    const team = orNull(s.table.team);
    return team ? [team.id] : [];
  });
  const marks =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teamMarks.id,
            teamId: teamMarks.teamId,
            score: teamMarks.score,
            impactRating: teamMarks.impactRating,
            creativityRating: teamMarks.creativityRating,
            technicalRating: teamMarks.technicalRating,
            designRating: teamMarks.designRating,
            adventurousRating: teamMarks.adventurousRating,
            notes: teamMarks.notes,
            superLike: teamMarks.superLike,
          })
          .from(teamMarks)
          .where(
            and(
              eq(teamMarks.judgeId, judgeId),
              inArray(teamMarks.teamId, teamIds),
            ),
          );
  const markByTeam = new Map(
    marks.map((m) => [
      m.teamId,
      {
        id: m.id,
        teamId: m.teamId,
        score: m.score,
        ratings: ratingsFromColumns(m),
        notes: m.notes,
        superLike: m.superLike,
      },
    ]),
  );

  const list = stops.map(({ table: { team: seated, ...table }, ...stop }) => {
    const team = orNull(seated);
    return {
      ...stop,
      table: { ...table, ...snakePosition(table.number, settings.perRow) },
      team,
      mark: team ? (markByTeam.get(team.id) ?? null) : null,
    };
  });
  const next =
    list.find((s) => s.status === "in_progress") ??
    list.find((s) => s.status === "assigned");
  const closed: StopStatus[] = ["done", "team_absent"];

  return {
    layout: {
      tableCount: settings.tableCount,
      rows: settings.rows,
      perRow: settings.perRow,
    },
    round: await getRoundState(),
    stops: list,
    nextStopId: next?.id ?? null,
    finished: list.filter((s) => closed.includes(s.status)).length,
    total: list.length,
  };
}

/**
 * A judge's own submitted marks, most recent first. The rating columns come
 * back folded into `ratings` ({ [criterionId]: 0-10 }), empty for a mark with
 * only an overall score.
 */
export async function getSubmittedMarks(judgeId: string) {
  const marks = await db.query.teamMarks.findMany({
    where: eq(teamMarks.judgeId, judgeId),
    with: { team: { columns: JUDGE_TEAM_COLUMNS } },
    orderBy: [desc(teamMarks.createdAt)],
  });
  return marks.map(
    ({
      impactRating,
      creativityRating,
      technicalRating,
      designRating,
      adventurousRating,
      ...mark
    }) => ({
      ...mark,
      ratings: ratingsFromColumns({
        impactRating,
        creativityRating,
        technicalRating,
        designRating,
        adventurousRating,
      }),
    }),
  );
}

/**
 * What a hacker sees: their table and grid position, and how many of the
 * judges at that table have scored them. Judge identities stay hidden.
 */
export async function getTeamJudging(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { teamId: true },
  });
  if (!user?.teamId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This user is not part of a team",
    });
  }
  const [settings, team] = await Promise.all([
    getSettings(),
    db.query.teams.findFirst({
      where: eq(teams.id, user.teamId),
      columns: { id: true },
      with: {
        judgingTable: { columns: { id: true, number: true, zone: true } },
      },
    }),
  ]);
  const table = team?.judgingTable ?? null;
  if (!table)
    return { table: null, absent: false, judges: { done: 0, total: 0 } };

  const counts = await db
    .select({ status: judgingAssignments.status, n: count() })
    .from(judgingAssignments)
    .where(
      and(
        eq(judgingAssignments.judgingTableId, table.id),
        ne(judgingAssignments.status, "cancelled"),
      ),
    )
    .groupBy(judgingAssignments.status);
  return {
    table: {
      number: table.number,
      zone: table.zone,
      ...snakePosition(table.number, settings.perRow),
    },
    // Reported absent: disqualified, and every stop at the table is closed.
    absent: counts.some((c) => c.status === "team_absent"),
    judges: {
      done: counts.find((c) => c.status === "done")?.n ?? 0,
      total: counts.reduce((sum, c) => sum + c.n, 0),
    },
  };
}

export type BoardStopStatus = "done" | "now" | "upcoming" | "skipped";

/**
 * The public view of the rounds, for hackers. Who is judging which team in
 * which round, and how far along it is, with judges as numbers ("Judge 7")
 * because judge identities stay hidden. No scores, no absences (a team that
 * wasn't at its table just shows as skipped). Stops at empty tables are left
 * out, so rounds only list teams that were really seated.
 */
export async function getRoundBoard() {
  await settleRound();
  const round = await getRoundState();
  const [stops, judgeOrder] = await Promise.all([
    db
      .select({
        judgeId: judgingAssignments.judgeId,
        position: judgingAssignments.position,
        status: judgingAssignments.status,
        table: judgingTables.number,
        team: teams.name,
      })
      .from(judgingAssignments)
      .innerJoin(
        judgingTables,
        eq(judgingTables.id, judgingAssignments.judgingTableId),
      )
      .innerJoin(teams, eq(teams.judgingTableId, judgingTables.id))
      .where(ne(judgingAssignments.status, "cancelled")),
    // Same order auto-assign uses, so "Judge 7" is the same on every refresh.
    db
      .select({ id: judges.id })
      .from(judges)
      .orderBy(asc(judges.createdAt), asc(judges.id)),
  ]);

  const number = new Map(judgeOrder.map((j, i) => [j.id, i + 1]));
  const open = round.status === "running" || round.status === "paused";
  const statusOf = (s: { status: StopStatus; position: number }) => {
    if (s.status === "done") return "done" as const;
    if (s.status === "team_absent") return "skipped" as const;
    if (s.status === "in_progress") return "now" as const;
    if (!round.enabled || s.position > round.round) return "upcoming" as const;
    // An unscored stop in a round that has passed or closed was missed.
    return s.position === round.round && open
      ? ("now" as const)
      : ("skipped" as const);
  };

  return {
    round,
    stops: stops
      .map((s) => ({
        round: s.position,
        judge: number.get(s.judgeId) ?? 0,
        table: s.table,
        team: s.team,
        status: statusOf(s),
      }))
      .sort((a, b) => a.round - b.round || a.table - b.table),
  };
}
