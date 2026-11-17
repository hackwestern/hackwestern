import { faker } from "@faker-js/faker";
import { scavengerHuntItems, scavengerHuntItemType } from "~/server/db/schema";
import { type Seeder } from "./helpers";

const ITEMS = 20;
export class ScavengerHuntItemSeeder
  implements Seeder<typeof scavengerHuntItems>
{
  tableName = "ScavengerHuntItems";
  table = scavengerHuntItems;

  constructor(public numRows = ITEMS) {}

  createRandom() {
    const startsAt = faker.date.soon({ days: 3 });
    return {
      code: faker.string.alphanumeric(6).toUpperCase(), // fake scan code
      points: faker.number.int({ min: 1, max: 50 }), // assign random points
      type: faker.helpers.arrayElement(scavengerHuntItemType.enumValues),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      deletedAt: null,
      description: faker.lorem.text(), // assign random text as description
    };
  }
}
