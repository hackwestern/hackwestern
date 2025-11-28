import { faker } from "@faker-js/faker";
import { scavengerHuntItems } from "~/server/db/schema";
import { type Seeder } from "./helpers";

const ITEMS = 20;
export class ScavengerHuntItemSeeder
  implements Seeder<typeof scavengerHuntItems>
{
  tableName = "ScavengerHuntItems";
  table = scavengerHuntItems;

  constructor(public numRows = ITEMS) {}

  createRandom() {
    return {
      code: faker.string.alphanumeric(6).toUpperCase(), // fake scan code
      name: faker.commerce.productName(), // item name
      points: faker.number.int({ min: 1, max: 50 }), // assign random points
      createdAt: new Date(),
    };
  }
}
