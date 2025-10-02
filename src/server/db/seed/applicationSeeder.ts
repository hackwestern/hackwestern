import { faker } from "@faker-js/faker";
import {
  applications,
  avatarColour,
  countrySelection,
  ethnicity,
  gender,
  levelOfStudy,
  major,
  numOfHackathons,
  sexualOrientation,
} from "../schema";
import { USERS } from "./userSeeder";
import { type UserPartial, type Seeder } from "./helpers";
import type { z } from "zod";
import { applicationSubmitSchema } from "~/schemas/application";

const schools = [
  "Western University",
  "University of Waterloo",
  "University of Toronto",
];

export class ApplicationSeeder implements Seeder<typeof applications> {
  private users: UserPartial[] = [];
  tableName = "Applications";
  table = applications;
  constructor(
    users: UserPartial[],
    public numRows = USERS,
  ) {
    this.users = [...users];
    this.numRows = users.length;
  }

  static createCompleteWithoutUser(): z.infer<typeof applicationSubmitSchema> {
    return {
      ...ApplicationSeeder.createRandomWithoutUser(),
      age: faker.number.int({ min: 18, max: 65 }),
      agreeCodeOfConduct: true,
      agreeShareWithMLH: true,
      agreeWillBe18: true,
      agreeEmailsFromMLH: true,
      agreeShareWithSponsors: true,
      school: "Western University",
      phoneNumber: "519-936-5950",
    };
  }

  static createRandomWithoutUser() {
    const application = {
      avatarColour: faker.helpers.arrayElement(avatarColour.enumValues),
      avatarFace: faker.number.int({ min: 1, max: 5 }),
      avatarLeftHand: faker.number.int({ min: 1, max: 5 }),
      avatarRightHand: faker.number.int({ min: 1, max: 5 }),
      avatarHat: faker.number.int({ min: 1, max: 5 }),

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

  createRandom() {
    const user = this.users.pop();
    if (user === undefined) {
      throw new Error("There were no more users found.");
    }

    const application = ApplicationSeeder.createRandomWithoutUser();

    const names = user.name?.split(" ");
    const [firstName, lastName] = [names?.at(0), names?.at(-1)];

    return {
      ...application,
      userId: user.id,
      firstName,
      lastName,
    };
  }
}
