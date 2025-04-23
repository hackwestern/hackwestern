import { beforeEach, afterEach, assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { type Session } from "next-auth";
import { eq } from "drizzle-orm";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { users, applications, reviews } from "~/server/db/schema";
import { ReviewSeeder } from "~/server/db/seed/reviewSeeder";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { GITHUB_URL, LINKEDIN_URL } from "~/utils/urls";

const session = await mockOrganizerSession(db);
const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

describe("review.save", async () => {
  afterEach(async () => {
    await db.delete(reviews).where(eq(reviews.reviewerUserId, session.user.id));
  });

  test("throws an error if the user is not an organizer", async () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    const review = {
      id: faker.string.uuid(),
      ...createRandomReview(session),
    };
    await expect(caller.review.save(review)).rejects.toThrowError();
  });

  test("saves a review if the user is an organizer", async () => {
    const application = createRandomApplication(session);
    await caller.application.save(application);
    const review = createRandomReview(session);

    try {
      await caller.review.save(review);
    } catch (error) {
      console.error("Test failed with error:", error);
    }
    await expect(caller.review.save(review)).resolves.not.toThrow();
  });

  test("updates an existing review", async () => {
    const review = createRandomReview(session);
    await db.insert(reviews).values(review);

    const updatedReview = {
      ...review,
      question1Rating: 10,
    };

    await expect(caller.review.save(updatedReview)).resolves.not.toThrow();
  });
});

describe.sequential("review.referApplicant", async () => {
  afterEach(async () => {
    await db.delete(reviews).where(eq(reviews.reviewerUserId, session.user.id));
  });

  test("throws an error if the user is not an organizer", async () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    const review = {
      id: faker.string.uuid(),
      ...createRandomReview(session),
    };
    await expect(caller.review.referApplicant(review)).rejects.toThrowError();
  });

  test("refers an applicant if the user is an organizer", async () => {
    const review = createRandomReview(session);

    await expect(caller.review.referApplicant(review)).resolves.not.toThrow();
  });
});

let application: ReturnType<typeof ReviewSeeder.createRandomWithoutUser> & {
  userId: string;
};

let review: ReturnType<typeof createRandomReview>;

let hackerCaller: ReturnType<typeof createCaller>;
let organizerCaller: ReturnType<typeof createCaller>;
let hackerCtx: ReturnType<typeof createInnerTRPCContext>;
let organizerCtx: ReturnType<typeof createInnerTRPCContext>;
let hackerSession: Session;
let organizerSession: Session;

interface ReviewCount {
  reviewerId: string;
  reviewerName: string | null;
  reviewCount: number;
}

describe("review.getReviewCounts", () => {
  beforeEach(async () => {
    hackerSession = await mockSession(db);
    hackerCtx = createInnerTRPCContext({ session: hackerSession });
    hackerCaller = createCaller(hackerCtx);

    organizerSession = await mockOrganizerSession(db);
    organizerCtx = createInnerTRPCContext({ session: organizerSession });
    organizerCaller = createCaller(organizerCtx);

    application = {
      ...ReviewSeeder.createRandomWithoutUser(),
      userId: hackerSession.user.id,
    };

    review = {
      ...ReviewSeeder.createRandomWithoutUser(),
      applicantUserId: hackerSession.user.id,
      reviewerUserId: organizerSession.user.id,
      completed: true,
    };
  });

  afterEach(async () => {
    // Clean up all related data created by tests using known session.user.id
    await db
      .delete(reviews)
      .where(eq(reviews.reviewerUserId, organizerSession.user.id));
    await db
      .delete(applications)
      .where(eq(applications.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, organizerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("throws error if user is not logged in", async () => {
    const ctx = createInnerTRPCContext({ session: null });
    const caller = createCaller(ctx);

    await expect(caller.review.getReviewCounts()).rejects.toThrowError(
      /UNAUTHORIZED/,
    );
  });

  test("throws error if user is not an organizer", async () => {
    await expect(hackerCaller.review.getReviewCounts()).rejects.toThrowError(
      /FORBIDDEN/,
    );
  });

  test("returns empty array if no reviews exist", async () => {
    const result = await filterBasedOnSession();
    expect(result).toEqual([]);
  });

  test("returns 1 count if 1 completed review exists", async () => {
    await db.insert(applications).values(application);
    await db.insert(reviews).values(review);
    const result = await filterBasedOnSession();

    expect(result.length).toBe(1);
    expect(result[0]?.reviewerId).toBe(organizerSession.user.id);
    expect(result[0]?.reviewCount).toBe(1);
  });

  test("ignores incomplete reviews", async () => {
    // Creating New Hacker (for incomplete review)
    const newHackerSession = await mockSession(db);

    // Incomplete Reviewed Application
    const incompleteApplication = {
      ...ReviewSeeder.createRandomWithoutUser(),
      userId: newHackerSession.user.id,
    };

    // Incomplete Review
    const incompleteReview = {
      ...ReviewSeeder.createRandomWithoutUser(),
      applicantUserId: newHackerSession.user.id,
      reviewerUserId: organizerSession.user.id,
      completed: false,
    };

    await db.insert(applications).values(application);
    await db.insert(applications).values(incompleteApplication);
    await db.insert(reviews).values(review);
    await db.insert(reviews).values(incompleteReview);

    const result = await filterBasedOnSession();

    expect(result.length).toBe(1);
    expect(result[0]?.reviewCount).toBe(1);

    // Clean up for newHacker
    await db
      .delete(reviews)
      .where(eq(reviews.applicantUserId, newHackerSession.user.id));
    await db
      .delete(applications)
      .where(eq(applications.userId, newHackerSession.user.id));
  });
});

/* HELPER FUNCTIONS */
// Filter to ensure only reviews created during test run are counted, and not prexisting db
async function filterBasedOnSession() {
  const result = await organizerCaller.review.getReviewCounts();

  return result.filter((item: ReviewCount) => {
    if (item.reviewerId === organizerSession.user.id) {
      return item;
    }
  });
}

function createRandomReview(session: Session) {
  const reviewerUserId = session.user.id;
  const applicantUserId = session.user.id;
  const review = ReviewSeeder.createRandomWithoutUser();

  return {
    ...review,
    applicantUserId,
    reviewerUserId,
  };
}

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
