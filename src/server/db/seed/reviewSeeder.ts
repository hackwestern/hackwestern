import { faker } from "@faker-js/faker";
import { reviews } from "../schema";
import { USERS } from "./userSeeder";
import { UserPartial, type Seeder } from ".";
import { reviewSubmitSchema } from "~/schemas/review";

export class ReviewSeeder implements Seeder<typeof reviews> {
  private reviewers: UserPartial[] = [];
  private applicants: UserPartial[] = [];
  tableName = "reviews";
  table = reviews;
  numRows = USERS;
  constructor(reviewers: UserPartial[], users: UserPartial[]) {
    this.reviewers = reviewers;;
    this.applicants = users;
    this.numRows = users.length;
  }

  static createRandomWithoutUser() {
    const review = {
      question1Rating: faker.number.int({ min: 1, max: 10 }),
      question2Rating: faker.number.int({ min: 1, max: 10 }),
      question3Rating: faker.number.int({ min: 1, max: 10 }),
      resumeBonus: faker.number.int({ min: 0, max: 3 }),
      githubBonus: faker.number.int({ min: 0, max: 3 }),
      linkedinBonus: faker.number.int({ min: 0, max: 3 }),
      otherlinkBonus: faker.number.int({ min: 0, max: 3 }),
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
