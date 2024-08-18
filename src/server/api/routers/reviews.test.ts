import { afterEach, assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { type Session } from "next-auth";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { reviews } from "~/server/db/schema";
import { ReviewSeeder } from "~/server/db/seed/reviewSeeder";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { GITHUB_URL, LINKEDIN_URL } from "~/utils/urls";

const session = await mockSession(db);

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

    // try {
    //   await caller.review.save(review);
    // } catch (error) {
    //   console.error('Test failed with error:', error);
    // }
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
