import { afterEach, describe, expect, test, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import handler from "~/pages/api/upload/resume";
import * as authModule from "~/server/auth";
import * as dateModule from "~/lib/date";
import { db } from "~/server/db";
import { applications } from "~/server/db/schema";
import { mockSession } from "~/server/auth";

function mockRes() {
  const res = {} as NextApiResponse & { _status?: number; _body?: unknown };
  res.status = vi.fn(function (this: typeof res, c: number) {
    this._status = c;
    return this;
  }) as never;
  res.json = vi.fn(function (this: typeof res, b: unknown) {
    this._body = b;
    return this;
  }) as never;
  res.setHeader = vi.fn(function (this: typeof res) {
    return this;
  }) as never;
  return res;
}

const session = await mockSession(db);
vi.spyOn(authModule, "getServerAuthSession").mockResolvedValue(session);
const pastDeadline = vi
  .spyOn(dateModule, "isPastDeadline")
  .mockReturnValue(false);

// Neither case should reach formidable: the request has no body to parse.
const req = { method: "POST", headers: {} } as unknown as NextApiRequest;

describe.sequential("/api/upload/resume", () => {
  afterEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("refuses uploads after the deadline", async () => {
    pastDeadline.mockReturnValueOnce(true);
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(403);
  });

  test("refuses uploads once the application is submitted", async () => {
    await db.insert(applications).values({
      userId: session.user.id,
      status: "PENDING_REVIEW",
      githubLink: "https://github.com/testuser",
      linkedInLink: "https://linkedin.com/in/testuser",
      devpostLink: "https://devpost.com/testuser",
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(403);
  });
});
