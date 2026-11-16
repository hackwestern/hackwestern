import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { asc, eq, inArray } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import {
  applications,
  sponsorInterests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";

const SPONSORS = [
  "Canada Life",
  "CSE",
  "Commure",
  "Scotiabank",
  "StarTech",
  "Sun Life",
];

type AppStatus = "CONFIRMED" | "PENDING_REVIEW";

async function hacker(status: AppStatus = "CONFIRMED", share = true) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    agreeShareWithSponsors: share,
  });
  return {
    id: session.user.id,
    caller: createCaller(createInnerTRPCContext({ session })),
  };
}

const rowsOf = (userId: string) =>
  db
    .select({
      name: sponsorJudgingSponsors.name,
      rank: sponsorInterests.rank,
    })
    .from(sponsorInterests)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorInterests.sponsorId, sponsorJudgingSponsors.id),
    )
    .where(eq(sponsorInterests.userId, userId))
    .orderBy(asc(sponsorInterests.rank));

beforeAll(async () => {
  await db
    .insert(sponsorJudgingSponsors)
    .values(SPONSORS.map((name) => ({ name })))
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(sponsorJudgingSponsors)
    .where(inArray(sponsorJudgingSponsors.name, SPONSORS));
});

describe("sponsorInterest", () => {
  test("a hacker saves a ranking of all 6 sponsors, in order", async () => {
    const me = await hacker();
    const ranking = [
      "Sun Life",
      "CSE",
      "StarTech",
      "Canada Life",
      "Scotiabank",
      "Commure",
    ];
    await me.caller.sponsorInterest.save({ ranking });

    expect(await rowsOf(me.id)).toEqual(
      ranking.map((name, i) => ({ name, rank: i + 1 })),
    );
    const got = await me.caller.sponsorInterest.get();
    expect(got.ranking).toEqual(ranking);
    expect(got.canRank).toBe(true);
    expect(got.sponsors).toEqual(expect.arrayContaining(SPONSORS));
  });

  test("saving again replaces the ranking; empty clears it", async () => {
    const me = await hacker();
    await me.caller.sponsorInterest.save({ ranking: ["CSE", "Sun Life"] });
    await me.caller.sponsorInterest.save({ ranking: ["Sun Life"] });
    expect(await rowsOf(me.id)).toEqual([{ name: "Sun Life", rank: 1 }]);
    await me.caller.sponsorInterest.save({ ranking: [] });
    expect(await rowsOf(me.id)).toEqual([]);
  });

  test("a save only touches the caller's own ranking", async () => {
    const me = await hacker();
    const other = await hacker();
    await other.caller.sponsorInterest.save({ ranking: ["StarTech", "CSE"] });
    await me.caller.sponsorInterest.save({ ranking: ["Commure"] });
    await me.caller.sponsorInterest.save({ ranking: [] });

    expect(await rowsOf(other.id)).toEqual([
      { name: "StarTech", rank: 1 },
      { name: "CSE", rank: 2 },
    ]);
    expect((await me.caller.sponsorInterest.get()).ranking).toEqual([]);
  });

  test("concurrent saves both succeed and leave one whole ranking", async () => {
    const me = await hacker();
    const a = ["StarTech", "CSE", "Sun Life"];
    const b = ["Commure", "Scotiabank"];
    await Promise.all([
      me.caller.sponsorInterest.save({ ranking: a }),
      me.caller.sponsorInterest.save({ ranking: b }),
      me.caller.sponsorInterest.save({ ranking: a }),
    ]);
    const names = (await rowsOf(me.id)).map((r) => r.name);
    expect([a, b]).toContainEqual(names);
  });

  test("the hacker API never exposes sponsor ids", async () => {
    const me = await hacker();
    const got = await me.caller.sponsorInterest.get();
    const ids = (
      await db
        .select({ id: sponsorJudgingSponsors.id })
        .from(sponsorJudgingSponsors)
    ).map((r) => r.id);
    const json = JSON.stringify(got);
    for (const id of ids) expect(json).not.toContain(id);
  });

  test("rejects unknown and duplicate sponsors", async () => {
    const me = await hacker();
    await expect(
      me.caller.sponsorInterest.save({ ranking: ["Not A Sponsor"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      me.caller.sponsorInterest.save({ ranking: ["CSE", "CSE"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await rowsOf(me.id)).toEqual([]);
  });

  test("hackers who aren't admitted can't rank", async () => {
    const me = await hacker("PENDING_REVIEW");
    expect((await me.caller.sponsorInterest.get()).canRank).toBe(false);
    await expect(
      me.caller.sponsorInterest.save({ ranking: ["CSE"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("logged out is UNAUTHORIZED", async () => {
    const anon = createCaller(createInnerTRPCContext({ session: null }));
    await expect(anon.sponsorInterest.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anon.sponsorInterest.save({ ranking: [] }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
