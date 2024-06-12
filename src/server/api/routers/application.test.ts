import { afterEach, assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { type Session } from "next-auth";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session, db });
const caller = createCaller(ctx);

describe("application.get", async () => {
  test("throws an error if no user exists", async () => {
    const ctx = createInnerTRPCContext({ session: null, db });
    const caller = createCaller(ctx);

    await expect(caller.application.get()).rejects.toThrowError();
  });

  test("throws an error if no application exists", async () => {
    await expect(caller.application.get()).rejects.toThrowError();
  });

  test("gets the user's application if it exists", async () => {
    const want = createRandomApplication(session);
    await db.insert(applications).values(want);

    const result = await caller.application.get();
    assert(!!result);

    const { createdAt, updatedAt, ...got } = result;
    void createdAt, updatedAt;

    expect(got).toEqual(want);
  });
});

describe.sequential("application.save", async () => {
  afterEach(async () => {
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

  test("creates a new application when it does not exist", async () => {
    await expect(caller.application.get()).rejects.toThrowError("not found");

    const application = createRandomApplication(session);
    const want = {
      ...application,
      githubLink: `https://github.com/${application.githubLink}`,
      linkedInLink: `https://linkedin.com/in/${application.linkedInLink}`,
    };

    const result = await caller.application.save(application);
    assert(!!result);

    const { createdAt, updatedAt, ...got } = result;
    void createdAt, updatedAt;

    expect(got).toEqual(want);
  });

  test("updates the application when it does exist", async () => {
    const application = createRandomApplication(session);

    await caller.application.save(application);
    const updatedApplication = createRandomApplication(session);

    const want = {
      ...updatedApplication,
      githubLink: `https://github.com/${updatedApplication.githubLink}`,
      linkedInLink: `https://linkedin.com/in/${updatedApplication.linkedInLink}`,
    };

    const result = await caller.application.save(updatedApplication);
    assert(!!result);

    const { createdAt, updatedAt, ...got } = result;
    void createdAt, updatedAt;

    expect(got).toEqual(want);
  });

  test("complete application changes status to PENDING_REVIEW", async () => {
    const completeApplication = createCompleteApplication(session);

    const want = {
      ...completeApplication,
      githubLink: `https://github.com/${completeApplication.githubLink}`,
      linkedInLink: `https://linkedin.com/in/${completeApplication.linkedInLink}`,
      status: "PENDING_REVIEW",
    };

    const result = await caller.application.save(completeApplication);
    assert(!!result);

    const { createdAt, updatedAt, ...got } = result;
    void createdAt, updatedAt;

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

function createCompleteApplication(session: Session) {
  const names = session.user.name?.split(" ");
  const [userId, firstName, lastName] = [
    session.user.id,
    names?.at(0),
    names?.at(-1),
  ];

  return {
    ...ApplicationSeeder.createCompleteWithoutUser(),
    userId,
    firstName,
    lastName,
  };
}
