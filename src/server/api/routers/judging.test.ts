import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { and, eq, sql } from "drizzle-orm";

// Same guard as cheat-check-sweep.test.ts: with a real CHEAT_SWEEP_SECRET in
// .env, the sweep tests below would otherwise POST the real bearer token at
// NEXTAUTH_URL and could start a real worker. Unset, `kickWorker` no-ops while
// the sweep rows are still written and assertable.
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/env")>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "CHEAT_SWEEP_SECRET") return undefined;
        return target[prop];
      },
    }),
  };
});

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  cheatCheckSweepItems,
  cheatCheckSweeps,
  judges,
  judgingAssignments,
  judgingRound,
  judgingSettings,
  judgingTables,
  type submissionStatusEnum,
  teamMarks,
  teams,
  type trackEnum,
  users,
} from "~/server/db/schema";
import { applyTriggers } from "~/server/db/triggers";

// Every test builds a room (teams, tables, judges, a plan) through the real
// procedures. That's fast alone (~5s for the file) but can pass the 5s
// default per test when the whole suite runs in parallel on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

type Track = (typeof trackEnum.enumValues)[number];
type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];
type Caller = ReturnType<typeof createCaller>;

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

// Judges get sections in the order they were added, so give each one a
// distinct created_at instead of relying on the clock's millisecond.
let judgeClock = Date.UTC(2026, 10, 20, 9, 0, 0);

async function makeJudge(opts?: {
  type?: "organizer" | "sponsored";
  tracks?: Track[];
}) {
  const session = await mockSession(db);
  await db.insert(judges).values({
    id: session.user.id,
    type: opts?.type ?? "organizer",
    track: opts?.tracks,
    createdAt: new Date((judgeClock += 1000)),
  });
  return { session, caller: createCaller(createInnerTRPCContext({ session })) };
}
type Judge = Awaited<ReturnType<typeof makeJudge>>;

async function makeOrganizer() {
  const session = await mockOrganizerSession(db);
  return { session, caller: createCaller(createInnerTRPCContext({ session })) };
}

async function makeTeam(opts?: {
  tracks?: Track[];
  submissionStatus?: SubmissionStatus;
  submittedAt?: Date;
  devpost?: boolean;
}) {
  const id = faker.string.alphanumeric(12);
  const links = opts?.devpost ?? true;
  await db.insert(teams).values({
    id,
    name: `team-${id}`,
    devpostUrl: links ? `https://devpost.com/${id}` : null,
    githubUrl: links ? `https://github.com/${id}` : null,
    tracks: opts?.tracks,
    submissionStatus: opts?.submissionStatus ?? "submitted",
    submittedAt: opts?.submittedAt,
    joinCode: faker.string.alphanumeric(6),
  });
  return id;
}

async function resetAll() {
  await db.delete(judgingAssignments).where(sql`true`);
  await db.delete(teamMarks).where(sql`true`);
  await db.delete(judges).where(sql`true`);
  // Sweep rows outlive their teams (no FK from sweep -> team), so a leftover
  // `running` sweep or a recent `finishedAt` would suppress the next one.
  await db.delete(cheatCheckSweepItems).where(sql`true`);
  await db.delete(cheatCheckSweeps).where(sql`true`);
  await db.delete(teams).where(sql`true`);
  await db.delete(judgingTables).where(sql`true`);
  await db.delete(judgingSettings).where(sql`true`);
  // Most tests score stops in any order, so rounds start switched off. The
  // "rounds" tests switch them on.
  await db.delete(judgingRound).where(sql`true`);
  await db.insert(judgingRound).values({ id: 1, roundsEnabled: false });
}

/**
 * A ready room: `tableCount` tables in `rows` rows, one submitted team per
 * table (in submission order, so team i sits at table i+1), and `judgeCount`
 * judges with sections assigned.
 */
async function setupRoom(opts: {
  tableCount: number;
  rows?: number;
  judgeCount: number;
  teamCount?: number;
}) {
  const org = await makeOrganizer();
  await org.caller.judging.admin.setupTables({
    tableCount: opts.tableCount,
    rows: opts.rows ?? 1,
  });
  const teamIds: string[] = [];
  for (let i = 0; i < (opts.teamCount ?? opts.tableCount); i++) {
    teamIds.push(
      await makeTeam({ submittedAt: new Date(Date.UTC(2026, 10, 20, 8, i)) }),
    );
  }
  await org.caller.judging.admin.seatTeams({ random: false });
  const judgeList: Judge[] = [];
  for (let i = 0; i < opts.judgeCount; i++) {
    judgeList.push(await makeJudge());
  }
  await org.caller.judging.admin.autoAssign();
  const tables = await db.query.judgingTables.findMany({
    orderBy: (t, { asc }) => [asc(t.number)],
  });
  return { org, teamIds, judges: judgeList, tables };
}

async function tableByNumber(number: number) {
  const table = await db.query.judgingTables.findFirst({
    where: eq(judgingTables.number, number),
  });
  assertDefined(table, `expected table ${number}`);
  return table;
}

/** A judge's live stops, in walking order. */
async function stopsOf(caller: Caller) {
  return (await caller.judging.me.getMyStops()).stops;
}

async function firstStop(caller: Caller) {
  const [stop] = await stopsOf(caller);
  assertDefined(stop, "expected the judge to have a stop");
  return stop;
}

/** Score every stop a judge has, all with the same score. */
async function scoreAll(judge: Judge, score: number) {
  for (const stop of await stopsOf(judge.caller)) {
    await judge.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score,
    });
  }
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
    await expect(anon.judging.me.getMyStops()).rejects.toThrow();
  });

  test("non-judge user rejected on judge route", async () => {
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    await expect(caller.judging.me.getMyStops()).rejects.toThrow(
      /not registered as a judge/,
    );
  });

  test("non-organizer rejected on admin routes", async () => {
    const j = await makeJudge();
    await expect(j.caller.judging.admin.getProgress()).rejects.toThrow();
    await expect(
      j.caller.judging.admin.setupTables({ tableCount: 5, rows: 1 }),
    ).rejects.toThrow();
    await expect(j.caller.judging.admin.autoAssign()).rejects.toThrow();
  });

  test("team status needs a signed-in user on a team", async () => {
    const anon = createCaller(createInnerTRPCContext({ session: null }));
    await expect(anon.judging.team.getMyJudging()).rejects.toThrow();
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    await expect(caller.judging.team.getMyJudging()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

/* ---------- room setup ---------- */

describe("setupTables", () => {
  test("creates tables 1..N and stores the layout", async () => {
    const org = await makeOrganizer();
    const result = await org.caller.judging.admin.setupTables({
      tableCount: 70,
      rows: 5,
    });
    expect(result).toMatchObject({
      tableCount: 70,
      rows: 5,
      perRow: 14,
      judgesPerTable: 3,
      tablesCreated: 70,
    });
    const tables = await db.query.judgingTables.findMany({});
    expect(tables.map((t) => t.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 70 }, (_, i) => i + 1),
    );
    expect(tables.every((t) => t.status === "empty" && t.isActive)).toBe(true);
  });

  test("shrinking removes the extra tables and unseats their teams", async () => {
    const { org, teamIds } = await setupRoom({ tableCount: 6, judgeCount: 3 });
    const result = await org.caller.judging.admin.setupTables({
      tableCount: 4,
      rows: 1,
    });
    expect(result.tablesRemoved).toBe(2);
    // The stale plan is cleared, since sections depend on the tables.
    expect(result.planCleared).toBeGreaterThan(0);
    expect(await db.query.judgingAssignments.findMany({})).toHaveLength(0);
    const last = await db.query.teams.findFirst({
      where: eq(teams.id, teamIds[5]!),
    });
    expect(last?.judgingTableId).toBeNull();
  });

  test("is locked once judging starts", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.startStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
    });
    await expect(
      org.caller.judging.admin.setupTables({ tableCount: 8, rows: 1 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("seatTeams", () => {
  test("submission order puts the earliest submission at table 1; drafts sit out", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 5, rows: 1 });
    const late = await makeTeam({ submittedAt: new Date("2026-11-20T10:00Z") });
    const early = await makeTeam({
      submittedAt: new Date("2026-11-20T08:00Z"),
    });
    const draft = await makeTeam({ submissionStatus: "draft" });

    const result = await org.caller.judging.admin.seatTeams({ random: false });
    expect(result).toMatchObject({ random: false, seated: 2, emptyTables: 3 });
    expect(result.seating.map((s) => [s.teamId, s.tableNumber])).toEqual([
      [early, 1],
      [late, 3],
    ]);
    const d = await db.query.teams.findFirst({ where: eq(teams.id, draft) });
    expect(d?.judgingTableId).toBeNull();
  });

  test("random seating gives every submitted team its own table", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 10, rows: 2 });
    for (let i = 0; i < 8; i++) await makeTeam();
    const result = await org.caller.judging.admin.seatTeams();
    expect(result.random).toBe(true);
    expect(result.seated).toBe(8);
    const numbers = result.seating.map((s) => s.tableNumber);
    // The reversed row has pairs (7, 8) and (9, 10), with 6 on its own.
    expect(numbers).toEqual([1, 3, 5, 6, 7, 9, 2, 4]);
  });

  test("seated tables flip from empty to waiting", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 3, rows: 1 });
    await makeTeam();
    await org.caller.judging.admin.seatTeams({ random: false });
    expect((await tableByNumber(1)).status).toBe("waiting");
    expect((await tableByNumber(2)).status).toBe("empty");
  });

  test("refuses when more teams submitted than tables are active", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 2, rows: 1 });
    for (let i = 0; i < 3; i++) await makeTeam();
    await expect(
      org.caller.judging.admin.seatTeams({ random: false }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("switched-off tables are skipped", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 3, rows: 1 });
    const t1 = await tableByNumber(1);
    await org.caller.judging.admin.setTableActive({
      tableId: t1.id,
      isActive: false,
    });
    await makeTeam();
    const result = await org.caller.judging.admin.seatTeams({ random: false });
    expect(result.seating[0]?.tableNumber).toBe(2);
  });
});

