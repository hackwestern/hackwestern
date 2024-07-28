import { faker } from "@faker-js/faker";
import { reviews } from "../schema";
import { type Seeder } from ".";
import { reviewSubmitSchema } from "~/schemas/review";

const REVIEWS = 100;

export class ReviewSeeder implements Seeder<typeof reviews> {
  tableName = "reviews";
  table = reviews;
  numRows = REVIEWS;

  static createRandomWithoutUser() {
    const review = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      age: faker.number.int({ min: 17, max: 65 }),
      phoneNumber: faker.phone.number(),
      countryOfResidence: faker.helpers.arrayElement(
        countrySelection.enumValues,
      ),

      school: faker.helpers.arrayElement(schools),
      levelOfStudy: faker.helpers.arrayElement(levelOfStudy.enumValues),
      major: faker.helpers.arrayElement(major.enumValues),

      attendedBefore: faker.datatype.boolean(),
      numOfHackathons: faker.helpers.arrayElement(numOfHackathons.enumValues),

      question1: faker.lorem.paragraphs(3),
      question2: faker.lorem.paragraphs(3),
      question3: faker.lorem.paragraphs(3),

      resumeLink: faker.internet.url(),
      githubLink: faker.internet.userName(),
      linkedInLink: faker.internet.userName(),
      otherLink: faker.internet.url(),

      agreeCodeOfConduct: faker.datatype.boolean(),
      agreeShareWithSponsors: faker.datatype.boolean(),
      agreeShareWithMLH: faker.datatype.boolean(),
      agreeEmailsFromMLH: faker.datatype.boolean(),
      agreeWillBe18: faker.datatype.boolean(),

      // Optional Questions
      underrepGroup: faker.datatype.boolean(),
      gender: faker.helpers.arrayElement(gender.enumValues),
      ethnicity: faker.helpers.arrayElement(ethnicity.enumValues),
      sexualOrientation: faker.helpers.arrayElement(
        sexualOrientation.enumValues,
      ),
    };

    const isComplete = applicationSubmitSchema.safeParse(application).success;
    const status = isComplete
      ? ("PENDING_REVIEW" as const)
      : ("IN_PROGRESS" as const);
    return {
      ...application,
      status,
    };
  }
}
