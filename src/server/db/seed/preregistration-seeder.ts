import { faker } from "@faker-js/faker";
import { Seeder } from ".";
import { preregistrations } from "../schema";

const PREREGISTRATIONS = 5000;

export class PreregistrationSeeder implements Seeder<typeof preregistrations> {
  tableName = "Preregistrations";
  table = preregistrations;
  num = PREREGISTRATIONS;

  createRandom() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
    };
  }
}