/* ---------- auto-assign ---------- */

describe("autoAssign", () => {
  test("the 140-spot room fills all 70 physical tables before sharing one", async () => {
    const { judges: judgeList } = await setupRoom({
      tableCount: 140,
      rows: 5,
      teamCount: 71,
      judgeCount: 3,
    });
    const occupied = Array.from({ length: 70 }, (_, i) => i * 2 + 1);
    occupied.splice(1, 0, 2);
    for (const judge of judgeList) {
      const stops = await stopsOf(judge.caller);
      expect(stops.map((stop) => stop.table.number)).toEqual(occupied);
      expect(stops.every((stop) => stop.team)).toBe(true);
    }
  });

  test("routes skip unoccupied and switched-off spots; reseating clears old stops", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 6, rows: 1 });
    await org.caller.judging.admin.setTableActive({
      tableId: (await tableByNumber(1)).id,
      isActive: false,
    });
    await makeTeam();
    await makeTeam();
    await org.caller.judging.admin.seatTeams({ random: false });
    const judgeList = [await makeJudge(), await makeJudge(), await makeJudge()];

    const plan = await org.caller.judging.admin.autoAssign();
    expect(plan).toMatchObject({ tables: 2, stops: 6 });
    for (const judge of judgeList) {
      expect((await stopsOf(judge.caller)).map((s) => s.table.number)).toEqual([
        2, 3,
      ]);
    }

    await makeTeam();
    const seating = await org.caller.judging.admin.seatTeams({ random: false });
    expect(seating.planCleared).toBe(6);
    expect(await stopsOf(judgeList[0]!.caller)).toHaveLength(0);
    await org.caller.judging.admin.autoAssign();
    expect(
      (await stopsOf(judgeList[0]!.caller)).map((s) => s.table.number),
    ).toEqual([2, 3, 5]);
  });

  test("every table gets 3 different judges; sections follow the order judges were added", async () => {
    const { judges: js, tables } = await setupRoom({
      tableCount: 12,
      judgeCount: 6,
    });
    // 12 tables x 3 = 36 visits / 6 judges = 6 each.
    const sections = await Promise.all(
      js.map(async (j) => (await stopsOf(j.caller)).map((s) => s.table.number)),
    );
    expect(sections).toEqual([
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]);
    for (const t of tables) {
      const here = await db.query.judgingAssignments.findMany({
        where: eq(judgingAssignments.judgingTableId, t.id),
      });
      expect(new Set(here.map((a) => a.judgeId)).size).toBe(3);
    }
  });

  test("positions run in walking order, with a wrap at the end of a pass", async () => {
    const { judges: js } = await setupRoom({
      tableCount: 70,
      rows: 5,
      judgeCount: 35,
    });
    const twelfth = await stopsOf(js[11]!.caller);
    expect(twelfth.map((s) => s.table.number)).toEqual([67, 68, 69, 70, 1, 2]);
    expect(twelfth.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
    // Table 70 sits at the end of the snake's last row.
    expect(twelfth[3]?.table).toMatchObject({ number: 70, row: 4, col: 13 });
  });

  test("fewer judges means more tables each", async () => {
    const { judges: js } = await setupRoom({ tableCount: 10, judgeCount: 3 });
    for (const j of js) {
      expect(await stopsOf(j.caller)).toHaveLength(10);
    }
  });

  test("refuses with fewer than 3 judges", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 4, rows: 1 });
    await makeTeam();
    await org.caller.judging.admin.seatTeams();
    await makeJudge();
    await makeJudge();
    await expect(org.caller.judging.admin.autoAssign()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("a judge added later is a floater until auto-assign is re-run", async () => {
    const { org } = await setupRoom({ tableCount: 6, judgeCount: 3 });
    const late = await makeJudge();
    expect(await stopsOf(late.caller)).toHaveLength(0);
    const progress = await org.caller.judging.admin.getProgress();
    expect(
      progress.judges.find((j) => j.id === late.session.user.id)?.isFloater,
    ).toBe(true);

    const result = await org.caller.judging.admin.autoAssign();
    expect(result.judges).toBe(4);
    expect((await stopsOf(late.caller)).length).toBeGreaterThan(0);
  });

  test("re-running replaces the plan instead of adding to it", async () => {
    const { org } = await setupRoom({ tableCount: 6, judgeCount: 3 });
    await org.caller.judging.admin.autoAssign();
    expect(await db.query.judgingAssignments.findMany({})).toHaveLength(18);
  });

  test("is locked once judging starts", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 7,
    });
    await expect(org.caller.judging.admin.autoAssign()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(
      org.caller.judging.admin.seatTeams({ random: false }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

/* ---------- the judge's flow ---------- */

describe("judge flow", () => {
  test("getMyStops shows each table, its team (no join code) and what's next", async () => {
    const { judges: js, teamIds } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const mine = await js[0]!.caller.judging.me.getMyStops();
    expect(mine.total).toBe(6);
    expect(mine.finished).toBe(0);
    expect(mine.layout).toMatchObject({ tableCount: 6, rows: 1, perRow: 6 });
    const first = mine.stops[0];
    assertDefined(first, "expected a first stop");
    expect(first.table).toMatchObject({ number: 1, row: 0, col: 0 });
    expect(first.team?.id).toBe(teamIds[0]);
    expect(first.team).not.toHaveProperty("joinCode");
    expect(mine.nextStopId).toBe(first.id);
    expect(mine.judge.type).toBe("organizer");
  });

  test("start, then submit: writes the mark with its breakdown and finishes the stop", async () => {
    const { judges: js, teamIds } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const j = js[0]!;
    const stop = await firstStop(j.caller);

    const started = await j.caller.judging.me.startStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
    });
    expect(started.status).toBe("in_progress");
    expect(started.startedAt).toBeInstanceOf(Date);
    expect((await tableByNumber(1)).status).toBe("being_judged");

    const breakdown = {
      ratings: {
        impact: 8,
        creativity: 7.5,
        technical: 9,
        design: 6,
        adventurous: 8.5,
      },
      notes: "Strong demo",
      superLike: true,
    };
    const result = await j.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 7,
      breakdown,
    });
    expect(result.teamId).toBe(teamIds[0]);
    const mark = await db.query.teamMarks.findFirst({
      where: eq(teamMarks.id, result.teamMarkId),
    });
    expect(mark).toMatchObject({
      score: 7,
      roundType: "regular",
      impactRating: 8,
      creativityRating: 7.5,
      technicalRating: 9,
      designRating: 6,
      adventurousRating: 8.5,
      notes: "Strong demo",
      superLike: true,
    });

    const mine = await j.caller.judging.me.getMyStops();
    expect(mine.stops[0]).toMatchObject({
      status: "done",
      mark: { score: 7, ratings: breakdown.ratings, superLike: true },
    });
    const [submitted] = await j.caller.judging.me.getSubmittedTeamMarks();
    expect(submitted?.ratings).toEqual(breakdown.ratings);
    expect(mine.finished).toBe(1);
    expect(mine.nextStopId).toBe(mine.stops[1]?.id);
    // Two other judges still have table 1 to come.
    expect((await tableByNumber(1)).status).toBe("waiting");
  });

  test("a table is finished once all 3 of its judges have scored it", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    for (const j of js) {
      const stop = (await stopsOf(j.caller)).find((s) => s.table.number === 1);
      assertDefined(stop, "expected table 1 in every section");
      await j.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 6,
      });
    }
    expect((await tableByNumber(1)).status).toBe("finished");
  });

  test("submitting straight from assigned is allowed", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const stop = await firstStop(js[0]!.caller);
    await expect(
      js[0]!.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 5,
      }),
    ).resolves.toMatchObject({ assignmentId: stop.id });
  });

  test("sponsor judges get no tables and can't be added to one", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const sponsor = await makeJudge({ type: "sponsored", tracks: ["General"] });
    // Re-run auto-assign with the sponsor judge on the roster.
    const plan = await org.caller.judging.admin.autoAssign();
    expect(plan.judges).toBe(3);
    expect(await stopsOf(sponsor.caller)).toHaveLength(0);
    for (const t of await db.query.judgingTables.findMany({})) {
      const here = await db.query.judgingAssignments.findMany({
        where: eq(judgingAssignments.judgingTableId, t.id),
      });
      expect(here).toHaveLength(3);
    }

    const t1 = await tableByNumber(1);
    await expect(
      org.caller.judging.admin.addJudgeToTable({
        judgeId: sponsor.session.user.id,
        tableId: t1.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      org.caller.judging.admin.handOffJudge({
        fromJudgeId: js[0]!.session.user.id,
        toJudgeId: sponsor.session.user.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("a judge with tables can't be switched to a sponsor judge", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    await expect(
      org.caller.judging.admin.addJudges([
        { id: js[0]!.session.user.id, type: "sponsored", track: ["General"] },
      ]),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // A floater with no tables can be.
    const floater = await makeJudge();
    await expect(
      org.caller.judging.admin.addJudges([
        { id: floater.session.user.id, type: "sponsored", track: ["General"] },
      ]),
    ).resolves.toHaveLength(1);
  });

  test("reporting absent with a stale team is refused; the right team is accepted", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 13,
      teamCount: 12,
      judgeCount: 6,
    });
    const j = js[0]!;
    const first = await firstStop(j.caller);
    await org.caller.judging.admin.swapTeams({
      teamAId: teamIds[0]!,
      teamBId: teamIds[11]!,
    });
    await expect(
      j.caller.judging.me.reportAbsent({
        assignmentId: first.id,
        teamId: first.team!.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      j.caller.judging.me.reportAbsent({
        assignmentId: first.id,
        teamId: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // A judge can only act on their current stop, so retry it with the team
    // seated there now.
    const fresh = await firstStop(j.caller);
    expect(fresh.id).toBe(first.id);
    await expect(
      j.caller.judging.me.reportAbsent({
        assignmentId: fresh.id,
        teamId: fresh.team!.id,
      }),
    ).resolves.toMatchObject({ status: "team_absent" });
  });

  test("auto-assign counts only organizer judges toward the 3 per table", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 3, rows: 1 });
    await makeTeam();
    await org.caller.judging.admin.seatTeams();
    await makeJudge();
    await makeJudge();
    await makeJudge({ type: "sponsored", tracks: ["General"] });
    await expect(org.caller.judging.admin.autoAssign()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("a score is refused if the team at the table changed since the judge looked", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 12,
      judgeCount: 6,
    });
    const j = js[0]!;
    const seen = await firstStop(j.caller); // table 1, team 1
    expect(seen.team?.id).toBe(teamIds[0]);
    await org.caller.judging.admin.swapTeams({
      teamAId: teamIds[0]!,
      teamBId: teamIds[11]!,
    });
    await expect(
      j.caller.judging.me.startStop({
        assignmentId: seen.id,
        teamId: seen.team!.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      j.caller.judging.me.submitStop({
        assignmentId: seen.id,
        teamId: seen.team!.id,
        score: 9,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await db.query.teamMarks.findMany({
        where: eq(teamMarks.judgeId, j.session.user.id),
      }),
    ).toHaveLength(0);

    // After a refresh the judge sees the new team and can score it.
    const fresh = await firstStop(j.caller);
    expect(fresh.team?.id).toBe(teamIds[11]);
    const { teamId } = await j.caller.judging.me.submitStop({
      assignmentId: fresh.id,
      teamId: fresh.team!.id,
      score: 9,
    });
    expect(teamId).toBe(teamIds[11]);
  });

  test("only one stop can be in progress at a time", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const [a, b] = await stopsOf(js[0]!.caller);
    await js[0]!.caller.judging.me.startStop({
      assignmentId: a!.id,
      teamId: a!.team?.id ?? "none",
    });
    await expect(
      js[0]!.caller.judging.me.startStop({
        assignmentId: b!.id,
        teamId: b!.team?.id ?? "none",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("the database allows only one in-progress stop per judge", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const [a, b] = await stopsOf(js[0]!.caller);
    await js[0]!.caller.judging.me.startStop({
      assignmentId: a!.id,
      teamId: a!.team?.id ?? "none",
    });
    // Bypass the app-level check: the unique index is the backstop when two
    // starts race past it.
    await expect(
      db
        .update(judgingAssignments)
        .set({ status: "in_progress" })
        .where(eq(judgingAssignments.id, b!.id)),
    ).rejects.toThrow();
    // Starting the same stop again is a clean conflict, not a crash.
    await expect(
      js[0]!.caller.judging.me.startStop({
        assignmentId: a!.id,
        teamId: a!.team?.id ?? "none",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("hand-off never takes a stop the leaving judge has finished", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const leaving = js[0]!;
    const stops = await stopsOf(leaving.caller);
    for (const stop of stops) {
      await leaving.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 5,
      });
    }
    const floater = await makeJudge();
    await expect(
      org.caller.judging.admin.handOffJudge({
        fromJudgeId: leaving.session.user.id,
        toJudgeId: floater.session.user.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await stopsOf(floater.caller)).toHaveLength(0);
  });

  test("a stop can't be scored twice, and scores must be 0-10", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const stop = await firstStop(js[0]!.caller);
    await expect(
      js[0]!.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 11,
      }),
    ).rejects.toThrow();
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 5,
    });
    await expect(
      js[0]!.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 9,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await db.query.teamMarks.findMany({
        where: eq(teamMarks.judgeId, js[0]!.session.user.id),
      }),
    ).toHaveLength(1);
  });

  test("a manually assigned empty table can only be reported absent", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      teamCount: 2,
      judgeCount: 3,
    });
    const table = await tableByNumber(2);
    await org.caller.judging.admin.addJudgeToTable({
      judgeId: js[0]!.session.user.id,
      tableId: table.id,
    });
    const stops = await stopsOf(js[0]!.caller);
    const empty = stops.find((s) => s.table.number === 2);
    assertDefined(empty, "expected table 2 in the section");
    // A judge only acts on their current stop: cancel the ones before it.
    for (const s of stops.slice(0, stops.indexOf(empty))) {
      await org.caller.judging.admin.cancelStop({ assignmentId: s.id });
    }
    expect(empty.team).toBeNull();
    await expect(
      js[0]!.caller.judging.me.submitStop({
        assignmentId: empty.id,
        teamId: empty.team?.id ?? "none",
        score: 5,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const row = await js[0]!.caller.judging.me.reportAbsent({
      assignmentId: empty.id,
    });
    expect(row.status).toBe("team_absent");
  });

  test("judges can't touch another judge's stops", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const stop = await firstStop(js[0]!.caller);
    await expect(
      js[1]!.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 5,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      js[1]!.caller.judging.me.reportAbsent({ assignmentId: stop.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

/* ---------- day-of fixes ---------- */

describe("swapTeams / moveTeam", () => {
  test("a swap moves each team into the other's judges' lineup", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 12,
      judgeCount: 6,
    });
    // Judge 1 has tables 1-6; team 12 sits at table 12.
    await org.caller.judging.admin.swapTeams({
      teamAId: teamIds[0]!,
      teamBId: teamIds[11]!,
    });
    const first = await firstStop(js[0]!.caller);
    expect(first.table.number).toBe(1);
    expect(first.team?.id).toBe(teamIds[11]);
  });

  test("swaps are locked once judging has started at either table", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.startStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
    });
    await expect(
      org.caller.judging.admin.swapTeams({
        teamAId: teamIds[0]!,
        teamBId: teamIds[5]!,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Tables nobody has started at can still swap.
    await expect(
      org.caller.judging.admin.swapTeams({
        teamAId: teamIds[2]!,
        teamBId: teamIds[4]!,
      }),
    ).resolves.toBeDefined();
  });

  test("moveTeam needs an empty active table", async () => {
    const {
      org,
      teamIds,
      judges: js,
    } = await setupRoom({
      tableCount: 4,
      teamCount: 3,
      judgeCount: 3,
    });
    const t2 = await tableByNumber(2);
    const t4 = await tableByNumber(4);
    await expect(
      org.caller.judging.admin.moveTeam({
        teamId: teamIds[0]!,
        tableId: t2.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await org.caller.judging.admin.moveTeam({
      teamId: teamIds[0]!,
      tableId: t4.id,
    });
    expect((await tableByNumber(1)).status).toBe("empty");
    expect((await tableByNumber(4)).status).toBe("waiting");
    for (const judge of js) {
      const stops = await stopsOf(judge.caller);
      expect(stops.map((stop) => stop.table.number)).toEqual([4, 2, 3]);
      expect(stops[0]?.team?.id).toBe(teamIds[0]);
    }
  });
});

describe("handOffJudge / addJudgeToTable / cancel / absent", () => {
  test("a leaving judge's unfinished tables go to a floater, in order", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const leaving = js[0]!;
    const [done, current] = await stopsOf(leaving.caller);
    await leaving.caller.judging.me.submitStop({
      assignmentId: done!.id,
      teamId: done!.team?.id ?? "none",
      score: 6,
    });
    await leaving.caller.judging.me.startStop({
      assignmentId: current!.id,
      teamId: current!.team?.id ?? "none",
    });

    const floater = await makeJudge();
    const result = await org.caller.judging.admin.handOffJudge({
      fromJudgeId: leaving.session.user.id,
      toJudgeId: floater.session.user.id,
    });
    expect(result.moved).toBe(5);

    const theirs = await stopsOf(floater.caller);
    expect(theirs.map((s) => s.table.number)).toEqual(result.tables);
    // The in-progress stop starts over for the new judge.
    expect(theirs.every((s) => s.status === "assigned")).toBe(true);
    // The finished stop stays with the judge who scored it.
    expect((await stopsOf(leaving.caller)).map((s) => s.status)).toEqual([
      "done",
    ]);
  });

  test("hand-off refuses a judge who already scored a team at those tables", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    // The floater already has a mark for team 1 (table 1, in judge 1's
    // section), e.g. from an earlier plan.
    const floater = await makeJudge();
    await db.insert(teamMarks).values({
      teamId: teamIds[0]!,
      judgeId: floater.session.user.id,
      score: 5,
    });
    await expect(
      org.caller.judging.admin.handOffJudge({
        fromJudgeId: js[0]!.session.user.id,
        toJudgeId: floater.session.user.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await stopsOf(floater.caller)).toHaveLength(0);
  });

  test("hand-off refuses a judge who already has those tables", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    await expect(
      org.caller.judging.admin.handOffJudge({
        fromJudgeId: js[0]!.session.user.id,
        toJudgeId: js[1]!.session.user.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("addJudgeToTable tops a table up, but never twice or for a team already scored", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 6,
      judgeCount: 3,
    });
    const extra = await makeJudge();
    const t4 = await tableByNumber(4);
    const added = await org.caller.judging.admin.addJudgeToTable({
      judgeId: extra.session.user.id,
      tableId: t4.id,
    });
    expect(added).toMatchObject({
      tableNumber: 4,
      position: 1,
      status: "assigned",
    });
    await expect(
      org.caller.judging.admin.addJudgeToTable({
        judgeId: extra.session.user.id,
        tableId: t4.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Judge 1 scores table 1, then is cancelled off it and re-added.
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 6,
    });
    const t1 = await tableByNumber(1);
    await expect(
      org.caller.judging.admin.addJudgeToTable({
        judgeId: js[0]!.session.user.id,
        tableId: t1.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("organizers can cancel or mark absent an open stop, not a finished one", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const [a, b, c] = await stopsOf(js[0]!.caller);
    await org.caller.judging.admin.cancelStop({ assignmentId: a!.id });
    await org.caller.judging.admin.markAbsent({ assignmentId: b!.id });
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: c!.id,
      teamId: c!.team?.id ?? "none",
      score: 5,
    });
    await expect(
      org.caller.judging.admin.cancelStop({ assignmentId: c!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Cancelled stops drop off the judge's list.
    expect((await stopsOf(js[0]!.caller)).map((s) => s.status)).toEqual([
      "team_absent",
      "done",
    ]);
  });
});

/* ---------- current stop, final absence, no-show ---------- */

describe("current stop", () => {
  test("a judge can't start, submit or report absent a stop that isn't current", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const [, second] = await stopsOf(js[0]!.caller);
    assertDefined(second, "expected a second stop");
    const conflict = { code: "CONFLICT" };
    await expect(
      js[0]!.caller.judging.me.startStop({
        assignmentId: second.id,
        teamId: second.team?.id ?? "none",
      }),
    ).rejects.toMatchObject(conflict);
    await expect(
      js[0]!.caller.judging.me.submitStop({
        assignmentId: second.id,
        teamId: second.team?.id ?? "none",
        score: 5,
      }),
    ).rejects.toMatchObject(conflict);
    await expect(
      js[0]!.caller.judging.me.reportAbsent({
        assignmentId: second.id,
        teamId: second.team?.id ?? null,
      }),
    ).rejects.toMatchObject(conflict);
  });
});

describe("absence is final", () => {
  test("one absent report closes every open stop at that table", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.reportAbsent({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? null,
    });
    const here = await db.query.judgingAssignments.findMany({
      where: eq(judgingAssignments.judgingTableId, stop.table.id),
    });
    expect(here.length).toBeGreaterThan(1);
    expect(here.every((a) => a.status === "team_absent")).toBe(true);

    // The table is closed to top-ups too.
    const extra = await makeJudge();
    await expect(
      org.caller.judging.admin.addJudgeToTable({
        judgeId: extra.session.user.id,
        tableId: stop.table.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("deleting a mark doesn't reopen a stop at an absent table", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 6,
    });
    const otherStop = (await stopsOf(js[1]!.caller)).find(
      (s) => s.table.id === stop.table.id,
    );
    assertDefined(otherStop, "expected another judge at the table");
    await org.caller.judging.admin.markAbsent({ assignmentId: otherStop.id });

    const mark = await db.query.teamMarks.findFirst({
      where: eq(teamMarks.judgeId, js[0]!.session.user.id),
    });
    assertDefined(mark, "expected a mark");
    const result = await org.caller.judging.admin.deleteTeamMark({
      teamMarkId: mark.id,
    });
    expect(result).toMatchObject({ reopened: false });
  });

  test("hand-off leaves stops at an absent table behind", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const leaving = js[0]!;
    const stops = await stopsOf(leaving.caller);
    await org.caller.judging.admin.markAbsent({
      assignmentId: stops[1]!.id,
    });
    const floater = await makeJudge();
    const result = await org.caller.judging.admin.handOffJudge({
      fromJudgeId: leaving.session.user.id,
      toJudgeId: floater.session.user.id,
    });
    expect(result.moved).toBe(stops.length - 1);
    expect(
      (await stopsOf(floater.caller)).map((s) => s.table.id),
    ).not.toContain(stops[1]!.table.id);
  });

  test("an absent team is left out of the ranking and of judge averages", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({ tableCount: 2, judgeCount: 3 });
    const [t1, t2] = teamIds as [string, string];
    const atT2 = (await stopsOf(js[0]!.caller)).find((s) => s.team?.id === t2);
    assertDefined(atT2, "expected a stop at team 2");
    await org.caller.judging.admin.markAbsent({ assignmentId: atT2.id });
    for (const judge of js) {
      for (const stop of await stopsOf(judge.caller)) {
        if (stop.status !== "assigned") continue;
        await judge.caller.judging.me.submitStop({
          assignmentId: stop.id,
          teamId: stop.team?.id ?? "none",
          score: 6,
        });
      }
    }
    const ranking = await org.caller.judging.admin.getLatestRanking();
    expect(ranking.map((r) => r.team_id)).toEqual([t1]);
  });

  test("getMyJudging tells a team it was reported absent", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const session = await mockSession(db);
    await db
      .update(users)
      .set({ teamId: teamIds[0] })
      .where(eq(users.id, session.user.id));
    const hacker = createCaller(createInnerTRPCContext({ session }));
    const stop = await firstStop(js[0]!.caller);
    expect(stop.team?.id).toBe(teamIds[0]);
    await org.caller.judging.admin.markAbsent({ assignmentId: stop.id });
    expect(await hacker.judging.team.getMyJudging()).toMatchObject({
      absent: true,
    });
  });
});

describe("setJudgeNoShow", () => {
  test("auto-assign skips a no-show judge", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 4,
    });
    const gone = js[3]!;
    await org.caller.judging.admin.setJudgeNoShow({
      judgeId: gone.session.user.id,
      noShow: true,
    });
    await org.caller.judging.admin.autoAssign();
    expect(await stopsOf(gone.caller)).toHaveLength(0);
    const judgesQ = await org.caller.judging.admin.getAllJudges();
    expect(judgesQ.find((j) => j.id === gone.session.user.id)?.noShow).toBe(
      true,
    );
  });

  test("before judging starts, marking a judge with stops clears the plan", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const result = await org.caller.judging.admin.setJudgeNoShow({
      judgeId: js[0]!.session.user.id,
      noShow: true,
    });
    expect(result.planCleared).toBeGreaterThan(0);
    expect(await db.query.judgingAssignments.findMany()).toHaveLength(0);
  });

  test("after judging starts, a judge with open stops must hand them off first", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const stop = await firstStop(js[1]!.caller);
    await js[1]!.caller.judging.me.startStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
    });
    await expect(
      org.caller.judging.admin.setJudgeNoShow({
        judgeId: js[0]!.session.user.id,
        noShow: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("a no-show judge can't take a hand-off or a top-up", async () => {
    const {
      org,
      judges: js,
      tables,
    } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const gone = await makeJudge();
    await org.caller.judging.admin.setJudgeNoShow({
      judgeId: gone.session.user.id,
      noShow: true,
    });
    await expect(
      org.caller.judging.admin.handOffJudge({
        fromJudgeId: js[0]!.session.user.id,
        toJudgeId: gone.session.user.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      org.caller.judging.admin.addJudgeToTable({
        judgeId: gone.session.user.id,
        tableId: tables[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

/* ---------- marks ---------- */

describe("editTeamMark / deleteTeamMark", () => {
  test("editTeamMark adjusts the score, breakdown and judge aggregates", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const j = js[0]!;
    const stop = await firstStop(j.caller);
    const { teamMarkId } = await j.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 5,
    });
    await j.caller.judging.me.editTeamMark({
      teamMarkId,
      score: 9,
      breakdown: { ratings: { impact: 9 } },
    });
    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
    expect(row).toMatchObject({
      marksCount: 1,
      marksSum: 9,
      marksSquaredSum: 81,
    });
    const mark = await db.query.teamMarks.findFirst({
      where: eq(teamMarks.id, teamMarkId),
    });
    // An edit with a breakdown rewrites every rubric column.
    expect(mark).toMatchObject({
      impactRating: 9,
      creativityRating: null,
      technicalRating: null,
      designRating: null,
      adventurousRating: null,
      notes: null,
      superLike: false,
    });

    // A criterion with no column is rejected rather than silently dropped.
    await expect(
      j.caller.judging.me.editTeamMark({
        teamMarkId,
        score: 9,
        breakdown: { ratings: { pitch: 9 } as never },
      }),
    ).rejects.toThrow();
  });

  test("editTeamMark only edits your own marks", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    const stop = await firstStop(js[0]!.caller);
    const { teamMarkId } = await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 5,
    });
    await expect(
      js[1]!.caller.judging.me.editTeamMark({ teamMarkId, score: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("deleteTeamMark reverses the aggregates and reopens the stop for a re-score", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const j = js[0]!;
    const stop = await firstStop(j.caller);
    const { teamMarkId } = await j.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 6,
    });
    const result = await org.caller.judging.admin.deleteTeamMark({
      teamMarkId,
    });
    expect(result.reopened).toBe(true);

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
    expect(row).toMatchObject({
      marksCount: 0,
      marksSum: 0,
      marksSquaredSum: 0,
    });
    const again = await firstStop(j.caller);
    expect(again).toMatchObject({
      id: stop.id,
      status: "assigned",
      mark: null,
    });
    await expect(
      j.caller.judging.me.submitStop({
        assignmentId: stop.id,
        teamId: stop.team?.id ?? "none",
        score: 8,
      }),
    ).resolves.toBeDefined();
  });
});

/* ---------- reads ---------- */

describe("getProgress / getAllJudges / getMyJudging", () => {
  test("getProgress has the layout, each table's judges and totals", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 6,
      rows: 2,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 6,
    });
    const next = await firstStop(js[1]!.caller);
    await js[1]!.caller.judging.me.startStop({
      assignmentId: next.id,
      teamId: next.team?.id ?? "none",
    });

    const p = await org.caller.judging.admin.getProgress();
    expect(p.settings).toMatchObject({ tableCount: 6, rows: 2, perRow: 3 });
    expect(p.started).toBe(true);
    expect(p.teams).toEqual({ submitted: 6, seated: 6 });
    expect(p.totals).toEqual({
      assigned: 16,
      in_progress: 1,
      done: 1,
      team_absent: 0,
    });
    const t1 = p.tables.find((t) => t.number === 1);
    expect(t1).toMatchObject({ judgesDone: 1, row: 0, col: 0 });
    expect(t1?.judges).toHaveLength(3);
    // Table 4 starts row 2 on the right-hand side.
    expect(p.tables.find((t) => t.number === 4)).toMatchObject({
      row: 1,
      col: 2,
    });
    const busy = p.judges.find((j) => j.id === js[1]!.session.user.id);
    expect(busy?.current?.tableNumber).toBe(next.table.number);
  });

  test("getAllJudges shows the team each judge is at right now", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.startStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
    });
    const roster = await org.caller.judging.admin.getAllJudges();
    const row = roster.find((j) => j.id === js[0]!.session.user.id);
    expect(row).toMatchObject({
      currentTeamId: teamIds[0],
      currentTableNumber: 1,
    });
    expect(
      roster.find((j) => j.id === js[1]!.session.user.id)?.currentTeamId,
    ).toBeNull();
  });

  test("getMyJudging shows a hacker their table and N of 3 judges done", async () => {
    const { judges: js, teamIds } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    const session = await mockSession(db);
    await db
      .update(users)
      .set({ teamId: teamIds[0] })
      .where(eq(users.id, session.user.id));
    const hacker = createCaller(createInnerTRPCContext({ session }));

    const stop = await firstStop(js[0]!.caller);
    await js[0]!.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 6,
    });
    expect(await hacker.judging.team.getMyJudging()).toEqual({
      table: { number: 1, zone: "Main room", row: 0, col: 0 },
      absent: false,
      judges: { done: 1, total: 3 },
    });
  });
});

/* ---------- cheat check ---------- */

describe("cheat check sweep trigger", () => {
  test("finishing every stop starts exactly one sweep with an item per eligible team", async () => {
    const { judges: js, teamIds } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    await scoreAll(js[0]!, 6);
    await scoreAll(js[1]!, 6);
    expect(await db.query.cheatCheckSweeps.findMany({})).toHaveLength(0);

    await scoreAll(js[2]!, 6);
    const sweeps = await db.query.cheatCheckSweeps.findMany({});
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]).toMatchObject({
      status: "running",
      triggeredBy: "judging_complete",
      totalTeams: 3,
    });
    const items = await db.query.cheatCheckSweepItems.findMany({});
    expect(items.map((i) => i.teamId).sort()).toEqual([...teamIds].sort());
  });

  test("absent and cancelled stops count as finished", async () => {
    const { org, judges: js } = await setupRoom({
      tableCount: 3,
      judgeCount: 3,
    });
    await scoreAll(js[0]!, 6);
    await scoreAll(js[1]!, 6);
    const [a, b, c] = await stopsOf(js[2]!.caller);
    await js[2]!.caller.judging.me.reportAbsent({ assignmentId: a!.id });
    await org.caller.judging.admin.markAbsent({ assignmentId: b!.id });
    await org.caller.judging.admin.cancelStop({ assignmentId: c!.id });
    expect(await db.query.cheatCheckSweeps.findMany({})).toHaveLength(1);
  });

  test("teams without a repo or DevPost link get no sweep item", async () => {
    const org = await makeOrganizer();
    await org.caller.judging.admin.setupTables({ tableCount: 3, rows: 1 });
    const linked = await makeTeam({
      submittedAt: new Date("2026-11-20T08:00Z"),
    });
    await makeTeam({
      devpost: false,
      submittedAt: new Date("2026-11-20T09:00Z"),
    });
    await org.caller.judging.admin.seatTeams({ random: false });
    const js = [await makeJudge(), await makeJudge(), await makeJudge()];
    await org.caller.judging.admin.autoAssign();
    for (const j of js) {
      for (const stop of await stopsOf(j.caller)) {
        if (stop.team) {
          await j.caller.judging.me.submitStop({
            assignmentId: stop.id,
            teamId: stop.team?.id ?? "none",
            score: 5,
          });
        } else {
          await j.caller.judging.me.reportAbsent({ assignmentId: stop.id });
        }
      }
    }
    const [sweep] = await db.query.cheatCheckSweeps.findMany({});
    expect(sweep?.totalTeams).toBe(1);
    const items = await db.query.cheatCheckSweepItems.findMany({});
    expect(items.map((i) => i.teamId)).toEqual([linked]);
  });

  test("a sweep that finished recently suppresses the next one", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    await db.insert(cheatCheckSweeps).values({
      triggeredBy: "manual",
      status: "completed",
      finishedAt: new Date(Date.now() - 60_000),
    });
    for (const j of js) await scoreAll(j, 6);
    const sweeps = await db.query.cheatCheckSweeps.findMany({});
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]?.triggeredBy).toBe("manual");
  });

  test("an already-running sweep is not duplicated", async () => {
    const { judges: js } = await setupRoom({ tableCount: 3, judgeCount: 3 });
    await db
      .insert(cheatCheckSweeps)
      .values({ triggeredBy: "manual", status: "running" });
    for (const j of js) await scoreAll(j, 6);
    expect(await db.query.cheatCheckSweeps.findMany({})).toHaveLength(1);
  });

  test("the partial unique index permits only one running sweep", async () => {
    await db
      .insert(cheatCheckSweeps)
      .values({ triggeredBy: "manual", status: "running" });
    await expect(
      db
        .insert(cheatCheckSweeps)
        .values({ triggeredBy: "judging_complete", status: "running" }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(cheatCheckSweeps)
        .values({ triggeredBy: "manual", status: "completed" }),
    ).resolves.toBeDefined();
  });
});

/* ---------- ranking ---------- */

describe("getLatestRanking", () => {
  test("normalizes by each judge's mean AND std dev; sponsored judges excluded", async () => {
    // 2 tables, 3 judges: every judge scores both teams.
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 2,
      judgeCount: 3,
    });
    const [t1, t2] = teamIds as [string, string];
    const scoreBoth = async (judge: Judge, s1: number, s2: number) => {
      for (const stop of await stopsOf(judge.caller)) {
        await judge.caller.judging.me.submitStop({
          assignmentId: stop.id,
          teamId: stop.team?.id ?? "none",
          score: stop.team?.id === t1 ? s1 : s2,
        });
      }
    };
    // harsh:    t1=4, t2=2 -> mean 3, sigma 1 -> z = +1, -1
    // generous: t1=9, t2=7 -> mean 8, sigma 1 -> z = +1, -1
    // middle:   t1=6, t2=4 -> mean 5, sigma 1 -> z = +1, -1
    await scoreBoth(js[0]!, 4, 2);
    await scoreBoth(js[1]!, 9, 7);
    await scoreBoth(js[2]!, 6, 4);
    // A sponsored judge's marks never count toward the ranking.
    const sponsor = await makeJudge({ type: "sponsored", tracks: ["General"] });
    await db.insert(teamMarks).values({
      teamId: t2,
      judgeId: sponsor.session.user.id,
      score: 10,
      roundType: "sponsored",
    });

    const ranking = await org.caller.judging.admin.getLatestRanking();
    const byTeam = new Map(
      ranking.map((r) => [r.team_id, Number(r.normalized_score)]),
    );
    expect(byTeam.get(t1)).toBeCloseTo(1, 5);
    expect(byTeam.get(t2)).toBeCloseTo(-1, 5);
    expect(ranking[0]?.team_id).toBe(t1);
    expect(Number(ranking[0]?.num_marks)).toBe(3);
  });
});

/* ---------- table status trigger ---------- */

describe("judging_table.status trigger", () => {
  test("tracks seating, judging and swaps", async () => {
    const {
      org,
      judges: js,
      teamIds,
    } = await setupRoom({
      tableCount: 4,
      teamCount: 3,
      judgeCount: 3,
    });
    expect((await tableByNumber(3)).status).toBe("waiting");
    expect((await tableByNumber(4)).status).toBe("empty");

    // Team 2 moves to table 4: table 3 empties, table 4 fills.
    const t4 = await tableByNumber(4);
    await org.caller.judging.admin.moveTeam({
      teamId: teamIds[1]!,
      tableId: t4.id,
    });
    expect((await tableByNumber(3)).status).toBe("empty");
    expect((await tableByNumber(4)).status).toBe("waiting");

    // A cancelled stop doesn't count; a table whose stops are all cancelled waits.
    const atTable2 = await db.query.judgingAssignments.findMany({
      where: and(
        eq(judgingAssignments.judgingTableId, (await tableByNumber(2)).id),
      ),
    });
    for (const a of atTable2) {
      await org.caller.judging.admin.cancelStop({ assignmentId: a.id });
    }
    expect((await tableByNumber(2)).status).toBe("waiting");

    // Every stop at table 1 finishes: finished.
    for (const j of js) {
      const stop = (await stopsOf(j.caller)).find((s) => s.table.number === 1);
      if (stop)
        await j.caller.judging.me.submitStop({
          assignmentId: stop.id,
          teamId: stop.team?.id ?? "none",
          score: 5,
        });
    }
    expect((await tableByNumber(1)).status).toBe("finished");
  });
});

/* ---------- judges ---------- */

describe("addJudges", () => {
  test("promotes a user to an organizer judge (default type)", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);

    const added = await org.caller.judging.admin.addJudges([
      { id: user.user.id },
    ]);
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe(user.user.id);
    expect(added[0]?.type).toBe("organizer");

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, user.user.id),
    });
    expect(row?.type).toBe("organizer");
  });

  test("adds multiple judges at once (organizer + sponsored)", async () => {
    const org = await makeOrganizer();
    const u1 = await mockSession(db);
    const u2 = await mockSession(db);

    const added = await org.caller.judging.admin.addJudges([
      { id: u1.user.id },
      { id: u2.user.id, type: "sponsored", track: ["Best Domain"] },
    ]);
    expect(added).toHaveLength(2);

    const rows = await db.query.judges.findMany({});
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(u1.user.id)?.type).toBe("organizer");
    expect(byId.get(u2.user.id)?.type).toBe("sponsored");
    expect(byId.get(u2.user.id)?.track).toEqual(["Best Domain"]);
  });

  test("rejects a sponsored judge with no tracks", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);

    await expect(
      org.caller.judging.admin.addJudges([
        { id: user.user.id, type: "sponsored" },
      ]),
    ).rejects.toThrow();
  });

  test("rejects an empty user id at input validation", async () => {
    const org = await makeOrganizer();

    await expect(
      org.caller.judging.admin.addJudges([{ id: "" }]),
    ).rejects.toThrow();
  });

  test("is all-or-nothing: one unknown user rolls back the whole batch", async () => {
    const org = await makeOrganizer();
    const valid = await mockSession(db);

    await expect(
      org.caller.judging.admin.addJudges([
        { id: valid.user.id },
        { id: "does-not-exist" },
      ]),
    ).rejects.toThrow(/not found/i);

    // The valid user must NOT have been inserted.
    const row = await db.query.judges.findFirst({
      where: eq(judges.id, valid.user.id),
    });
    expect(row).toBeUndefined();
  });

  test("upserts: re-adding updates type and tracks without duplicating", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);

    await org.caller.judging.admin.addJudges([{ id: user.user.id }]);
    const [updated] = await org.caller.judging.admin.addJudges([
      { id: user.user.id, type: "sponsored", track: ["Best Use of Cohere"] },
    ]);
    expect(updated?.type).toBe("sponsored");
    expect(updated?.track).toEqual(["Best Use of Cohere"]);

    const rows = await db.query.judges.findMany({
      where: eq(judges.id, user.user.id),
    });
    expect(rows).toHaveLength(1);
  });

  test("rejects non-organizer callers", async () => {
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    const target = await mockSession(db);

    await expect(
      caller.judging.admin.addJudges([{ id: target.user.id }]),
    ).rejects.toThrow();
  });
});

