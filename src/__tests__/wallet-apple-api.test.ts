import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { getServerAuthSession, mockSession } from "~/server/auth";
import type * as Auth from "~/server/auth";
import { buildApplePass } from "~/server/wallet/apple-pass";
import handler from "~/pages/api/wallet/apple";

vi.mock("~/server/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  getServerAuthSession: vi.fn(),
}));
vi.mock("~/server/wallet/apple-pass", () => ({
  buildApplePass: vi.fn(() => Buffer.from("pkpass")),
}));

const userIds: string[] = [];

afterEach(async () => {
  for (const id of userIds.splice(0)) {
    await db.delete(applications).where(eq(applications.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  vi.mocked(buildApplePass).mockClear();
});

async function signIn(status?: typeof applications.$inferInsert.status) {
  const session = await mockSession(db);
  userIds.push(session.user.id);
  if (status) {
    await db.insert(applications).values({
      userId: session.user.id,
      firstName: "Jessica",
      lastName: "Wang",
      school: "Western University",
      githubLink: "https://github.com/testuser",
      linkedInLink: "https://linkedin.com/in/testuser",
      devpostLink: "https://devpost.com/testuser",
      status,
    });
  }
  vi.mocked(getServerAuthSession).mockResolvedValue(session);
  return session.user.id;
}

async function get() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body?: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  await handler(
    { method: "GET", query: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return res;
}

const hackerIdOf = async (userId: string) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.hackerId;

describe("GET /api/wallet/apple", () => {
  test("rejects signed-out users", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue(null);
    expect((await get()).statusCode).toBe(401);
  });

  test.each([
    "IN_PROGRESS",
    "PENDING_REVIEW",
    "REJECTED",
    "WAITLISTED",
    "DECLINED",
  ] as const)(
    "refuses a %s hacker and gives them no hacker ID",
    async (status) => {
      const userId = await signIn(status);
      expect((await get()).statusCode).toBe(403);
      expect(await hackerIdOf(userId)).toBeNull();
      expect(buildApplePass).not.toHaveBeenCalled();
    },
  );

  test("refuses a hacker with no application", async () => {
    await signIn();
    expect((await get()).statusCode).toBe(403);
  });

  test("says so plainly when signing fails", async () => {
    await signIn("CONFIRMED");
    vi.mocked(buildApplePass).mockImplementationOnce(() => {
      throw new Error("bad certificate");
    });
    const res = await get();

    expect(res.statusCode).toBe(500);
    expect(String(res.body)).toContain("couldn't make your pass");
  });

  test("gives a confirmed hacker a pass with their hacker ID", async () => {
    const userId = await signIn("CONFIRMED");
    const res = await get();

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/vnd.apple.pkpass");
    const hackerId = await hackerIdOf(userId);
    expect(hackerId).toBeTruthy();
    expect(vi.mocked(buildApplePass).mock.calls[0]?.[0]).toMatchObject({
      hackerId,
      name: "Jessica Wang",
      email: expect.stringContaining("@") as string,
    });
  });
});
