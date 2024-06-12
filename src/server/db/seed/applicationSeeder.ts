import { faker } from "@faker-js/faker";
import {
  applicationStatus,
  applications,
  countrySelection,
  ethnicity,
  gender,
  levelOfStudy,
  major,
  numOfHackathons,
  sexualOrientation,
} from "../schema";
import { USERS } from "./userSeeder";
import { type UserPartial, type Seeder } from ".";

const schools = [
  "Western University",
  "University of Waterloo",
  "University of Toronto",
];

export class ApplicationSeeder implements Seeder<typeof applications> {
  private users: UserPartial[] = [];
  tableName = "Applications";
  table = applications;
  numRows = USERS;
  constructor(users: UserPartial[]) {
    this.users = users;
    this.numRows = users.length;
  }

  static createRandomWithoutUser() {
    return {
      status: faker.helpers.arrayElement(applicationStatus.enumValues),

      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      age: faker.number.int({ min: 17, max: 65 }),
      phoneNumber: faker.phone.number(),
      countryOfResidence: faker.helpers.arrayElement(countrySelection.enumValues),

      school: faker.helpers.arrayElement(schools),
      levelOfStudy: faker.helpers.arrayElement(levelOfStudy.enumValues),
      major: faker.helpers.arrayElement(major.enumValues),

      attendedBefore: faker.datatype.boolean(),
      numOfHackathons: faker.helpers.arrayElement(numOfHackathons.enumValues),

      question1: faker.lorem.paragraphs(2),
      question2: faker.lorem.paragraphs(2),
      question3: faker.lorem.paragraphs(2),

      resumeLink: faker.internet.url(),
      githubLink: faker.internet.url(),
      linkedInLink: faker.internet.url(),
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