/* ---------- addJudgeByEmail (control room form) ---------- */

describe("addJudgeByEmail", () => {
  test("finds the account case-insensitively and makes it an organizer judge", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);
    const email = user.user.email;
    assertDefined(email, "mock user should have an email");

    const added = await org.caller.judging.admin.addJudgeByEmail({
      email: `  ${email.toUpperCase()}  `,
    });
    expect(added.id).toBe(user.user.id);
    expect(added.type).toBe("organizer");

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, user.user.id),
    });
    expect(row?.type).toBe("organizer");
  });

  test("upserts: re-adding by email switches the judge to sponsored", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);
    const email = user.user.email;
    assertDefined(email, "mock user should have an email");

    await org.caller.judging.admin.addJudgeByEmail({ email });
    const updated = await org.caller.judging.admin.addJudgeByEmail({
      email,
      type: "sponsored",
      track: ["Best Domain"],
    });
    expect(updated.type).toBe("sponsored");
    expect(updated.track).toEqual(["Best Domain"]);

    const rows = await db.query.judges.findMany({
      where: eq(judges.id, user.user.id),
    });
    expect(rows).toHaveLength(1);
  });

  test("an unknown email is a friendly NOT_FOUND and writes nothing", async () => {
    const org = await makeOrganizer();

    await expect(
      org.caller.judging.admin.addJudgeByEmail({
        email: "nobody-here@example.com",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No Hack Western account with that email.",
    });
    expect(await db.query.judges.findMany({})).toHaveLength(0);
  });

  test("rejects a sponsored judge with no tracks", async () => {
    const org = await makeOrganizer();
    const user = await mockSession(db);
    const email = user.user.email;
    assertDefined(email, "mock user should have an email");

    await expect(
      org.caller.judging.admin.addJudgeByEmail({ email, type: "sponsored" }),
    ).rejects.toThrow();
    expect(await db.query.judges.findMany({})).toHaveLength(0);
  });

  test("rejects non-organizer callers", async () => {
    const session = await mockSession(db);
    const caller = createCaller(createInnerTRPCContext({ session }));
    const target = await mockSession(db);
    const email = target.user.email;
    assertDefined(email, "mock user should have an email");

    await expect(
      caller.judging.admin.addJudgeByEmail({ email }),
    ).rejects.toThrow();
  });
});

