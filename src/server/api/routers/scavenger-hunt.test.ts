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
  users,
} from "~/server/db/schema";
import { mockSession, mockOrganizerSession } from "~/server/auth";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";

// ---- helpers ----
const insertTestItem = async (
  overrides: Partial<typeof scavengerHuntItems.$inferInsert> = {},
  code = `123456789012`,
) => {
  const [item] = await db
    .insert(scavengerHuntItems)
    .values({
      code: code,
      points: 25,
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

// Tests
describe("scavengerHuntRouter basic endpoints", () => {
  // getScavengerHuntItem tests
  describe("getScavengerHuntItem", () => {
    test("returns inserted item", async () => {
      const item = await insertTestItem();
      const result = await caller.scavengerHunt.getScavengerHuntItem({
        code: item.code,
      });

      expect(result.id).toBe(item.id);
    });

    test("throws error if code not found", async () => {
      await expect(
        caller.scavengerHunt.getScavengerHuntItem({ code: "nonexistent" }),
      ).rejects.toThrow();
    });
  });

  // scan tests
  let testItem: Awaited<ReturnType<typeof insertTestItem>>; // declare outside so tests can use it
  describe("scan", () => {
    beforeEach(async () => {
      // Create a fresh item for each test to avoid state pollution
      testItem = await insertTestItem({}, faker.string.alphanumeric(12));

      // Reset user's scavenger hunt balance and points
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, session.user.id));

      // Clean up any existing scans for this user
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, session.user.id));
    });

    test("successfully scans and awards points", async () => {
      const scanResult = await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemCode: testItem.code,
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

    test("throws error if scanning same item twice", async () => {
      const firstScanResult = await organizerCaller.scavengerHunt.scan({
        userId: session.user.id,
        itemCode: testItem.code,
      });
      expect(firstScanResult.success).toBe(true);
      expect(firstScanResult.message).toBe("Item scanned successfully");

      try {
        await organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemCode: testItem.code,
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
          itemCode: testItem.code,
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
          itemCode: "nonexistent-code",
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }
    });

    test("throws error if user not found", async () => {
      const nonExistentUserId = "non-existent-user-id";
      try {
        await organizerCaller.scavengerHunt.scan({
          userId: nonExistentUserId,
          itemCode: testItem.code,
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

      await expect(unauthenticatedCaller.scavengerHunt.getPoints()).rejects.toThrow();
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
        .set({ scavengerHuntBalance: initialBalance, scavengerHuntEarned: initialEarned })
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
        await unauthenticatedCaller.scavengerHunt.redeem({
          rewardId: testReward.id,
        }),
        expect.fail("Route should return a TRPCError");
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
        .set({ scavengerHuntBalance: testReward.costPoints - 1, scavengerHuntEarned: 100 })
        .where(eq(users.id, session.user.id));

      try {
        await caller.scavengerHunt.redeem({ rewardId: testReward.id });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("BAD_REQUEST");
        expect(trpcErr.message).toBe("User does not have enough points to redeem reward");
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
  // getScans tests
  describe("getScans", () => {
    let testItem: Awaited<ReturnType<typeof insertTestItem>>;
    let testItem2: Awaited<ReturnType<typeof insertTestItem>>;

    beforeEach(async () => {
      // Create test items
      testItem = await insertTestItem({}, faker.string.alphanumeric(12));
      testItem2 = await insertTestItem({}, faker.string.alphanumeric(12));

      // Reset user's scavenger hunt balance
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, organizerSession.user.id));

      // Clean up any existing scans for organizer user
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, organizerSession.user.id));
    });

    afterEach(async () => {
      // Clean up scans
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, organizerSession.user.id));

      // Clean up test items
      if (testItem) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem.id));
      }
      if (testItem2) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem2.id));
      }
    });

    test("returns empty array when user has no scans", async () => {
      const scans = await organizerCaller.scavengerHunt.getScans();
      expect(scans).toEqual([]);
    });

    test("returns user's scans", async () => {
      // Scan items first
      await organizerCaller.scavengerHunt.scan({
        userId: organizerSession.user.id,
        itemCode: testItem.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: organizerSession.user.id,
        itemCode: testItem2.code,
      });

      const scans = await organizerCaller.scavengerHunt.getScans();

      expect(scans.length).toBe(2);
      expect(scans.map((s) => s.itemId)).toContain(testItem.id);
      expect(scans.map((s) => s.itemId)).toContain(testItem2.id);
      expect(scans.every((s) => s.userId === organizerSession.user.id)).toBe(true);
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.getScans();
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });
  });

  // getScansByUserId tests
  describe("getScansByUserId", () => {
    let testUser: Awaited<ReturnType<typeof mockSession>>;
    let testItem: Awaited<ReturnType<typeof insertTestItem>>;
    let testItem2: Awaited<ReturnType<typeof insertTestItem>>;

    beforeEach(async () => {
      // Create a test user to query
      testUser = await mockSession(db);
      testItem = await insertTestItem({}, faker.string.alphanumeric(12));
      testItem2 = await insertTestItem({}, faker.string.alphanumeric(12));

      // Reset test user's scavenger hunt balance
      await db
        .update(users)
        .set({ scavengerHuntBalance: 0, scavengerHuntEarned: 0 })
        .where(eq(users.id, testUser.user.id));

      // Clean up any existing scans for test user
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser.user.id));
    });

    afterEach(async () => {
      // Clean up scans
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser.user.id));

      // Clean up test user
      await db.delete(users).where(eq(users.id, testUser.user.id));

      // Clean up test items
      if (testItem) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem.id));
      }
      if (testItem2) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.id, testItem2.id));
      }
    });

    test("returns empty array when user has no scans", async () => {
      const scans = await organizerCaller.scavengerHunt.getScansByUserId({
        requestedUserId: testUser.user.id,
      });

      expect(scans).toEqual([]);
    });

    test("returns scans for requested user", async () => {
      // Scan items for test user
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem2.code,
      });

      // Organizer queries the scans
      const scans = await organizerCaller.scavengerHunt.getScansByUserId({
        requestedUserId: testUser.user.id,
      });

      expect(scans.length).toBe(2);
      expect(scans.map((s) => s.itemId)).toContain(testItem.id);
      expect(scans.map((s) => s.itemId)).toContain(testItem2.id);
      expect(scans.every((s) => s.userId === testUser.user.id)).toBe(true);
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.getScansByUserId({
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

    test("returns empty array for non-existent user (doesn't throw)", async () => {
      // This endpoint doesn't check if user exists, it just returns scans
      // If user doesn't exist, it should return empty array
      const nonExistentUserId = "non-existent-user-id";
      const scans = await organizerCaller.scavengerHunt.getScansByUserId({
        requestedUserId: nonExistentUserId,
      });

      expect(scans).toEqual([]);
    });
  });
});

