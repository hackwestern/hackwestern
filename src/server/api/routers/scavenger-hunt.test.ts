/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import {
  scavengerHuntItems,
  scavengerHuntRewards,
  scavengerHuntScans,
  scavengerHuntRedemptions,
  applications,
  users,
} from "~/server/db/schema";
import { mockSession, mockOrganizerSession } from "~/server/auth";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";
import { getOrCreateHackerId } from "~/server/api/utils/hacker-id";

// ---- helpers ----
const insertTestItem = async (
  overrides: Partial<typeof scavengerHuntItems.$inferInsert> = {},
  name = `123456789012`, // Names must be unique among items that are not deleted
) => {
  const [item] = await db
    .insert(scavengerHuntItems)
    .values({
      name,
      points: 25,
      type: "activity",
      startsAt: new Date("2026-11-21T14:00:00Z"),
      endsAt: new Date("2026-11-21T15:00:00Z"),
      ...overrides,
    })
    .returning();
  if (!item) throw new Error("Failed to insert test item");
  return item;
};

const insertTestReward = async (
  overrides: Partial<typeof scavengerHuntRewards.$inferInsert> = {},
) => {
  const [reward] = await db
    .insert(scavengerHuntRewards)
    .values({
      name: "Sticker Pack",
      costPoints: 10,
      ...overrides,
    })
    .returning();
  if (!reward) throw new Error("Failed to insert test reward");
  return reward;
};

const session = await mockSession(db);
const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const organizerSession = await mockOrganizerSession(db);
const organizerCtx = createInnerTRPCContext({ session: organizerSession });
const organizerCaller = createCaller(organizerCtx);

// The scanned hacker must be admitted to be scanned. CONFIRMED is admitted
// on any date (ACCEPTED stops counting once RSVP closes).
await db.insert(applications).values({
  ...ApplicationSeeder.createRandomWithoutUser(),
  userId: session.user.id,
  status: "CONFIRMED" as const,
});

