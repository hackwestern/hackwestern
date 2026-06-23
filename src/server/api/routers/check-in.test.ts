import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { applications, dayOfRegistrations, users } from "~/server/db/schema";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { TRPCError } from "@trpc/server";

const organizerSession = await mockOrganizerSession(db);
const organizerCtx = createInnerTRPCContext({ session: organizerSession });
const organizerCaller = createCaller(organizerCtx);

// ---------------------------------------------------------------------------
// searchByName
// ---------------------------------------------------------------------------

describe("checkIn.searchByName", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
    await insertTestApplication(hackerSession.user.id, {
      firstName: "Alice",
      lastName: "Smith",
      status: "CONFIRMED",
    });
  });

  afterEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("does not return partial first/last name match", async () => {
    const results = await organizerCaller.checkIn.searchByName({
      name: "Alice Jones",
    });
    expect(results).toHaveLength(0);
  });

  test("is case-insensitive", async () => {
    const results = await organizerCaller.checkIn.searchByName({
      name: "alice smith",
    });
    expect(results).toHaveLength(1);
  });

  test("returns multiple results with email and id when multiple people share the same name", async () => {
    const secondSession = await mockSession(db);
    await insertTestApplication(secondSession.user.id, {
      firstName: "Alice",
      lastName: "Smith",
      status: "CONFIRMED",
    });

    const results = await organizerCaller.checkIn.searchByName({
      name: "Alice Smith",
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => !!r.email)).toBe(true);
    expect(results.every((r) => !!r.userId)).toBe(true);

    await db
      .delete(applications)
      .where(eq(applications.userId, secondSession.user.id));
    await db.delete(users).where(eq(users.id, secondSession.user.id));
  });

  test("returns results for single-word query matching first or last name", async () => {
    const byFirst = await organizerCaller.checkIn.searchByName({
      name: "Alice",
    });
    expect(byFirst).toHaveLength(1);
    expect(byFirst[0]?.firstName).toBe("Alice");

    const byLast = await organizerCaller.checkIn.searchByName({
      name: "Smith",
    });
    expect(byLast).toHaveLength(1);
    expect(byLast[0]?.lastName).toBe("Smith");
  });

  test("does not return unconfirmed applicants", async () => {
    const session = await mockSession(db);
    await insertTestApplication(session.user.id, {
      firstName: "Alice",
      lastName: "Smith",
      status: "ACCEPTED",
    });
    const results = await organizerCaller.checkIn.searchByName({
      name: "Alice Smith",
    });
    expect(results).toHaveLength(1); // only the CONFIRMED one
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
    await db.delete(users).where(eq(users.id, session.user.id));
  });

  test("throws BAD_REQUEST for empty query", async () => {
    try {
      await organizerCaller.checkIn.searchByName({ name: "" });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.checkIn.searchByName({ name: "Alice Smith" });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// signInHacker
// ---------------------------------------------------------------------------

describe("checkIn.signInHacker", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
  });

  afterEach(async () => {
    await db
      .delete(dayOfRegistrations)
      .where(eq(dayOfRegistrations.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("creates a dayOfRegistration record and returns it", async () => {
    const result = await organizerCaller.checkIn.signInHacker({
      userId: hackerSession.user.id,
    });
    expect(result?.approved).toBe(true);
    expect(result?.signedInAt).toBeInstanceOf(Date);
  });

  test("throws CONFLICT if hacker is already signed in", async () => {
    await organizerCaller.checkIn.signInHacker({
      userId: hackerSession.user.id,
    });
    try {
      await organizerCaller.checkIn.signInHacker({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("CONFLICT");
    }
  });

  test("signs in when a dayOfRegistration row exists but signedInAt is null", async () => {
    await db
      .insert(dayOfRegistrations)
      .values({ userId: hackerSession.user.id, approved: false });

    const result = await organizerCaller.checkIn.signInHacker({
      userId: hackerSession.user.id,
    });
    expect(result?.signedInAt).toBeInstanceOf(Date);
    expect(result?.approved).toBe(true);
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.checkIn.signInHacker({ userId: hackerSession.user.id });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// checkIsHackerApproved
// ---------------------------------------------------------------------------

describe("checkIn.checkIsHackerApproved", () => {
  let hackerSession: Awaited<ReturnType<typeof mockSession>>;

  beforeEach(async () => {
    hackerSession = await mockSession(db);
  });

  afterEach(async () => {
    await db
      .delete(dayOfRegistrations)
      .where(eq(dayOfRegistrations.userId, hackerSession.user.id));
    await db
      .delete(applications)
      .where(eq(applications.userId, hackerSession.user.id));
    await db.delete(users).where(eq(users.id, hackerSession.user.id));
  });

  test("returns isApproved=true for ACCEPTED status", async () => {
    await insertTestApplication(hackerSession.user.id, { status: "ACCEPTED" });
    const result = await organizerCaller.checkIn.checkIsHackerApproved({
      userId: hackerSession.user.id,
    });
    expect(result.isApproved).toBe(true);
  });

  test("returns isApproved=true for CONFIRMED status", async () => {
    await insertTestApplication(hackerSession.user.id, { status: "CONFIRMED" });
    const result = await organizerCaller.checkIn.checkIsHackerApproved({
      userId: hackerSession.user.id,
    });
    expect(result.isApproved).toBe(true);
  });

  test("returns isApproved=false for PENDING_REVIEW status", async () => {
    await insertTestApplication(hackerSession.user.id, {
      status: "PENDING_REVIEW",
    });
    const result = await organizerCaller.checkIn.checkIsHackerApproved({
      userId: hackerSession.user.id,
    });
    expect(result.isApproved).toBe(false);
  });

  test("throws NOT_FOUND when no application exists", async () => {
    try {
      await organizerCaller.checkIn.checkIsHackerApproved({
        userId: "non-existent-user-id",
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  test("throws FORBIDDEN for non-organizer", async () => {
    await insertTestApplication(hackerSession.user.id, { status: "ACCEPTED" });
    const userCtx = createInnerTRPCContext({ session: hackerSession });
    const userCaller = createCaller(userCtx);
    try {
      await userCaller.checkIn.checkIsHackerApproved({
        userId: hackerSession.user.id,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertTestApplication(
  userId: string,
  overrides: Partial<typeof applications.$inferInsert> = {},
) {
  const [app] = await db
    .insert(applications)
    .values({
      userId,
      githubLink: "https://github.com/testuser",
      linkedInLink: "https://linkedin.com/in/testuser",
      devpostLink: "https://devpost.com/testuser",
      ...overrides,
    })
    .returning();
  if (!app) throw new Error("Failed to insert test application");
  return app;
}
