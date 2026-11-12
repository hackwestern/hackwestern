import { and, asc, eq, inArray } from "drizzle-orm";

import {
  type CalibrationData,
  buildCalibration,
} from "~/server/api/utils/judge-calibration";
import { db } from "~/server/db";
import { teamMarks, teams, users } from "~/server/db/schema";

export interface JudgeTableRow {
  number: number;
  zone: string;
}

export interface JudgeInitialData {
  /** Every active table, for the map. */
  tables: JudgeTableRow[];
  /** Team id -> table number, for every team seated at a table. */
  tableByTeam: Record<string, number>;
  /** True for organizer accounts. Only they get the calibration view. */
  isOrganizer: boolean;
  /** The viewer's marks against the organizer average. Null for everyone else. */
  calibration: CalibrationData | null;
}

/**
 * Read-only data for the judge page, loaded straight from the db in
 * getServerSideProps (no extra tRPC procedures). The judging router does all
 * the reading and writing of marks; this only supplies what it can't:
 * which table each team is at, and the organizer calibration numbers.
 * A snapshot from page load; the page re-runs it to refresh.
 */
export async function loadJudgeData(userId: string): Promise<JudgeInitialData> {
  const [tables, seated, user] = await Promise.all([
    db.query.judgingTables.findMany({
      where: (t, { eq }) => eq(t.isActive, true),
      columns: { number: true, zone: true },
      orderBy: (t, { asc }) => [asc(t.number)],
    }),
    db.query.teams.findMany({
      where: (t, { isNotNull }) => isNotNull(t.judgingTableId),
      columns: { id: true },
      with: { judgingTable: { columns: { number: true } } },
    }),
    db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { type: true },
    }),
  ]);

  const tableByTeam: Record<string, number> = {};
  for (const t of seated) {
    if (t.judgingTable) tableByTeam[t.id] = t.judgingTable.number;
  }

  const isOrganizer = user?.type === "organizer";
  return {
    tables,
    tableByTeam,
    isOrganizer,
    calibration: isOrganizer ? await loadCalibration(userId) : null,
  };
}

/**
 * Regular-round marks from every organizer account (users.type = organizer),
 * compared team by team with the viewer's own marks. Oldest mark first, so the
 * viewer's list reads in the order they judged.
 */
async function loadCalibration(viewerId: string): Promise<CalibrationData> {
  const rows = await db
    .select({
      teamId: teamMarks.teamId,
      judgeId: teamMarks.judgeId,
      score: teamMarks.score,
      breakdown: teamMarks.scoreBreakdown,
    })
    .from(teamMarks)
    .innerJoin(users, eq(users.id, teamMarks.judgeId))
    .where(and(eq(users.type, "organizer"), eq(teamMarks.roundType, "regular")))
    .orderBy(asc(teamMarks.createdAt), asc(teamMarks.id));

  const mineIds = [
    ...new Set(rows.filter((r) => r.judgeId === viewerId).map((r) => r.teamId)),
  ];
  const named =
    mineIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, mineIds))
      : [];
  const teamNames = Object.fromEntries(named.map((t) => [t.id, t.name]));

  return buildCalibration(rows, viewerId, teamNames);
}
