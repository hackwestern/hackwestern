import { eq, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { clock } from "~/server/db/schema";
import { deriveStatus, type ClockState } from "~/lib/clock";

const CLOCK_ID = 1;

// Every timestamp is computed by Postgres (`now()`), never by the caller's
// device or this server's clock, so all clients agree on a single time source.
const nowMsSql = sql<number>`(extract(epoch from now()) * 1000)::float8`;

async function readClock(): Promise<ClockState> {
  // The migration seeds this row; the upsert covers fresh/test databases.
  await db.insert(clock).values({ id: CLOCK_ID }).onConflictDoNothing();

  const [row] = await db
    .select({
      endsAt: clock.endsAt,
      pausedRemainingMs: clock.pausedRemainingMs,
      durationMs: clock.durationMs,
      serverNowMs: nowMsSql,
    })
    .from(clock)
    .where(eq(clock.id, CLOCK_ID));

  if (!row) throw new Error("clock row missing");

  return {
    status: deriveStatus(row),
    endsAtMs: row.endsAt ? row.endsAt.getTime() : null,
    pausedRemainingMs: row.pausedRemainingMs,
    durationMs: row.durationMs,
    serverNowMs: Number(row.serverNowMs),
  };
}

const intervalMs = (ms: ReturnType<typeof sql>) =>
  sql`(${ms} * interval '1 millisecond')`;

export const clockRouter = createTRPCRouter({
  /** Current clock state. Public: hackers (and the projector) only read this. */
  get: publicProcedure.query(() => readClock()),

  /** Start (or restart) a full-length countdown from now. */
  start: protectedOrganizerProcedure.mutation(async () => {
    await readClock();
    await db
      .update(clock)
      .set({
        endsAt: sql`now() + ${intervalMs(sql`${clock.durationMs}`)}`,
        pausedRemainingMs: null,
        updatedAt: sql`now()`,
      })
      .where(eq(clock.id, CLOCK_ID));
    return readClock();
  }),

  /** Freeze the countdown, remembering how much time was left. */
  pause: protectedOrganizerProcedure.mutation(async () => {
    await readClock();
    await db
      .update(clock)
      .set({
        pausedRemainingMs: sql`greatest(0, floor(extract(epoch from (${clock.endsAt} - now())) * 1000))::int`,
        endsAt: null,
        updatedAt: sql`now()`,
      })
      .where(sql`${clock.id} = ${CLOCK_ID} and ${clock.endsAt} is not null`);
    return readClock();
  }),

  /** Continue a paused countdown with the time that was left. */
  resume: protectedOrganizerProcedure.mutation(async () => {
    await readClock();
    await db
      .update(clock)
      .set({
        endsAt: sql`now() + ${intervalMs(sql`${clock.pausedRemainingMs}`)}`,
        pausedRemainingMs: null,
        updatedAt: sql`now()`,
      })
      .where(
        sql`${clock.id} = ${CLOCK_ID} and ${clock.pausedRemainingMs} is not null`,
      );
    return readClock();
  }),

  /** Back to idle (shows the full duration, not counting). */
  reset: protectedOrganizerProcedure.mutation(async () => {
    await readClock();
    await db
      .update(clock)
      .set({ endsAt: null, pausedRemainingMs: null, updatedAt: sql`now()` })
      .where(eq(clock.id, CLOCK_ID));
    return readClock();
  }),
});
