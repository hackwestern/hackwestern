import { afterEach, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import {
  judges,
  judgingAssignments,
  judgingTables,
  type ScoreBreakdown,
  teamMarks,
  teamTracks,
  teams,
  users,
} from "~/server/db/schema";

async function makeTeam() {
  const id = faker.string.alphanumeric(12);
  await db.insert(teams).values({
    id,
    name: `team-${id}`,
    joinCode: faker.string.alphanumeric(6),
  });
  return id;
}

afterEach(async () => {
  await db.delete(judgingAssignments).where(sql`true`);
  await db.delete(teamMarks).where(sql`true`);
  await db.delete(teamTracks).where(sql`true`);
  await db.delete(teams).where(sql`true`);
  await db.delete(judgingTables).where(sql`true`);
  await db.delete(judges).where(sql`true`);
});

describe("team_track", () => {
  test("lists every team in a track, once per team", async () => {
    const a = await makeTeam();
    const b = await makeTeam();
    await db.insert(teamTracks).values([
      { teamId: a, track: "Best Domain" },
      { teamId: a, track: "General" },
      { teamId: b, track: "Best Domain" },
    ]);
    await expect(
      db.insert(teamTracks).values({ teamId: a, track: "General" }),
    ).rejects.toThrow();

    const inTrack = await db.query.teamTracks.findMany({
      where: eq(teamTracks.track, "Best Domain"),
      with: { team: { columns: { id: true } } },
    });
    expect(inTrack.map((r) => r.team.id).sort()).toEqual([a, b].sort());

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, a),
      with: { trackEntries: true },
    });
    expect(team?.trackEntries.map((r) => r.track).sort()).toEqual([
      "Best Domain",
      "General",
    ]);
  });

  test("rows go away with their team", async () => {
    const a = await makeTeam();
    await db.insert(teamTracks).values({ teamId: a, track: "General" });
    await db.delete(teams).where(eq(teams.id, a));
    expect(await db.query.teamTracks.findMany()).toEqual([]);
  });
});

describe("team_mark.score_breakdown", () => {
  test("stores the rubric and notes, and is optional", async () => {
    const session = await mockSession(db);
    await db.insert(judges).values({ id: session.user.id });
    const teamId = await makeTeam();
    const breakdown: ScoreBreakdown = {
      idea: 4,
      technical: 5,
      design: 3,
      pitch: 4,
      notes: "Great live demo; auth was mocked.",
    };

    const [withRubric] = await db
      .insert(teamMarks)
      .values({
        teamId,
        judgeId: session.user.id,
        score: 80,
        scoreBreakdown: breakdown,
      })
      .returning();
    expect(withRubric?.scoreBreakdown).toEqual(breakdown);

    const [sliderOnly] = await db
      .insert(teamMarks)
      .values({ teamId, judgeId: session.user.id, score: 60 })
      .returning();
    expect(sliderOnly?.scoreBreakdown).toBeNull();
  });
});

describe("judging_table.status", () => {
  test("starts empty and stores each live state", async () => {
    const [table] = await db
      .insert(judgingTables)
      .values({ number: 1, zone: "Main gym" })
      .returning();
    expect(table?.status).toBe("empty");
    expect(table?.statusUpdatedAt).toBeInstanceOf(Date);

    for (const status of ["waiting", "being_judged", "finished"] as const) {
      const [row] = await db
        .update(judgingTables)
        .set({ status })
        .where(eq(judgingTables.id, table!.id))
        .returning();
      expect(row?.status).toBe(status);
    }
  });
});

describe("user_type judge", () => {
  test("accounts can be created as public judges", async () => {
    const session = await mockSession(db);
    await db
      .update(users)
      .set({ type: "judge" })
      .where(eq(users.id, session.user.id));
    const row = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { type: true },
    });
    expect(row?.type).toBe("judge");
  });
});
