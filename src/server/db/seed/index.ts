import { conn } from "..";
import { seedDatabase } from "./helpers";
import * as p from "@clack/prompts";

p.intro("Starting hackwestern db seed script");
if (!process.env.DATABASE_URL?.includes("localhost")) {
  p.outro("Seed script must only be run on localhost.");
  process.exit(1);
}
try {
  await seedDatabase();
} catch (e) {
  console.error("\nSomething went wrong when seeding the database.", e);
  p.outro("Seed script failed.");
} finally {
  await conn.end();
}
