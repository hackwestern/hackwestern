import { faker } from "@faker-js/faker";
import { Seeder } from ".";
import { preregistrations } from "../schema";

const PREREGISTRATIONS = 2345;

export class PreregistrationSeeder implements Seeder<typeof preregistrations> {
  tableName = "Preregistrations";
  table = preregistrations;
  numRows = PREREGISTRATIONS;

  createRandom() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
    };
  }
}
