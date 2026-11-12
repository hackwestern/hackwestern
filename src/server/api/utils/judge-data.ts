import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";

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

export interface TeamLinks {
  /** http(s) links only; null when the team didn't add one. */
  github: string | null;
  devpost: string | null;
}

/** Team-submitted URLs are untrusted, so only http(s) ones become buttons. */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export interface JudgeInitialData {
  /** Every active table, for the map. */
  tables: JudgeTableRow[];
  /** Team id -> table number, for every team seated at a table. */
  tableByTeam: Record<string, number>;
  /** Team id -> GitHub and Devpost links, for teams that added at least one. */
  linksByTeam: Record<string, TeamLinks>;
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
  const [tables, seated, linked, user] = await Promise.all([
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
    db.query.teams.findMany({
      where: or(isNotNull(teams.githubUrl), isNotNull(teams.devpostUrl)),
      columns: { id: true, githubUrl: true, devpostUrl: true },
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

  const linksByTeam: Record<string, TeamLinks> = {};
  for (const t of linked) {
    const github = safeHttpUrl(t.githubUrl);
    const devpost = safeHttpUrl(t.devpostUrl);
    if (github || devpost) linksByTeam[t.id] = { github, devpost };
  }

  const isOrganizer = user?.type === "organizer";
  return {
    tables,
    tableByTeam,
    linksByTeam,
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