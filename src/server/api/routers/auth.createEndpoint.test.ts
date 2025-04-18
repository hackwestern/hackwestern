import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

describe("auth.create", () => {
  const fakeUser = {
    password: "Str0ngP@ssword!", // Valid password format
    email: faker.internet.email(),
  };

  const ctx = createInnerTRPCContext({ session: null });
  const caller = createCaller(ctx);

  test("creates a new user successfully", async () => {
    const createdUser = await caller.auth.create(fakeUser);

    expect(createdUser.success).toBe(true);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, fakeUser.email),
    });

    expect(dbUser?.email).toBe(fakeUser.email);
  });

  // test("throws an error when creating a duplicate user", async () => {
  //   try {
  //     await caller.auth.create(fakeUser);
  //   } catch (err) {
  //     console.error("Caught error:", err); // 👈 This will give us the exact shape of the error
  //     expect(err).toBeInstanceOf(TRPCError);
  //   }
  // });
  test("throws an error when creating a duplicate user", async () => {
    await expect(caller.auth.create(fakeUser)).rejects.toThrowError(
      /already exists/i,
    );
  });
});
