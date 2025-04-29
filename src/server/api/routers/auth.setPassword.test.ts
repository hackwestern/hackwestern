import { assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { mockSession } from "~/server/auth";
import {
  resetPasswordTokens,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

describe("auth.verify", () => {
  const failToken = randomBytes(20).toString("hex");
  const successToken = randomBytes(20).toString("hex");

  test("throw an error if no such token exists", async () => {
    await expect(caller.auth.verify({ token: failToken })).rejects.toThrowError(
      "not found",
    );
  });

  test("throws an error if the token is expired", async () => {
    const fakeId = faker.string.uuid();

    const fakeUser = {
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };

    await db.insert(users).values(fakeUser);

    await db.insert(verificationTokens).values({
      identifier: fakeId,
      token: failToken,
      expires: new Date(Date.now() - 1000 * 60 * 60),
    });

    await expect(caller.auth.verify({ token: failToken })).rejects.toThrowError(
      "expired",
    );
  });

  test("verifies the token successfully", async () => {
    const fakeId = faker.string.uuid();

    const fakeUser = {
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };

    await db.insert(users).values(fakeUser);

    await db.insert(verificationTokens).values({
      identifier: fakeId,
      token: successToken,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    const result = await caller.auth.verify({ token: successToken });

    expect(result.success).toBe(true);
  });

  describe.sequential("auth.setPassword", () => {
    const password = "NewP@ssword1";

    test("throws an error if token does not exist", async () => {
      const fakeToken = randomBytes(20).toString("hex");

      await expect(
        caller.auth.setPassword({
          token: fakeToken,
          password,
        }),
      ).rejects.toThrowError(/not found/i);
    });

    test("throws an error if token is expired", async () => {
      const fakeUserId = faker.string.uuid();
      const fakeToken = randomBytes(20).toString("hex");

      await db.insert(users).values({
        id: fakeUserId,
        email: faker.internet.email(),
        password: "oldpassword",
        emailVerified: faker.date.anytime(),
      });

      await db.insert(resetPasswordTokens).values({
        userId: fakeUserId,
        token: fakeToken,
        expires: new Date(Date.now() - 1000 * 60), // expired
      });

      await expect(
        caller.auth.setPassword({
          token: fakeToken,
          password,
        }),
      ).rejects.toThrowError(/expired/i);

      await db.delete(users).where(eq(users.id, fakeUserId));
    });

    test("successfully sets password and deletes token", async () => {
      const fakeUserId = faker.string.uuid();
      const fakeToken = randomBytes(20).toString("hex");
      const fakeEmail = faker.internet.email();

      await db.insert(users).values({
        id: fakeUserId,
        email: fakeEmail,
        password: "oldpassword",
        emailVerified: faker.date.anytime(),
      });

      await db.insert(resetPasswordTokens).values({
        userId: fakeUserId,
        token: fakeToken,
        expires: new Date(Date.now() + 1000 * 60 * 60), // 1 hour ahead
      });

      const result = await caller.auth.setPassword({
        token: fakeToken,
        password,
      });

      expect(result.success).toBe(true);

      // Verify password is actually updated and hashed
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, fakeUserId),
      });

      const match = await bcrypt.compare(password, updatedUser!.password!);
      expect(match).toBe(true);

      // Verify token is deleted
      const tokenRecord = await db.query.resetPasswordTokens.findFirst({
        where: eq(resetPasswordTokens.token, fakeToken),
      });

      expect(tokenRecord).toBeNull();

      await db.delete(users).where(eq(users.id, fakeUserId));
    });
  });
});
