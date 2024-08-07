import { conn } from "..";
import { seedDatabase } from "./helpers";
import * as p from "@clack/prompts";

p.intro("Starting hackwestern db seed script");
try {
  await seedDatabase();
} catch (e) {
  console.error("\nSomething went wrong when seeding the database.", e);
  p.outro("Seed script failed.");
} finally {
  await conn.end();
}
