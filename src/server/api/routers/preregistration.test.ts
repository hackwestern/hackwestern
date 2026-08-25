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
import * as contactsModule from "~/server/mailjet-contacts";
import { generateUnsubscribeToken, normalizeEmail } from "~/server/subscribers";
import { env } from "~/env";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const testPreregistration = new PreregistrationSeeder().createRandom();

// Mock the confirmation email so tests don't hit the real Mailjet API.
const sendEmailSpy = vi.spyOn(mailModule, "sendViaMailjet").mockResolvedValue({
  data: { delivered: [testPreregistration.email], queued: [], bounced: [] },
  error: null,
});

// Same for the contact-list write, so tests never touch the real Mailjet list.
const manageContactSpy = vi
  .spyOn(contactsModule, "manageContact")
  .mockResolvedValue({ ok: true });

describe("preregistration.create", async () => {
  beforeEach(async () => {
    sendEmailSpy.mockClear();
    manageContactSpy.mockClear();

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
    manageContactSpy.mockClear();
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
    // NORMALIZED, not the raw input. Mailjet's Send API creates a contact from
    // whatever address it delivered to, so sending to the raw form files a
    // second contact for the same mailbox alongside the one managecontact adds.
    expect(arg?.to).toBe(normalizeEmail(testPreregistration.email));
    expect(arg?.subject).toContain("signed up");
    expect(arg?.html).toBeTruthy();
  });

  test("files the new signup into the Mailjet contact list, normalized", async () => {
    await caller.preregistration.create(testPreregistration);

    expect(manageContactSpy).toHaveBeenCalledTimes(1);
    const [listId, email, , action] = manageContactSpy.mock.calls[0] ?? [];
    expect(listId).toBe(env.MAILJET_CONTACT_LIST_ID);
    expect(email).toBe(normalizeEmail(testPreregistration.email));
    // Default action. addforce would reset IsUnsubscribed and resurrect opt-outs.
    expect(action).toBeUndefined();
  });

  // The row is committed before this call, so a Mailjet outage must not turn a
  // successful signup into an error for the user.
  test("still succeeds when the Mailjet list write fails", async () => {
    manageContactSpy.mockResolvedValueOnce({ ok: false, error: "boom" });

    await expect(
      caller.preregistration.create(testPreregistration),
    ).resolves.toBeTruthy();

    const row = await db.query.preregistrations.findFirst({
      where: (p, { eq }) =>
        eq(p.email, normalizeEmail(testPreregistration.email)),
    });
    expect(row).toBeTruthy();
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
