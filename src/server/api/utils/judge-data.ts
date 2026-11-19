import { and, asc, desc, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

import {
  type ComparisonData,
  buildComparison,
} from "~/server/api/utils/judge-comparison";
import { ratingsFromColumns } from "~/lib/judging-criteria";
import { db } from "~/server/db";
import {
  judgingAssignments,
  judgingQueue,
  judgingSkips,
  teamMarks,
  teams,
} from "~/server/db/schema";

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

/** A team the judge is lined up to see, for the list before Start judging. */
export interface QueueTeam {
  id: string;
  name: string;
  /** Member names; empty strings are left out. */
  members: string[];
}

export interface JudgeInitialData {
  /**
   * Teams lined up for this judge: their organizer-made stops if they have
   * any, otherwise the teams waiting in the queue that they haven't seen, in
   * the order the queue hands them out. The server still picks each team, so
   * this is a preview, not a promise.
   */
  queueTeams: QueueTeam[];
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
    queueTeams: await loadQueueTeams(userId),
    tables,
    tableByTeam,
    linksByTeam,
    comparison: withComparison ? await loadComparison(userId, roundType) : null,
  };
}

const QUEUE_PREVIEW_LIMIT = 50;

// NOTE: follows the order of pickNextTeam in routers/judging.ts (Kevin Li's
// queue engine, which MAY BE REPLACED). Update this together with it.
async function loadQueueTeams(judgeId: string): Promise<QueueTeam[]> {
  const stops = await db
    .select({ teamId: judgingAssignments.teamId })
    .from(judgingAssignments)
    .where(
      and(
        eq(judgingAssignments.judgeId, judgeId),
        inArray(judgingAssignments.status, ["assigned", "in_progress"]),
      ),
    )
    .orderBy(asc(judgingAssignments.position));

  let ids = stops.map((s) => s.teamId);
  if (ids.length === 0) {
    const [waiting, marked, skipped] = await Promise.all([
      db
        .select({ teamId: judgingQueue.teamId })
        .from(judgingQueue)
        .where(
          and(
            gt(judgingQueue.roundsRemaining, 0),
            eq(judgingQueue.status, "waiting"),
          ),
        )
        .orderBy(
          desc(judgingQueue.roundsRemaining),
          asc(judgingQueue.enqueuedAt),
        ),
      db
        .select({ teamId: teamMarks.teamId })
        .from(teamMarks)
        .where(eq(teamMarks.judgeId, judgeId)),
      db
        .select({ teamId: judgingSkips.teamId })
        .from(judgingSkips)
        .where(eq(judgingSkips.judgeId, judgeId)),
    ]);
    const seen = new Set([...marked, ...skipped].map((r) => r.teamId));
    ids = waiting
      .map((w) => w.teamId)
      .filter((id) => !seen.has(id))
      .slice(0, QUEUE_PREVIEW_LIMIT);
  }
  if (ids.length === 0) return [];

  const rows = await db.query.teams.findMany({
    where: inArray(teams.id, ids),
    columns: { id: true, name: true },
    with: { members: { columns: { name: true } } },
  });
  const byId = new Map(rows.map((t) => [t.id, t]));
  return ids.flatMap((id) => {
    const t = byId.get(id);
    if (!t) return [];
    return [
      {
        id: t.id,
        name: t.name,
        members: t.members
          .map((m) => m.name?.trim() ?? "")
          .filter((n) => n !== ""),
      },
    ];
  });
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
      impactRating: teamMarks.impactRating,
      creativityRating: teamMarks.creativityRating,
      designRating: teamMarks.designRating,
      adventurousRating: teamMarks.adventurousRating,
      superLike: teamMarks.superLike,
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

  return buildComparison(
    rows.map((r) => ({
      teamId: r.teamId,
      judgeId: r.judgeId,
      score: r.score,
      ratings: ratingsFromColumns(r),
      superLike: r.superLike,
    })),
    viewerId,
    teamNames,
  );
}