// Tests
describe("scavengerHuntRouter basic endpoints", () => {
  // getScavengerHuntItemById tests
  let item: Awaited<ReturnType<typeof insertTestItem>>; // declare outside so tests can use it
  describe("getScavengerHuntItemById", () => {
    beforeEach(async () => {
      item = await insertTestItem();
    });

    afterEach(async () => {
      // Clean up any existing items
      await db
        .delete(scavengerHuntItems)
        .where(eq(scavengerHuntItems.id, item.id));
    });

    test("returns inserted item", async () => {
      const result =
        await organizerCaller.scavengerHunt.getScavengerHuntItemById({
          id: item.id,
        });

      expect(result.id).toBe(item.id);
    });

    test("hackers can't read items", async () => {
      await expect(
        caller.scavengerHunt.getScavengerHuntItemById({ id: item.id }),
      ).rejects.toThrow(TRPCError);
    });

    test("throws error if id not found", async () => {
      await expect(
        organizerCaller.scavengerHunt.getScavengerHuntItemById({ id: -1 }),
      ).rejects.toThrow();
    });

    test("does not return soft-deleted item", async () => {
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, item.id));

      // Should throw error when trying to get soft-deleted item
      try {
        (await organizerCaller.scavengerHunt.getScavengerHuntItemById({
          id: item.id,
        }),
          expect.fail("Route should return a TRPCError"));
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }
    });
  });

  // getAllScavengerHuntItems tests
  describe("getAllScavengerHuntItems", () => {
    afterEach(async () => {
      // Clean up test items
      const testNames = ["GETALL-001", "GETALL-002", "GETALL-003"];
      for (const name of testNames) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.name, name));
      }
    });

    test("returns empty array when no items exist", async () => {
      const result = await caller.scavengerHunt.getAllScavengerHuntItems();
      expect(result).toEqual([]);
    });

    test("returns all non-deleted items", async () => {
      // Create multiple test items
      const item1 = await insertTestItem({ points: 10 }, "GETALL-001");
      const item2 = await insertTestItem({ points: 20 }, "GETALL-002");
      const item3 = await insertTestItem({ points: 30 }, "GETALL-003");

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      expect(result.length).toBeGreaterThanOrEqual(3);
      const resultNames = result.map((item) => item.name);
      expect(resultNames).toContain(item1.name);
      expect(resultNames).toContain(item2.name);
      expect(resultNames).toContain(item3.name);
    });

    /*test("excludes soft-deleted items", async () => {
      // Create items
      const activeItem = await insertTestItem(
        { points: 10 },
        "GETALL-001",
      );
      const deletedItem = await insertTestItem(
        { points: 20 },
        "GETALL-002",
      );

      // Soft delete one item
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, deletedItem.id));

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      // Should only return the active item
      const resultNames = result.map((item) => item.name);
      expect(resultNames).toContain(activeItem.name);
      expect(resultNames).not.toContain(deletedItem.name);
    });*/

    test("works without authentication (public procedure)", async () => {
      const item = await insertTestItem({ points: 10 }, "GETALL-001");

      // Create unauthenticated caller
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      const result =
        await unauthenticatedCaller.scavengerHunt.getAllScavengerHuntItems();

      expect(result.length).toBeGreaterThanOrEqual(1);
      const resultNames = result.map((i) => i.name);
      expect(resultNames).toContain(item.name);
    });

    test("returns items with correct structure", async () => {
      const item = await insertTestItem({ points: 25 }, "GETALL-001");

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      const foundItem = result.find((i) => i.id === item.id);
      expect(foundItem).toBeDefined();
      expect(foundItem?.points).toBe(25);
      expect(foundItem?.name).toBe("GETALL-001");
      expect(foundItem?.deletedAt).toBeNull();
    });
  });

  // scan tests
  let testItem: Awaited<ReturnType<typeof insertTestItem>>; // declare outside so tests can use it
  describe("scan", () => {
    beforeEach(async () => {
      // Create a fresh item for each test to avoid state pollution
      testItem = await insertTestItem({}, faker.string.alphanumeric(12));

      // Clean up any existing scans for this user (first, because deleting a scan refunds its points)
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, session.user.id));

      // Reset user's scavenger hunt balance and points
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, session.user.id));
    });

    test("successfully scans and awards points", async () => {
      const scanResult = await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: testItem.id,
      });
      expect(scanResult.success).toBe(true);

      const scans = await db.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, session.user.id),
          eq(scavengerHuntScans.itemId, testItem.id),
        ),
      });
      expect(scans).not.toBeNull();
      expect(scans).toBeDefined();

      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      expect(updatedUser?.scavengerHuntBalance).toBe(testItem.points);
    });

    test("scans by hacker ID (the value on printed QRs)", async () => {
      const hackerId = await getOrCreateHackerId(session.user.id);
      const scanResult = await organizerCaller.scavengerHunt.scan({
        userId: hackerId,
        itemId: testItem.id,
      });
      expect(scanResult.success).toBe(true);

      const scan = await db.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, session.user.id),
          eq(scavengerHuntScans.itemId, testItem.id),
        ),
      });
      expect(scan).toBeDefined();
    });

    test("throws error if scanning same item twice", async () => {
      const firstScanResult = await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: testItem.id,
      });
      expect(firstScanResult.success).toBe(true);
      expect(firstScanResult.message).toBe("Item scanned successfully");

      try {
        await organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemId: testItem.id,
        });

        // If we get here, the test should fail because the function should throw an error
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("BAD_REQUEST");
        expect(trpcErr.message).toBe("Item already scanned");
      }

      // Check to make sure user's points weren't updated on the second scan
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      // Should still be the points from the first scan
      expect(updatedUser?.scavengerHuntBalance).toBe(testItem.points);
    });

    test("throws error if non organizer scans item", async () => {
      try {
        await caller.scavengerHunt.scan({
          userId: session.user.id,
          itemId: testItem.id,
        });

        // If we get here, the test should fail because the function should throw an error
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    test("throws error if item code not found", async () => {
      try {
        await organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemId: -1,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }
    });

    test("throws error if trying to scan soft-deleted item", async () => {
      // Soft delete the test item
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, testItem.id));

      try {
        await organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemId: testItem.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }
    });

    // deletedAt in the future means "scans close then" (#557), so it still scans.
    test("scans an item whose close time is still in the future", async () => {
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date(Date.now() + 60 * 60 * 1000) })
        .where(eq(scavengerHuntItems.id, testItem.id));

      const scanResult = await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: testItem.id,
      });
      expect(scanResult.success).toBe(true);
    });

    test("throws error if user not found", async () => {
      const nonExistentUserId = "non-existent-user-id";
      try {
        await organizerCaller.scavengerHunt.scan({
          userId: nonExistentUserId,
          itemId: testItem.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("User not found");
      }
    });
  });

  // getPoints tests
  describe("getPoints", () => {
    beforeEach(async () => {
      // Reset user's points to known values
      await db
        .update(users)
        .set({ scavengerHuntBalance: 50, scavengerHuntEarned: 100 })
        .where(eq(users.id, session.user.id));
    });

    test("returns earned and balance for user", async () => {
      const points = await caller.scavengerHunt.getPoints();
      expect(points).toHaveProperty("earned");
      expect(points).toHaveProperty("balance");
      expect(points.earned).toBe(100);
      expect(points.balance).toBe(50);
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      await expect(
        unauthenticatedCaller.scavengerHunt.getPoints(),
      ).rejects.toThrow();
    });
  });

  // getPointsByUserId tests
  describe("getPointsByUserId", () => {
    beforeEach(async () => {
      // Reset user's points to known values
      await db
        .update(users)
        .set({ scavengerHuntBalance: 75, scavengerHuntEarned: 150 })
        .where(eq(users.id, session.user.id));
    });

    test("returns earned and balance for user", async () => {
      const points = await organizerCaller.scavengerHunt.getPointsByUserId({
        requestedUserId: session.user.id,
      });
      expect(points).toHaveProperty("earned");
      expect(points).toHaveProperty("balance");
      expect(points.earned).toBe(150);
      expect(points.balance).toBe(75);
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.getPointsByUserId({
          requestedUserId: session.user.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    test("throws error if requested user not found", async () => {
      const nonExistentUserId = "non-existent-user-id";
      try {
        await organizerCaller.scavengerHunt.getPointsByUserId({
          requestedUserId: nonExistentUserId,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("User not found");
      }
    });
  });
});

describe("scavengerHuntRouter redemption endpoints", () => {
  const initialBalance = 100;
  const initialEarned = 100;

  // redeem tests
  describe("redeem", () => {
    let testReward: Awaited<ReturnType<typeof insertTestReward>>;

    beforeEach(async () => {
      // Create a fresh reward for each test
      testReward = await insertTestReward();

      // Reset user's scavenger hunt balance and points
      await db
        .update(users)
        .set({
          scavengerHuntBalance: initialBalance,
          scavengerHuntEarned: initialEarned,
        })
        .where(eq(users.id, session.user.id));

      // Clean up any existing redemptions for this user
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, session.user.id));
    });

    afterEach(async () => {
      // Clean up redemptions
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, session.user.id));

      // Clean up test reward if it still exists
      if (testReward) {
        await db
          .delete(scavengerHuntRewards)
          .where(eq(scavengerHuntRewards.id, testReward.id));
      }
    });

    test("successfully redeems reward and deducts points", async () => {
      const redeemResult = await caller.scavengerHunt.redeem({
        rewardId: testReward.id,
      });

      expect(redeemResult.success).toBe(true);
      expect(redeemResult.message).toBe("Reward redeemed successfully");

      // Check that redemption was recorded
      const redemption = await db.query.scavengerHuntRedemptions.findFirst({
        where: and(
          eq(scavengerHuntRedemptions.userId, session.user.id),
          eq(scavengerHuntRedemptions.rewardId, testReward.id),
        ),
      });
      expect(redemption).not.toBeNull();
      expect(redemption?.rewardId).toBe(testReward.id);

      // Check that points were deducted
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      expect(updatedUser?.scavengerHuntBalance).toBe(
        initialBalance - testReward.costPoints,
      );
      // Earned points should remain the same
      expect(updatedUser?.scavengerHuntEarned).toBe(100);
    });

    test("throws error if reward not found", async () => {
      const nonExistentRewardId = 99999;

      try {
        await caller.scavengerHunt.redeem({ rewardId: nonExistentRewardId });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Reward not found");
      }
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      try {
        (await unauthenticatedCaller.scavengerHunt.redeem({
          rewardId: testReward.id,
        }),
          expect.fail("Route should return a TRPCError"));
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("UNAUTHORIZED");
        expect(trpcErr.message).toBe("UNAUTHORIZED");
      }
    });

    test("throws error if user has insufficient balance", async () => {
      // Set user balance to less than reward cost
      await db
        .update(users)
        .set({
          scavengerHuntBalance: testReward.costPoints - 1,
          scavengerHuntEarned: 100,
        })
        .where(eq(users.id, session.user.id));

      try {
        await caller.scavengerHunt.redeem({ rewardId: testReward.id });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("BAD_REQUEST");
        expect(trpcErr.message).toBe(
          "User does not have enough points to redeem reward",
        );
      }
    });
  });

  // getRedemptions tests
  describe("getRedemptions", () => {
    let testReward: Awaited<ReturnType<typeof insertTestReward>>;

    beforeEach(async () => {
      testReward = await insertTestReward();

      // Reset user's scavenger hunt balance
      await db
        .update(users)
        .set({ scavengerHuntBalance: 100, scavengerHuntEarned: 100 })
        .where(eq(users.id, session.user.id));

      // Clean up any existing redemptions for this user
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, session.user.id));
    });

    afterEach(async () => {
      // Clean up redemptions
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, session.user.id));

      // Clean up test reward
      if (testReward) {
        await db
          .delete(scavengerHuntRewards)
          .where(eq(scavengerHuntRewards.id, testReward.id));
      }
    });

    test("returns empty array when user has no redemptions", async () => {
      const redemptions = await caller.scavengerHunt.getRedemptions();
      expect(redemptions).toEqual([]);
    });

    test("returns user's redemptions", async () => {
      // Redeem a reward first
      await caller.scavengerHunt.redeem({ rewardId: testReward.id });

      const redemptions = await caller.scavengerHunt.getRedemptions();

      expect(redemptions.length).toBe(1);
      expect(redemptions[0]?.userId).toBe(session.user.id);
      expect(redemptions[0]?.rewardId).toBe(testReward.id);
    });

    test("returns multiple redemptions for user", async () => {
      // Create another reward
      const secondReward = await insertTestReward({
        name: "Second Reward",
        costPoints: 5,
      });

      // Update balance to have enough points for both
      await db
        .update(users)
        .set({ scavengerHuntBalance: 200, scavengerHuntEarned: 200 })
        .where(eq(users.id, session.user.id));

      // Redeem both rewards
      await caller.scavengerHunt.redeem({ rewardId: testReward.id });
      await caller.scavengerHunt.redeem({ rewardId: secondReward.id });

      const redemptions = await caller.scavengerHunt.getRedemptions();

      expect(redemptions.length).toBe(2);
      expect(redemptions.map((r) => r.rewardId)).toContain(testReward.id);
      expect(redemptions.map((r) => r.rewardId)).toContain(secondReward.id);

      // Clean up redemptions for second reward first (to avoid foreign key constraint)
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.rewardId, secondReward.id));

      // Then clean up second reward
      await db
        .delete(scavengerHuntRewards)
        .where(eq(scavengerHuntRewards.id, secondReward.id));
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      await expect(
        unauthenticatedCaller.scavengerHunt.getRedemptions(),
      ).rejects.toThrow();
    });
  });

  // getRedemptionByUserId tests
  describe("getRedemptionByUserId", () => {
    let testUser: Awaited<ReturnType<typeof mockSession>>;
    let testReward: Awaited<ReturnType<typeof insertTestReward>>;

    beforeEach(async () => {
      // Create a test user to query
      testUser = await mockSession(db);
      testReward = await insertTestReward();

      // Set up test user's balance
      await db
        .update(users)
        .set({ scavengerHuntBalance: 100, scavengerHuntEarned: 100 })
        .where(eq(users.id, testUser.user.id));

      // Clean up any existing redemptions for test user
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, testUser.user.id));
    });

    afterEach(async () => {
      // Clean up redemptions
      await db
        .delete(scavengerHuntRedemptions)
        .where(eq(scavengerHuntRedemptions.userId, testUser.user.id));

      // Clean up test user
      await db.delete(users).where(eq(users.id, testUser.user.id));

      // Clean up test reward
      if (testReward) {
        await db
          .delete(scavengerHuntRewards)
          .where(eq(scavengerHuntRewards.id, testReward.id));
      }
    });

    test("returns empty array when user has no redemptions", async () => {
      const redemptions =
        await organizerCaller.scavengerHunt.getRedemptionByUserId({
          requestedUserId: testUser.user.id,
        });

      expect(redemptions).toEqual([]);
    });

    test("returns redemptions for requested user", async () => {
      // Create a context for the test user to redeem
      const testUserCtx = createInnerTRPCContext({ session: testUser });
      const testUserCaller = createCaller(testUserCtx);

      // Test user redeems a reward
      await testUserCaller.scavengerHunt.redeem({ rewardId: testReward.id });

      // Organizer queries the redemptions
      const redemptions =
        await organizerCaller.scavengerHunt.getRedemptionByUserId({
          requestedUserId: testUser.user.id,
        });

      expect(redemptions.length).toBe(1);
      expect(redemptions[0]?.userId).toBe(testUser.user.id);
      expect(redemptions[0]?.rewardId).toBe(testReward.id);
    });

    test("throws error if user not found", async () => {
      const nonExistentUserId = "non-existent-user-id";

      try {
        await organizerCaller.scavengerHunt.getRedemptionByUserId({
          requestedUserId: nonExistentUserId,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("User not found");
      }
    });

    test("throws error if user is not an organizer", async () => {
      // Regular user tries to access organizer-only endpoint
      try {
        await caller.scavengerHunt.getRedemptionByUserId({
          requestedUserId: testUser.user.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      await expect(
        unauthenticatedCaller.scavengerHunt.getRedemptionByUserId({
          requestedUserId: testUser.user.id,
        }),
      ).rejects.toThrow();
    });
  });
});

describe("scavengerHuntRouter scan endpoints", () => {
  // getAllScans tests
  describe("getAllScans", () => {
    let testUser1: Awaited<ReturnType<typeof mockSession>>;
    let testUser2: Awaited<ReturnType<typeof mockSession>>;
    let testItem1: Awaited<ReturnType<typeof insertTestItem>>;
    let testItem2: Awaited<ReturnType<typeof insertTestItem>>;

    beforeEach(async () => {
      // Create test users
      testUser1 = await mockSession(db);
      testUser2 = await mockSession(db);

      // Create test items
      testItem1 = await insertTestItem({}, faker.string.alphanumeric(12));
      testItem2 = await insertTestItem({}, faker.string.alphanumeric(12));

      // Reset users' scavenger hunt balances
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, testUser1.user.id));
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, testUser2.user.id));

      // Clean up any existing scans
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser1.user.id));
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser2.user.id));
    });

    afterEach(async () => {
      // Clean up scans
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser1.user.id));
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser2.user.id));

      // Clean up test users
      await db.delete(users).where(eq(users.id, testUser1.user.id));
      await db.delete(users).where(eq(users.id, testUser2.user.id));

      // Clean up test items
      if (testItem1) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem1.id));
      }
      if (testItem2) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem2.id));
      }
    });

    test("returns empty array when no scans exist", async () => {
      const result = await organizerCaller.scavengerHunt.getAllScans({});
      expect(result.scans).toEqual([]);
      expect(result.total).toBe(0);
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.getAllScans({});
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      await expect(
        unauthenticatedCaller.scavengerHunt.getAllScans({}),
      ).rejects.toThrow();
    });
  });

  // deleteScavengerHuntItem tests
  describe("deleteScavengerHuntItem", () => {
    let testItem: Awaited<ReturnType<typeof insertTestItem>>;

    beforeEach(async () => {
      testItem = await insertTestItem({}, faker.string.alphanumeric(12));
    });

    afterEach(async () => {
      // Clean up - actually delete the item (hard delete for cleanup)
      if (testItem) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem.id));
      }
    });

    test("soft deletes item by setting deletedAt", async () => {
      await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
        itemId: testItem.id,
      });

      // Verify item still exists in database
      const deletedItem = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.id, testItem.id),
      });

      expect(deletedItem).not.toBeNull();
      expect(deletedItem?.id).toBe(testItem.id);
      expect(deletedItem?.deletedAt).not.toBeNull();
      expect(deletedItem?.deletedAt).toBeInstanceOf(Date);
    });

    test("soft-deleted item cannot be retrieved via getScavengerHuntItemById", async () => {
      await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
        itemId: testItem.id,
      });

      // Should throw error when trying to get soft-deleted item
      await expect(
        organizerCaller.scavengerHunt.getScavengerHuntItemById({
          id: testItem.id,
        }),
      ).rejects.toThrow();
    });

    /*
    test("soft-deleted item cannot be scanned", async () => {
      const testUser = await mockSession(db);

      // Soft delete the item
      await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
        itemId: testItem.id,
      });

      // Should throw error when trying to scan soft-deleted item
      try {
        await organizerCaller.scavengerHunt.scan({
          userId: testUser.user.id,
          itemId: testItem.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }

      // Clean up test user
      await db.delete(users).where(eq(users.id, testUser.user.id));
    });*/

    test("scans remain linked to soft-deleted item", async () => {
      const testUser = await mockSession(db);
      await db.insert(applications).values({
        ...ApplicationSeeder.createRandomWithoutUser(),
        userId: testUser.user.id,
        status: "CONFIRMED" as const,
      });

      // Scan the item first
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemId: testItem.id,
      });

      // Verify scan exists
      const scanBeforeDelete = await db.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, testUser.user.id),
          eq(scavengerHuntScans.itemId, testItem.id),
        ),
      });
      expect(scanBeforeDelete).not.toBeNull();

      // Soft delete the item
      await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
        itemId: testItem.id,
      });

      // Verify scan still exists (referential integrity maintained)
      const scanAfterDelete = await db.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, testUser.user.id),
          eq(scavengerHuntScans.itemId, testItem.id),
        ),
      });
      expect(scanAfterDelete).not.toBeNull();
      expect(scanAfterDelete?.itemId).toBe(testItem.id);

      // Clean up
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser.user.id));
      await db
        .delete(applications)
        .where(eq(applications.userId, testUser.user.id));
      await db.delete(users).where(eq(users.id, testUser.user.id));
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.deleteScavengerHuntItem({
          itemId: testItem.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    test("throws error if user is not authenticated", async () => {
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      await expect(
        unauthenticatedCaller.scavengerHunt.deleteScavengerHuntItem({
          itemId: testItem.id,
        }),
      ).rejects.toThrow();
    });
  });
});

