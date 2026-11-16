import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  sponsorInterests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";

// Sponsors aren't logged in: their private UUID is the credential.
const anon = createCaller(createInnerTRPCContext({ session: null }));

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}

async function hackerRanking(sponsorId: string, share: boolean) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status: "CONFIRMED",
    agreeShareWithSponsors: share,
    firstName: share ? "Shared" : "Private",
    lastName: "Hacker",
  });
  await db
    .insert(sponsorInterests)
    .values({ userId: session.user.id, sponsorId, rank: 1 });
  return session.user.id;
}

describe("sponsorShortlist.list", () => {
  test("rejects a sponsor id that isn't a UUID", async () => {
    await expect(
      anon.sponsorShortlist.list({ sponsor: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("unknown sponsor is NOT_FOUND", async () => {
    await expect(
      anon.sponsorShortlist.list({ sponsor: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("lists only consenting hackers who ranked this sponsor", async () => {
    const mine = await sponsor();
    const other = await sponsor();
    const sharedId = await hackerRanking(mine.id, true);
    const privateId = await hackerRanking(mine.id, false);
    await hackerRanking(other.id, true);

    const res = await anon.sponsorShortlist.list({
      sponsor: mine.id.toUpperCase(),
    });
    expect(res.sponsorName).toBe(mine.name);
    expect(res.hackers.map((h) => h.name)).toEqual(["Shared Hacker"]);
    const json = JSON.stringify(res);
    expect(json).not.toContain(sharedId);
    expect(json).not.toContain(privateId);
    expect(json).not.toContain("Private");
  });
});
