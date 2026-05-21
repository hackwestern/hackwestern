import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  judges,
  judgingQueue,
  judgingSkips,
  teamMarks,
  teams,
} from "~/server/db/schema";
import { applyTriggers } from "~/server/db/triggers";

type Track =
  | "Best Use of Cohere"
  | "Best Use of AntiGravity"
  | "Best Domain"
  | "General";

/* ---------- helpers ---------- */

async function makeJudge(opts?: { type?: "organizer" | "sponsored"; tracks?: Track[] }) {
  const session = await mockSession(db);
  await db.insert(judges).values({
    id: session.user.id,
    type: opts?.type ?? "organizer",
    track: opts?.tracks,
  });
  return { session, caller: createCaller(createInnerTRPCContext({ session })) };
}

async function makeOrganizer() {
  const session = await mockOrganizerSession(db);
  return { session, caller: createCaller(createInnerTRPCContext({ session })) };
}

async function makeTeam(opts?: {
  tracks?: Track[];
  submissionStatus?: "draft" | "submitted" | "late";
}) {
  const id = faker.string.alphanumeric(6);
  await db.insert(teams).values({
    id,
    name: `team-${id}`,
    devpostUrl: `https://devpost.com/${id}`,
    githubUrl: `https://github.com/${id}`,
    tracks: opts?.tracks,
    submissionStatus: opts?.submissionStatus ?? "submitted",
  });
  return id;
}

async function resetAll() {
  await db.delete(teamMarks).where(sql`true`);
  await db.delete(judgingSkips).where(sql`true`);
  await db.delete(judgingQueue).where(sql`true`);
  await db.delete(judges).where(sql`true`);
  await db.delete(teams).where(sql`true`);
}

// The triggers can't be expressed in Drizzle's schema DSL, so pushSchema
// (run by vitest.setup.ts) doesn't create them. Apply them once here so the
// tests exercise the real triggers.
beforeAll(async () => {
  await applyTriggers(db);
});

beforeEach(async () => {
  await resetAll();
});

/* ---------- auth ---------- */

describe("auth gating", () => {
  test("anon rejected on judge route", async () => {
    const anon = createCaller(createInnerTRPCContext({ session: null }));
    await expect(anon.judging.me.getNextTeam()).rejects.toThrow();
  });

  test("non-judge user rejected on judge route", async () => {
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    await expect(caller.judging.me.getNextTeam()).rejects.toThrow(/judge/i);
  });

  test("non-organizer rejected on admin route", async () => {
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    await expect(caller.judging.admin.getAllJudges()).rejects.toThrow();
  });
});

/* ---------- loadQueue / purgeQueue ---------- */

describe("loadQueue / purgeQueue", () => {
  test("loadQueue enqueues submitted + late teams, skips drafts", async () => {
    const org = await makeOrganizer();
    await makeTeam({ submissionStatus: "submitted" });
    await makeTeam({ submissionStatus: "late" });
    await makeTeam({ submissionStatus: "draft" });

    const { added } = await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });
    expect(added).toBe(2);

    const rows = await db.query.judgingQueue.findMany({});
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.roundsRemaining === 3)).toBe(true);
  });

  test("purgeQueue clears the queue but leaves marks", async () => {
    const org = await makeOrganizer();
    await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });
    await org.caller.judging.admin.purgeQueue();
    const rows = await db.query.judgingQueue.findMany({});
    expect(rows).toHaveLength(0);
  });
});

/* ---------- getNextTeam: priority, eligibility, concurrency ---------- */

describe("getNextTeam", () => {
  test("priority: most rounds remaining first", async () => {
    const org = await makeOrganizer();
    const low = await makeTeam();
    const high = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 1 });
    // Bump `high` to need more rounds.
    await db
      .update(judgingQueue)
      .set({ roundsRemaining: 5 })
      .where(eq(judgingQueue.teamId, high));
    void low;

    const j = await makeJudge();
    const { team } = await j.caller.judging.me.getNextTeam();
    expect(team?.id).toBe(high);
  });

  test("idempotent: returns the same held team on repeat call", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 2 });

    const j = await makeJudge();
    const first = await j.caller.judging.me.getNextTeam();
    const second = await j.caller.judging.me.getNextTeam();
    expect(first.team?.id).toBe(teamId);
    expect(second.team?.id).toBe(teamId);
  });

  test("already-marked team is not re-assigned to the same judge", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 80 });
    const next = await j.caller.judging.me.getNextTeam();
    expect(next.team).toBeNull();
  });

  test("skipped team is excluded for that judge, available to others", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const a = await makeJudge();
    await a.caller.judging.me.getNextTeam();
    await a.caller.judging.me.skipAssignment();
    const aAgain = await a.caller.judging.me.getNextTeam();
    expect(aAgain.team).toBeNull();

    const b = await makeJudge();
    const bGot = await b.caller.judging.me.getNextTeam();
    expect(bGot.team?.id).toBe(teamId);
  });

  test("sponsored judge only matched to teams in their tracks", async () => {
    const org = await makeOrganizer();
    const cohere = await makeTeam({ tracks: ["Best Use of Cohere"] });
    const domain = await makeTeam({ tracks: ["Best Domain"] });
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 1 });
    void cohere;

    const j = await makeJudge({ type: "sponsored", tracks: ["Best Domain"] });
    const got = await j.caller.judging.me.getNextTeam();
    expect(got.team?.id).toBe(domain);
  });

  test("two judges racing for one team get distinct results", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 1 });
    void teamId;

    const a = await makeJudge();
    const b = await makeJudge();
    const [ra, rb] = await Promise.all([
      a.caller.judging.me.getNextTeam(),
      b.caller.judging.me.getNextTeam(),
    ]);
    const handed = [ra, rb].filter((r) => r.team !== null);
    const empty = [ra, rb].filter((r) => r.team === null);
    expect(handed).toHaveLength(1);
    expect(empty).toHaveLength(1);
  });
});

