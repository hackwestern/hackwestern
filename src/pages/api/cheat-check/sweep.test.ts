import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import {
  applications,
  cheatCheckSweepItems,
  cheatCheckSweeps,
  hackerCheckResults,
  teamCheckResults,
  teams,
  users,
} from "~/server/db/schema";

const SECRET = "test-sweep-secret";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/env")>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "HACK_START") return "2025-11-01T00:00:00.000Z";
        if (prop === "HACK_END") return "2025-11-03T00:00:00.000Z";
        if (prop === "CHEAT_SWEEP_SECRET") return SECRET;
        return target[prop];
      },
    }),
  };
});

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
const { SYSTEM_USER_ID } = await import("~/server/api/utils/cheat-checks");
const handler = (await import("./sweep")).default;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

/** Minimal NextApiRequest/Response pair — the handler only touches these bits. */
async function invoke(
  opts: { method?: string; secret?: string | null } = {},
): Promise<CapturedResponse> {
  const captured: CapturedResponse = { statusCode: 0, body: undefined };

  const secret = opts.secret === undefined ? SECRET : opts.secret;
  const req = {
    method: opts.method ?? "POST",
    headers: secret === null ? {} : { authorization: `Bearer ${secret}` },
  } as NextApiRequest;

  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as NextApiResponse;

  await handler(req, res);
  return captured;
}

/**
 * DevPost is scraped with a bare `fetch`, and so is the worker's self-chain.
 * One stub serves both: chain requests get an empty 200, DevPost gets a page
 * listing `john_doe`.
 */
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          `<ul id="collaborators"><li><a href="/john_doe">john_doe</a></li></ul>`,
        ),
    }),
  );
}

async function makeTeam() {
  const id = faker.string.alphanumeric(6);
  await db.insert(teams).values({
    id,
    name: `team-${id}`,
    githubUrl: `https://github.com/owner/${id}`,
    devpostUrl: `https://devpost.com/software/${id}`,
    submissionStatus: "submitted",
    memberGithubUsernames: ["john_doe"],
    memberDevpostUsernames: ["john_doe"],
  });
  return id;
}

async function makeMember(teamId: string) {
  const id = faker.string.uuid();
  await db.insert(users).values({
    id,
    name: faker.person.fullName(),
    email: faker.internet.email(),
    teamId,
  });
  await db.insert(applications).values({
    userId: id,
    age: 21,
    githubLink: "https://github.com/testuser",
    linkedInLink: "https://linkedin.com/in/testuser",
    devpostLink: "https://devpost.com/testuser",
  });
  return id;
}

async function startSweep(teamIds: string[]) {
  const [sweep] = await db
    .insert(cheatCheckSweeps)
    .values({ triggeredBy: "manual", totalTeams: teamIds.length })
    .returning();
  if (teamIds.length > 0) {
    await db
      .insert(cheatCheckSweepItems)
      .values(teamIds.map((teamId) => ({ sweepId: sweep!.id, teamId })));
  }
  return sweep!;
}

beforeEach(() => {
  fetchAllCommits.mockResolvedValue([
    {
      sha: "abc1234",
      commit: {
        author: {
          name: "john_doe",
          email: "j@x.com",
          date: "2025-11-02T12:00:00.000Z",
        },
        message: "wip",
      },
      author: { login: "john_doe" },
    },
  ]);
  fetchContributors.mockResolvedValue([
    { login: "john_doe", id: 1, contributions: 5 },
  ]);
  stubFetch();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  await db.delete(cheatCheckSweepItems).where(sql`true`);
  await db.delete(cheatCheckSweeps).where(sql`true`);
  await db.delete(teamCheckResults).where(sql`true`);
  await db.delete(hackerCheckResults).where(sql`true`);
  await db.delete(applications).where(sql`true`);
  await db.delete(users).where(sql`true`);
  await db.delete(teams).where(sql`true`);
});

// ---------------------------------------------------------------------------

describe("sweep worker auth", () => {
  test("rejects a non-POST request", async () => {
    expect((await invoke({ method: "GET" })).statusCode).toBe(405);
  });

  test("rejects a missing bearer token", async () => {
    expect((await invoke({ secret: null })).statusCode).toBe(401);
  });

  test("rejects a wrong bearer token", async () => {
    expect((await invoke({ secret: "nope" })).statusCode).toBe(401);
  });

  test("rejects a token of the right length but wrong value", async () => {
    const sameLength = "x".repeat(SECRET.length);
    expect((await invoke({ secret: sameLength })).statusCode).toBe(401);
  });
});

