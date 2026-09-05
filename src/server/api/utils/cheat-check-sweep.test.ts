import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  applications,
  cheatCheckSweepItems,
  cheatCheckSweeps,
  dayOfRegistrations,
  hackerCheckResults,
  teamCheckResults,
  teams,
  users,
} from "~/server/db/schema";

// Allow per-test override of the hack window without re-importing the env module
let _testHackStart: string | undefined = "2025-11-01T00:00:00.000Z";
let _testHackEnd: string | undefined = "2025-11-03T00:00:00.000Z";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/env")>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "HACK_START") return _testHackStart ?? target[prop];
        if (prop === "HACK_END") return _testHackEnd ?? target[prop];
        // Left unset on purpose: `kickWorker` then no-ops instead of firing
        // real HTTP at localhost while the sweep rows are still exercised.
        if (prop === "CHEAT_SWEEP_SECRET") return undefined;
        return target[prop];
      },
    }),
  };
});

// The team checks are the only network-touching part of a sweep. Stub GitHub at
// the module boundary and DevPost at `fetch`, so the tests exercise the real
// aggregation, retry and rate-limit paths without leaving the machine.
const fetchAllCommits = vi.fn();
const fetchContributors = vi.fn();

vi.mock("~/utils/github", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/utils/github")>();
  return {
    ...original,
    fetchAllCommits: (owner: string, repo: string) =>
      fetchAllCommits(owner, repo) as unknown,
    fetchContributors: (owner: string, repo: string) =>
      fetchContributors(owner, repo) as unknown,
  };
});

const { GithubRateLimitError } = await import("~/utils/github");
const {
  SYSTEM_USER_ID,
  ensureSystemUser,
  runAllTeamChecks,
  runHackerChecksBulk,
} = await import("~/server/api/utils/cheat-check-runners");
const {
  MAX_ATTEMPTS,
  claimBatch,
  countPendingItems,
  createSweep,
  getSweepMemberIds,
  getSweepStatus,
  markItemAttemptFailed,
  markItemDone,
  releaseItem,
  releaseOrphanedItems,
  resumeSweep,
  setRateLimited,
} = await import("~/server/api/utils/cheat-check-sweep");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IN_WINDOW = "2025-11-02T12:00:00.000Z";
const OUT_OF_WINDOW = "2025-10-01T12:00:00.000Z";

function commit(date: string, author = "john_doe") {
  return {
    sha: faker.string.hexadecimal({ length: 7, prefix: "" }),
    commit: {
      author: { name: author, email: `${author}@x.com`, date },
      message: "wip",
    },
    author: { login: author },
  };
}

/** A DevPost page whose collaborator list contains `usernames`. */
function devpostHtml(usernames: string[]) {
  const items = usernames
    .map((u) => `<li><a href="/${u}">${u}</a></li>`)
    .join("");
  return `<html><body><ul id="collaborators">${items}</ul></body></html>`;
}

function stubDevpost(usernames: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(devpostHtml(usernames)),
    }),
  );
}

async function makeTeam(opts: { members?: string[] } = {}) {
  const id = faker.string.alphanumeric(6);
  await db.insert(teams).values({
    joinCode: faker.string.fromCharacters(
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      6,
    ),
    id,
    name: `team-${id}`,
    githubUrl: `https://github.com/owner/${id}`,
    devpostUrl: `https://devpost.com/software/${id}`,
    submissionStatus: "submitted",
    memberGithubUsernames: opts.members ?? ["john_doe"],
    memberDevpostUsernames: opts.members ?? ["john_doe"],
  });
  return id;
}

async function makeUser(
  opts: {
    teamId?: string;
    age?: number;
    signedIn?: boolean;
    application?: boolean;
  } = {},
) {
  const id = faker.string.uuid();
  await db.insert(users).values({
    id,
    name: faker.person.fullName(),
    email: faker.internet.email(),
    teamId: opts.teamId,
  });

  if (opts.application !== false) {
    await db.insert(applications).values({
      userId: id,
      age: opts.age ?? 20,
      githubLink: "https://github.com/testuser",
      linkedInLink: "https://linkedin.com/in/testuser",
      devpostLink: "https://devpost.com/testuser",
    });
  }

  if (opts.signedIn) {
    await db
      .insert(dayOfRegistrations)
      .values({ userId: id, signedInAt: new Date() });
  }

  return id;
}

