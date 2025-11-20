import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { createInnerTRPCContext } from "../trpc";
import { createCaller } from "../root";
import { assert, beforeEach, describe, expect, test } from "vitest";
import { preregistrations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PreregistrationSeeder } from "~/server/db/seed/preregistrationSeeder";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const testPreregistration = new PreregistrationSeeder().createRandom();

describe("preregistration.create", async () => {
  beforeEach(async () => {
    await db
      .delete(preregistrations)
      .where(eq(preregistrations.email, testPreregistration.email));
  });

  test("creates a new preregistration when it does not exist", async () => {
    const want = testPreregistration;
    const result = await caller.preregistration.create(want);

    assert(!!result);
    const { id, createdAt, ...got } = result;
    (void id, createdAt);

    expect(got).toEqual(want);
  });

  test("throws an error if the preregistration already exists", async () => {
    await caller.preregistration.create(testPreregistration);
    await expect(
      caller.preregistration.create(testPreregistration),
    ).rejects.toThrowError();
  });
});
