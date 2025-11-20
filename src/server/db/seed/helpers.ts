import { type Transaction, db } from "..";
import { type users } from "../schema";
import { type PgTable, type PgInsertValue } from "drizzle-orm/pg-core";

import { ApplicationSeeder } from "./applicationSeeder";
import { PreregistrationSeeder } from "./preregistrationSeeder";
import { UserSeeder } from "./userSeeder";

import * as p from "@clack/prompts";

const MAX_INSERT_PARAMETERS = 2000;

export async function seedDatabase(): Promise<void> {
  const shouldSeed = await p.confirm({
    message:
      "Are you sure you want to continue seeding? THIS WILL DELETE ALL ROWS in the seeded tables.",
  });

  if (!shouldSeed) {
    p.outro("Stopped seed script.");
    return;
  }

  await deleteSeedTables();
  await seedTables();
  p.outro("You're all set!");
}

export interface Seeder<T extends PgTable> {
  tableName: string;
  table: T;
  numRows: number;
  createRandom: () => PgInsertValue<T>;
}

export type UserPartial = {
  id: string;
  name: string | null;
};

function CreateSeeders(users: UserPartial[]): Seeder<PgTable>[] {
  return [new PreregistrationSeeder(), new ApplicationSeeder(users)];
}

function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from(new Array(Math.ceil(array.length / size)), (_, i) =>
    array.slice(i * size, i * size + size),
  );
}

export function seed<T extends PgTable>(s: Seeder<T>, tx: Transaction) {
  const vals = Array.from(Array(s.numRows), () => s.createRandom());

  if (vals.length === 0) return [];

  // Estimate number of columns by inspecting the first generated row.
  // The number of SQL parameters for a multi-row insert is columns * rows.
  const firstRow = vals[0] as unknown as Record<string, unknown>;
  const numColumns = Object.keys(firstRow).length;

  // Determine how many rows we can insert per batch without exceeding parameter limit.
  const rowsPerBatch = Math.floor(
    MAX_INSERT_PARAMETERS / Math.max(numColumns, 1),
  );

  if (rowsPerBatch < 1) {
    throw new Error(
      `Seeder ${s.tableName} produces rows with ${numColumns} columns which exceeds the MAX_INSERT_PARAMETERS (${MAX_INSERT_PARAMETERS}). Reduce columns or increase MAX_INSERT_PARAMETERS.`,
    );
  }

  const batches = chunkArray(vals, rowsPerBatch);
  return batches.map((b) => tx.insert(s.table).values(b).onConflictDoNothing());
}

function deleteAll<T extends PgTable>(s: Seeder<T>, tx: Transaction) {
  return tx.delete(s.table);
}

export async function seedUsers(
  us: Seeder<typeof users>,
  tx: Transaction,
): Promise<UserPartial[]> {
  const usersChunked = await Promise.all(
    seed(us, tx).map((b) =>
      b.returning({ id: us.table.id, name: us.table.name }),
    ),
  );

  return usersChunked.flat(1);
}

async function deleteSeedTables(): Promise<void> {
  await db.transaction(async (tx) => {
    const delSpinner = p.spinner();
    delSpinner.start("Starting to delete rows from seeded tables.");

    const seeders = [new UserSeeder(), ...CreateSeeders([])];
    const seederTableNames = seeders.map((s) => s.tableName);

    delSpinner.message(
      `Deleting rows from tables ${seederTableNames.join(", ")}`,
    );
    const deletePromises = seeders.map((s) => deleteAll(s, tx));
    const deleteResults = await Promise.allSettled(deletePromises);
    const deleteErrors = deleteResults
      .map((r, i) => ({
        tableName: seeders[i]?.tableName,
        ...r,
      }))
      .filter((r) => r.status === "rejected");

    if (deleteErrors.length > 0) {
      delSpinner.stop("Deleting rows from tables failed.");
      throw new Error(
        "Deleting rows from seeded tables failed.\n" +
          JSON.stringify(deleteErrors),
      );
    }

    delSpinner.stop("Finished deleting rows from the seeded tables.");
  });
}

async function seedTables(): Promise<void> {
  await db.transaction(async (tx) => {
    try {
      const seedSpinner = p.spinner();
      seedSpinner.start("Starting to seed tables");

      seedSpinner.message("Seeding users table");
      const us = new UserSeeder();
      const insertedUsers = await seedUsers(us, tx);

      const seeders = CreateSeeders(insertedUsers);
      const seederTableNames = seeders.map((s) => s.tableName);

      seedSpinner.message(`Seeding tables ${seederTableNames.join(", ")}`);

      const seedResults = await Promise.allSettled(
        seeders.map((s) => Promise.all(seed(s, tx))),
      );
      const seedErrors = seedResults
        .map((r, i) => ({
          tableName: seeders[i]?.tableName,
          ...r,
        }))
        .filter((r) => r.status === "rejected");

      if (seedErrors.length > 0) {
        seedSpinner.stop("Seeding tables failed.");
        throw new Error(
          "Some seeders failed to seed correctly.\n" +
            JSON.stringify(seedErrors),
        );
      }

      seedSpinner.stop("Finished seeding the database.");
    } catch (e) {
      console.log(e, "Rolling back the database transaction.");
      tx.rollback();
      throw e;
    }
  });
}
