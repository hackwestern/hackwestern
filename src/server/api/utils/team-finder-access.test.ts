import { afterEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { RSVP_DEADLINE } from "~/lib/date";
import { getTeamFinderAccess } from "./team-finder-access";

const session = await mockSession(db);
const userId = session.user.id;

const BEFORE = RSVP_DEADLINE.getTime() - 60 * 1000;
const AFTER = RSVP_DEADLINE.getTime() + 60 * 1000;

const seed = (status: "ACCEPTED" | "CONFIRMED" | "DECLINED") =>
  db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId,
    status,
  });

const setType = (type: "hacker" | "organizer" | "sponsor") =>
  db.update(users).set({ type }).where(eq(users.id, userId));

describe("getTeamFinderAccess", () => {
  afterEach(async () => {
    await db.delete(applications).where(eq(applications.userId, userId));
    await setType("hacker");
  });

  test("confirmed hacker is refused before the deadline", async () => {
    await seed("CONFIRMED");
    expect(await getTeamFinderAccess(userId, BEFORE)).toEqual({
      ok: false,
      reason: "not-open",
    });
  });

  test("confirmed hacker gets in after the deadline", async () => {
    await seed("CONFIRMED");
    expect(await getTeamFinderAccess(userId, AFTER)).toEqual({
      ok: true,
      role: "hacker",
    });
  });

  test.each(["ACCEPTED", "DECLINED"] as const)(
    "%s hacker is not confirmed after the deadline",
    async (status) => {
      await seed(status);
      expect(await getTeamFinderAccess(userId, AFTER)).toEqual({
        ok: false,
        reason: "not-confirmed",
      });
    },
  );

  test("hacker with no application is not confirmed", async () => {
    expect(await getTeamFinderAccess(userId, AFTER)).toEqual({
      ok: false,
      reason: "not-confirmed",
    });
  });

  test("organizer gets in before the deadline", async () => {
    await setType("organizer");
    expect(await getTeamFinderAccess(userId, BEFORE)).toEqual({
      ok: true,
      role: "organizer",
    });
  });

  test("sponsor is not allowed", async () => {
    await setType("sponsor");
    expect(await getTeamFinderAccess(userId, AFTER)).toEqual({
      ok: false,
      reason: "not-allowed",
    });
  });

  test("unknown user is not allowed", async () => {
    expect(
      await getTeamFinderAccess("00000000-0000-0000-0000-000000000000", AFTER),
    ).toEqual({ ok: false, reason: "not-allowed" });
  });
});
