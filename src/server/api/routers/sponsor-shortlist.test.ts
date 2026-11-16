import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
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

async function hackerRanking(
  sponsorId: string | null,
  share: boolean,
  status: "CONFIRMED" | "DECLINED" = "CONFIRMED",
) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    agreeShareWithSponsors: share,
    firstName: share ? "Shared" : "Private",
    lastName: "Hacker",
  });
  if (sponsorId) {
    await db
      .insert(sponsorInterests)
      .values({ userId: session.user.id, sponsorId, rank: 1 });
  }
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
    expect(res.hackers[0]).toMatchObject({
      userId: sharedId,
      shortlisted: false,
    });
    const json = JSON.stringify(res);
    expect(json).not.toContain(privateId);
    expect(json).not.toContain("Private");
  });
});

describe("sponsorShortlist.add / remove", () => {
  test("rejects a sponsor id that isn't a UUID", async () => {
    await expect(
      anon.sponsorShortlist.add({ sponsor: "not-a-uuid", userId: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      anon.sponsorShortlist.remove({ sponsor: "not-a-uuid", userId: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("adds an interested hacker once, and remove takes them off", async () => {
    const mine = await sponsor();
    const userId = await hackerRanking(mine.id, true);

    await anon.sponsorShortlist.add({ sponsor: mine.id, userId });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId });
    let res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers.filter((h) => h.shortlisted)).toHaveLength(1);

    await anon.sponsorShortlist.remove({ sponsor: mine.id, userId });
    res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers[0]!.shortlisted).toBe(false);
  });

  test("can't shortlist a hacker who didn't consent, didn't rank you, or isn't admitted", async () => {
    const mine = await sponsor();
    const other = await sponsor();
    const notSharing = await hackerRanking(mine.id, false);
    const rankedOther = await hackerRanking(other.id, true);
    const rankedNobody = await hackerRanking(null, true);
    const declined = await hackerRanking(mine.id, true, "DECLINED");

    for (const userId of [notSharing, rankedOther, rankedNobody, declined]) {
      await expect(
        anon.sponsorShortlist.add({ sponsor: mine.id, userId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  test("unknown sponsor is NOT_FOUND", async () => {
    const userId = await hackerRanking(null, true);
    await expect(
      anon.sponsorShortlist.add({ sponsor: faker.string.uuid(), userId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("sponsorShortlist.chatPartners", () => {
  test("full profile only for hackers who agreed to share", async () => {
    const mine = await sponsor();
    const sharedId = await hackerRanking(null, true);
    const privateId = await hackerRanking(null, false);
    await db.insert(coffeeChats).values([
      { sponsorId: mine.id, userId: sharedId, slotTime: "10:00" },
      { sponsorId: mine.id, userId: privateId, slotTime: "10:15" },
    ]);

    const partners = await anon.sponsorShortlist.chatPartners({
      sponsor: mine.id,
    });
    const byName = Object.fromEntries(partners.map((p) => [p.name, p]));
    expect(byName["Shared Hacker"]).toMatchObject({ shared: true });
    expect(byName.Private).toMatchObject({
      shared: false,
      team: null,
      resume: null,
      github: null,
    });
    expect(JSON.stringify(partners)).not.toContain("@");
  });
});

describe("sponsorShortlist.forSponsor (organizers)", () => {
  test("logged out is UNAUTHORIZED", async () => {
    await expect(
      anon.sponsorShortlist.forSponsor({ sponsorId: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("a hacker is FORBIDDEN", async () => {
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(
      hacker.sponsorShortlist.forSponsor({ sponsorId: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("returns the sponsor's shortlist and drops hackers who withdrew consent", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const mine = await sponsor();
    const keep = await hackerRanking(mine.id, true);
    const withdraws = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: keep });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: withdraws });
    await db
      .update(applications)
      .set({ agreeShareWithSponsors: false })
      .where(eq(applications.userId, withdraws));

    const res = await organizer.sponsorShortlist.forSponsor({
      sponsorId: mine.id,
    });
    expect(res.hackers.map((h) => h.userId)).toEqual([keep]);
  });
});
