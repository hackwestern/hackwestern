import { afterEach, assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { type Session } from "next-auth";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";

import { db } from "~/server/db";
import { count, eq, inArray } from "drizzle-orm";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { applications, users } from "~/server/db/schema";

import { applicationSubmitSchema } from "~/schemas/application";

import { UserSeeder } from "~/server/db/seed/userSeeder";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { seed, seedUsers } from "~/server/db/seed/helpers";

import { GITHUB_URL, LINKEDIN_URL } from "~/utils/urls";

const session = await mockSession(db);
const organizerSession = await mockOrganizerSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

describe("application.get", async () => {
  test("throws an error if no user exists", () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    return expect(caller.application.get()).rejects.toThrowError();
  });

  test("undefined if no application exists", () => {
    return expect(caller.application.get()).resolves.toBeNull();
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

    return expect(got).toEqual(want);
  });
});

describe("application.getById", async() => {
  const fakeUserId = faker.string.uuid();
  
  test("throws an error if ID is null", async () => {
    return expect(caller.application.getById({ applicantId: null })).rejects.toThrowError();
  });

  test("throws an error if ID does not exist", async () => {
    return expect(caller.application.getById({ applicantId: fakeUserId })).rejects.toThrowError();
  });

  test("gets application successfully given an existing user ID", async () => {
    const getByIdSession = await mockSession(db);
    const userId = getByIdSession.user.id
    const application = createRandomApplication(getByIdSession);
    await db.insert(applications).values(application);

    const result = await caller.application.getById({ applicantId: userId });
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;
    const want = {
      ...application,
      githubLink: application?.githubLink,
      linkedInLink: application?.linkedInLink,
    };

    return expect(got).toEqual(want);
  })
})

describe("application.getAllApplicants", async () => {
  test("throws an error if not authenticated", async () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    return expect(caller.application.getAllApplicants()).rejects.toThrowError();
  });

  test("throws an error if user is not an organizer", () => {
    return expect(caller.application.getAllApplicants()).rejects.toThrowError();
  });

  test("gets all applicants with applications that are ready for review", async () => {
    const ctx = createInnerTRPCContext({ session: organizerSession });
    const caller = createCaller(ctx);

    const NUM_ROWS = 50;
    const us = new UserSeeder(NUM_ROWS);
    const insertedUsers = await db.transaction(async (tx) => {
      const insertedUsers = await seedUsers(us, tx);
      const as = new ApplicationSeeder(insertedUsers, NUM_ROWS);
      await Promise.all(seed(as, tx));

      return insertedUsers;
    });

    const result = await db
      .select({
        count: count(),
      })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.userId))
      .where(eq(applications.status, "PENDING_REVIEW"));

    const want = result[0]?.count ?? 0;

    const applicants = await caller.application.getAllApplicants();
    const got = applicants.length;

    // clean up inserted users and applications
    const userIds = insertedUsers.map((u) => u.id);
    await db.delete(applications).where(inArray(applications.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));

    return expect(got).toBe(want);
  });
});

describe.sequential("application.save", async () => {
  afterEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("throws an error if no user exists", () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    const application = {
      id: faker.string.uuid(),
      ...createRandomApplication(session),
    };
    return expect(caller.application.save(application)).rejects.toThrowError();
  });

  test("creates a new application when it does not exist", async () => {
    await expect(caller.application.get()).resolves.toBeNull();

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
    githubLink: `${GITHUB_URL}${application.githubLink}`,
    linkedInLink: `${LINKEDIN_URL}${application.linkedInLink}`,
  };
}

function createCompleteApplication(session: Session) {
  const names = session.user.name?.split(" ");
  const [userId, firstName, lastName] = [
    session.user.id,
    names?.at(0),
    names?.at(-1),
  ];

  const application = ApplicationSeeder.createCompleteWithoutUser();

  return {
    ...application,
    userId,
    firstName,
    lastName,
    githubLink: `${GITHUB_URL}${application.githubLink}`,
    linkedInLink: `${LINKEDIN_URL}${application.linkedInLink}`,
    agreeCodeOfConduct: true,
    agreeShareWithSponsors: true,
    agreeShareWithMLH: true,
    agreeEmailsFromMLH: true,
    agreeWillBe18: true,
  };
}
