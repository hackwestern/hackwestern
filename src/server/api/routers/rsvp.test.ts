import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

const saved = async () =>
  db.query.applications.findFirst({
    columns: {
      status: true,
      transportationMethod: true,
      travelReimbursement: true,
      travelFrom: true,
      enrollmentConfirmedAt: true,
    },
    where: eq(applications.userId, session.user.id),
  });

// A fixed day a week before RSVP closes, so these tests don't start failing
// once the real deadline passes.
const WHILE_OPEN = RSVP_DEADLINE.getTime() - 7 * 24 * 60 * 60 * 1000;

const statusNow = async () =>
  (
    await db.query.applications.findFirst({
      columns: { status: true },
      where: eq(applications.userId, session.user.id),
    })
  )?.status;

describe("application.rsvp", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(WHILE_OPEN);
  });

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

  test("confirming records when they attested enrollment", async () => {
    await seed("ACCEPTED");
    await caller.application.rsvp({ attending: true, enrolled: true });
    const row = await saved();
    expect(row?.status).toBe("CONFIRMED");
    // Stamped with the real time (new Date() ignores the mocked Date.now).
    const stamped = row?.enrollmentConfirmedAt?.getTime() ?? 0;
    expect(Math.abs(stamped - new Date().getTime())).toBeLessThan(60_000);
  });

  test("declining doesn't record an enrollment attestation", async () => {
    await seed("ACCEPTED");
    await caller.application.rsvp({ attending: false, enrolled: true });
    expect((await saved())?.enrollmentConfirmedAt).toBeNull();
  });

  test("confirms with the answer on screen even before autosave lands", async () => {
    // Nothing saved yet: the click beat the autosave debounce.
    await seed("ACCEPTED", { transportationMethod: null });
    await caller.application.rsvp({
      attending: true,
      enrolled: true,
      travel: { transportationMethod: "Toronto" },
    });
    const row = await saved();
    expect(row?.status).toBe("CONFIRMED");
    expect(row?.transportationMethod).toBe("Toronto");
  });

  test("the answer on screen wins over an older saved one", async () => {
    // Saved: a bus. On screen: own travel with a reimbursement request.
    await seed("ACCEPTED");
    await caller.application.rsvp({
      attending: true,
      enrolled: true,
      travel: {
        transportationMethod: "None",
        travelReimbursement: true,
        travelFrom: " Ottawa ",
      },
    });
    const row = await saved();
    expect(row).toMatchObject({
      status: "CONFIRMED",
      transportationMethod: "None",
      travelReimbursement: true,
      travelFrom: "Ottawa",
    });
  });

  test("an incomplete answer on screen blocks the confirm, even if a saved one is complete", async () => {
    await seed("ACCEPTED"); // saved: Waterloo bus (complete)
    await expect(
      caller.application.rsvp({
        attending: true,
        enrolled: true,
        travel: { transportationMethod: "None", travelReimbursement: null },
      }),
    ).rejects.toThrow("reimbursement");
    const row = await saved();
    expect(row?.status).toBe("ACCEPTED");
    expect(row?.transportationMethod).toBe("Waterloo");
  });

  test("picking a bus on screen clears a stale reimbursement request", async () => {
    await seed("ACCEPTED", {
      transportationMethod: "None",
      travelReimbursement: true,
      travelFrom: "Ottawa",
    });
    await caller.application.rsvp({
      attending: true,
      enrolled: true,
      travel: {
        transportationMethod: "Hamilton",
        travelReimbursement: true,
        travelFrom: "Ottawa",
      },
    });
    expect(await saved()).toMatchObject({
      transportationMethod: "Hamilton",
      travelReimbursement: null,
      travelFrom: null,
    });
  });
});
