import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  judges,
  judgingAssignments,
  judgingTables,
  teamMarks,
  teams,
  users,
} from "~/server/db/schema";
import { applyTriggers } from "~/server/db/triggers";

/* ---------- helpers ---------- */

const callerFor = (session: Awaited<ReturnType<typeof mockSession>> | null) =>
  createCaller(createInnerTRPCContext({ session }));

async function makeJudge(type: "organizer" | "sponsored" = "organizer") {
  const session = await mockSession(db);
  await db.insert(judges).values({ id: session.user.id, type });
  return { id: session.user.id, caller: callerFor(session) };
}

async function makeTeam(submissionStatus: "submitted" | "draft" = "submitted") {
  const id = faker.string.alphanumeric(12);
  await db.insert(teams).values({
    id,
    name: `team-${id}`,
    submissionStatus,
    joinCode: faker.string.alphanumeric(6),
  });
  return id;
}

let organizer: ReturnType<typeof callerFor>;
let organizerId: string;
let tableNumber = 0;

async function makeTable(zone = "Main gym") {
  return organizer.judgingPlan.admin.upsertTable({
    number: ++tableNumber,
    zone,
  });
}

/** A submitted team seated at a fresh table. */
async function seatedTeam() {
  const teamId = await makeTeam();
  const table = await makeTable();
  await organizer.judgingPlan.admin.seatTeam({ teamId, tableId: table.id });
  return { teamId, table };
}

beforeAll(async () => {
  await applyTriggers(db);
  const session = await mockOrganizerSession(db);
  organizer = callerFor(session);
  organizerId = session.user.id;
});

beforeEach(async () => {
  await db.delete(judgingAssignments).where(sql`true`);
  await db.delete(teamMarks).where(sql`true`);
  await db.delete(teams).where(sql`true`);
  await db.delete(judgingTables).where(sql`true`);
  await db.delete(judges).where(sql`true`);
});

/* ---------- auth ---------- */

describe("judgingPlan auth", () => {
  test("admin procedures reject non-organizers", async () => {
    const hacker = callerFor(await mockSession(db));
    await expect(hacker.judgingPlan.admin.getSetup()).rejects.toThrow();
    await expect(
      hacker.judgingPlan.admin.upsertTable({ number: 1, zone: "A" }),
    ).rejects.toThrow();
  });

  test("judge procedures reject non-judges", async () => {
    const hacker = callerFor(await mockSession(db));
    await expect(hacker.judgingPlan.me.getMyAssignments()).rejects.toThrow(
      /not registered as a judge/,
    );
  });

  test("team procedures reject anonymous callers", async () => {
    await expect(
      callerFor(null).judgingPlan.team.getMyJudging(),
    ).rejects.toThrow();
  });
});

/* ---------- tables + seating ---------- */

