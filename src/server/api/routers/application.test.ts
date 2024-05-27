import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { type Session } from "next-auth";
import { assert, beforeEach, describe, expect, test } from "vitest";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db, type Database } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { UserSeeder } from "~/server/db/seed/userSeeder";
import { delay } from "~/utils/delay";

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
    const want = createRandomApplication(session);
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

describe.sequential("application.save", async () => {
  beforeEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("throws an error if no user exists", async () => {
    const ctx = createInnerTRPCContext({ session: null, db });
    const caller = createCaller(ctx);

    const application = {
      id: faker.string.uuid(),
      ...createRandomApplication(session),
    };
    await expect(caller.application.save(application)).rejects.toThrowError();
  });

  test("throws an error if the user has another application with a different id", async () => {
    const application = {
      ...createRandomApplication(session),
    };

    await caller.application.save(application);

    const newApplication = {
      ...application,
      id: faker.string.uuid(),
    };

    await expect(
      caller.application.save(newApplication),
    ).rejects.toThrowError();
  });

  test("creates a new application when it does not exist", async () => {
    await expect(caller.application.get()).rejects.toThrowError("not found");

    const want = {
      ...createRandomApplication(session),
    };
    const got = await caller.application.save(want);

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

  test("updates the application when it does exist", async () => {
    const application = {
      ...createRandomApplication(session),
    };

    const originalApplication = await caller.application.save(application);

    const want = {
      ...createRandomApplication(session),
      id: originalApplication?.id,
    };

    const got = await caller.application.save(want);

    expect(got?.updatedAt.getTime()).toBeGreaterThan(
      got?.createdAt.getTime() ?? 0,
    );

    assert(!!got);

    // @ts-ignore
    delete got.id;
    // @ts-ignore
    delete got.createdAt;
    // @ts-ignore
    delete got.updatedAt;

    // dates are the same but different, don't think too much about dates.
    got.dateOfBirth = want.dateOfBirth;

    expect(got).toEqual(want);
  });
});

function createRandomApplication(session: Session) {
  const names = session.user.name?.split(" ");
  const [userId, firstName, lastName] = [
    session.user.id,
    names?.at(0),
    names?.at(-1),
  ];

  return {
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId,
    firstName,
    lastName,
  };
}
