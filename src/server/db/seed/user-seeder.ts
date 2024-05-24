import { faker } from "@faker-js/faker";
import { users } from "../schema";
import { Seeder } from ".";

export const USERS = 30;

export class UserSeeder implements Seeder<typeof users> {
  private userIds = faker.helpers.uniqueArray(faker.string.uuid, USERS);
  tableName = "Users";
  table = users;
  num = USERS;

  createRandom() {
    return {
      id: this.userIds.pop() ?? "",
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };
  }
}