/* ---------- submitTeamMark + triggers ---------- */

describe("submitTeamMark", () => {
  test("rejects a mark for a team the judge doesn't hold", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    // never called getNextTeam
    await expect(
      j.caller.judging.me.submitTeamMark({ teamId, score: 50 }),
    ).rejects.toThrow(/not currently assigned/i);
  });

  test("stat trigger updates judge aggregates on insert", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 80 });

    const row = await db.query.judges.findFirst({ where: eq(judges.id, j.session.user.id) });
    expect(row?.marksCount).toBe(1);
    expect(row?.marksSum).toBe(80);
    expect(row?.marksSquaredSum).toBe(6400);
  });

  test("auto-queue trigger removes a team after its last round", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 1 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 70 });

    const row = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.teamId, teamId),
    });
    expect(row).toBeUndefined();
  });

  test("auto-queue trigger returns a team to waiting with fewer rounds", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 70 });

    const row = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.teamId, teamId),
    });
    expect(row?.roundsRemaining).toBe(2);
    expect(row?.seenJudges).toBe(1);
    expect(row?.status).toBe("waiting");
    expect(row?.currentJudgeId).toBeNull();
  });
});

/* ---------- edit / delete marks + stat trigger ---------- */

describe("editTeamMark / deleteTeamMark", () => {
  test("editTeamMark adjusts the score and the judge aggregates", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 50 });

    const marks = await j.caller.judging.me.getSubmittedTeamMarks();
    expect(marks).toHaveLength(1);
    await j.caller.judging.me.editTeamMark({ teamMarkId: marks[0]!.id, score: 90 });

    const row = await db.query.judges.findFirst({ where: eq(judges.id, j.session.user.id) });
    expect(row?.marksCount).toBe(1); // unchanged
    expect(row?.marksSum).toBe(90); // 50 -> 90
    expect(row?.marksSquaredSum).toBe(8100);
  });

  test("deleteTeamMark removes the mark and reverses the aggregates", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 60 });
    const marks = await j.caller.judging.me.getSubmittedTeamMarks();

    await org.caller.judging.admin.deleteTeamMark({ teamMarkId: marks[0]!.id });

    const row = await db.query.judges.findFirst({ where: eq(judges.id, j.session.user.id) });
    expect(row?.marksCount).toBe(0);
    expect(row?.marksSum).toBe(0);
    expect(row?.marksSquaredSum).toBe(0);
    const remaining = await db.query.teamMarks.findMany({});
    expect(remaining).toHaveLength(0);
  });
});

/* ---------- assignJudgeForTeam ---------- */

describe("assignJudgeForTeam", () => {
  test("pins a team to a judge, overriding a prior holder", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 2 });

    const b = await makeJudge();
    await b.caller.judging.me.getNextTeam(); // b holds it

    const a = await makeJudge();
    await org.caller.judging.admin.assignJudgeForTeam({
      judgeId: a.session.user.id,
      teamId,
    });

    const row = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.teamId, teamId),
    });
    expect(row?.currentJudgeId).toBe(a.session.user.id);
  });

  test("rejects when the team isn't in the queue", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    const a = await makeJudge();
    await expect(
      org.caller.judging.admin.assignJudgeForTeam({
        judgeId: a.session.user.id,
        teamId,
      }),
    ).rejects.toThrow(/not in the judging queue/i);
  });
});

/* ---------- getLatestRanking (normalization) ---------- */

describe("getLatestRanking", () => {
  test("normalizes by subtracting each judge's mean; sponsored judges excluded", async () => {
    const org = await makeOrganizer();
    const t1 = await makeTeam();
    const t2 = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 5 });

    // Judge H is harsh (mean low), judge G is generous (mean high).
    const harsh = await makeJudge();
    const generous = await makeJudge();

    // harsh: t1=40, t2=20  -> mean 30  -> deviations +10, -10
    // generous: t1=90, t2=70 -> mean 80 -> deviations +10, -10
    // t1 normalized = avg(+10, +10) = +10 ; t2 = avg(-10,-10) = -10
    await harsh.caller.judging.me.getNextTeam();
    let hold = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, harsh.session.user.id),
    });
    await harsh.caller.judging.me.submitTeamMark({ teamId: hold!.teamId, score: hold!.teamId === t1 ? 40 : 20 });
    await harsh.caller.judging.me.getNextTeam();
    hold = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, harsh.session.user.id),
    });
    await harsh.caller.judging.me.submitTeamMark({ teamId: hold!.teamId, score: hold!.teamId === t1 ? 40 : 20 });

    await generous.caller.judging.me.getNextTeam();
    hold = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, generous.session.user.id),
    });
    await generous.caller.judging.me.submitTeamMark({ teamId: hold!.teamId, score: hold!.teamId === t1 ? 90 : 70 });
    await generous.caller.judging.me.getNextTeam();
    hold = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.currentJudgeId, generous.session.user.id),
    });
    await generous.caller.judging.me.submitTeamMark({ teamId: hold!.teamId, score: hold!.teamId === t1 ? 90 : 70 });

    const ranking = await org.caller.judging.admin.getLatestRanking();
    const byTeam = new Map(ranking.map((r) => [r.team_id, Number(r.normalized_score)]));
    expect(byTeam.get(t1)!).toBeCloseTo(10, 5);
    expect(byTeam.get(t2)!).toBeCloseTo(-10, 5);
    // t1 ranks above t2
    expect(ranking[0]!.team_id).toBe(t1);
  });
});
