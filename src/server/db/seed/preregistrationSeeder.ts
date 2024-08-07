import { faker } from "@faker-js/faker";
import { preregistrations } from "../schema";
import { type Seeder } from "./helpers";

const PREREGISTRATIONS = 2345;

export class PreregistrationSeeder implements Seeder<typeof preregistrations> {
  tableName = "Preregistrations";
  table = preregistrations;
  numRows = PREREGISTRATIONS;

  createRandom() {
    return {
      email: faker.internet.email(),
    };
  }
}
