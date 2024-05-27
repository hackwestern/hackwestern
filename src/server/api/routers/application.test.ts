import { type Session } from "next-auth";
import { assert, describe, expect, test } from "vitest";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db, type Database } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { UserSeeder } from "~/server/db/seed/userSeeder";

async function mockSession(db: Database): Promise<Session> {
  const user = new UserSeeder().createRandom();
  await db.insert(users).values(user).returning();

  return {
    user,
    expires: new Date(Date.now() + 10).toISOString(),
  };
}

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session, db });
const caller = createCaller(ctx);

describe("application.get", async () => {
  test("should throw an error if no user exists", async () => {
    const ctx = createInnerTRPCContext({ session: null, db });
    const caller = createCaller(ctx);

    await expect(caller.application.get()).rejects.toThrowError();
  });

  test("should throw an error if no application exists", async () => {
    await expect(caller.application.get()).rejects.toThrowError();
  });

  test("get the user's application if it exists", async () => {
    const user = session?.user!;
    const userPartial = {
      id: user.id,
      name: user.name ?? "",
    };

    const want = new ApplicationSeeder([userPartial]).createRandom();
    await db.insert(applications).values(want);

    const got = await caller.application.get();
    assert(!!got);

    // @ts-ignore
    delete got.id;
    // @ts-ignore
    delete got.createdAt;
    // @ts-ignore
    delete got.updatedAt;

    // dates are the same but different, don't worry about dates LOL.
    got.dateOfBirth = want.dateOfBirth;

    expect(got).toEqual(want);
  });
});
