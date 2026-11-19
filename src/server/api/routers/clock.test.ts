import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { clock } from "~/server/db/schema";
import { mockOrganizerSession, mockSession } from "~/server/auth";

const organizer = createCaller(
  createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
);
const hacker = createCaller(
  createInnerTRPCContext({ session: await mockSession(db) }),
);
const anon = createCaller(createInnerTRPCContext({ session: null }));

async function resetRow() {
  await db.insert(clock).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(clock)
    .set({ endsAt: null, pausedRemainingMs: null })
    .where(eq(clock.id, 1));
}

beforeEach(resetRow);
afterAll(resetRow);

describe("clock.get", () => {
  test("is public and starts idle with the full 5 minutes", async () => {
    const state = await anon.clock.get();
    expect(state.status).toBe("idle");
    expect(state.durationMs).toBe(300_000);
    expect(state.endsAtMs).toBeNull();
    expect(Math.abs(state.serverNowMs - Date.now())).toBeLessThan(60_000);
  });
});

describe("clock mutations", () => {
  test("hackers and anonymous users cannot control the clock", async () => {
    for (const caller of [hacker, anon]) {
      await expect(caller.clock.start()).rejects.toThrow();
      await expect(caller.clock.pause()).rejects.toThrow();
      await expect(caller.clock.resume()).rejects.toThrow();
      await expect(caller.clock.reset()).rejects.toThrow();
    }
    expect((await anon.clock.get()).status).toBe("idle");
  });

  test("start runs for ~5 minutes measured on the server clock", async () => {
    const state = await organizer.clock.start();
    expect(state.status).toBe("running");
    const left = state.endsAtMs! - state.serverNowMs;
    expect(left).toBeGreaterThan(299_000);
    expect(left).toBeLessThanOrEqual(300_000);
  });

  test("pause freezes remaining time, resume continues from it", async () => {
    await organizer.clock.start();
    const paused = await organizer.clock.pause();
    expect(paused.status).toBe("paused");
    expect(paused.endsAtMs).toBeNull();
    expect(paused.pausedRemainingMs).toBeGreaterThan(298_000);
    expect(paused.pausedRemainingMs).toBeLessThanOrEqual(300_000);

    const resumed = await organizer.clock.resume();
    expect(resumed.status).toBe("running");
    expect(resumed.pausedRemainingMs).toBeNull();
    const left = resumed.endsAtMs! - resumed.serverNowMs;
    expect(left).toBeLessThanOrEqual(paused.pausedRemainingMs!);
    expect(left).toBeGreaterThan(paused.pausedRemainingMs! - 5_000);
  });

  test("pause when not running and resume when not paused are no-ops", async () => {
    expect((await organizer.clock.pause()).status).toBe("idle");
    expect((await organizer.clock.resume()).status).toBe("idle");
  });

  test("reset returns to idle from running or paused", async () => {
    await organizer.clock.start();
    expect((await organizer.clock.reset()).status).toBe("idle");
    await organizer.clock.start();
    await organizer.clock.pause();
    expect((await organizer.clock.reset()).status).toBe("idle");
  });
});
