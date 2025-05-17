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

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

describe.sequential("auth.reset", async () => {
  const fakeEmail = faker.internet.email();
  const fakeUserId = faker.string.uuid();

  test("Throws an error if no such user exists", () => {
    return expect(
      caller.auth.reset({ email: fakeEmail }),
    ).rejects.toThrowError();
  });

  test("Sends a reset email if the user exists", async () => {
    // insert fake user
    await db
      .insert(users)
      .values({
        id: fakeUserId,
        name: faker.person.fullName(),
        email: fakeEmail,
        emailVerified: faker.date.anytime(),
        image: faker.image.avatar(),
      })
      .returning()
      .then((res) => res[0]);

    const result = await caller.auth.reset({ email: fakeEmail });

    // non-null result
    assert(!!result);

    // clean up inserted user and associated pw reset token
    await db
      .delete(resetPasswordTokens)
      .where(eq(resetPasswordTokens.userId, fakeUserId));
    await db.delete(users).where(eq(users.email, fakeEmail));
  });
});

describe.sequential("auth.create", () => {
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

  test("throws an error when creating a duplicate user", async () => {
    await expect(caller.auth.create(fakeUser)).rejects.toThrowError(
      /already exists/i,
    );
  });
});

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
});

describe.sequential("auth.checkVerified", async () => {
  test("throws an error if not logged in", async () => {
    const unauthCtx = createInnerTRPCContext({ session: null });
    const unauthCaller = createCaller(unauthCtx);

    await expect(unauthCaller.auth.checkVerified()).rejects.toThrowError(
      "Not logged in",
    );
  });

  test("Returns verification status for non-verified email", async () => {
    const userId = session.user.id;

    //update email to be unverified
    await db
      .update(users)
      .set({
        emailVerified: null,
      })
      .where(eq(users.id, userId));

    const result = await caller.auth.checkVerified();
    expect(result.verified).toBeNull();
  });

  test("Returns verification status for verified email", async () => {
    const userId = session.user.id;
    const verificationDate = faker.date.recent();

    //update email to be verified
    await db
      .update(users)
      .set({
        emailVerified: verificationDate,
      })
      .where(eq(users.id, userId));

    const result = await caller.auth.checkVerified();
    expect(result.verified).toEqual(verificationDate);
  });
});
