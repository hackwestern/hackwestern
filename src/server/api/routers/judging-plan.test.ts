import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { type Session } from "next-auth";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  judgingAssignments,
  judgingQueue,
  judgingTables,
  sponsorPitches,
  teams,
  users,
} from "~/server/db/schema";
import { applyTriggers } from "~/server/db/triggers";
import * as mailModule from "~/server/mail-mailjet";
import {
  deleteJudging,
  type JudgingSeedResult,
  seedJudging,
} from "~/server/db/seed/judgingSeeder";
import { buildLayout, buildVisits, type Visit } from "~/server/judging/plan";

const MINUTE = 60_000;
const ROUND_START = new Date("2026-11-22T13:00:00.000Z");
const SLOT_MINUTES = 10;

const sendSpy = vi.spyOn(mailModule, "sendViaMailjet").mockResolvedValue({
  data: { delivered: [], queued: [], bounced: [] },
  error: null,
});

function callerFor(userId: string) {
  const session = {
    user: { id: userId },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  } as Session;
  return createCaller(createInnerTRPCContext({ session }));
}

/** Every rule the generator promises, checked on a finished set of visits. */
function expectValidPlan(
  visits: Pick<Visit, "judgeId" | "teamId" | "slot">[],
  teamIds: string[],
  slotCount: number,
  judgesPerTeam: number,
) {
  const byTeam = new Map<string, typeof visits>();
  const byJudge = new Map<string, typeof visits>();
  for (const v of visits) {
    byTeam.set(v.teamId, [...(byTeam.get(v.teamId) ?? []), v]);
    byJudge.set(v.judgeId, [...(byJudge.get(v.judgeId) ?? []), v]);
  }
  expect(new Set(byTeam.keys())).toEqual(new Set(teamIds));
  for (const vs of byTeam.values()) {
    expect(vs).toHaveLength(judgesPerTeam);
    expect(new Set(vs.map((v) => v.judgeId)).size).toBe(judgesPerTeam);
    expect(new Set(vs.map((v) => v.slot)).size).toBe(judgesPerTeam);
  }
  for (const vs of byJudge.values()) {
    expect(vs.length).toBeLessThanOrEqual(slotCount);
    expect(new Set(vs.map((v) => v.slot)).size).toBe(vs.length);
    expect(new Set(vs.map((v) => v.teamId)).size).toBe(vs.length);
    for (const v of vs) {
      expect(v.slot).toBeGreaterThanOrEqual(1);
      expect(v.slot).toBeLessThanOrEqual(slotCount);
    }
  }
}

/* ---------- pure engine pieces ---------- */

describe("buildLayout", () => {
  test("numbers in reading order and snakes the walk across zones", () => {
    const tables = buildLayout([
      { zone: "A", rows: 2, cols: 3 },
      { zone: "B", rows: 1, cols: 2 },
    ]);
    expect(tables.map((t) => [t.number, t.walkOrder])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 5],
      [5, 4],
      [6, 3],
      [7, 6],
      [8, 7],
    ]);
    expect(tables[3]).toMatchObject({ zone: "A", mapX: 0, mapY: 1 });
  });
});

describe("buildVisits", () => {
  test.each([6, 7, 8, 9, 10, 12, 13, 17, 18, 25, 36, 49, 80])(
    "%i teams: 3 judges each, different slots, at most 6 per judge",
    (n) => {
      const teamIds = Array.from({ length: n }, (_, i) => `t${i}`);
      const judgeIds = Array.from({ length: n }, (_, i) => `j${i}`);
      const visits = buildVisits(teamIds, judgeIds, 6, 3);
      expectValidPlan(visits, teamIds, 6, 3);

      // Padding between passes costs at most a couple of judges.
      const used = new Set(visits.map((v) => v.judgeId)).size;
      expect(used).toBeLessThanOrEqual(Math.ceil((n * 3) / 6) + 2);
    },
  );

  test("each judge walks a contiguous run of tables within a pass", () => {
    const teamIds = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const judgeIds = Array.from({ length: 40 }, (_, i) => `j${i}`);
    const visits = buildVisits(teamIds, judgeIds, 6, 3);
    const first = visits
      .filter((v) => v.judgeId === "j0")
      .sort((a, b) => a.slot - b.slot)
      .map((v) => v.teamId);
    expect(first).toEqual(["t0", "t1", "t2", "t3", "t4", "t5"]);
  });

  test("rejects a plan that needs more judges than there are", () => {
    const teamIds = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(() => buildVisits(teamIds, ["a", "b", "c"], 6, 3)).toThrow(
      /needs \d+ judges; only 3 available/,
    );
  });
});