/* ---------- getLatestRanking (normalization) ---------- */

/* ---------- stat maintenance across judge reassignment ---------- */

/**
 * These bypass the router deliberately. Reassignment can't happen through the
 * application, so the point is that the aggregates survive it when it arrives
 * from somewhere else — an admin fixing data by hand, most likely.
 */
describe("team_mark stat maintenance", () => {
  test("reassigning judge_id moves the mark between both judges' aggregates", async () => {
    const teamId = await makeTeam();
    const a = await makeJudge();
    const b = await makeJudge();
    await db
      .insert(teamMarks)
      .values({ teamId, judgeId: a.session.user.id, score: 4 });

    await db
      .update(teamMarks)
      .set({ judgeId: b.session.user.id })
      .where(eq(teamMarks.teamId, teamId));

    const rowA = await db.query.judges.findFirst({
      where: eq(judges.id, a.session.user.id),
    });
    const rowB = await db.query.judges.findFirst({
      where: eq(judges.id, b.session.user.id),
    });
    // A is emptied out, B gains the mark whole — counts included.
    expect(rowA?.marksCount).toBe(0);
    expect(rowA?.marksSum).toBe(0);
    expect(rowA?.marksSquaredSum).toBe(0);
    expect(rowB?.marksCount).toBe(1);
    expect(rowB?.marksSum).toBe(4);
    expect(rowB?.marksSquaredSum).toBe(16);
  });

  test("reassigning judge_id and score together stays consistent", async () => {
    const teamId = await makeTeam();
    const a = await makeJudge();
    const b = await makeJudge();
    await db
      .insert(teamMarks)
      .values({ teamId, judgeId: a.session.user.id, score: 4 });

    await db
      .update(teamMarks)
      .set({ judgeId: b.session.user.id, score: 9 })
      .where(eq(teamMarks.teamId, teamId));

    const rowA = await db.query.judges.findFirst({
      where: eq(judges.id, a.session.user.id),
    });
    const rowB = await db.query.judges.findFirst({
      where: eq(judges.id, b.session.user.id),
    });
    // A loses the old score, B gains the new one — not a delta between them.
    expect(rowA?.marksCount).toBe(0);
    expect(rowA?.marksSum).toBe(0);
    expect(rowB?.marksCount).toBe(1);
    expect(rowB?.marksSum).toBe(9);
    expect(rowB?.marksSquaredSum).toBe(81);
  });

  test("editing only the score is still a delta on one judge", async () => {
    const teamId = await makeTeam();
    const j = await makeJudge();
    await db
      .insert(teamMarks)
      .values({ teamId, judgeId: j.session.user.id, score: 4 });

    await db
      .update(teamMarks)
      .set({ score: 9 })
      .where(eq(teamMarks.teamId, teamId));

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, j.session.user.id),
    });
    expect(row?.marksCount).toBe(1);
    expect(row?.marksSum).toBe(9);
    expect(row?.marksSquaredSum).toBe(81);
  });
});

