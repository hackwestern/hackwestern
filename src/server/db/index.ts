import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsTransaction,
} from "drizzle-orm/postgres-js";
import { type ExtractTablesWithRelations } from "drizzle-orm";
import postgres from "postgres";
import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema, logger: true });

export type Database = PostgresJsDatabase<typeof schema>;

export type Transaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Normalize the result of `db.execute` across drivers: postgres-js returns the
 * rows as a bare array, PGlite (used by the Vitest harness) wraps them in
 * `{ rows }`. Raw-SQL callers go through this so the same code works in both.
 */
export function extractRows<T>(result: unknown): T[] {
  return Array.isArray(result)
    ? (result as T[])
    : ((result as { rows?: T[] }).rows ?? []);
}