/** A sweep row plus one pending item per team. */
async function makeSweepWith(teamIds: string[]) {
  const [sweep] = await db
    .insert(cheatCheckSweeps)
    .values({ triggeredBy: "manual" })
    .returning();
  await db
    .insert(cheatCheckSweepItems)
    .values(teamIds.map((teamId) => ({ sweepId: sweep!.id, teamId })));
  return sweep!;
}

function itemFor(sweepId: number, teamId: string) {
  return db.query.cheatCheckSweepItems.findFirst({
    where: and(
      eq(cheatCheckSweepItems.sweepId, sweepId),
      eq(cheatCheckSweepItems.teamId, teamId),
    ),
  });
}

beforeEach(async () => {
  fetchAllCommits.mockResolvedValue([commit(IN_WINDOW)]);
  fetchContributors.mockResolvedValue([
    { login: "john_doe", id: 1, contributions: 5 },
  ]);
  stubDevpost(["john_doe"]);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  _testHackStart = "2025-11-01T00:00:00.000Z";
  _testHackEnd = "2025-11-03T00:00:00.000Z";
  await db.delete(cheatCheckSweepItems).where(sql`true`);
  await db.delete(cheatCheckSweeps).where(sql`true`);
  await db.delete(teamCheckResults).where(sql`true`);
  await db.delete(hackerCheckResults).where(sql`true`);
  await db.delete(dayOfRegistrations).where(sql`true`);
  await db.delete(applications).where(sql`true`);
  await db.delete(users).where(sql`true`);
  await db.delete(teams).where(sql`true`);
});

// ---------------------------------------------------------------------------
// runAllTeamChecks
// ---------------------------------------------------------------------------

describe("runAllTeamChecks", () => {
  test("writes all three results, attributed to the system user", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();

    const { results, failures, skipped } = await runAllTeamChecks(
      teamId,
      SYSTEM_USER_ID,
    );

    expect(failures).toEqual([]);
    expect(skipped).toEqual([]);
    expect(results).toHaveLength(3);

    const rows = await db.query.teamCheckResults.findMany({
      where: eq(teamCheckResults.teamId, teamId),
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.checkedByUserId === SYSTEM_USER_ID)).toBe(true);
    expect(rows.every((r) => r.passed)).toBe(true);
    expect(rows.map((r) => r.checkType).sort()).toEqual([
      "COMMIT_WITHIN_ALLOTTED_TIME",
      "DEVPOST_MEMBERS_REGISTERED",
      "ONLY_TEAM_MEMBER_COMMITS",
    ]);
  });

  test("fails the checks it should: out-of-window commits and stranger contributors", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    fetchAllCommits.mockResolvedValue([
      commit(IN_WINDOW),
      commit(OUT_OF_WINDOW),
    ]);
    fetchContributors.mockResolvedValue([
      { login: "john_doe", id: 1, contributions: 5 },
      { login: "a_stranger", id: 2, contributions: 3 },
    ]);

    await runAllTeamChecks(teamId, SYSTEM_USER_ID);

    const rows = await db.query.teamCheckResults.findMany({
      where: eq(teamCheckResults.teamId, teamId),
    });
    const byType = Object.fromEntries(rows.map((r) => [r.checkType, r]));
    expect(byType.COMMIT_WITHIN_ALLOTTED_TIME?.passed).toBe(false);
    expect(byType.ONLY_TEAM_MEMBER_COMMITS?.passed).toBe(false);
    expect(byType.DEVPOST_MEMBERS_REGISTERED?.passed).toBe(true);
  });

  test("skips check types that already have a cached result", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    await db.insert(teamCheckResults).values({
      teamId,
      checkType: "DEVPOST_MEMBERS_REGISTERED",
      passed: true,
      details: {},
      checkedByUserId: SYSTEM_USER_ID,
    });

    const { results, skipped } = await runAllTeamChecks(teamId, SYSTEM_USER_ID);

    expect(skipped).toEqual(["DEVPOST_MEMBERS_REGISTERED"]);
    expect(results).toHaveLength(2);
    // The cached check never re-scraped DevPost.
    expect(fetch).not.toHaveBeenCalled();
  });

  test("forceRerun re-runs every check", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    await runAllTeamChecks(teamId, SYSTEM_USER_ID);

    const { results, skipped } = await runAllTeamChecks(
      teamId,
      SYSTEM_USER_ID,
      {
        forceRerun: true,
      },
    );

    expect(skipped).toEqual([]);
    expect(results).toHaveLength(3);
    expect(
      await db.query.teamCheckResults.findMany({
        where: eq(teamCheckResults.teamId, teamId),
      }),
    ).toHaveLength(3);
  });

  test("one failing check still persists the other two", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    fetchAllCommits.mockRejectedValue(new Error("GitHub API error 404"));

    const { results, failures } = await runAllTeamChecks(
      teamId,
      SYSTEM_USER_ID,
    );

    expect(results).toHaveLength(2);
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toMatch(/404/);

    const rows = await db.query.teamCheckResults.findMany({
      where: eq(teamCheckResults.teamId, teamId),
    });
    expect(rows.map((r) => r.checkType).sort()).toEqual([
      "DEVPOST_MEMBERS_REGISTERED",
      "ONLY_TEAM_MEMBER_COMMITS",
    ]);
  });

  test("surfaces a rate-limit error through failures rather than throwing", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    const resetAt = new Date(Date.now() + 120_000);
    fetchAllCommits.mockRejectedValue(
      new GithubRateLimitError("rate limited", resetAt),
    );

    const { failures } = await runAllTeamChecks(teamId, SYSTEM_USER_ID);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toBeInstanceOf(GithubRateLimitError);
    expect(
      (failures[0] as InstanceType<typeof GithubRateLimitError>).resetAt,
    ).toEqual(resetAt);
  });
});