describe("tables and seating", () => {
  test("upsertTable creates, then updates by number", async () => {
    const created = await organizer.judgingPlan.admin.upsertTable({
      number: 42,
      zone: "Main gym",
    });
    expect(created).toMatchObject({
      number: 42,
      zone: "Main gym",
      isActive: true,
    });

    const updated = await organizer.judgingPlan.admin.upsertTable({
      number: 42,
      zone: "Side hall",
    });
    expect(updated.id).toBe(created.id);
    expect(updated.zone).toBe("Side hall");
    expect(updated.isActive).toBe(true);
  });

  test("seatTeam puts one team per table", async () => {
    const { table } = await seatedTeam();
    const other = await makeTeam();
    await expect(
      organizer.judgingPlan.admin.seatTeam({
        teamId: other,
        tableId: table.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("seatTeam moves an already-seated team", async () => {
    const { teamId, table } = await seatedTeam();
    const next = await makeTable();
    await organizer.judgingPlan.admin.seatTeam({ teamId, tableId: next.id });

    const setup = await organizer.judgingPlan.admin.getSetup();
    const byId = new Map(setup.tables.map((t) => [t.id, t]));
    expect(byId.get(table.id)?.team).toBeNull();
    expect(byId.get(next.id)?.team?.id).toBe(teamId);
  });

  test("inactive tables can't be seated, and seated tables can't be switched off", async () => {
    const { table } = await seatedTeam();
    await expect(
      organizer.judgingPlan.admin.setTableActive({
        tableId: table.id,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const empty = await makeTable();
    await organizer.judgingPlan.admin.setTableActive({
      tableId: empty.id,
      isActive: false,
    });
    await expect(
      organizer.judgingPlan.admin.seatTeam({
        teamId: await makeTeam(),
        tableId: empty.id,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("deleteTable refuses a seated table", async () => {
    const { table } = await seatedTeam();
    await expect(
      organizer.judgingPlan.admin.deleteTable({ tableId: table.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const empty = await makeTable();
    await organizer.judgingPlan.admin.deleteTable({ tableId: empty.id });
    const setup = await organizer.judgingPlan.admin.getSetup();
    expect(setup.tables.map((t) => t.id)).not.toContain(empty.id);
  });

  test("getSetup lists unseated submitted teams only", async () => {
    const { teamId: seated } = await seatedTeam();
    const unseated = await makeTeam();
    const draft = await makeTeam("draft");

    const { unseatedTeams } = await organizer.judgingPlan.admin.getSetup();
    const ids = unseatedTeams.map((t) => t.id);
    expect(ids).toContain(unseated);
    expect(ids).not.toContain(seated);
    expect(ids).not.toContain(draft);
  });

  test("unseatTeam clears the seat", async () => {
    const { teamId } = await seatedTeam();
    await organizer.judgingPlan.admin.unseatTeam({ teamId });
    const row = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    expect(row?.judgingTableId).toBeNull();
  });

  test("hackers can't set their own table through saveProject", async () => {
    const session = await mockSession(db);
    const hacker = callerFor(session);
    const { teamId, table } = await seatedTeam();
    await db.update(users).set({ teamId }).where(eq(users.id, session.user.id));

    const other = await makeTable();
    await hacker.teams.saveProject({
      memberDevpostUsernames: [],
      memberGithubUsernames: [],
      tracks: [],
      // Not in the schema, so stripped.
      ...({ judgingTableId: other.id } as object),
    });
    const row = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    expect(row?.judgingTableId).toBe(table.id);
  });
});

/* ---------- pairing ---------- */

describe("addAssignment", () => {
  test("appends to the end of the judge's list", async () => {
    const judge = await makeJudge();
    const a = await seatedTeam();
    const b = await seatedTeam();

    const first = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: a.teamId,
    });
    const second = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: b.teamId,
    });
    expect(first).toMatchObject({
      position: 1,
      status: "assigned",
      assignedBy: organizerId,
    });
    expect(second.position).toBe(2);
  });

  test("requires the team to be seated", async () => {
    const judge = await makeJudge();
    const teamId = await makeTeam();
    await expect(
      organizer.judgingPlan.admin.addAssignment({ judgeId: judge.id, teamId }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects unknown judges and teams", async () => {
    const judge = await makeJudge();
    const { teamId } = await seatedTeam();
    await expect(
      organizer.judgingPlan.admin.addAssignment({ judgeId: "nope", teamId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      organizer.judgingPlan.admin.addAssignment({
        judgeId: judge.id,
        teamId: "nope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("won't pair the same judge and team twice", async () => {
    const judge = await makeJudge();
    const { teamId } = await seatedTeam();
    await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId,
    });
    await expect(
      organizer.judgingPlan.admin.addAssignment({ judgeId: judge.id, teamId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("won't pair a judge with a team they already scored", async () => {
    const judge = await makeJudge();
    const { teamId } = await seatedTeam();
    await db.insert(teamMarks).values({ judgeId: judge.id, teamId, score: 50 });
    await expect(
      organizer.judgingPlan.admin.addAssignment({ judgeId: judge.id, teamId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rejects a taken position", async () => {
    const judge = await makeJudge();
    const a = await seatedTeam();
    const b = await seatedTeam();
    await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: a.teamId,
      position: 3,
    });
    await expect(
      organizer.judgingPlan.admin.addAssignment({
        judgeId: judge.id,
        teamId: b.teamId,
        position: 3,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("a cancelled pairing frees the team and the position", async () => {
    const judge = await makeJudge();
    const { teamId } = await seatedTeam();
    const stop = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId,
    });
    await organizer.judgingPlan.admin.cancelAssignment({
      assignmentId: stop.id,
    });

    const again = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId,
    });
    expect(again.position).toBe(1);
  });
});

describe("reorderAssignments", () => {
  test("renumbers the list in the given order", async () => {
    const judge = await makeJudge();
    const stops = [];
    for (let i = 0; i < 3; i++) {
      const { teamId } = await seatedTeam();
      stops.push(
        await organizer.judgingPlan.admin.addAssignment({
          judgeId: judge.id,
          teamId,
        }),
      );
    }
    const order = [stops[2]!.id, stops[0]!.id, stops[1]!.id];
    await organizer.judgingPlan.admin.reorderAssignments({
      judgeId: judge.id,
      assignmentIds: order,
    });

    const mine = await judge.caller.judgingPlan.me.getMyAssignments();
    expect(mine.map((s) => s.id)).toEqual(order);
    expect(mine.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  test("requires every current stop exactly once", async () => {
    const judge = await makeJudge();
    const a = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: (await seatedTeam()).teamId,
    });
    await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: (await seatedTeam()).teamId,
    });
    await expect(
      organizer.judgingPlan.admin.reorderAssignments({
        judgeId: judge.id,
        assignmentIds: [a.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      organizer.judgingPlan.admin.reorderAssignments({
        judgeId: judge.id,
        assignmentIds: [a.id, a.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

/* ---------- judge flow ---------- */

describe("judge flow", () => {
  async function pairedStop(type: "organizer" | "sponsored" = "organizer") {
    const judge = await makeJudge(type);
    const seat = await seatedTeam();
    const stop = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: seat.teamId,
    });
    return { judge, stop, ...seat };
  }

  test("getMyAssignments shows the team, its table, and no join code", async () => {
    const { judge, teamId, table } = await pairedStop();
    const [stop] = await judge.caller.judgingPlan.me.getMyAssignments();
    expect(stop?.team.id).toBe(teamId);
    expect(stop?.table).toEqual({ number: table.number, zone: table.zone });
    expect(stop?.mark).toBeNull();
    expect(stop?.team).not.toHaveProperty("joinCode");
  });

  test("start -> submit records the mark and finishes the stop", async () => {
    const { judge, stop, teamId } = await pairedStop();
    const started = await judge.caller.judgingPlan.me.startAssignment({
      assignmentId: stop.id,
    });
    expect(started.status).toBe("in_progress");
    expect(started.startedAt).toBeInstanceOf(Date);

    const { teamMarkId } = await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stop.id,
      score: 80,
    });
    const mark = await db.query.teamMarks.findFirst({
      where: eq(teamMarks.id, teamMarkId),
    });
    expect(mark).toMatchObject({ teamId, score: 80, roundType: "regular" });

    const [after] = await judge.caller.judgingPlan.me.getMyAssignments();
    expect(after?.status).toBe("done");
    expect(after?.completedAt).toBeInstanceOf(Date);
    expect(after?.mark?.score).toBe(80);
  });

  test("submitting updates the judge's normalization stats", async () => {
    const { judge, stop } = await pairedStop();
    await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stop.id,
      score: 70,
    });
    const row = await db.query.judges.findFirst({
      where: eq(judges.id, judge.id),
    });
    expect(row).toMatchObject({ marksCount: 1, marksSum: 70 });
  });

  test("sponsored judges' marks are sponsored-round", async () => {
    const { judge, stop } = await pairedStop("sponsored");
    const { teamMarkId } = await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stop.id,
      score: 60,
    });
    const mark = await db.query.teamMarks.findFirst({
      where: eq(teamMarks.id, teamMarkId),
    });
    expect(mark?.roundType).toBe("sponsored");
  });

  test("a stop can't be scored twice", async () => {
    const { judge, stop } = await pairedStop();
    await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stop.id,
      score: 50,
    });
    await expect(
      judge.caller.judgingPlan.me.submitMark({
        assignmentId: stop.id,
        score: 90,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const marks = await db.query.teamMarks.findMany({
      where: eq(teamMarks.judgeId, judge.id),
    });
    expect(marks).toHaveLength(1);
  });

  test("only one stop can be in progress", async () => {
    const { judge, stop } = await pairedStop();
    const second = await organizer.judgingPlan.admin.addAssignment({
      judgeId: judge.id,
      teamId: (await seatedTeam()).teamId,
    });
    await judge.caller.judgingPlan.me.startAssignment({
      assignmentId: stop.id,
    });
    await expect(
      judge.caller.judgingPlan.me.startAssignment({ assignmentId: second.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("reportAbsent closes the stop without a mark", async () => {
    const { judge, stop } = await pairedStop();
    const row = await judge.caller.judgingPlan.me.reportAbsent({
      assignmentId: stop.id,
    });
    expect(row.status).toBe("team_absent");
    await expect(
      judge.caller.judgingPlan.me.submitMark({
        assignmentId: stop.id,
        score: 50,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("judges can't touch another judge's stops", async () => {
    const { stop } = await pairedStop();
    const other = await makeJudge();
    await expect(
      other.caller.judgingPlan.me.submitMark({
        assignmentId: stop.id,
        score: 50,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      other.caller.judgingPlan.me.reportAbsent({ assignmentId: stop.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("cancelled stops disappear from the judge's list and can't be scored", async () => {
    const { judge, stop } = await pairedStop();
    await organizer.judgingPlan.admin.cancelAssignment({
      assignmentId: stop.id,
    });
    expect(await judge.caller.judgingPlan.me.getMyAssignments()).toEqual([]);
    await expect(
      judge.caller.judgingPlan.me.submitMark({
        assignmentId: stop.id,
        score: 50,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("finished stops can't be cancelled", async () => {
    const { judge, stop } = await pairedStop();
    await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stop.id,
      score: 50,
    });
    await expect(
      organizer.judgingPlan.admin.cancelAssignment({ assignmentId: stop.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

/* ---------- reads ---------- */

describe("progress and hacker view", () => {
  test("getProgress totals live stops by status", async () => {
    const judge = await makeJudge();
    const stops = [];
    for (let i = 0; i < 4; i++) {
      stops.push(
        await organizer.judgingPlan.admin.addAssignment({
          judgeId: judge.id,
          teamId: (await seatedTeam()).teamId,
        }),
      );
    }
    await judge.caller.judgingPlan.me.submitMark({
      assignmentId: stops[0]!.id,
      score: 50,
    });
    await judge.caller.judgingPlan.me.reportAbsent({
      assignmentId: stops[1]!.id,
    });
    await organizer.judgingPlan.admin.cancelAssignment({
      assignmentId: stops[2]!.id,
    });

    const { assignments, totals } =
      await organizer.judgingPlan.admin.getProgress();
    expect(assignments).toHaveLength(3);
    expect(assignments[0]).toHaveProperty("tableNumber");
    expect(totals).toEqual({
      assigned: 1,
      in_progress: 0,
      done: 1,
      team_absent: 1,
    });
  });

  test("getMyJudging shows the table and judge counts", async () => {
    const session = await mockSession(db);
    const hacker = callerFor(session);
    const { teamId, table } = await seatedTeam();
    await db.update(users).set({ teamId }).where(eq(users.id, session.user.id));

    const j1 = await makeJudge();
    const j2 = await makeJudge();
    const s1 = await organizer.judgingPlan.admin.addAssignment({
      judgeId: j1.id,
      teamId,
    });
    await organizer.judgingPlan.admin.addAssignment({ judgeId: j2.id, teamId });
    await j1.caller.judgingPlan.me.submitMark({
      assignmentId: s1.id,
      score: 50,
    });

    expect(await hacker.judgingPlan.team.getMyJudging()).toEqual({
      table: { number: table.number, zone: table.zone },
      judges: { paired: 2, done: 1, remaining: 1 },
    });
  });

  test("getMyJudging needs a team", async () => {
    const hacker = callerFor(await mockSession(db));
    await expect(hacker.judgingPlan.team.getMyJudging()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
