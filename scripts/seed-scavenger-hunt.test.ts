import { afterEach, describe, expect, test } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { scavengerHuntItems, scavengerHuntRewards } from "~/server/db/schema";
import { ITEMS, REWARDS, seedScavengerHunt } from "./seed-scavenger-hunt";

describe("seed scavenger hunt (DB integration)", () => {
  const items = [
    { name: "zz-seed-task", points: 5, type: "bonus" as const },
    {
      name: "zz-seed-game",
      points: 10,
      type: "activity" as const,
      winPoints: 50,
    },
  ];
  const rewards = [{ name: "zz-seed-prize", costPoints: 20, quantity: 3 }];

  afterEach(async () => {
    await db.delete(scavengerHuntItems).where(
      inArray(
        scavengerHuntItems.name,
        items.map((i) => i.name),
      ),
    );
    await db.delete(scavengerHuntRewards).where(
      inArray(
        scavengerHuntRewards.name,
        rewards.map((r) => r.name),
      ),
    );
  });

  test("adds the tasks and prizes once, even when run twice", async () => {
    expect(await seedScavengerHunt(items, rewards)).toEqual({
      items: 2,
      rewards: 1,
    });
    expect(await seedScavengerHunt(items, rewards)).toEqual({
      items: 0,
      rewards: 0,
    });

    const game = await db.query.scavengerHuntItems.findFirst({
      where: (t, { eq }) => eq(t.name, "zz-seed-game"),
    });
    expect(game).toMatchObject({ points: 10, winPoints: 50, status: "active" });
  });

  test("a task scheduled to close later still counts as existing", async () => {
    await db.insert(scavengerHuntItems).values({
      ...items[0]!,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      deletedAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(await seedScavengerHunt(items, rewards)).toEqual({
      items: 1,
      rewards: 1,
    });
  });

  test("the task and prize lists have no repeated names", () => {
    const itemNames = ITEMS.map((i) => i.name.toLowerCase());
    const rewardNames = REWARDS.map((r) => r.name.toLowerCase());
    expect(new Set(itemNames).size).toBe(itemNames.length);
    expect(new Set(rewardNames).size).toBe(rewardNames.length);
  });
});
