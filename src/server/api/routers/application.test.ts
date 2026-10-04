import { afterEach, assert, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { type Session } from "next-auth";
import * as mailModule from "~/server/mail-mailjet";
import * as dateModule from "~/lib/date";

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

import { GITHUB_URL, LINKEDIN_URL, DEVPOST_URL } from "~/utils/urls";

// application.submit sends a real confirmation email, and CI runs with live
// Mailjet credentials — so without this, every test run delivered
// "We've received your Hack Western 13 application!" to a faker-generated
// address. Those are guaranteed hard bounces on hello@hackwestern.com, the apex
// domain that password resets and email verification depend on, and they showed
// up as untraceable contacts in the production Mailjet account.
vi.spyOn(mailModule, "sendViaMailjet").mockResolvedValue({
  data: { delivered: [], queued: [], bounced: [] },
  error: null,
});

// save and submit refuse writes once applications close. Pin "before the
// deadline" so these tests keep passing after Oct 18; the deadline tests below
// flip it for a single call.
const pastDeadline = vi
  .spyOn(dateModule, "isPastDeadline")
  .mockReturnValue(false);

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
      dietaryRestrictionsOther: application.dietaryRestrictionsOther ?? null,
      devpostLink: application?.devpostLink?.substring(DEVPOST_URL.length),
      githubLink: application?.githubLink?.substring(GITHUB_URL.length),
      linkedInLink: application?.linkedInLink?.substring(LINKEDIN_URL.length),
      avatarColour: null,
      avatarFace: null,
      avatarLeftHand: null,
      avatarRightHand: null,
      avatarHat: null,
      canvasData: {
        paths: [],
        timestamp: 0,
        version: "",
      },
    };

    return expect(got).toEqual(want);
  });
});

