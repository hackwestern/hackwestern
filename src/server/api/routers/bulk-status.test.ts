import { afterEach, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { applications, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { normalizeAuthEmail } from "~/server/subscribers";

const organizerSession = await mockOrganizerSession(db);
const organizerCaller = createCaller(
  createInnerTRPCContext({ session: organizerSession }),
);

type Status = "PENDING_REVIEW" | "CONFIRMED" | "DECLINED";

const seeded: string[] = [];

// A hacker with an application in `status`. Signup stores emails canonical
// (trim+lowercase) and mockSession doesn't, so the email is canonicalized here.
async function seedHacker(status: Status) {
  const session = await mockSession(db);
  const email = normalizeAuthEmail(session.user.email!);
  await db.update(users).set({ email }).where(eq(users.id, session.user.id));
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
  });
  seeded.push(session.user.id);
  return { session, email };
}

const statusOf = async (userId: string) =>
  (
    await db.query.applications.findFirst({
      columns: { status: true },
      where: eq(applications.userId, userId),
    })
  )?.status;

describe("application.bulkUpdateStatusByEmails", () => {
  afterEach(async () => {
    await db.delete(applications).where(inArray(applications.userId, seeded));
    await db.delete(users).where(inArray(users.id, seeded));
    seeded.length = 0;
  });

  test("an accept list never undoes an RSVP", async () => {
    const pending = await seedHacker("PENDING_REVIEW");
    const confirmed = await seedHacker("CONFIRMED");
    const declined = await seedHacker("DECLINED");

    await expect(
      organizerCaller.application.bulkUpdateStatusByEmails({
        emails: [pending.email, confirmed.email, declined.email],
        status: "ACCEPTED",
      }),
    ).resolves.toEqual({ matched: 3, updated: 1, skippedRsvped: 2 });

    expect(await statusOf(pending.session.user.id)).toBe("ACCEPTED");
    expect(await statusOf(confirmed.session.user.id)).toBe("CONFIRMED");
    expect(await statusOf(declined.session.user.id)).toBe("DECLINED");
  });

  test("matches emails in any casing", async () => {
    const hacker = await seedHacker("PENDING_REVIEW");

    await expect(
      organizerCaller.application.bulkUpdateStatusByEmails({
        emails: [hacker.email.toUpperCase()],
        status: "ACCEPTED",
      }),
    ).resolves.toEqual({ matched: 1, updated: 1, skippedRsvped: 0 });
    expect(await statusOf(hacker.session.user.id)).toBe("ACCEPTED");
  });

  test("hackers can't use it", async () => {
    const hacker = await seedHacker("PENDING_REVIEW");
    const hackerCaller = createCaller(
      createInnerTRPCContext({ session: hacker.session }),
    );

    await expect(
      hackerCaller.application.bulkUpdateStatusByEmails({
        emails: [hacker.email],
        status: "ACCEPTED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await statusOf(hacker.session.user.id)).toBe("PENDING_REVIEW");
  });
});