describe("sweep worker", () => {
  test("no-ops when no sweep is running", async () => {
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: "No sweep is running" });
  });

  test("runs every item, writes results as the system user, and completes", async () => {
    const teamA = await makeTeam();
    const teamB = await makeTeam();
    const member = await makeMember(teamA);
    const sweep = await startSweep([teamA, teamB]);

    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: "Sweep complete", processed: 2 });

    const finished = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(finished?.status).toBe("completed");
    expect(finished?.finishedAt).not.toBeNull();
    expect(finished?.hackerChecksDone).toBe(true);

    const items = await db.query.cheatCheckSweepItems.findMany({});
    expect(items.every((i) => i.status === "done")).toBe(true);

    // Three team checks per team, both hacker checks for the one member.
    const teamRows = await db.query.teamCheckResults.findMany({});
    expect(teamRows).toHaveLength(6);
    expect(teamRows.every((r) => r.checkedByUserId === SYSTEM_USER_ID)).toBe(
      true,
    );

    const hackerRows = await db.query.hackerCheckResults.findMany({
      where: eq(hackerCheckResults.userId, member),
    });
    expect(hackerRows).toHaveLength(2);
    expect(hackerRows.every((r) => r.checkedByUserId === SYSTEM_USER_ID)).toBe(
      true,
    );
  });

  test("does nothing while the sweep is rate limited", async () => {
    const teamId = await makeTeam();
    const sweep = await startSweep([teamId]);
    await db
      .update(cheatCheckSweeps)
      .set({ rateLimitedUntil: new Date(Date.now() + 60_000) })
      .where(eq(cheatCheckSweeps.id, sweep.id));

    const res = await invoke();
    expect(res.body).toMatchObject({ message: "Rate limited" });
    expect(fetchAllCommits).not.toHaveBeenCalled();

    const item = await db.query.cheatCheckSweepItems.findFirst({});
    expect(item?.status).toBe("pending");
    expect(item?.attempts).toBe(0);
  });

  test("a rate limit mid-run pauses the sweep and refunds the attempt", async () => {
    const teamId = await makeTeam();
    const resetAt = new Date(Date.now() + 300_000);
    fetchAllCommits.mockRejectedValue(
      new GithubRateLimitError("secondary rate limit", resetAt),
    );
    const sweep = await startSweep([teamId]);

    const res = await invoke();
    expect(res.body).toMatchObject({ message: "Rate limited; sweep paused" });

    const row = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(row?.status).toBe("running");
    expect(row?.rateLimitedUntil?.getTime()).toBe(resetAt.getTime());

    // The team keeps its full retry budget — this was not its fault.
    const item = await db.query.cheatCheckSweepItems.findFirst({});
    expect(item?.status).toBe("pending");
    expect(item?.attempts).toBe(0);
  });

  test("a failing team is retried, then marked failed with the reason", async () => {
    const teamId = await makeTeam();
    fetchAllCommits.mockRejectedValue(new Error("GitHub API error 404"));
    const sweep = await startSweep([teamId]);

    // A failed item goes back to `pending`, so the invocation's own loop
    // re-claims it until the budget is spent — no chaining needed here.
    const res = await invoke();

    expect(res.body).toMatchObject({ message: "Sweep complete" });
    const item = await db.query.cheatCheckSweepItems.findFirst({});
    expect(item?.status).toBe("failed");
    expect(item?.attempts).toBe(3);
    expect(item?.error).toMatch(/404/);

    const finished = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(finished?.status).toBe("completed");

    // The two checks that didn't depend on the commit list still landed.
    expect(await db.query.teamCheckResults.findMany({})).toHaveLength(2);
  });

  test("an empty sweep completes rather than spinning", async () => {
    const sweep = await startSweep([]);

    const res = await invoke();
    expect(res.body).toMatchObject({ message: "Sweep complete", processed: 0 });

    const finished = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(finished?.status).toBe("completed");
  });

  test("a total network outage still reaches a terminal state instead of chaining forever", async () => {
    const teamId = await makeTeam();
    const sweep = await startSweep([teamId]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network is down")),
    );
    fetchAllCommits.mockRejectedValue(new Error("network is down"));
    fetchContributors.mockRejectedValue(new Error("network is down"));

    await invoke();

    const finished = await db.query.cheatCheckSweeps.findFirst({
      where: eq(cheatCheckSweeps.id, sweep.id),
    });
    expect(finished?.status).toBe("completed");
    const item = await db.query.cheatCheckSweepItems.findFirst({});
    expect(item?.status).toBe("failed");
    expect(item?.error).toMatch(/network is down/);
    expect(await db.query.teamCheckResults.findMany({})).toHaveLength(0);
  });
});
