import { afterEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { rsvpTravelSubmitSchema } from "~/schemas/rsvp";

const session = await mockSession(db);
const caller = createCaller(createInnerTRPCContext({ session }));

const seedApplication = (status: "ACCEPTED" | "PENDING_REVIEW") =>
  db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
  });

const savedTravel = async () =>
  db.query.applications.findFirst({
    columns: {
      transportationMethod: true,
      travelReimbursement: true,
      travelFrom: true,
    },
    where: eq(applications.userId, session.user.id),
  });

describe("application.saveTravel", () => {
  afterEach(async () => {
    await db
      .delete(applications)
      .where(eq(applications.userId, session.user.id));
  });

  test("saves a reimbursement request for an accepted hacker travelling on their own", async () => {
    await seedApplication("ACCEPTED");

    await caller.application.saveTravel({
      transportationMethod: "None",
      travelReimbursement: true,
      travelFrom: " Ottawa ",
    });

    expect(await savedTravel()).toEqual({
      transportationMethod: "None",
      travelReimbursement: true,
      travelFrom: "Ottawa",
    });
  });

  test("clears reimbursement and city when they switch to a Hack Western bus", async () => {
    await seedApplication("ACCEPTED");
    await caller.application.saveTravel({
      transportationMethod: "None",
      travelReimbursement: true,
      travelFrom: "Ottawa",
    });

    await caller.application.saveTravel({
      transportationMethod: "Toronto",
      travelReimbursement: true,
      travelFrom: "Ottawa",
    });

    expect(await savedTravel()).toEqual({
      transportationMethod: "Toronto",
      travelReimbursement: null,
      travelFrom: null,
    });
  });

  test("refuses applicants who aren't accepted", async () => {
    await seedApplication("PENDING_REVIEW");

    await expect(
      caller.application.saveTravel({ transportationMethod: "None" }),
    ).rejects.toThrowError("Only accepted hackers can RSVP.");
  });
});

describe("rsvpTravelSubmitSchema", () => {
  test("a bus rider doesn't need to answer the reimbursement question", () => {
    expect(
      rsvpTravelSubmitSchema.safeParse({ transportationMethod: "Waterloo" })
        .success,
    ).toBe(true);
  });

  test("travelling on their own needs a reimbursement answer", () => {
    expect(
      rsvpTravelSubmitSchema.safeParse({ transportationMethod: "None" })
        .success,
    ).toBe(false);
  });

  test("a reimbursement request needs a city", () => {
    expect(
      rsvpTravelSubmitSchema.safeParse({
        transportationMethod: "None",
        travelReimbursement: true,
      }).success,
    ).toBe(false);
  });
});
