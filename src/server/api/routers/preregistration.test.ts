import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { createInnerTRPCContext } from "../trpc";
import { createCaller } from "../root";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { emailSubscribers, preregistrations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PreregistrationSeeder } from "~/server/db/seed/preregistrationSeeder";
import * as mailModule from "~/server/mail-mailjet";
import { generateUnsubscribeToken, normalizeEmail } from "~/server/subscribers";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const testPreregistration = new PreregistrationSeeder().createRandom();

// Mock the confirmation email so tests don't hit the real Mailjet API.
const sendEmailSpy = vi.spyOn(mailModule, "sendViaMailjet").mockResolvedValue({
  data: { delivered: [testPreregistration.email], queued: [], bounced: [] },
  error: null,
});

describe("preregistration.create", async () => {
  beforeEach(async () => {
    sendEmailSpy.mockClear();

    // Delete by the NORMALIZED address, because that is what create() stores.
    // Deleting by the raw seed address left the row behind, and every later test
    // then failed on its own first create with a spurious CONFLICT.
    await db
      .delete(preregistrations)
      .where(
        eq(preregistrations.email, normalizeEmail(testPreregistration.email)),
      );
  });

  afterEach(() => {
    sendEmailSpy.mockClear();
  });

  test("creates a new preregistration when it does not exist", async () => {
    const want = testPreregistration;
    const result = await caller.preregistration.create(want);

    assert(!!result);
    const {
      id,
      createdAt,
      unsubscribeToken,
      unsubscribedAt,
      bouncedAt,
      ...got
    } = result;
    (void id, createdAt, unsubscribedAt, bouncedAt);

    // The stored email is normalized, not the raw input. This assertion used to
    // expect the raw form, which is exactly the bug it was hiding: storing
    // "Ari_Maggio@gmail.com" while the duplicate check looked up the normalized
    // form meant the same person could sign up twice and get every email twice.
    expect(got).toEqual({ ...want, email: normalizeEmail(want.email) });
    // a unique unsubscribe token is generated for the updates email
    expect(unsubscribeToken).toMatch(/^[a-f0-9]{40}$/);
  });

  test("throws an error if the preregistration already exists", async () => {
    await caller.preregistration.create(testPreregistration);
    await expect(
      caller.preregistration.create(testPreregistration),
    ).rejects.toThrowError();
  });

  test("sends a confirmation email to the new signup", async () => {
    await caller.preregistration.create(testPreregistration);

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    const arg = sendEmailSpy.mock.calls[0]?.[0];
    expect(arg?.to).toBe(testPreregistration.email);
    expect(arg?.subject).toContain("signed up");
    expect(arg?.html).toBeTruthy();
  });

  test("does not send a confirmation email when the signup already exists", async () => {
    await caller.preregistration.create(testPreregistration);
    sendEmailSpy.mockClear();

    await expect(
      caller.preregistration.create(testPreregistration),
    ).rejects.toThrowError();
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  test("rejects signup when the email already exists in email_subscribers", async () => {
    // subscribers are stored normalized, so seed the normalized form
    const normalized = normalizeEmail(testPreregistration.email);
    await db
      .delete(emailSubscribers)
      .where(eq(emailSubscribers.email, normalized));
    await db.insert(emailSubscribers).values({
      email: normalized,
      source: "hw12",
      unsubscribeToken: generateUnsubscribeToken(),
    });

    await expect(
      caller.preregistration.create(testPreregistration),
    ).rejects.toThrowError();
    expect(sendEmailSpy).not.toHaveBeenCalled();

    // cleanup
    await db
      .delete(emailSubscribers)
      .where(eq(emailSubscribers.email, normalized));
  });
});