describe("scavengerHuntRouter item status", () => {
  afterEach(async () => {
    await db
      .delete(scavengerHuntItems)
      .where(eq(scavengerHuntItems.name, "STATUS-TEST"));
  });

  test.each(["draft", "disabled"] as const)(
    "%s items are hidden from the scanner and can't be scanned",
    async (status) => {
      const item = await insertTestItem({ status }, "STATUS-TEST");
      const scannable = await caller.scavengerHunt.getAllScavengerHuntItems();
      expect(scannable.map((i) => i.id)).not.toContain(item.id);
      await expect(
        organizerCaller.scavengerHunt.getScavengerHuntItemById({ id: item.id }),
      ).rejects.toThrow("Item not found");
      await expect(
        organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemId: item.id,
        }),
      ).rejects.toThrow("can't be scanned");
    },
  );
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("scavengerHuntRouter activity endpoints", () => {
  afterEach(async () => {
    const items = await db.query.scavengerHuntItems.findMany({
      where: (t, { like }) => like(t.name, "ACT-TEST%"),
    });
    for (const item of items) {
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.itemId, item.id));
      await db
        .delete(scavengerHuntItems)
        .where(eq(scavengerHuntItems.id, item.id));
    }
  });

  const base = {
    name: "ACT-TEST Dinner",
    type: "meal" as const,
    startsAt: new Date(Date.now() + DAY),
    endsAt: new Date(Date.now() + DAY + 2 * HOUR),
    room: "Rm 1230",
    points: 5,
    winPoints: null,
  };
  const findMine = async () =>
    (await organizerCaller.scavengerHunt.getScavengerHuntItems()).filter((a) =>
      a.name?.startsWith("ACT-TEST"),
    );

  test("creates and edits an activity", async () => {
    await organizerCaller.scavengerHunt.saveActivity(base);
    const [created] = await findMine();
    expect(created).toMatchObject({
      type: "meal",
      status: "active",
      room: "Rm 1230",
      points: 5,
      winPoints: null,
      scans: 0,
    });

    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      id: created!.id,
      name: "ACT-TEST Cup Stacking",
      type: "activity",
      winPoints: 50,
    });
    const [edited] = await findMine();
    expect(edited).toMatchObject({
      id: created!.id,
      name: "ACT-TEST Cup Stacking",
      type: "activity",
      winPoints: 50,
    });
  });

  test("drops win points for types that can't be won", async () => {
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      winPoints: 10,
    });
    expect((await findMine())[0]?.winPoints).toBeNull();
  });

  test("drafts and disabled items are hidden from the scanner and can't be scanned", async () => {
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      status: "draft",
    });
    const [draft] = await findMine();
    expect(draft?.status).toBe("draft");

    const scannable = async () =>
      (await caller.scavengerHunt.getAllScavengerHuntItems()).map((i) => i.id);
    expect(await scannable()).not.toContain(draft!.id);
    await expect(
      organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: draft!.id,
      }),
    ).rejects.toThrow("This activity is a draft");

    await organizerCaller.scavengerHunt.setActivityStatus({
      id: draft!.id,
      status: "active",
    });
    expect(await scannable()).toContain(draft!.id);

    await organizerCaller.scavengerHunt.setActivityStatus({
      id: draft!.id,
      status: "disabled",
    });
    expect(await scannable()).not.toContain(draft!.id);
    expect((await findMine())[0]?.status).toBe("disabled");
  });

  test("counts scans and hides deleted activities", async () => {
    await organizerCaller.scavengerHunt.saveActivity(base);
    const [activity] = await findMine();
    await organizerCaller.scavengerHunt.scan({
      userId: session.user.id,
      itemId: activity!.id,
    });
    expect((await findMine())[0]?.scans).toBe(1);

    await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
      itemId: activity!.id,
    });
    expect(await findMine()).toHaveLength(0);
  });

  test("a winner's attendance and win scans count as one scan", async () => {
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      type: "activity",
      winPoints: 20,
    });
    const [activity] = await findMine();
    for (const activityType of ["attendance", "win"] as const) {
      await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: activity!.id,
        activityType,
      });
    }
    expect((await findMine())[0]?.scans).toBe(1);
  });

  test("editing or disabling a deleted activity fails", async () => {
    await organizerCaller.scavengerHunt.saveActivity(base);
    const [activity] = await findMine();
    await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
      itemId: activity!.id,
    });
    await expect(
      organizerCaller.scavengerHunt.saveActivity({ ...base, id: activity!.id }),
    ).rejects.toThrow("This activity was deleted");
    await expect(
      organizerCaller.scavengerHunt.setActivityStatus({
        id: activity!.id,
        status: "disabled",
      }),
    ).rejects.toThrow("This activity was deleted");
  });

  test("rejects a duplicate name, ignoring case", async () => {
    await organizerCaller.scavengerHunt.saveActivity(base);
    await expect(
      organizerCaller.scavengerHunt.saveActivity({
        ...base,
        name: "act-test dinner",
        type: "workshop",
      }),
    ).rejects.toThrow('An activity named "act-test dinner" already exists');

    // Saving an activity under its own name is not a duplicate
    const [activity] = await findMine();
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      id: activity!.id,
      points: 7,
    });
    expect((await findMine())[0]?.points).toBe(7);
  });

  test("a new or changed end time must be in the future", async () => {
    const past = {
      startsAt: new Date(Date.now() - 2 * HOUR),
      endsAt: new Date(Date.now() - HOUR),
    };
    await expect(
      organizerCaller.scavengerHunt.saveActivity({ ...base, ...past }),
    ).rejects.toThrow("End time must be in the future");

    await organizerCaller.scavengerHunt.saveActivity(base);
    const [activity] = await findMine();
    await expect(
      organizerCaller.scavengerHunt.saveActivity({
        ...base,
        id: activity!.id,
        ...past,
      }),
    ).rejects.toThrow("End time must be in the future");
  });

  test("an activity that already started can be created", async () => {
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      startsAt: new Date(Date.now() - HOUR),
      endsAt: new Date(Date.now() + HOUR),
    });
    expect(await findMine()).toHaveLength(1);
  });

  test("a finished activity can be edited if its times don't change", async () => {
    await organizerCaller.scavengerHunt.saveActivity(base);
    const [activity] = await findMine();
    const past = {
      startsAt: new Date(Date.now() - 2 * HOUR),
      endsAt: new Date(Date.now() - HOUR),
    };
    await db
      .update(scavengerHuntItems)
      .set(past)
      .where(eq(scavengerHuntItems.id, activity!.id));

    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      ...past,
      id: activity!.id,
      room: "Rm 2230",
    });
    expect((await findMine())[0]?.room).toBe("Rm 2230");
  });

  test("changing points updates the balances of hackers who scanned it", async () => {
    const pointsOf = async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      return [
        user?.scavengerHuntEarned ?? 0,
        user?.scavengerHuntBalance ?? 0,
      ] as const;
    };
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      type: "activity",
      points: 10,
      winPoints: 50,
    });
    const [activity] = await findMine();
    const [earned0, balance0] = await pointsOf();
    for (const activityType of ["attendance", "win"] as const) {
      await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemId: activity!.id,
        activityType,
      });
    }
    expect(await pointsOf()).toEqual([earned0 + 60, balance0 + 60]);

    // +5 attendance, -10 win
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      id: activity!.id,
      type: "activity",
      points: 15,
      winPoints: 40,
    });
    expect(await pointsOf()).toEqual([earned0 + 55, balance0 + 55]);

    // No longer winnable, so the win scan is worth 0
    await organizerCaller.scavengerHunt.saveActivity({
      ...base,
      id: activity!.id,
      type: "workshop",
      points: 15,
      winPoints: null,
    });
    expect(await pointsOf()).toEqual([earned0 + 15, balance0 + 15]);
  });

  test("rejects an end time equal to the start time", async () => {
    await expect(
      organizerCaller.scavengerHunt.saveActivity({
        ...base,
        endsAt: base.startsAt,
      }),
    ).rejects.toThrow("End time must be after start time");
  });

  test("rejects an end time before the start time", async () => {
    await expect(
      organizerCaller.scavengerHunt.saveActivity({
        ...base,
        endsAt: new Date(base.startsAt.getTime() - HOUR),
      }),
    ).rejects.toThrow("End time must be after start time");
  });

  test("hackers can't manage activities", async () => {
    await expect(caller.scavengerHunt.getScavengerHuntItems()).rejects.toThrow(
      TRPCError,
    );
    await expect(caller.scavengerHunt.saveActivity(base)).rejects.toThrow(
      TRPCError,
    );
  });
});
