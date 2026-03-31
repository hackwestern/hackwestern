import { users } from "../schema";
import { type Seeder } from "./helpers";
import { USERS, UserSeeder } from "./userSeeder";

export class OrganizerSeeder implements Seeder<typeof users> {
  tableName = "Users";
  table = users;
  seeder = new UserSeeder();
  constructor(public numRows = USERS) {}

  createRandom() {
    const user = this.seeder.createRandom();
    return {
      ...user,
      type: "organizer" as const,
    };
  }
}