describe("scavengerHuntRouter item management endpoints", () => {
  // addScanvengerHuntItem tests
  describe("addScanvengerHuntItem", () => {
    afterEach(async () => {
      // Clean up any test items created (by code)
      const testCodes = ["TEST-ITEM-1", "TEST-ITEM-2", "TEST-ITEM-3"];
      for (const code of testCodes) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.code, code));
      }
    });

    test("successfully adds a new scavenger hunt item", async () => {
      const newItem = {
        code: "TEST-ITEM-1",
        points: 50,
        description: "Test item description",
      };

      const result = await organizerCaller.scavengerHunt.addScanvengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Item added successfully");

      // Verify item was added to database
      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item).not.toBeNull();
      expect(item?.code).toBe(newItem.code);
      expect(item?.points).toBe(newItem.points);
      expect(item?.description).toBe(newItem.description);
    });

    test("can add multiple items with different codes", async () => {
      const item1 = {
        code: "TEST-ITEM-1",
        points: 25,
        description: "First test item",
      };
      const item2 = {
        code: "TEST-ITEM-2",
        points: 75,
        description: "Second test item",
      };

      const result1 = await organizerCaller.scavengerHunt.addScanvengerHuntItem({
        item: item1,
      });
      const result2 = await organizerCaller.scavengerHunt.addScanvengerHuntItem({
        item: item2,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify both items exist
      const dbItem1 = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, item1.code),
      });
      const dbItem2 = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, item2.code),
      });

      expect(dbItem1).not.toBeNull();
      expect(dbItem2).not.toBeNull();
      expect(dbItem1?.points).toBe(item1.points);
      expect(dbItem2?.points).toBe(item2.points);
    });

    test("throws error if user is not an organizer", async () => {
      const newItem = {
        code: "TEST-ITEM-1",
        points: 50,
        description: "Test item description",
      };

      try {
        await caller.scavengerHunt.addScanvengerHuntItem({ item: newItem });
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

      const newItem = {
        code: "TEST-ITEM-1",
        points: 50,
        description: "Test item description",
      };

      await expect(
        unauthenticatedCaller.scavengerHunt.addScanvengerHuntItem({ item: newItem }),
      ).rejects.toThrow();
    });

    test("can add item with zero points", async () => {
      const newItem = {
        code: "TEST-ITEM-3",
        points: 0,
        description: "Item with zero points",
      };

      const result = await organizerCaller.scavengerHunt.addScanvengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item?.points).toBe(0);
    });

    test("can add item with negative points", async () => {
      const newItem = {
        code: "TEST-ITEM-3",
        points: -10,
        description: "Item with negative points",
      };

      const result = await organizerCaller.scavengerHunt.addScanvengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item?.points).toBe(-10);
    });
  });
});