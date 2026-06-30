import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { parseGithubUrl } from "~/utils/github";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import {
  applications,
  dayOfRegistrations,
  hackerCheckResults,
  teamCheckResults,
  teams,
  users,
} from "~/server/db/schema";
import { mockOrganizerSession, mockSession } from "~/server/auth";

// Allow per-test override of the hack window without re-importing the env module
let _testHackStart: string | undefined;
let _testHackEnd: string | undefined;

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/env")>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "HACK_START") return _testHackStart ?? target[prop];
        if (prop === "HACK_END") return _testHackEnd ?? target[prop];
        return target[prop];
      },
    }),
  };
});

const organizerSession = await mockOrganizerSession(db);
const organizerCtx = createInnerTRPCContext({ session: organizerSession });
const organizerCaller = createCaller(organizerCtx);

// ---------------------------------------------------------------------------
// github.ts helpers
// ---------------------------------------------------------------------------

describe("parseGithubUrl", () => {
  it("parses a standard https URL", () => {
    expect(parseGithubUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("strips .git suffix", () => {
    expect(parseGithubUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("ignores trailing branch path", () => {
    expect(parseGithubUrl("https://github.com/owner/repo/tree/main")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("handles dotted repo names", () => {
    expect(parseGithubUrl("https://github.com/owner/my.cool.app")).toEqual({
      owner: "owner",
      repo: "my.cool.app",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGithubUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseGithubUrl("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cheatCheck.isOfAge
// ---------------------------------------------------------------------------

describe("cheatCheck.isOfAge", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
  });

  afterEach(async () => {
    await db
      .delete(hackerCheckResults)
      .where(eq(hackerCheckResults.userId, hackerSession.user.id));
    await db
      .delete(applications)
      .where(eq(applications.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("passes for age >= 18", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 18 });
    const result = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(true);
    expect(result.fromCache).toBe(false);
  });

  test("fails for age < 18", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 17 });
    const result = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(false);
  });

  test("fails for null age", async () => {
    await insertTestApplication(hackerSession.user.id, { age: null });
    const result = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(false);
  });

  test("throws NOT_FOUND when no application exists", async () => {
    try {
      await organizerCaller.cheatCheck.isOfAge({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  test("returns cached result on second call", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 20 });
    const first = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
    });
    expect(first.fromCache).toBe(false);
    const second = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
    });
    expect(second.fromCache).toBe(true);
    expect(second.passed).toBe(true);
  });

  test("forceRerun bypasses cache", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 20 });
    await organizerCaller.cheatCheck.isOfAge({ userId: hackerSession.user.id });
    const result = await organizerCaller.cheatCheck.isOfAge({
      userId: hackerSession.user.id,
      forceRerun: true,
    });
    expect(result.fromCache).toBe(false);
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 20 });
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.cheatCheck.isOfAge({ userId: hackerSession.user.id });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// cheatCheck.isRegistered
// ---------------------------------------------------------------------------

describe("cheatCheck.isRegistered", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
  });

  afterEach(async () => {
    await db
      .delete(hackerCheckResults)
      .where(eq(hackerCheckResults.userId, hackerSession.user.id));
    await db
      .delete(dayOfRegistrations)
      .where(eq(dayOfRegistrations.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("passes when hacker has signed in", async () => {
    await db.insert(dayOfRegistrations).values({
      userId: hackerSession.user.id,
      approved: true,
      signedInAt: new Date(),
    });
    const result = await organizerCaller.cheatCheck.isRegistered({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(true);
    expect(result.fromCache).toBe(false);
  });

  test("fails when no dayOfRegistration record exists", async () => {
    const result = await organizerCaller.cheatCheck.isRegistered({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(false);
  });

  test("fails when dayOfRegistration exists but signedInAt is null", async () => {
    await db
      .insert(dayOfRegistrations)
      .values({ userId: hackerSession.user.id, approved: false });
    const result = await organizerCaller.cheatCheck.isRegistered({
      userId: hackerSession.user.id,
    });
    expect(result.passed).toBe(false);
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.cheatCheck.isRegistered({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// cheatCheck.runAllHackerChecks
// ---------------------------------------------------------------------------

describe("cheatCheck.runAllHackerChecks", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
  });

  afterEach(async () => {
    await db
      .delete(hackerCheckResults)
      .where(eq(hackerCheckResults.userId, hackerSession.user.id));
    await db
      .delete(dayOfRegistrations)
      .where(eq(dayOfRegistrations.userId, hackerSession.user.id));
    await db
      .delete(applications)
      .where(eq(applications.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("returns IS_OF_AGE and IS_REGISTERED results", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 20 });
    await db.insert(dayOfRegistrations).values({
      userId: hackerSession.user.id,
      approved: true,
      signedInAt: new Date(),
    });

    const { results, fromCache } =
      await organizerCaller.cheatCheck.runAllHackerChecks({
        userId: hackerSession.user.id,
      });

    expect(fromCache).toBe(false);
    expect(results).toHaveLength(2);
    const types = results.map((r) => r.checkType);
    expect(types).toContain("IS_OF_AGE");
    expect(types).toContain("IS_REGISTERED");
    expect(results.find((r) => r.checkType === "IS_OF_AGE")?.passed).toBe(true);
    expect(results.find((r) => r.checkType === "IS_REGISTERED")?.passed).toBe(
      true,
    );
  });

  test("throws NOT_FOUND when no application exists", async () => {
    try {
      await organizerCaller.cheatCheck.runAllHackerChecks({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  test("handles concurrent checks for all team members simultaneously", async () => {
    const TEAM_SIZE = 5;
    const sessions = await Promise.all(
      Array.from({ length: TEAM_SIZE }, () => mockSession(db)),
    );

    await Promise.all([
      ...sessions.map((s) => insertTestApplication(s.user.id, { age: 20 })),
      ...sessions.map((s) =>
        db.insert(dayOfRegistrations).values({
          userId: s.user.id,
          approved: true,
          signedInAt: new Date(),
        }),
      ),
    ]);

    const results = await Promise.all(
      sessions.map((s) =>
        organizerCaller.cheatCheck.runAllHackerChecks({ userId: s.user.id }),
      ),
    );

    expect(results).toHaveLength(TEAM_SIZE);
    expect(results.every((r) => r.results.length === 2)).toBe(true);
    expect(results.every((r) => r.results.every((c) => c.passed))).toBe(true);

    await Promise.all(
      sessions.map(async (s) => {
        await db
          .delete(hackerCheckResults)
          .where(eq(hackerCheckResults.userId, s.user.id));
        await db
          .delete(dayOfRegistrations)
          .where(eq(dayOfRegistrations.userId, s.user.id));
        await db.delete(applications).where(eq(applications.userId, s.user.id));
        await db.delete(users).where(eq(users.id, s.user.id));
      }),
    );
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    await insertTestApplication(hackerSession.user.id, { age: 20 });
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.cheatCheck.runAllHackerChecks({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// Network tests — real GitHub API calls against hackwestern/hackwestern
// ---------------------------------------------------------------------------

const HACKWESTERN_GITHUB_URL = "https://github.com/hackwestern/hackwestern";
const TEST_TEAM_ID = "tst001";
const hasHackWindow = !!process.env.HACK_START && !!process.env.HACK_END;

describe.skipIf(!process.env.GITHUB_TOKEN)(
  "cheatCheck GitHub network tests",
  () => {
    beforeEach(async () => {
      _testHackStart = undefined;
      _testHackEnd = undefined;
      await db.insert(teams).values({
        id: TEST_TEAM_ID,
        // One registered member: John Doe with GitHub username john_doe
        name: "Test Team — John Doe",
        githubUrl: HACKWESTERN_GITHUB_URL,
        devpostUrl: "https://devpost.com/software/placeholder",
        memberGithubUsernames: ["john_doe"],
      });
    });

    afterEach(async () => {
      _testHackStart = undefined;
      _testHackEnd = undefined;
      await db
        .delete(teamCheckResults)
        .where(eq(teamCheckResults.teamId, TEST_TEAM_ID));
      await db.delete(teams).where(eq(teams.id, TEST_TEAM_ID));
    });

    test("onlyTeamMemberCommits: returns false because repo contributors are not in the team's registered GitHub usernames", async () => {
      const result = await organizerCaller.cheatCheck.onlyTeamMemberCommits({
        teamId: TEST_TEAM_ID,
      });
      expect(result.fromCache).toBe(false);
      expect(result.passed).toBe(false);
      const details = result.details as {
        unregisteredContributors: { login: string }[];
      };
      expect(details.unregisteredContributors.length).toBeGreaterThan(0);
    }, 30_000);

    test.skipIf(!hasHackWindow)(
      "commitWithinAllottedTime: returns false for the env-configured hack window",
      async () => {
        const result =
          await organizerCaller.cheatCheck.commitWithinAllottedTime({
            teamId: TEST_TEAM_ID,
          });
        expect(result.fromCache).toBe(false);
        expect(result.passed).toBe(false);
      },
      30_000,
    );

    test("commitWithinAllottedTime: returns true for a large 2010–2050 hack window", async () => {
      _testHackStart = "2010-01-01T00:00:00Z";
      _testHackEnd = "2050-12-31T23:59:59Z";
      const result = await organizerCaller.cheatCheck.commitWithinAllottedTime({
        teamId: TEST_TEAM_ID,
      });
      expect(result.fromCache).toBe(false);
      expect(result.passed).toBe(true);
    }, 30_000);

    test("commitWithinAllottedTime: throws PRECONDITION_FAILED when hack window not configured", async () => {
      if (hasHackWindow) return; // skip if env vars happen to be set
      try {
        await organizerCaller.cheatCheck.commitWithinAllottedTime({
          teamId: TEST_TEAM_ID,
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        expect((err as TRPCError).code).toBe("PRECONDITION_FAILED");
      }
    });
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertTestApplication(
  userId: string,
  overrides: Partial<typeof applications.$inferInsert> = {},
) {
  const [app] = await db
    .insert(applications)
    .values({
      userId,
      githubLink: "https://github.com/testuser",
      linkedInLink: "https://linkedin.com/in/testuser",
      devpostLink: "https://devpost.com/testuser",
      ...overrides,
    })
    .returning();
  if (!app) throw new Error("Failed to insert test application");
  return app;
}
