import { assert, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { authOptions, mockSession } from "~/server/auth";
import {
  resetPasswordTokens,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { randomBytes } from "crypto";
import * as mailModule from "~/server/mail-mailjet";
import * as contactsModule from "~/server/mailjet-contacts";
import { normalizeEmail } from "~/server/subscribers";
import { env } from "~/env";

// Mock the contact-list write so tests never touch the real Mailjet list.
const manageContactSpy = vi
  .spyOn(contactsModule, "manageContact")
  .mockResolvedValue({ ok: true });

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
    const sendEmailSpy = vi
      .spyOn(mailModule, "sendViaMailjet")
      .mockResolvedValue({
        data: { delivered: [fakeEmail], queued: [], bounced: [] },
        error: null,
      });

    // Insert the fake user CANONICAL (trim+lowercase) — that is the only form
    // a real row can have, since auth.create normalizes on write. Calling
    // reset with faker's raw (often mixed-case) email then exercises the
    // lookup-side normalization.
    await db
      .insert(users)
      .values({
        id: fakeUserId,
        name: faker.person.fullName(),
        email: fakeEmail.toLowerCase(),
        emailVerified: faker.date.anytime(),
        image: faker.image.avatar(),
      })
      .returning()
      .then((res) => res[0]);

    try {
      const result = await caller.auth.reset({ email: fakeEmail });

      // non-null result
      assert(!!result);
    } finally {
      sendEmailSpy.mockRestore();

      // clean up inserted user and associated pw reset token
      await db
        .delete(resetPasswordTokens)
        .where(eq(resetPasswordTokens.userId, fakeUserId));
      await db.delete(users).where(eq(users.email, fakeEmail.toLowerCase()));
    }
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
    const sendEmailSpy = vi
      .spyOn(mailModule, "sendViaMailjet")
      .mockResolvedValue({
        data: { delivered: [fakeUser.email], queued: [], bounced: [] },
        error: null,
      });

    try {
      const createdUser = await caller.auth.create(fakeUser);

      expect(createdUser.success).toBe(true);

      // Stored canonical: trim+lowercase, whatever casing was typed. (faker
      // emails are often mixed-case, so this also exercises the normalization.)
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, fakeUser.email.toLowerCase()),
      });

      expect(dbUser?.email).toBe(fakeUser.email.toLowerCase());
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  test("throws an error when creating a duplicate user", async () => {
    await expect(caller.auth.create(fakeUser)).rejects.toThrowError(
      /already exists/i,
    );
  });

  // The HW12 failure mode: same mailbox, different casing, second account
  // created. 7 of 2,278 HW12 users hit this — one was ACCEPTED on one account
  // with a duplicate still in PENDING_REVIEW.
  test("rejects a duplicate that differs only in casing", async () => {
    const swapped =
      fakeUser.email === fakeUser.email.toLowerCase()
        ? fakeUser.email.toUpperCase()
        : fakeUser.email.toLowerCase();
    await expect(
      caller.auth.create({ ...fakeUser, email: swapped }),
    ).rejects.toThrowError(/already exists/i);
  });

  test("rejects a duplicate with surrounding whitespace", async () => {
    await expect(
      caller.auth.create({ ...fakeUser, email: ` ${fakeUser.email} ` }),
    ).rejects.toThrowError();
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

  // Every registrant joins the marketing list at email verification — decided
  // 2026-09-06, consent = CASL implied (inquiry). Gated on verification, not
  // raw signup, so typo'd addresses never reach the list and feed its bounce
  // rate. Normalized, because managecontact on the raw gmail form would file a
  // second contact for the same mailbox.
  test("files the verified registrant into the Mailjet contact list, normalized", async () => {
    manageContactSpy.mockClear();
    const fakeId = faker.string.uuid();
    const token = randomBytes(20).toString("hex");

    await db.insert(users).values({
      id: fakeId,
      name: faker.person.fullName(),
      email: "list.reg.test+hw13@gmail.com",
      emailVerified: null,
      image: faker.image.avatar(),
    });
    await db.insert(verificationTokens).values({
      identifier: fakeId,
      token,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    try {
      await caller.auth.verify({ token });

      expect(manageContactSpy).toHaveBeenCalledTimes(1);
      const [listId, email, , action] = manageContactSpy.mock.calls[0] ?? [];
      expect(listId).toBe(env.MAILJET_CONTACT_LIST_ID);
      expect(email).toBe(normalizeEmail("list.reg.test+hw13@gmail.com"));
      // Default action. addforce would reset IsUnsubscribed and resurrect opt-outs.
      expect(action).toBeUndefined();
    } finally {
      await db.delete(users).where(eq(users.id, fakeId));
    }
  });

  // The verification is already committed; a Mailjet outage must not undo it
  // from the user's point of view.
  test("still succeeds when the Mailjet list write fails", async () => {
    manageContactSpy.mockClear();
    manageContactSpy.mockResolvedValueOnce({ ok: false, error: "boom" });
    const fakeId = faker.string.uuid();
    const token = randomBytes(20).toString("hex");

    await db.insert(users).values({
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: null,
      image: faker.image.avatar(),
    });
    await db.insert(verificationTokens).values({
      identifier: fakeId,
      token,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    try {
      await expect(caller.auth.verify({ token })).resolves.toEqual({
        success: true,
      });
    } finally {
      await db.delete(users).where(eq(users.id, fakeId));
    }
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

describe("auth.checkValidToken", () => {
  test("throw an error if no such token exists", async () => {
    await expect(
      caller.auth.checkValidToken({ token: "nonexistent-token" }),
    ).rejects.toThrowError("not found");
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

    await db.insert(resetPasswordTokens).values({
      userId: fakeId,
      token: "expired-token",
      expires: new Date(Date.now() - 1000 * 60 * 60),
    });

    await expect(
      caller.auth.checkValidToken({ token: "expired-token" }),
    ).rejects.toThrowError("expired");
  });

  test("validates the token successfully", async () => {
    const fakeId = faker.string.uuid();

    const fakeUser = {
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };

    await db.insert(users).values(fakeUser);

    await db.insert(resetPasswordTokens).values({
      userId: fakeId,
      token: "valid-token",
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    //reinserts item that gets deleted
    await db.insert(verificationTokens).values({
      identifier: fakeId,
      token: "valid-token",
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    const result = await caller.auth.checkValidToken({ token: "valid-token" });

    expect(result.success).toBe(true);
  });

  // checkValidToken is the second site that sets emailVerified (a delivered
  // reset email proves mailbox ownership), so it files the registrant into the
  // marketing list the same way auth.verify does.
  test("files the verified registrant into the Mailjet contact list", async () => {
    manageContactSpy.mockClear();
    const fakeId = faker.string.uuid();
    const token = randomBytes(20).toString("hex");

    await db.insert(users).values({
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      emailVerified: null,
      image: faker.image.avatar(),
    });
    await db.insert(resetPasswordTokens).values({
      userId: fakeId,
      token,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    try {
      await caller.auth.checkValidToken({ token });

      expect(manageContactSpy).toHaveBeenCalledTimes(1);
      const [listId] = manageContactSpy.mock.calls[0] ?? [];
      expect(listId).toBe(env.MAILJET_CONTACT_LIST_ID);
    } finally {
      await db
        .delete(resetPasswordTokens)
        .where(eq(resetPasswordTokens.userId, fakeId));
      await db.delete(users).where(eq(users.id, fakeId));
    }
  });
});

// OAuth sign-ins (GitHub/Google/Discord) create the user through next-auth's
// own flow and never touch auth.verify, so the createUser event is what files
// them into the marketing list. The credentials path bypasses events entirely
// (auth.create calls adapter.createUser directly) and joins at verification.
describe("authOptions.events.createUser", () => {
  test("files an OAuth-created user into the Mailjet contact list, normalized", async () => {
    manageContactSpy.mockClear();

    await authOptions.events?.createUser?.({
      user: {
        id: faker.string.uuid(),
        email: "oauth.reg.test+hw13@gmail.com",
      },
    });

    expect(manageContactSpy).toHaveBeenCalledTimes(1);
    const [listId, email, , action] = manageContactSpy.mock.calls[0] ?? [];
    expect(listId).toBe(env.MAILJET_CONTACT_LIST_ID);
    expect(email).toBe(normalizeEmail("oauth.reg.test+hw13@gmail.com"));
    // Default action. addforce would reset IsUnsubscribed and resurrect opt-outs.
    expect(action).toBeUndefined();
  });
});

describe("auth.resendEmail", () => {
  test("unauthorized user: throws error", async () => {
    const unauthCtx = createInnerTRPCContext({ session: null });
    const unauthCaller = createCaller(unauthCtx);
    await expect(unauthCaller.auth.resendEmail()).rejects.toThrowError(
      "Not logged in",
    );
  });

  test("non-existent user: throws error", async () => {
    const fakeSession = {
      ...session,
      user: {
        ...session.user,
        id: "non-existent-id",
        email: "nonexistent@example.com",
      },
    };
    const fakeCtx = createInnerTRPCContext({ session: fakeSession });
    const fakeCaller = createCaller(fakeCtx);
    await expect(fakeCaller.auth.resendEmail()).rejects.toThrowError(
      /not found/i,
    );
  });

  test("existing user: returns success", async () => {
    const sessionUser = session.user;
    await db
      .insert(users)
      .values({
        id: sessionUser.id,
        name: sessionUser.name ?? faker.person.fullName(),
        email: sessionUser.email ?? faker.internet.email(),
        emailVerified: null,
        image: sessionUser.image ?? faker.image.avatar(),
      })
      .onConflictDoNothing?.();

    const sendEmailSpy = vi
      .spyOn(mailModule, "sendViaMailjet")
      .mockResolvedValue({
        data: { delivered: ["mock@example.com"], queued: [], bounced: [] },
        error: null,
      });

    try {
      const result = await caller.auth.resendEmail();
      expect(result.success).toBe(true);
    } finally {
      // Restore the original method with its context
      sendEmailSpy.mockRestore();
    }
  });
});

describe("auth.setPassword", () => {
  test("throw an error if no such token exists", async () => {
    const nonexistentToken = randomBytes(20).toString("hex"); // 40 characters
    await expect(
      caller.auth.setPassword({
        password: "HackWestern12!",
        token: nonexistentToken,
      }),
    ).rejects.toThrowError("not found");
  });

  test("throws an error if the token is expired", async () => {
    const fakeId = faker.string.uuid();
    const expiredToken = randomBytes(20).toString("hex"); // 40 characters

    const fakeUser = {
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };

    await db.insert(users).values(fakeUser);

    await db.insert(resetPasswordTokens).values({
      userId: fakeId,
      token: expiredToken, // Use the 40-character token
      expires: new Date(Date.now() - 1000 * 60 * 60),
    });

    await expect(
      caller.auth.setPassword({
        password: "HackWestern12!",
        token: expiredToken,
      }),
    ).rejects.toThrowError("expired");
  });

  test("validates the token successfully", async () => {
    const fakeId = faker.string.uuid();
    const validToken = randomBytes(20).toString("hex"); // 40 characters

    const fakeUser = {
      id: fakeId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      emailVerified: faker.date.anytime(),
      image: faker.image.avatar(),
    };

    await db.insert(users).values(fakeUser);

    await db.insert(resetPasswordTokens).values({
      userId: fakeId,
      token: validToken, // Use the 40-character token
      expires: new Date(Date.now() + 1000 * 60 * 60),
    });

    const result = await caller.auth.setPassword({
      password: "HackWestern12!",
      token: validToken,
    });

    expect(result.success).toBe(true);
  });
});