// ---------------------------------------------------------------------------
// runHackerChecksBulk
// ---------------------------------------------------------------------------

describe("runHackerChecksBulk", () => {
  test("writes both check types for every user in one pass", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    const adult = await makeUser({ teamId, age: 22, signedIn: true });
    const minor = await makeUser({ teamId, age: 16, signedIn: false });

    const { upserted, skipped } = await runHackerChecksBulk(
      [adult, minor],
      SYSTEM_USER_ID,
    );

    expect(upserted).toBe(4);
    expect(skipped).toBe(0);

    const rows = await db.query.hackerCheckResults.findMany({});
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.checkedByUserId === SYSTEM_USER_ID)).toBe(true);

    const byKey = Object.fromEntries(
      rows.map((r) => [`${r.userId}:${r.checkType}`, r.passed]),
    );
    expect(byKey[`${adult}:IS_OF_AGE`]).toBe(true);
    expect(byKey[`${adult}:IS_REGISTERED`]).toBe(true);
    expect(byKey[`${minor}:IS_OF_AGE`]).toBe(false);
    expect(byKey[`${minor}:IS_REGISTERED`]).toBe(false);
  });

  test("skips users with no application instead of throwing", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    const withApp = await makeUser({ teamId });
    const withoutApp = await makeUser({ teamId, application: false });

    const { upserted, skipped } = await runHackerChecksBulk(
      [withApp, withoutApp],
      SYSTEM_USER_ID,
    );

    expect(upserted).toBe(2);
    expect(skipped).toBe(1);
    expect(
      await db.query.hackerCheckResults.findMany({
        where: eq(hackerCheckResults.userId, withoutApp),
      }),
    ).toHaveLength(0);
  });

  test("skips check types already cached, and forceRerun overrides that", async () => {
    await ensureSystemUser();
    const teamId = await makeTeam();
    const userId = await makeUser({ teamId, age: 22 });
    await db.insert(hackerCheckResults).values({
      userId,
      checkType: "IS_OF_AGE",
      passed: false,
      details: {},
      checkedByUserId: SYSTEM_USER_ID,
    });

    const first = await runHackerChecksBulk([userId], SYSTEM_USER_ID);
    expect(first.upserted).toBe(1);
    // The cached (stale) result is left alone.
    const cached = await db.query.hackerCheckResults.findFirst({
      where: and(
        eq(hackerCheckResults.userId, userId),
        eq(hackerCheckResults.checkType, "IS_OF_AGE"),
      ),
    });
    expect(cached?.passed).toBe(false);

    const second = await runHackerChecksBulk([userId], SYSTEM_USER_ID, {
      forceRerun: true,
    });
    expect(second.upserted).toBe(2);
    const rerun = await db.query.hackerCheckResults.findFirst({
      where: and(
        eq(hackerCheckResults.userId, userId),
        eq(hackerCheckResults.checkType, "IS_OF_AGE"),
      ),
    });
    expect(rerun?.passed).toBe(true);
  });

  test("is a no-op for an empty user list", async () => {
    await expect(runHackerChecksBulk([], SYSTEM_USER_ID)).resolves.toEqual({
      upserted: 0,
      skipped: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Work list
// ---------------------------------------------------------------------------

describe("sweep work list", () => {
  test("claimBatch claims at most `limit` items and consumes an attempt", async () => {
    const teamIds = [await makeTeam(), await makeTeam(), await makeTeam()];
    const sweep = await makeSweepWith(teamIds);

    const claimed = await claimBatch(sweep.id, 2);
    expect(claimed).toHaveLength(2);

    const rows = await db.query.cheatCheckSweepItems.findMany({});
    const running = rows.filter((r) => r.status === "running");
    expect(running).toHaveLength(2);
    expect(running.every((r) => r.attempts === 1)).toBe(true);
    expect(rows.filter((r) => r.status === "pending")).toHaveLength(1);

    // The remaining item is handed out next, and nothing is handed out twice.
    const next = await claimBatch(sweep.id, 2);
    expect(next).toHaveLength(1);
    expect(claimed).not.toContain(next[0]);
    expect(await claimBatch(sweep.id, 2)).toEqual([]);
  });

  test("a failing item retries up to MAX_ATTEMPTS then goes failed with the error", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      expect(await claimBatch(sweep.id, 1)).toEqual([teamId]);
      await markItemAttemptFailed(sweep.id, teamId, `boom ${attempt}`);

      const item = await itemFor(sweep.id, teamId);
      expect(item?.attempts).toBe(attempt);
      expect(item?.error).toBe(`boom ${attempt}`);
      expect(item?.status).toBe(attempt < MAX_ATTEMPTS ? "pending" : "failed");
    }

    // Exhausted: it is no longer offered to a worker.
    expect(await claimBatch(sweep.id, 1)).toEqual([]);
    expect(await countPendingItems(sweep.id)).toBe(0);
  });

  test("releaseItem hands an item back without charging an attempt", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);

    await claimBatch(sweep.id, 1);
    await releaseItem(sweep.id, teamId);

    const item = await itemFor(sweep.id, teamId);
    expect(item?.status).toBe("pending");
    expect(item?.attempts).toBe(0);
    expect(await claimBatch(sweep.id, 1)).toEqual([teamId]);
  });

  test("releaseOrphanedItems recovers work abandoned by a dead worker", async () => {
    const teamIds = [await makeTeam(), await makeTeam()];
    const sweep = await makeSweepWith(teamIds);

    await claimBatch(sweep.id, 2);
    expect(await claimBatch(sweep.id, 2)).toEqual([]);

    expect(await releaseOrphanedItems(sweep.id)).toBe(2);
    expect(await claimBatch(sweep.id, 2)).toHaveLength(2);
  });

  test("resumeSweep refuses while the worker's heartbeat is fresh", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);
    await claimBatch(sweep.id, 1);

    const result = await resumeSweep();

    // The live worker keeps its claim — releasing it would double-process.
    expect(result.resumed).toBe(false);
    expect(result.released).toBe(0);
    expect(await claimBatch(sweep.id, 1)).toEqual([]);
  });

  test("resumeSweep releases a dead worker's items once the heartbeat is stale", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);
    await claimBatch(sweep.id, 1);

    await db
      .update(cheatCheckSweeps)
      .set({ lastHeartbeatAt: new Date(Date.now() - 5 * 60_000) })
      .where(eq(cheatCheckSweeps.id, sweep.id));

    const result = await resumeSweep();

    expect(result.resumed).toBe(true);
    expect(result.released).toBe(1);
    expect(await claimBatch(sweep.id, 1)).toEqual([teamId]);
  });

  test("resumeSweep clears a rate-limit pause even with a fresh heartbeat", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);
    await setRateLimited(sweep.id, new Date(Date.now() + 60 * 60_000));

    const result = await resumeSweep();

    expect(result.resumed).toBe(true);
    const row = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(row?.rateLimitedUntil).toBeNull();
  });

  test("markItemDone clears a previous error and drops the item from the pending count", async () => {
    const teamId = await makeTeam();
    const sweep = await makeSweepWith([teamId]);

    await claimBatch(sweep.id, 1);
    await markItemAttemptFailed(sweep.id, teamId, "transient");
    await claimBatch(sweep.id, 1);
    await markItemDone(sweep.id, teamId);

    const item = await itemFor(sweep.id, teamId);
    expect(item?.status).toBe("done");
    expect(item?.error).toBeNull();
    expect(await countPendingItems(sweep.id)).toBe(0);
  });

  test("getSweepMemberIds returns the members of swept teams only", async () => {
    const sweptTeam = await makeTeam();
    const otherTeam = await makeTeam();
    const inSweep = await makeUser({ teamId: sweptTeam });
    const notInSweep = await makeUser({ teamId: otherTeam });
    const teamless = await makeUser();
    const sweep = await makeSweepWith([sweptTeam]);

    const memberIds = await getSweepMemberIds(sweep.id);
    expect(memberIds).toEqual([inSweep]);
    expect(memberIds).not.toContain(notInSweep);
    expect(memberIds).not.toContain(teamless);
  });
});

