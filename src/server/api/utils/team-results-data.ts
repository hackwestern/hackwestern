// src/server/api/utils/team-results-data.ts
import { asc, eq, inArray, ne, or, sql } from "drizzle-orm";

import {
  type TeamResult,
  buildTeamResults,
} from "~/server/api/utils/team-results";
import { ratingsFromColumns } from "~/lib/judging-criteria";
import { db, extractRows } from "~/server/db";
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
      impactRating: teamMarks.impactRating,
      creativityRating: teamMarks.creativityRating,
      technicalRating: teamMarks.technicalRating,
      designRating: teamMarks.designRating,
      adventurousRating: teamMarks.adventurousRating,
      notes: teamMarks.notes,
      superLike: teamMarks.superLike,
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

  const scoreRows = extractRows<{
    team_id: string;
    super_likes: number | string;
    normalized_score: number | string | null;
    adventure_score: number | string | null;
    raw_total: number | string | null;
    adventurous: number | string | null;
    other_four: number | string | null;
    q: number | string | null;
  }>(
    await db.execute(
      sql`SELECT s.team_id, s.super_likes, s.normalized_score, s.adventure_score, s.raw_total, nt.q,
            -- Normalized once judging_normalize() has run; raw averages before.
            coalesce(na.final_score, s.avg_adventurous) AS adventurous,
            coalesce(no.final_score,
              (coalesce(s.avg_impact, 0) + coalesce(s.avg_creativity, 0)
                + coalesce(s.avg_technical, 0) + coalesce(s.avg_design, 0)) / 4.0
            ) AS other_four
          FROM judging_team_scores s
          LEFT JOIN judging_normalized_team nt
            ON nt.team_id = s.team_id AND nt.series = 'total'
          LEFT JOIN judging_normalized_team na
            ON na.team_id = s.team_id AND na.series = 'adventurous'
          LEFT JOIN judging_normalized_team no
            ON no.team_id = s.team_id AND no.series = 'other'`,
    ),
  );
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  const scores = new Map(scoreRows.map((r) => [r.team_id, r]));

  return buildTeamResults(
    teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      table: t.judgingTable?.number ?? null,
      github: safeHttpUrl(t.githubUrl),
      devpost: safeHttpUrl(t.devpostUrl),
      superLikes: Number(scores.get(t.id)?.super_likes ?? 0),
      normalized: num(scores.get(t.id)?.normalized_score ?? null),
      adventure: num(scores.get(t.id)?.adventure_score ?? null),
      normalizedQ: num(scores.get(t.id)?.q ?? null),
      rawTotal: num(scores.get(t.id)?.raw_total ?? null),
      adventurous: num(scores.get(t.id)?.adventurous ?? null),
      otherFour: num(scores.get(t.id)?.other_four ?? null),
    })),
    marks.map((m) => ({
      teamId: m.teamId,
      judgeId: m.judgeId,
      judgeName: m.judgeName ?? m.judgeEmail,
      judgeType: m.judgeType,
      roundType: m.roundType,
      score: m.score,
      ratings: ratingsFromColumns(m),
      notes: m.notes ?? "",
      superLike: m.superLike,
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