/* ---------- auth ---------- */

describe("auth gating", () => {
  test("anonymous and hacker callers can't run organizer actions", async () => {
    const anon = createCaller(createInnerTRPCContext({ session: null }));
    await expect(anon.judgingPlan.admin.generate()).rejects.toThrow();
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(hacker.judgingPlan.admin.publish()).rejects.toThrow();
    await expect(hacker.judgingPlan.me.getMyVisits()).rejects.toThrow(
      /not registered as a judge/,
    );
  });
});

/* ---------- full day, end to end ---------- */

describe.sequential("judging plan end to end", () => {
  let seed: JudgingSeedResult;
  let org: ReturnType<typeof createCaller>;

  const liveVisits = () =>
    db
      .select()
      .from(judgingAssignments)
      .where(ne(judgingAssignments.status, "reassigned"));

  async function hackerOn(teamId: string) {
    const member = await db.query.users.findFirst({
      where: eq(users.teamId, teamId),
    });
    if (!member) throw new Error("seeded team has no members");
    return callerFor(member.id);
  }

  beforeAll(async () => {
    await applyTriggers(db);
    await deleteJudging(db);
    seed = await seedJudging(db, { teams: 40, roundStartsAt: ROUND_START });
    org = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
  });

  afterAll(async () => {
    await deleteJudging(db);
  });

  test("setup reports what's ready", async () => {
    const { round, readiness } = await org.judgingPlan.admin.getSetup();
    expect(round?.status).toBe("draft");
    expect(readiness.eligibleTeams).toBe(seed.eligibleTeamIds.length);
    // Two tables are seeded as switched off.
    const tables = await db.query.judgingTables.findMany();
    expect(readiness.activeTables).toBe(tables.length - 2);
    expect(readiness.activeTables).toBeGreaterThanOrEqual(
      readiness.eligibleTeams,
    );
    expect(readiness.generalJudges).toBe(seed.generalJudgeIds.length);
    expect(readiness.judgesNeeded).toBe(
      Math.ceil((seed.eligibleTeamIds.length * 3) / 6),
    );
    expect(readiness.seatedTeams).toBe(0);
  });

  test("seating puts each eligible team at an active table, sponsor tracks together", async () => {
    const res = await org.judgingPlan.admin.seatTeams();
    expect(res.seated).toBe(seed.eligibleTeamIds.length);

    const seated = await db
      .select({
        id: teams.id,
        status: teams.submissionStatus,
        tracks: teams.tracks,
        walk: judgingTables.walkOrder,
        active: judgingTables.isActive,
      })
      .from(teams)
      .innerJoin(judgingTables, eq(teams.judgingTableId, judgingTables.id))
      .orderBy(judgingTables.walkOrder);
    expect(new Set(seated.map((s) => s.id))).toEqual(
      new Set(seed.eligibleTeamIds),
    );
    expect(seated.every((s) => s.active)).toBe(true);
    expect(seated.some((s) => s.status === "draft")).toBe(false);

    // Grouping key changes at most once per sponsor track (plus General).
    const keys = seated.map(
      (s) => (s.tracks ?? []).filter((t) => t !== "General").sort()[0] ?? "~",
    );
    const runs = keys.filter((k, i) => i === 0 || k !== keys[i - 1]);
    expect(runs.length).toBe(new Set(keys).size);
  });

  test("generate gives every team 3 different judges in 3 different slots", async () => {
    const res = await org.judgingPlan.admin.generate();
    expect(res.teams).toBe(seed.eligibleTeamIds.length);
    expect(res.visits).toBe(seed.eligibleTeamIds.length * 3);
    expectValidPlan(await liveVisits(), seed.eligibleTeamIds, 6, 3);

    // Only general judges walk the tables.
    const judgeIds = new Set((await liveVisits()).map((v) => v.judgeId));
    for (const id of seed.sponsorJudgeIds) expect(judgeIds.has(id)).toBe(false);
  });

  test("reshuffle replaces the draft with another valid plan", async () => {
    await org.judgingPlan.admin.reshuffle();
    expectValidPlan(await liveVisits(), seed.eligibleTeamIds, 6, 3);
  });

  test("judges and hackers see nothing before publish", async () => {
    const someVisit = (await liveVisits())[0]!;
    const judge = callerFor(someVisit.judgeId);
    expect(await judge.judgingPlan.me.getMyVisits()).toEqual({
      published: false,
      visits: [],
    });
    const hacker = await hackerOn(someVisit.teamId);
    expect(await hacker.judgingPlan.team.getMyJudging()).toEqual({
      published: false,
    });
  });

  test("publish freezes the plan", async () => {
    const round = await org.judgingPlan.admin.publish();
    expect(round?.status).toBe("published");
    expect(round?.publishedAt).toBeInstanceOf(Date);

    await expect(org.judgingPlan.admin.seatTeams()).rejects.toThrow(
      /published/,
    );
    await expect(org.judgingPlan.admin.generate()).rejects.toThrow(/published/);
    await expect(
      org.judgingPlan.admin.saveLayout({
        zones: [{ zone: "X", rows: 1, cols: 1 }],
        startNumber: 1,
      }),
    ).rejects.toThrow(/published/);
    await expect(org.judgingPlan.admin.publish()).rejects.toThrow(/published/);
  });

  test("a judge sees their route in slot order, with tables and times", async () => {
    const visit = (await liveVisits())[0]!;
    const { published, visits } = await callerFor(
      visit.judgeId,
    ).judgingPlan.me.getMyVisits();
    expect(published).toBe(true);
    expect(visits.length).toBeGreaterThan(0);
    expect(visits.length).toBeLessThanOrEqual(6);
    expect(visits.map((v) => v.slot)).toEqual(
      [...visits.map((v) => v.slot)].sort((a, b) => a - b),
    );
    for (const v of visits) {
      expect(v.startsAt.getTime()).toBe(
        ROUND_START.getTime() + (v.slot - 1) * SLOT_MINUTES * MINUTE,
      );
      expect(v.table?.number).toEqual(expect.any(Number));
      expect(v.team?.name).toEqual(expect.any(String));
      expect(v.done).toBe(false);
    }
  });

  test("a hacker sees their table, 3 judges left and when the next one comes", async () => {
    const teamId = seed.eligibleTeamIds[0]!;
    const view = await (await hackerOn(teamId)).judgingPlan.team.getMyJudging();
    if (!view.published) throw new Error("expected a published view");
    expect(view.table?.number).toEqual(expect.any(Number));
    expect(view.judgesTotal).toBe(3);
    expect(view.judgesLeft).toBe(3);
    const firstSlot = Math.min(...view.visits.map((v) => v.slot));
    expect(view.nextVisitAt?.getTime()).toBe(
      ROUND_START.getTime() + (firstSlot - 1) * SLOT_MINUTES * MINUTE,
    );
  });

  test("scoring a visit updates the judge's route, progress and the hacker view", async () => {
    const teamId = seed.eligibleTeamIds[0]!;
    const [visit, other] = await db
      .select()
      .from(judgingAssignments)
      .where(eq(judgingAssignments.teamId, teamId));
    const judge = callerFor(visit!.judgeId);

    await judge.judgingPlan.me.submitVisitMark({
      assignmentId: visit!.id,
      score: 72,
    });
    await expect(
      judge.judgingPlan.me.submitVisitMark({
        assignmentId: visit!.id,
        score: 80,
      }),
    ).rejects.toThrow(/already scored/);
    await expect(
      judge.judgingPlan.me.submitVisitMark({
        assignmentId: other!.id,
        score: 80,
      }),
    ).rejects.toThrow(/not yours/);

    const route = await judge.judgingPlan.me.getMyVisits();
    expect(route.visits.find((v) => v.assignmentId === visit!.id)?.done).toBe(
      true,
    );

    const progress = await org.judgingPlan.admin.getProgress();
    expect(progress).toMatchObject({
      status: "published",
      visitsPlanned: seed.eligibleTeamIds.length * 3,
      visitsDone: 1,
      teamsComplete: 0,
    });

    const view = await (await hackerOn(teamId)).judgingPlan.team.getMyJudging();
    if (!view.published) throw new Error("expected a published view");
    expect(view.judgesDone).toBe(1);
    expect(view.judgesLeft).toBe(2);
  });

  test("absent flags block scoring; reassignment moves a visit to a free judge", async () => {
    const teamId = seed.eligibleTeamIds[1]!;
    const [visit] = await db
      .select()
      .from(judgingAssignments)
      .where(eq(judgingAssignments.teamId, teamId));

    await org.judgingPlan.admin.setAbsent({
      assignmentId: visit!.id,
      absent: true,
    });
    await expect(
      callerFor(visit!.judgeId).judgingPlan.me.submitVisitMark({
        assignmentId: visit!.id,
        score: 50,
      }),
    ).rejects.toThrow(/absent/);
    await org.judgingPlan.admin.setAbsent({
      assignmentId: visit!.id,
      absent: false,
    });

    const live = await liveVisits();
    const busyInSlot = new Set(
      live.filter((v) => v.slot === visit!.slot).map((v) => v.judgeId),
    );
    const onTeam = new Set(
      live.filter((v) => v.teamId === teamId).map((v) => v.judgeId),
    );
    const free = seed.generalJudgeIds.find(
      (j) => !busyInSlot.has(j) && !onTeam.has(j),
    );
    const busy = [...busyInSlot].find(
      (j) => j !== visit!.judgeId && !onTeam.has(j),
    );
    expect(free).toBeDefined();

    if (busy) {
      await expect(
        org.judgingPlan.admin.reassign({
          assignmentId: visit!.id,
          judgeId: busy,
        }),
      ).rejects.toThrow(/busy in slot/);
    }
    const moved = await org.judgingPlan.admin.reassign({
      assignmentId: visit!.id,
      judgeId: free!,
    });
    expect(moved).toMatchObject({ teamId, slot: visit!.slot, judgeId: free });

    const old = await db.query.judgingAssignments.findFirst({
      where: eq(judgingAssignments.id, visit!.id),
    });
    expect(old?.status).toBe("reassigned");
    await expect(
      org.judgingPlan.admin.reassign({
        assignmentId: visit!.id,
        judgeId: free!,
      }),
    ).rejects.toThrow(/already reassigned/);
    expectValidPlan(await liveVisits(), seed.eligibleTeamIds, 6, 3);
  });

  test("sponsor pitches avoid every conflict the spec names", async () => {
    // Start pitches during the general round so the checks have work to do.
    const res = await org.judgingPlan.admin.schedulePitches({
      startsAt: ROUND_START,
    });
    const shortlisted = Object.values(seed.shortlists).flat().length;
    expect(res.scheduled).toBe(shortlisted);

    const pitches = await db.query.sponsorPitches.findMany();
    expect(pitches.every((p) => p.startsAt && p.endsAt)).toBe(true);
    const iv = (p: (typeof pitches)[number]) => ({
      start: p.startsAt!.getTime(),
      end: p.endsAt!.getTime(),
    });
    const clash = (a: { start: number; end: number }, b: typeof a) =>
      a.start < b.end && b.start < a.end;

    // 1. No room runs two pitches at once.
    for (const a of pitches)
      for (const b of pitches)
        if (a !== b && a.track === b.track)
          expect(clash(iv(a), iv(b))).toBe(false);

    // 2. No team is in two rooms at once.
    for (const a of pitches)
      for (const b of pitches)
        if (a !== b && a.teamId === b.teamId)
          expect(clash(iv(a), iv(b))).toBe(false);

    // 3. No pitch overlaps that team's general judging visits.
    const visits = await liveVisits();
    for (const p of pitches) {
      for (const v of visits.filter((x) => x.teamId === p.teamId)) {
        const start =
          ROUND_START.getTime() + (v.slot - 1) * SLOT_MINUTES * MINUTE;
        expect(
          clash(iv(p), { start, end: start + SLOT_MINUTES * MINUTE }),
        ).toBe(false);
      }
    }

    // 4. The judge on two tracks is never in both rooms at once.
    const dual = pitches.filter(
      (p) =>
        p.track === "Best Use of Cohere" ||
        p.track === "Best Use of AntiGravity",
    );
    for (const a of dual)
      for (const b of dual)
        if (a !== b && a.track !== b.track)
          expect(clash(iv(a), iv(b))).toBe(false);
  });

  test("a shortlisted team sees its room and time", async () => {
    const pitch = await db.query.sponsorPitches.findFirst();
    const view = await (
      await hackerOn(pitch!.teamId)
    ).judgingPlan.team.getMyJudging();
    if (!view.published) throw new Error("expected a published view");
    const mine = view.pitches.find((p) => p.track === pitch!.track);
    expect(mine?.startsAt).toEqual(pitch!.startsAt);
    expect(mine?.room).toMatch(/^Room [A-C]$/);
  });

  test("room messages go out once to every team and every room's judges", async () => {
    sendSpy.mockClear();
    const first = await org.judgingPlan.admin.sendRoomMessages();
    const pitches = await db.query.sponsorPitches.findMany();
    expect(first).toEqual({
      teamsNotified: pitches.length,
      roomsNotified: 3,
      failures: [],
    });
    expect(sendSpy).toHaveBeenCalledTimes(pitches.length + 3);
    expect(pitches.every((p) => p.notifiedAt)).toBe(true);

    sendSpy.mockClear();
    const again = await org.judgingPlan.admin.sendRoomMessages();
    expect(again).toEqual({ teamsNotified: 0, roomsNotified: 0, failures: [] });
    expect(sendSpy).not.toHaveBeenCalled();

    await expect(
      org.judgingPlan.admin.schedulePitches({ startsAt: ROUND_START }),
    ).rejects.toThrow(/already gone out/);
    await expect(
      org.judgingPlan.admin.setShortlist({ track: "Best Domain", teams: [] }),
    ).rejects.toThrow(/already gone out/);
  });

  test("a failed send is reported and retried on the next run", async () => {
    await db
      .update(sponsorPitches)
      .set({ notifiedAt: null })
      .where(isNotNull(sponsorPitches.notifiedAt));
    sendSpy.mockClear();
    sendSpy.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await org.judgingPlan.admin.sendRoomMessages();
    expect(res.failures).toHaveLength(1);
    expect(res.teamsNotified).toBe(
      (await db.query.sponsorPitches.findMany()).length - 1,
    );

    const retry = await org.judgingPlan.admin.sendRoomMessages();
    expect(retry.teamsNotified).toBe(1);
  });

  test("after the round, teams short of 3 judges go to the queue for top-ups", async () => {
    const res = await org.judging.admin.loadQueue({ roundsPerTeam: 3 });
    expect(res.added).toBe(seed.eligibleTeamIds.length);

    // The team scored once earlier is owed 2 more, everyone else 3.
    const scored = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.teamId, seed.eligibleTeamIds[0]!),
    });
    expect(scored).toMatchObject({ roundsRemaining: 2, seenJudges: 1 });
    const draftTeams = seed.teamIds.filter(
      (id) => !seed.eligibleTeamIds.includes(id),
    );
    const queuedDrafts = await db
      .select()
      .from(judgingQueue)
      .where(and(inArray(judgingQueue.teamId, draftTeams)));
    expect(queuedDrafts).toHaveLength(0);
  });
});
