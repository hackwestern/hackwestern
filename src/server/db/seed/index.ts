import { Transaction, conn, db } from "..";
import { users } from "../schema";
import { type PgTable, type PgInsertValue } from "drizzle-orm/pg-core";

import { ApplicationSeeder } from "./application-seeder";
import { PreregistrationSeeder } from "./preregistration-seeder";
import { UserSeeder } from "./user-seeder";

try {
  await seedDatabase();
} catch (e) {
  console.log("Something went wrong when seeding the database.", e);
} finally {
  conn.end();
}

export interface Seeder<T extends PgTable> {
  tableName: string;
  table: T;
  num: number;
  createRandom: () => PgInsertValue<T>;
}

export type UserPartial = {
  id: string;
  name: string | null;
};

function CreateSeeders(users: UserPartial[]): Seeder<PgTable>[] {
  return [new PreregistrationSeeder(), new ApplicationSeeder(users)];
}

function seed<T extends PgTable>(s: Seeder<T>, tx: Transaction) {
  console.log(`Seeding ${s.tableName}`);
  const vals = Array.from(Array(s.num), () => s.createRandom());

  return tx.insert(s.table).values(vals);
}

function deleteAll<T extends PgTable>(s: Seeder<T>, tx: Transaction) {
  console.log(`Deleting all rows from ${s.tableName}`);

  return tx.delete(s.table);
}

function seedUsers(
  us: Seeder<typeof users>,
  tx: Transaction,
): Promise<UserPartial[]> {
  return seed(us, tx).returning({ id: us.table.id, name: us.table.name });
}

async function seedDatabase(): Promise<void> {
  await db.transaction(async (tx) => {
    try {
      console.log("Starting to delete all rows from seeded tables...");

      const us = new UserSeeder();
      await deleteAll(us, tx);
      const insertedUsers = await seedUsers(us, tx);

      const seeders = CreateSeeders(insertedUsers);
      const deletePromises = seeders.map((s) => deleteAll(s, tx));
      const deleteResults = await Promise.allSettled(deletePromises);
      const deleteErrors = deleteResults
        .map((r, i) => ({
          tableName: seeders[i]?.tableName,
          ...r,
        }))
        .filter((r) => r.status === "rejected");

      if (deleteErrors.length > 0) {
        throw new Error(
          "Deleting rows from seeded tables failed.\n" +
            JSON.stringify(deleteErrors),
        );
      }

      console.log("Finished deleting rows from the seeded tables.");

      console.log("Starting to seed database...");

      const seedPromises = seeders.map((s) => seed(s, tx));

      const seedResults = await Promise.allSettled(seedPromises);
      const seedErrors = seedResults
        .map((r, i) => ({
          tableName: seeders[i]?.tableName,
          ...r,
        }))
        .filter((r) => r.status === "rejected");

      if (seedErrors.length > 0) {
        throw new Error(
          "Some seeders failed to seed correctly.\n" +
            JSON.stringify(seedErrors),
        );
      }

      console.log("Finished seeding the database.");
    } catch (e) {
      console.log(e, "Rolling back the database transaction.");
      tx.rollback();
      throw e;
    }
  });
}