/* ---------- rounds ---------- */

describe("timed rounds", () => {
  async function roundsRoom() {
    const room = await setupRoom({ tableCount: 4, judgeCount: 3 });
    await room.org.caller.judging.admin.setRoundConfig({ roundsEnabled: true });
    return room;
  }
  const stopAt = async (judge: Judge, position: number) => {
    const stop = (await stopsOf(judge.caller)).find(
      (s) => s.position === position,
    );
    assertDefined(stop, `expected a stop at position ${position}`);
    return stop;
  };
  const score = (judge: Judge, stop: Awaited<ReturnType<typeof stopAt>>) =>
    judge.caller.judging.me.submitStop({
      assignmentId: stop.id,
      teamId: stop.team?.id ?? "none",
      score: 5,
    });

  test("nothing can be scored before round 1 starts", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    await expect(score(judge, await stopAt(judge, 1))).rejects.toThrow(
      /start round 1/i,
    );
    await expect(
      judge.caller.judging.me.startStop({
        assignmentId: (await stopAt(judge, 1)).id,
        teamId: (await stopAt(judge, 1)).team?.id ?? "none",
      }),
    ).rejects.toThrow(/start round 1/i);
  });

  test("only the current round's stop can be scored", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const state = await room.org.caller.judging.admin.startRound();
    expect(state).toMatchObject({ round: 1, status: "running" });

    await expect(score(judge, await stopAt(judge, 2))).rejects.toThrow(
      /round 2/i,
    );
    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();
  });

  test("time running out closes the round, and the next needs an organizer", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    await room.org.caller.judging.admin.startRound();
    // The timer hits 0.
    await db
      .update(judgingRound)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(judgingRound.id, 1));

    const seen = await judge.caller.judging.me.getMyStops();
    expect(seen.round).toMatchObject({ round: 1, status: "closed" });
    // The judge can still finish the team late.
    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();

    const next = await room.org.caller.judging.admin.startRound();
    expect(next).toMatchObject({ round: 2, status: "running" });
    await expect(score(judge, await stopAt(judge, 2))).resolves.toBeDefined();
  });

  test("pausing stops the clock but scoring still works; resume continues", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    await room.org.caller.judging.admin.startRound();
    const paused = await room.org.caller.judging.admin.pauseRound();
    expect(paused.status).toBe("paused");
    expect(paused.remainingMs).toBeGreaterThan(0);
    expect(paused.endsAt).toBeNull();

    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();
    const resumed = await room.org.caller.judging.admin.resumeRound();
    expect(resumed.status).toBe("running");
    expect(resumed.endsAt).not.toBeNull();
  });

  test("ending a round still allows late scores; rounds can't overlap or pass the last", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const admin = room.org.caller.judging.admin;
    await admin.startRound();
    await expect(admin.startRound()).rejects.toThrow(/still open/i);

    await admin.endRound();
    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();

    for (const n of [2, 3, 4]) {
      expect((await admin.startRound()).round).toBe(n);
      await admin.endRound();
    }
    await expect(admin.startRound()).rejects.toThrow(/last round/i);
    expect(await admin.resetRounds()).toMatchObject({
      round: 0,
      status: "idle",
    });
  });

  test("round length is validated", async () => {
    const room = await roundsRoom();
    const admin = room.org.caller.judging.admin;
    await expect(admin.setRoundConfig({ roundSeconds: 5 })).rejects.toThrow();
    const state = await admin.setRoundConfig({ roundSeconds: 120 });
    expect(state.roundSeconds).toBe(120);
  });

  test("a judge who runs out of time is released, and can start next round", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const admin = room.org.caller.judging.admin;
    await admin.startRound();
    const first = await stopAt(judge, 1);
    await judge.caller.judging.me.startStop({
      assignmentId: first.id,
      teamId: first.team?.id ?? "none",
    });
    expect((await stopAt(judge, 1)).status).toBe("in_progress");

    // Time runs out with the judge still mid-score.
    await db
      .update(judgingRound)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(judgingRound.id, 1));
    const overview = await admin.getRound();
    expect(overview.status).toBe("closed");
    expect(overview.stops.inProgress).toBe(0);
    expect((await stopAt(judge, 1)).status).toBe("assigned");
    expect((await tableByNumber(first.table.number)).status).not.toBe(
      "being_judged",
    );

    // The next round isn't blocked by the unfinished stop.
    await admin.startRound();
    const second = await stopAt(judge, 2);
    await expect(
      judge.caller.judging.me.startStop({
        assignmentId: second.id,
        teamId: second.team?.id ?? "none",
      }),
    ).resolves.toBeDefined();

    // The missed team can still be scored late, during a later round.
    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();
    expect((await stopAt(judge, 1)).status).toBe("done");
  });

  test("ending a round releases judges still mid-score", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const admin = room.org.caller.judging.admin;
    await admin.startRound();
    const first = await stopAt(judge, 1);
    await judge.caller.judging.me.startStop({
      assignmentId: first.id,
      teamId: first.team?.id ?? "none",
    });
    await admin.endRound();
    expect((await stopAt(judge, 1)).status).toBe("assigned");
  });

  test("clearing assignments goes back to before assignment, but not once judging has started", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const admin = room.org.caller.judging.admin;
    await admin.startRound();

    const result = await admin.clearAssignments();
    expect(result.removed).toBeGreaterThan(0);
    expect(await stopsOf(judge.caller)).toHaveLength(0);
    expect(await admin.getRound()).toMatchObject({
      round: 0,
      status: "idle",
      totalRounds: 0,
    });
    // Teams stay seated and the plan can be made again.
    await admin.autoAssign();
    expect((await stopsOf(judge.caller)).length).toBeGreaterThan(0);

    // Once a stop is scored the plan is locked.
    await admin.startRound();
    await score(judge, await stopAt(judge, 1));
    await expect(admin.clearAssignments()).rejects.toThrow(/started/i);
    expect((await admin.getRound()).judgingStarted).toBe(true);
  });

  test("hackers only see the rounds board while an organizer turns it on, without judge identities or scores", async () => {
    const room = await roundsRoom();
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    const admin = room.org.caller.judging.admin;
    await admin.startRound();
    await score(judge, await stopAt(judge, 1));

    const hackerSession = await mockSession(db);
    const hacker = createCaller(
      createInnerTRPCContext({ session: hackerSession }),
    );
    const anon = createCaller(createInnerTRPCContext({ session: null }));

    // Off by default: hidden from hackers and signed-out visitors,
    // always open to organizers.
    await expect(anon.judging.board.get()).rejects.toThrow();
    await expect(hacker.judging.board.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await hacker.judging.board.getAccess()).toMatchObject({
      visible: false,
      shownToHackers: false,
    });
    expect(await admin.getRound()).toBeDefined();
    expect(await room.org.caller.judging.board.getAccess()).toMatchObject({
      isOrganizer: true,
      visible: true,
    });
    await expect(room.org.caller.judging.board.get()).resolves.toBeDefined();
    // Hackers can't flip it themselves.
    await expect(
      (
        hacker.judging.admin as unknown as {
          setBoardVisible: (i: { shownToHackers: boolean }) => Promise<unknown>;
        }
      ).setBoardVisible({ shownToHackers: true }),
    ).rejects.toThrow();

    await admin.setBoardVisible({ shownToHackers: true });
    expect(await hacker.judging.board.getAccess()).toMatchObject({
      visible: true,
      shownToHackers: true,
    });
    const board = await hacker.judging.board.get();
    expect(board.round).toMatchObject({ round: 1, status: "running" });
    expect(board.stops.length).toBeGreaterThan(0);

    // Judges are numbers, never ids, names or emails.
    for (const stop of board.stops) {
      expect(Object.keys(stop).sort()).toEqual([
        "judge",
        "round",
        "status",
        "table",
        "team",
      ]);
      expect(stop.judge).toBeGreaterThan(0);
    }
    expect(JSON.stringify(board)).not.toContain(judge.session.user.id);
    expect(JSON.stringify(board)).not.toContain(
      judge.session.user.email ?? "@",
    );

    // The scored stop shows as done, later rounds as coming up.
    expect(board.stops.some((s) => s.round === 1 && s.status === "done")).toBe(
      true,
    );
    expect(
      board.stops.some((s) => s.round > 1 && s.status === "upcoming"),
    ).toBe(true);

    await admin.setBoardVisible({ shownToHackers: false });
    await expect(hacker.judging.board.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("the projector clock reads the round timer without logging in", async () => {
    const room = await roundsRoom();
    const admin = room.org.caller.judging.admin;
    const anon = createCaller(createInnerTRPCContext({ session: null }));

    expect(await anon.judging.board.getClock()).toMatchObject({
      round: 0,
      status: "idle",
    });
    await admin.startRound();
    const running = await anon.judging.board.getClock();
    expect(running).toMatchObject({ round: 1, status: "running" });
    expect(running.remainingMs).toBeGreaterThan(0);
    // Reading it never changes anything.
    expect((await admin.getRound()).status).toBe("running");
    await admin.pauseRound();
    expect((await anon.judging.board.getClock()).status).toBe("paused");
  });

  test("stops at empty tables aren't rounds", async () => {
    // 4 tables but 2 teams: tables 3 and 4 are empty.
    const room = await setupRoom({
      tableCount: 4,
      teamCount: 2,
      judgeCount: 3,
    });
    const admin = room.org.caller.judging.admin;
    await admin.setRoundConfig({ roundsEnabled: true });

    const overview = await admin.getRound();
    expect(overview.totalRounds).toBe(2);

    await admin.startRound();
    // Only stops with a team count towards "judges done".
    expect((await admin.getRound()).stops.total).toBe(3);
    await admin.endRound();
    await admin.startRound();
    await admin.endRound();
    await expect(admin.startRound()).rejects.toThrow(/last round/i);
  });

  test("with rounds off, judges still follow their walking order", async () => {
    const room = await setupRoom({ tableCount: 4, judgeCount: 3 });
    const [judge] = room.judges;
    assertDefined(judge, "judge");
    await expect(score(judge, await stopAt(judge, 3))).rejects.toThrow(
      /current team/i,
    );
    await expect(score(judge, await stopAt(judge, 1))).resolves.toBeDefined();
  });
});