describe("application.getById", async () => {
  const fakeUserId = faker.string.uuid();

  test("throws an error if ID is null", async () => {
    return expect(
      caller.application.getById({ applicantId: null }),
    ).rejects.toThrowError();
  });

  test("throws an error if ID does not exist", async () => {
    return expect(
      caller.application.getById({ applicantId: fakeUserId }),
    ).rejects.toThrowError();
  });

  test("gets application successfully given an existing user ID", async () => {
    const getByIdSession = await mockSession(db);
    const userId = getByIdSession.user.id;
    const application = createRandomApplication(getByIdSession);

    await db.insert(applications).values(application);

    const getByIdOrganizerSession = await mockOrganizerSession(db);
    const getByIdOrganizerCtx = createInnerTRPCContext({
      session: getByIdOrganizerSession,
    });
    const getByIdOrganizerCaller = createCaller(getByIdOrganizerCtx);

    const result = await getByIdOrganizerCaller.application.getById({
      applicantId: userId,
    });

    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;
    const want = {
      ...application,
      dietaryRestrictionsOther: application.dietaryRestrictionsOther ?? null,

      githubLink: application?.githubLink,
      linkedInLink: application?.linkedInLink,
      avatarColour: null,
      avatarFace: null,
      avatarLeftHand: null,
      avatarRightHand: null,
      avatarHat: null,
      canvasData: {
        paths: [],
        timestamp: 0,
        version: "",
      },
    };

    return expect(got).toEqual(want);
  });
});

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

    const application = createRandomSaveInput(session);
    const want = {
      ...application,
      dietaryRestrictionsOther: application.dietaryRestrictionsOther ?? null,

      avatarColour: null,
      avatarFace: null,
      avatarLeftHand: null,
      avatarRightHand: null,
      avatarHat: null,
      canvasData: {
        paths: [],
        timestamp: 0,
        version: "",
      },
    };

    await caller.application.save(application);
    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

    expect(got).toEqual(want);
  });

  test("updates the application when it does exist", async () => {
    const application = createRandomSaveInput(session);

    // forcing the dietary update
    application.dietaryRestrictions = "Other";
    application.dietaryRestrictionsOther = "Other Res";

    await caller.application.save(application);
    const updatedApplication = createRandomSaveInput(session);

    // forcing the dietary update
    updatedApplication.dietaryRestrictions = "Kosher";
    updatedApplication.dietaryRestrictionsOther = null;

    const want = {
      ...updatedApplication,
      dietaryRestrictionsOther:
        updatedApplication.dietaryRestrictionsOther ?? null,

      avatarColour: null,
      avatarFace: null,
      avatarLeftHand: null,
      avatarRightHand: null,
      avatarHat: null,
      canvasData: {
        paths: [],
        timestamp: 0,
        version: "",
      },
    };

    await caller.application.save(updatedApplication);
    const result = await caller.application.get();
    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

    expect(got).toEqual(want);
  });

  test("complete application changes status to PENDING_REVIEW", async () => {
    const completeApplication = createCompleteSaveInput(session);
    applicationSubmitSchema.parse(completeApplication);

    const want = {
      ...completeApplication,
      dietaryRestrictionsOther:
        completeApplication.dietaryRestrictionsOther ?? null,

      status: "PENDING_REVIEW",
      avatarColour: null,
      avatarFace: null,
      avatarLeftHand: null,
      avatarRightHand: null,
      avatarHat: null,
      canvasData: {
        paths: [],
        timestamp: 0,
        version: "",
      },
    };

    // Save the complete application first, then call submit() which validates the
    // stored application and flips the status to PENDING_REVIEW.
    await caller.application.save(completeApplication);
    await caller.application.submit();
    const result = await caller.application.get();

    assert(!!result);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...got } = result;

    expect(got).toEqual(want);
  });

  test("submits when dietaryRestrictionsOther was never filled in", async () => {
    // Picking "None" leaves the Other text box untouched, so the column stays
    // null — the submit schema must accept that.
    const { dietaryRestrictionsOther: _other, ...completeApplication } =
      createCompleteSaveInput(session);

    await caller.application.save(completeApplication);
    const saved = await caller.application.get();
    assert(!!saved);
    expect(saved.dietaryRestrictionsOther).toBeNull();
    expect(applicationSubmitSchema.safeParse(saved).success).toBe(true);

    await caller.application.submit();
    const result = await caller.application.get();
    expect(result?.status).toBe("PENDING_REVIEW");
  });

  test("Devpost, GitHub and LinkedIn are required, portfolio isn't", async () => {
    const complete = createCompleteSaveInput(session);

    // The form's check (review step) flags each missing link on its own...
    for (const link of ["devpostLink", "githubLink", "linkedInLink"] as const) {
      const result = applicationSubmitSchema.safeParse({
        ...complete,
        [link]: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.format()[link]?._errors.length).toBeGreaterThan(0);
    }
    expect(
      applicationSubmitSchema.safeParse({ ...complete, otherLink: "" }).success,
    ).toBe(true);

    // ...and the server refuses the same application.
    await caller.application.save({ ...complete, githubLink: "" });
    await expect(caller.application.submit()).rejects.toThrowError(
      "GitHub link",
    );
    const result = await caller.application.get();
    expect(result?.status).toBe("IN_PROGRESS");
  });

  test("won't submit Other without the school's name", async () => {
    await caller.application.save({
      ...createCompleteSaveInput(session),
      school: "Other",
      schoolOther: null,
    });

    await expect(caller.application.submit()).rejects.toThrowError(
      "Your application isn't complete yet",
    );
    const result = await caller.application.get();
    expect(result?.status).toBe("IN_PROGRESS");
  });

  test("submits Other with the school's name", async () => {
    await caller.application.save({
      ...createCompleteSaveInput(session),
      school: "Other",
      schoolOther: "University of Illinois Urbana-Champaign",
    });

    await caller.application.submit();
    const result = await caller.application.get();
    expect(result?.status).toBe("PENDING_REVIEW");
    expect(result?.schoolOther).toBe("University of Illinois Urbana-Champaign");
  });
});

describe.sequential("application deadline", async () => {
  afterEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("save is refused after the deadline and writes nothing", async () => {
    pastDeadline.mockReturnValueOnce(true);

    await expect(
      caller.application.save(createRandomSaveInput(session)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.application.get()).resolves.toBeNull();
  });

  test("submit is refused after the deadline and the application stays in progress", async () => {
    await caller.application.save(createCompleteSaveInput(session));
    pastDeadline.mockReturnValueOnce(true);

    await expect(caller.application.submit()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const result = await caller.application.get();
    expect(result?.status).toBe("IN_PROGRESS");
  });
});

/**
 * Creates application data with full URLs — for direct DB inserts.
 */
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
    devpostLink: `${DEVPOST_URL}${application.devpostLink}`,
    githubLink: `${GITHUB_URL}${application.githubLink}`,
    linkedInLink: `${LINKEDIN_URL}${application.linkedInLink}`,
  };
}

/**
 * Creates application data with raw usernames (no URL prefix) — for save() calls,
 * since save() prepends the prefixes itself.
 */
function createRandomSaveInput(session: Session) {
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
    // save() strips status from input and DB defaults it to IN_PROGRESS
    status: "IN_PROGRESS" as const,
    // save() prepends the URL prefixes, so pass raw usernames
  };
}

/**
 * Creates a complete application with raw usernames — for save() + submit() calls.
 */
function createCompleteSaveInput(session: Session) {
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
    // save() prepends the URL prefixes, so pass raw usernames
    agreeCodeOfConduct: true,
    agreeShareWithSponsors: true,
    agreeShareWithMLH: true,
    agreeEmailsFromMLH: true,
    agreeWillBe18: true,
  };
}
