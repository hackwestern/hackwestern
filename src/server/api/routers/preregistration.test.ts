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
import { preregistrations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PreregistrationSeeder } from "~/server/db/seed/preregistrationSeeder";
import * as mailModule from "~/server/mail";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const testPreregistration = new PreregistrationSeeder().createRandom();

// Mock the confirmation email so tests don't hit the real Cloudflare API.
const sendEmailSpy = vi.spyOn(mailModule, "sendEmail").mockResolvedValue({
  data: { delivered: [testPreregistration.email], queued: [], bounced: [] },
  error: null,
});

describe("preregistration.create", async () => {
  beforeEach(async () => {
    sendEmailSpy.mockClear();

    await db
      .delete(preregistrations)
      .where(eq(preregistrations.email, testPreregistration.email));
  });

  afterEach(() => {
    sendEmailSpy.mockClear();
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
});
