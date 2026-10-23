import { afterEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { RSVP_DEADLINE } from "~/lib/date";

const session = await mockSession(db);
const caller = createCaller(createInnerTRPCContext({ session }));

type Status = "ACCEPTED" | "CONFIRMED" | "DECLINED" | "PENDING_REVIEW";

const seed = (
  status: Status,
  travel: Partial<typeof applications.$inferInsert> = {
    transportationMethod: "Waterloo",
    travelReimbursement: null,
    travelFrom: null,
  },
) =>
  db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    ...travel,
  });

const statusNow = async () =>
  (
    await db.query.applications.findFirst({
      columns: { status: true },
      where: eq(applications.userId, session.user.id),
    })
  )?.status;

describe("application.rsvp", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("confirms an accepted hacker with the travel step done", async () => {
    await seed("ACCEPTED");
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).resolves.toEqual({
      status: "CONFIRMED",
    });
    expect(await statusNow()).toBe("CONFIRMED");
  });

  test("won't confirm until the travel step is done", async () => {
    await seed("ACCEPTED", { transportationMethod: null });
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).rejects.toThrow("Tell us how you're getting here");
    expect(await statusNow()).toBe("ACCEPTED");
  });

  test("own travel needs the reimbursement answer before confirming", async () => {
    await seed("ACCEPTED", {
      transportationMethod: "None",
      travelReimbursement: null,
    });
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).rejects.toThrow("reimbursement");
  });

  test("an accepted hacker can decline", async () => {
    await seed("ACCEPTED");
    await caller.application.rsvp({ attending: false });
    expect(await statusNow()).toBe("DECLINED");
  });

  test("a confirmed hacker can still give up their spot", async () => {
    await seed("CONFIRMED");
    await caller.application.rsvp({ attending: false });
    expect(await statusNow()).toBe("DECLINED");
  });

  test("a decline can't be undone", async () => {
    await seed("DECLINED");
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).rejects.toThrow("Only accepted hackers");
    expect(await statusNow()).toBe("DECLINED");
  });

  test("applicants without a decision can't RSVP", async () => {
    await seed("PENDING_REVIEW");
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).rejects.toThrow();
    await expect(
      caller.application.rsvp({ attending: false }),
    ).rejects.toThrow();
    expect(await statusNow()).toBe("PENDING_REVIEW");
  });

  test("confirming closes at the RSVP deadline", async () => {
    await seed("ACCEPTED");
    vi.spyOn(Date, "now").mockReturnValue(RSVP_DEADLINE.getTime() + 1000);
    await expect(
      caller.application.rsvp({ attending: true, enrolled: true }),
    ).rejects.toThrow("RSVP is closed");
    expect(await statusNow()).toBe("ACCEPTED");
  });

  test("confirmed hackers can edit travel before the deadline", async () => {
    await seed("CONFIRMED");
    await caller.application.saveTravel({ transportationMethod: "Toronto" });
    const row = await db.query.applications.findFirst({
      columns: { transportationMethod: true },
      where: eq(applications.userId, session.user.id),
    });
    expect(row?.transportationMethod).toBe("Toronto");
  });

  test("confirming needs the enrollment attestation", async () => {
    await seed("ACCEPTED");
    await expect(caller.application.rsvp({ attending: true })).rejects.toThrow(
      "enrolled",
    );
    expect(await statusNow()).toBe("ACCEPTED");
  });
});
