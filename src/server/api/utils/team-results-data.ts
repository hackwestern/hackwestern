// src/server/api/utils/team-results-data.ts
import { asc, eq, inArray, ne, or } from "drizzle-orm";

import {
  type TeamResult,
  buildTeamResults,
} from "~/server/api/utils/team-results";
import { db } from "~/server/db";
import { judges, teamMarks, teams, users } from "~/server/db/schema";

/**
 * Read-only data for the organizer results page, loaded straight from the db in
 * getServerSideProps (no tRPC procedure). Every team that has been submitted or
 * has a mark, with all the marks it got so far. A snapshot from page load.
 */
export async function loadTeamResults(): Promise<TeamResult[]> {
  const marks = await db
    .select({
      teamId: teamMarks.teamId,
      judgeId: teamMarks.judgeId,
      judgeName: users.name,
      judgeEmail: users.email,
      judgeType: judges.type,
      roundType: teamMarks.roundType,
      score: teamMarks.score,
      breakdown: teamMarks.scoreBreakdown,
    })
    .from(teamMarks)
    .innerJoin(judges, eq(judges.id, teamMarks.judgeId))
    .innerJoin(users, eq(users.id, teamMarks.judgeId))
    .orderBy(asc(teamMarks.createdAt), asc(teamMarks.id));

  const markedIds = [...new Set(marks.map((m) => m.teamId))];
  const teamRows = await db.query.teams.findMany({
    where: or(
      ne(teams.submissionStatus, "draft"),
      markedIds.length > 0 ? inArray(teams.id, markedIds) : undefined,
    ),
    columns: { id: true, name: true, githubUrl: true, devpostUrl: true },
    with: { judgingTable: { columns: { number: true } } },
  });

  return buildTeamResults(
    teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      table: t.judgingTable?.number ?? null,
      github: safeHttpUrl(t.githubUrl),
      devpost: safeHttpUrl(t.devpostUrl),
    })),
    marks.map((m) => ({
      teamId: m.teamId,
      judgeId: m.judgeId,
      judgeName: m.judgeName ?? m.judgeEmail,
      judgeType: m.judgeType,
      roundType: m.roundType,
      score: m.score,
      breakdown: m.breakdown,
      notes: m.breakdown?.notes ?? "",
    })),
  );
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