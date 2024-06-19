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
import { applicationSubmitSchema } from "~/schemas/application";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

describe("application.get", async () => {
  test("throws an error if no user exists", async () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    await expect(caller.application.get()).rejects.toThrowError();
  });

  test("undefined if no application exists", () => {
    return expect(caller.application.get()).resolves.toBeUndefined();
  });

  test("gets the user's application if it exists", async () => {
    const application = createRandomApplication(session);
    await db.insert(applications).values(application);

    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;
    const want = {
      ...application,
      githubLink: application?.githubLink?.substring(19),
      linkedInLink: application?.linkedInLink?.substring(24),
    };

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
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    const application = {
      id: faker.string.uuid(),
      ...createRandomApplication(session),
    };
    await expect(caller.application.save(application)).rejects.toThrowError();
  });

  test("creates a new application when it does not exist", async () => {
    await expect(caller.application.get()).resolves.toBeUndefined();

    const application = createRandomApplication(session);
    const want = application;

    await caller.application.save(application);
    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

    expect(got).toEqual(want);
  });

  test("updates the application when it does exist", async () => {
    const application = createRandomApplication(session);

    await caller.application.save(application);
    const updatedApplication = createRandomApplication(session);

    const want = updatedApplication;

    await caller.application.save(updatedApplication);
    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

    expect(got).toEqual(want);
  });

  test("complete application changes status to PENDING_REVIEW", async () => {
    const completeApplication = createCompleteApplication(session);
    applicationSubmitSchema.parse(completeApplication);

    const want = {
      ...completeApplication,
      status: "PENDING_REVIEW",
    };

    await caller.application.save(completeApplication);
    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

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

  const application = ApplicationSeeder.createRandomWithoutUser();

  return {
    ...application,
    userId,
    firstName,
    lastName,
    githubLink: `https://github.com/${application.githubLink}`,
    linkedInLink: `https://linkedin.com/in/${application.linkedInLink}`,
  };
}

function createCompleteApplication(session: Session) {
  const names = session.user.name?.split(" ");
  const [userId, firstName, lastName] = [
    session.user.id,
    names?.at(0),
    names?.at(-1),
  ];

  const application = ApplicationSeeder.createRandomWithoutUser();

  return {
    ...application,
    userId,
    firstName,
    lastName,
    githubLink: `https://github.com/${application.githubLink}`,
    linkedInLink: `https://linkedin.com/in/${application.linkedInLink}`,
    agreeCodeOfConduct: true,
    agreeShareWithSponsors: true,
    agreeShareWithMLH: true,
    agreeEmailsFromMLH: true,
    agreeWillBe18: true,
  };
}
