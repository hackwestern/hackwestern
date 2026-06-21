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
  type submissionStatusEnum,
  teamMarks,
  teams,
  type trackEnum,
} from "~/server/db/schema";
import { applyTriggers } from "~/server/db/triggers";

type Track = (typeof trackEnum.enumValues)[number];
type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];

/* ---------- helpers ---------- */

/** Narrowing assert so tests fail loudly instead of relying on `!`. */
function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/** The team a judge is currently holding; throws if they hold none. */
async function currentHoldTeamId(judgeUserId: string): Promise<string> {
  const hold = await db.query.judgingQueue.findFirst({
    where: eq(judgingQueue.currentJudgeId, judgeUserId),
  });
  assertDefined(hold, "expected the judge to be holding a team");
  return hold.teamId;
}

async function makeJudge(opts?: {
  type?: "organizer" | "sponsored";
  tracks?: Track[];
}) {
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
  submissionStatus?: SubmissionStatus;
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

  test("judge allowed on judge route (happy path)", async () => {
    const j = await makeJudge();
    await expect(j.caller.judging.me.getCurrentAssignment()).resolves.toEqual({
      currentTeamId: null,
    });
  });
});

/* ---------- loadQueue / purgeQueue ---------- */

describe("loadQueue / purgeQueue", () => {
  test("loadQueue enqueues submitted + late teams, skips drafts", async () => {
    const org = await makeOrganizer();
    await makeTeam({ submissionStatus: "submitted" });
    await makeTeam({ submissionStatus: "late" });
    await makeTeam({ submissionStatus: "draft" });

    const { added } = await org.caller.judging.admin.loadQueue({
      roundsPerTeam: 3,
    });
    expect(added).toBe(2);

    const rows = await db.query.judgingQueue.findMany({});
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.roundsRemaining === 3)).toBe(true);
  });

  test("purgeQueue clears the queue but leaves marks", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    // Submit a real mark so we can assert it survives the purge.
    const j = await makeJudge();
    await j.caller.judging.me.getNextTeam();
    await j.caller.judging.me.submitTeamMark({ teamId, score: 75 });

    await org.caller.judging.admin.purgeQueue();

    const rows = await db.query.judgingQueue.findMany({});
    expect(rows).toHaveLength(0);
    const marks = await db.query.teamMarks.findMany({});
    expect(marks).toHaveLength(1);
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
    // No other eligible team -> 409 rather than a null team.
    await expect(j.caller.judging.me.getNextTeam()).rejects.toThrow(
      /no teams are currently available/i,
    );
  });

  test("skipped team is excluded for that judge, available to others", async () => {
    const org = await makeOrganizer();
    const teamId = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 3 });

    const a = await makeJudge();
    await a.caller.judging.me.getNextTeam();
    await a.caller.judging.me.skipAssignment();
    // The skipped team is the only one, so A now has nothing eligible -> 409.
    await expect(a.caller.judging.me.getNextTeam()).rejects.toThrow(
      /no teams are currently available/i,
    );

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

    const a = await makeJudge();
    const b = await makeJudge();
    // One judge claims the only team; the other gets a 409 (nothing left).
    const results = await Promise.allSettled([
      a.caller.judging.me.getNextTeam(),
      b.caller.judging.me.getNextTeam(),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const winner = fulfilled[0];
    assertDefined(winner, "expected one judge to receive a team");
    if (winner.status === "fulfilled") {
      expect(winner.value.team?.id).toBe(teamId);
    }
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

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
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
    const mark = marks[0];
    assertDefined(mark, "expected a submitted mark to edit");
    await j.caller.judging.me.editTeamMark({ teamMarkId: mark.id, score: 90 });

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
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
    const mark = marks[0];
    assertDefined(mark, "expected a submitted mark to delete");

    await org.caller.judging.admin.deleteTeamMark({ teamMarkId: mark.id });

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
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
  test("normalizes by each judge's mean AND std dev; sponsored judges excluded", async () => {
    const org = await makeOrganizer();
    const t1 = await makeTeam();
    const t2 = await makeTeam();
    await org.caller.judging.admin.loadQueue({ roundsPerTeam: 5 });

    // Judge H is harsh (mean low), judge G is generous (mean high).
    const harsh = await makeJudge();
    const generous = await makeJudge();

    // Each judge scores both teams. The z-score normalization recenters by
    // the judge's mean and divides by their (population) std dev:
    //   harsh:    t1=40, t2=20  -> mean 30, sigma 10 -> z = +1, -1
    //   generous: t1=90, t2=70  -> mean 80, sigma 10 -> z = +1, -1
    //   t1 normalized = avg(+1, +1) = +1 ; t2 = avg(-1, -1) = -1
    const scoreBoth = async (
      judge: Awaited<ReturnType<typeof makeJudge>>,
      t1Score: number,
      t2Score: number,
    ) => {
      for (let round = 0; round < 2; round++) {
        await judge.caller.judging.me.getNextTeam();
        const teamId = await currentHoldTeamId(judge.session.user.id);
        await judge.caller.judging.me.submitTeamMark({
          teamId,
          score: teamId === t1 ? t1Score : t2Score,
        });
      }
    };

    await scoreBoth(harsh, 40, 20);
    await scoreBoth(generous, 90, 70);

    const ranking = await org.caller.judging.admin.getLatestRanking();
    const byTeam = new Map(
      ranking.map((r) => [r.team_id, Number(r.normalized_score)]),
    );
    const t1Score = byTeam.get(t1);
    const t2Score = byTeam.get(t2);
    assertDefined(t1Score, "expected a ranking row for t1");
    assertDefined(t2Score, "expected a ranking row for t2");
    expect(t1Score).toBeCloseTo(1, 5);
    expect(t2Score).toBeCloseTo(-1, 5);
    // t1 ranks above t2
    const top = ranking[0];
    assertDefined(top, "expected at least one ranking row");
    expect(top.team_id).toBe(t1);
  });
});