// ---------------------------------------------------------------------------
// Sweep lifecycle
// ---------------------------------------------------------------------------

describe("createSweep / getSweepStatus", () => {
  test("builds a work list from eligible teams and reports progress", async () => {
    await makeTeam();
    await makeTeam();

    const sweep = await createSweep("manual");
    expect(sweep?.status).toBe("running");
    expect(sweep?.totalTeams).toBe(2);

    const before = await getSweepStatus();
    expect(before?.items).toEqual({
      pending: 2,
      running: 0,
      done: 0,
      failed: 0,
    });
    expect(before?.stalled).toBe(false);

    const [claimed] = await claimBatch(sweep!.id, 1);
    await markItemDone(sweep!.id, claimed!);

    const after = await getSweepStatus();
    expect(after?.items).toEqual({
      pending: 1,
      running: 0,
      done: 1,
      failed: 0,
    });
  });

  test("returns null when a sweep is already running", async () => {
    await makeTeam();
    expect(await createSweep("manual")).not.toBeNull();
    expect(await createSweep("queue_drain")).toBeNull();
  });

  test("completes immediately when no team is eligible", async () => {
    await db.insert(teams).values({
      joinCode: faker.string.fromCharacters(
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        6,
      ),
      id: faker.string.alphanumeric(6),
      name: "draft team",
      submissionStatus: "draft",
    });

    const sweep = await createSweep("manual");
    expect(sweep?.status).toBe("completed");
    expect(sweep?.totalTeams).toBe(0);
    expect(await db.query.cheatCheckSweepItems.findMany({})).toHaveLength(0);
  });

  test("reports a running sweep with a stale heartbeat as stalled", async () => {
    await makeTeam();
    const sweep = await createSweep("manual");
    await db
      .update(cheatCheckSweeps)
      .set({ lastHeartbeatAt: new Date(Date.now() - 10 * 60_000) })
      .where(eq(cheatCheckSweeps.id, sweep!.id));

    expect((await getSweepStatus())?.stalled).toBe(true);
  });

  test("ensureSystemUser is idempotent and creates a non-loginnable organizer", async () => {
    await ensureSystemUser();
    await ensureSystemUser();

    const system = await db.query.users.findFirst({
      where: eq(users.id, SYSTEM_USER_ID),
    });
    expect(system?.type).toBe("organizer");
    expect(system?.password).toBeNull();
    expect(system?.teamId).toBeNull();
  });
});
