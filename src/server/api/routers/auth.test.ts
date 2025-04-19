import { assert, describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { mockSession } from "~/server/auth";
import { resetPasswordTokens, users } from "~/server/db/schema";

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
