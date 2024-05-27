import { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db, type Database } from "~/server/db";
import { users } from "~/server/db/schema";
import { UserSeeder } from "~/server/db/seed/userSeeder";

async function mockSession(db: Database): Promise<Session> {
  const user = new UserSeeder().createRandom();
  await db.insert(users).values(user).returning();

  return {
    user,
    expires: new Date(Date.now() + 10).toISOString(),
  };
}

describe("application.get", async () => {
  const session = await mockSession(db);

  const ctx = createInnerTRPCContext({ session, db });
  const caller = createCaller(ctx);

  it("should throw an error if no session exists", async () => {
    await expect(caller.application.get()).rejects.toThrowError();
  });
});
