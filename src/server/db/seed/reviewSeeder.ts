import { faker } from "@faker-js/faker";
import { reviews } from "../schema";
import { USERS } from "./userSeeder";
import type { UserPartial, Seeder } from "./helpers";
import { reviewSubmitSchema } from "~/schemas/review";

export class ReviewSeeder implements Seeder<typeof reviews> {
  private reviewers: UserPartial[] = [];
  private applicants: UserPartial[] = [];
  tableName = "reviews";
  table = reviews;
  numRows = USERS;
  constructor(reviewers: UserPartial[], users: UserPartial[]) {
    this.reviewers = reviewers;
    this.applicants = users;
    this.numRows = users.length;
  }

  static createRandomWithoutUser() {
    const review = {
      originalityRating: faker.number.int({ min: 1, max: 10 }),
      technicalityRating: faker.number.int({ min: 1, max: 10 }),
      passionRating: faker.number.int({ min: 1, max: 10 }),
      comments: faker.lorem.sentence(),
      referral: faker.datatype.boolean(),
    };

    const completed = reviewSubmitSchema.safeParse(review).success;
    return {
      ...review,
      completed,
    };
  }

  createRandom() {
    const applicant = this.applicants.pop();
    const reviewer = this.reviewers.pop();
    if (reviewer === undefined) {
      throw new Error("There were no more reviewers found.");
    }
    if (applicant === undefined) {
      throw new Error("There were no more applicants found.");
    }

    const review = ReviewSeeder.createRandomWithoutUser();

    return {
      ...review,
      applicantUserId: applicant.id,
      reviewerUserId: reviewer.id,
    };
  }
}
