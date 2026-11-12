import { asc, eq, inArray, isNotNull, or } from "drizzle-orm";

import {
  type ComparisonData,
  buildComparison,
} from "~/server/api/utils/judge-comparison";
import { db } from "~/server/db";
import { teamMarks, teams } from "~/server/db/schema";

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
  /**
   * The viewer's marks against the other judges' average. Null until asked
   * for (the page is loaded with ?compare=1), so the numbers are not sent while
   * a judge is still scoring.
   */
  comparison: ComparisonData | null;
}

/**
 * Read-only data for the judge page, loaded straight from the db in
 * getServerSideProps (no extra tRPC procedures). The judging router does all
 * the reading and writing of marks; this only supplies what it can't:
 * which table each team is at, and the judge comparison numbers.
 * A snapshot from page load; the page re-runs it to refresh.
 */
export async function loadJudgeData(
  userId: string,
  withComparison: boolean,
): Promise<JudgeInitialData> {
  const [tables, seated, linked, judge] = await Promise.all([
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
    db.query.judges.findFirst({
      where: (j, { eq }) => eq(j.id, userId),
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
    if (github !== null || devpost !== null)
      linksByTeam[t.id] = { github, devpost };
  }

  // Sponsored judges are compared with other sponsored judges, since the two
  // rounds are ranked apart.
  const roundType = judge?.type === "sponsored" ? "sponsored" : "regular";
  return {
    tables,
    tableByTeam,
    linksByTeam,
    comparison: withComparison ? await loadComparison(userId, roundType) : null,
  };
}

/**
 * Every judge's marks in the viewer's round, compared team by team with the
 * viewer's own. Oldest mark first, so the viewer's list reads in the order they
 * judged.
 */
async function loadComparison(
  viewerId: string,
  roundType: "regular" | "sponsored",
): Promise<ComparisonData> {
  const rows = await db
    .select({
      teamId: teamMarks.teamId,
      judgeId: teamMarks.judgeId,
      score: teamMarks.score,
      breakdown: teamMarks.scoreBreakdown,
    })
    .from(teamMarks)
    .where(eq(teamMarks.roundType, roundType))
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

  return buildComparison(rows, viewerId, teamNames);
}
