import { eq, sql } from "drizzle-orm";
import { conn, db } from "~/server/db";
import { botState } from "~/server/db/schema";
import type { StateStore } from "./bot-state";

/** Bot state in Postgres (bot_state), for the Vercel cron, which has no lasting disk. */
export const dbStore: StateStore = {
  async get(key) {
    const [row] = await db
      .select({ value: botState.value })
      .from(botState)
      .where(eq(botState.key, key));
    return row?.value ?? null;
  },
  async set(key, value) {
    await db
      .insert(botState)
      .values({ key, value })
      .onConflictDoUpdate({
        target: botState.key,
        set: { value, updatedAt: sql`now()` },
      });
  },
};

/** pg advisory lock id for the ping syncs ("HWPINGS" as a number). */
export const PINGS_LOCK_ID = 7_262_401;

/**
 * Runs `fn` only if no other ping sync holds the lock, else returns null.
 * The lock is tied to a transaction, so it's released when `fn` finishes or
 * the function dies, and works through a connection pooler. Vercel can
 * deliver a cron event twice; this keeps two syncs from queueing the same DM.
 */
export async function withPingsLock<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  return conn.begin(async (tx) => {
    const [row] = await tx<{ locked: boolean }[]>`
      select pg_try_advisory_xact_lock(${PINGS_LOCK_ID}) as locked`;
    if (!row?.locked) return null;
    return fn();
  }) as Promise<T | null>;
}
