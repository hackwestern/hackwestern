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
  let item: Awaited<ReturnType<typeof insertTestItem>>; // declare outside so tests can use it
  describe("getScavengerHuntItem", () => {
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

    test("does not return soft-deleted item", async () => {
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, item.id));

      // Should throw error when trying to get soft-deleted item
      try {
        (await caller.scavengerHunt.getScavengerHuntItem({ code: item.code }),
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
      const testCodes = ["GETALL-001", "GETALL-002", "GETALL-003"];
      for (const code of testCodes) {
        await db
          .delete(scavengerHuntItems)
          .where(eq(scavengerHuntItems.code, code));
      }
    });

    test("returns empty array when no items exist", async () => {
      const result = await caller.scavengerHunt.getAllScavengerHuntItems();
      expect(result).toEqual([]);
    });

    test("returns all non-deleted items", async () => {
      // Create multiple test items
      const item1 = await insertTestItem(
        { code: "GETALL-001", points: 10 },
        "GETALL-001",
      );
      const item2 = await insertTestItem(
        { code: "GETALL-002", points: 20 },
        "GETALL-002",
      );
      const item3 = await insertTestItem(
        { code: "GETALL-003", points: 30 },
        "GETALL-003",
      );

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      expect(result.length).toBeGreaterThanOrEqual(3);
      const resultCodes = result.map((item) => item.code);
      expect(resultCodes).toContain(item1.code);
      expect(resultCodes).toContain(item2.code);
      expect(resultCodes).toContain(item3.code);
    });

    test("excludes soft-deleted items", async () => {
      // Create items
      const activeItem = await insertTestItem(
        { code: "GETALL-001", points: 10 },
        "GETALL-001",
      );
      const deletedItem = await insertTestItem(
        { code: "GETALL-002", points: 20 },
        "GETALL-002",
      );

      // Soft delete one item
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, deletedItem.id));

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      // Should only return the active item
      const resultCodes = result.map((item) => item.code);
      expect(resultCodes).toContain(activeItem.code);
      expect(resultCodes).not.toContain(deletedItem.code);
    });

    test("works without authentication (public procedure)", async () => {
      const item = await insertTestItem(
        { code: "GETALL-001", points: 10 },
        "GETALL-001",
      );

      // Create unauthenticated caller
      const unauthenticatedCtx = createInnerTRPCContext({ session: null });
      const unauthenticatedCaller = createCaller(unauthenticatedCtx);

      const result =
        await unauthenticatedCaller.scavengerHunt.getAllScavengerHuntItems();

      expect(result.length).toBeGreaterThanOrEqual(1);
      const resultCodes = result.map((i) => i.code);
      expect(resultCodes).toContain(item.code);
    });

    test("returns items with correct structure", async () => {
      const item = await insertTestItem(
        { code: "GETALL-001", points: 25, description: "Test item" },
        "GETALL-001",
      );

      const result = await caller.scavengerHunt.getAllScavengerHuntItems();

      const foundItem = result.find((i) => i.id === item.id);
      expect(foundItem).toBeDefined();
      expect(foundItem?.code).toBe(item.code);
      expect(foundItem?.points).toBe(25);
      expect(foundItem?.description).toBe("Test item");
      expect(foundItem?.deletedAt).toBeNull();
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

    test("throws error if trying to scan soft-deleted item", async () => {
      // Soft delete the test item
      await db
        .update(scavengerHuntItems)
        .set({ deletedAt: new Date() })
        .where(eq(scavengerHuntItems.id, testItem.id));

      try {
        await organizerCaller.scavengerHunt.scan({
          userId: session.user.id,
          itemCode: testItem.code,
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
      expect(scans.every((s) => s.userId === organizerSession.user.id)).toBe(
        true,
      );
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
      const scans = await organizerCaller.scavengerHunt.getAllScans({});
      expect(scans).toEqual([]);
    });

    test("returns all scans from all users", async () => {
      // Create scans for different users
      await organizerCaller.scavengerHunt.scan({
        userId: testUser1.user.id,
        itemCode: testItem1.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser1.user.id,
        itemCode: testItem2.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser2.user.id,
        itemCode: testItem1.code,
      });

<<<<<<< HEAD
      const scans = await organizerCaller.scavengerHunt.getAllScans({});
=======
      const scans =
        (await organizerCaller.scavengerHunt.getAllScans()) as Array<{
          userId: string;
          itemId: number;
        }>;
>>>>>>> 3a8935ad991f504ace0568b38aeb0b08e95102be

      expect(scans.length).toBeGreaterThanOrEqual(3);
      const scanUserIds = scans.map((s) => s.userId);
      const scanItemIds = scans.map((s) => s.itemId);

      // Should contain scans from both users
      expect(scanUserIds).toContain(testUser1.user.id);
      expect(scanUserIds).toContain(testUser2.user.id);

      // Should contain scans for both items
      expect(scanItemIds).toContain(testItem1.id);
      expect(scanItemIds).toContain(testItem2.id);
    });

    test("returns scans with correct structure", async () => {
      await organizerCaller.scavengerHunt.scan({
        userId: testUser1.user.id,
        itemCode: testItem1.code,
      });

      const scans = await organizerCaller.scavengerHunt.getAllScans({});

      const scan = scans.find(
        (s) => s.userId === testUser1.user.id && s.itemId === testItem1.id,
      );

      expect(scan).toBeDefined();
      expect(scan?.userId).toBe(testUser1.user.id);
      expect(scan?.itemId).toBe(testItem1.id);
      expect(scan?.scannerId).toBeDefined();
      expect(scan?.createdAt).toBeInstanceOf(Date);
    });

    test("includes scans from multiple users and items", async () => {
      // Create multiple scans
      await organizerCaller.scavengerHunt.scan({
        userId: testUser1.user.id,
        itemCode: testItem1.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser1.user.id,
        itemCode: testItem2.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser2.user.id,
        itemCode: testItem1.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser2.user.id,
        itemCode: testItem2.code,
      });

<<<<<<< HEAD
      const scans = await organizerCaller.scavengerHunt.getAllScans({});
=======
      const scans =
        (await organizerCaller.scavengerHunt.getAllScans()) as Array<{
          userId: string;
          itemId: number;
        }>;
>>>>>>> 3a8935ad991f504ace0568b38aeb0b08e95102be

      expect(scans.length).toBeGreaterThanOrEqual(4);

      // Verify all combinations exist
      const scanCombinations = (
        scans as Array<{ userId: string; itemId: number }>
      ).map((s) => ({
        userId: s.userId,
        itemId: s.itemId,
      }));

      expect(scanCombinations).toContainEqual({
        userId: testUser1.user.id,
        itemId: testItem1.id,
      });
      expect(scanCombinations).toContainEqual({
        userId: testUser1.user.id,
        itemId: testItem2.id,
      });
      expect(scanCombinations).toContainEqual({
        userId: testUser2.user.id,
        itemId: testItem1.id,
      });
      expect(scanCombinations).toContainEqual({
        userId: testUser2.user.id,
        itemId: testItem2.id,
      });
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
  // addScavengerHuntItem tests
  describe("addScavengerHuntItem", () => {
    afterEach(async () => {
      // Clean up any test items created (by code)
      const testCodes = [
        "TEST-ITEM-1",
        "TEST-ITEM-2",
        "TEST-ITEM-3",
        "SCHED-001",
        "NORMAL-001",
        "PAST-DEL",
      ];
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

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
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

<<<<<<< HEAD
      const result1 = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: item1,
      });
      const result2 = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: item2,
      });
=======
      const result1 = (await organizerCaller.scavengerHunt.addScavengerHuntItem(
        {
          item: item1,
        },
      )) as { success: boolean; message: string };
      const result2 = (await organizerCaller.scavengerHunt.addScavengerHuntItem(
        {
          item: item2,
        },
      )) as { success: boolean; message: string };
>>>>>>> 3a8935ad991f504ace0568b38aeb0b08e95102be

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
        await caller.scavengerHunt.addScavengerHuntItem({ item: newItem });
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
        unauthenticatedCaller.scavengerHunt.addScavengerHuntItem({
          item: newItem,
        }),
      ).rejects.toThrow();
    });

    test("can add item with zero points", async () => {
      const newItem = {
        code: "TEST-ITEM-3",
        points: 0,
        description: "Item with zero points",
      };

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
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

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item?.points).toBe(-10);
    });

    test("can add item with scheduled deletion time", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const newItem = {
        code: "SCHED-001",
        points: 50,
        description: "Item scheduled for deletion",
        deletedAt: futureDate,
      };

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Item added successfully");

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item).not.toBeNull();
      expect(item?.deletedAt).not.toBeNull();
      expect(item?.deletedAt?.getTime()).toBe(futureDate.getTime());

      // Item should still be accessible since deletion is scheduled for the future
      const accessibleItem = await caller.scavengerHunt.getScavengerHuntItem({
        code: newItem.code,
      });
      expect(accessibleItem.code).toBe(newItem.code);
      expect(accessibleItem.points).toBe(newItem.points);

      // Item should be scannable since it's not yet deleted
      const testUser = await mockSession(db);
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: newItem.code,
      });

      // Clean up
      await db
        .delete(scavengerHuntScans)
        .where(eq(scavengerHuntScans.userId, testUser.user.id));
      await db.delete(users).where(eq(users.id, testUser.user.id));
      await db
        .delete(scavengerHuntItems)
        .where(eq(scavengerHuntItems.code, newItem.code));
    });

    test("can add item without deletedAt (normal behavior)", async () => {
      const newItem = {
        code: "NORMAL-001",
        points: 25,
        description: "Normal item without scheduled deletion",
        // deletedAt not provided
      };

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item).not.toBeNull();
      expect(item?.deletedAt).toBeNull();
      expect(item?.code).toBe(newItem.code);
      expect(item?.points).toBe(newItem.points);

      // Clean up
      await db
        .delete(scavengerHuntItems)
        .where(eq(scavengerHuntItems.code, newItem.code));
    });

    test("item with past deletedAt is immediately considered deleted", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const newItem = {
        code: "PAST-DEL",
        points: 30,
        description: "Item with past deletion time",
        deletedAt: pastDate,
      };

      const result = await organizerCaller.scavengerHunt.addScavengerHuntItem({
        item: newItem,
      });

      expect(result.success).toBe(true);

      const item = await db.query.scavengerHuntItems.findFirst({
        where: eq(scavengerHuntItems.code, newItem.code),
      });

      expect(item).not.toBeNull();
      expect(item?.deletedAt).not.toBeNull();

      // Item should not be accessible since deletion time has passed
      await expect(
        caller.scavengerHunt.getScavengerHuntItem({
          code: newItem.code,
        }),
      ).rejects.toThrow();

      // Item should not be scannable
      const testUser = await mockSession(db);
      await expect(
        organizerCaller.scavengerHunt.scan({
          userId: testUser.user.id,
          itemCode: newItem.code,
        }),
      ).rejects.toThrow();

      // Clean up
      await db.delete(users).where(eq(users.id, testUser.user.id));
      await db
        .delete(scavengerHuntItems)
        .where(eq(scavengerHuntItems.code, newItem.code));
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

    test("soft-deleted item cannot be retrieved via getScavengerHuntItem", async () => {
      await organizerCaller.scavengerHunt.deleteScavengerHuntItem({
        itemId: testItem.id,
      });

      // Should throw error when trying to get soft-deleted item
      await expect(
        caller.scavengerHunt.getScavengerHuntItem({ code: testItem.code }),
      ).rejects.toThrow();
    });

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
          itemCode: testItem.code,
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
    });

    test("scans remain linked to soft-deleted item", async () => {
      const testUser = await mockSession(db);

      // Scan the item first
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem.code,
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

  // deleteScanByUserId tests
  describe("deleteScanByUserId", () => {
    let testUser: Awaited<ReturnType<typeof mockSession>>;
    let testItem: Awaited<ReturnType<typeof insertTestItem>>;
    let testItem2: Awaited<ReturnType<typeof insertTestItem>>;

    beforeEach(async () => {
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

    test("deletes specific scan by userId and itemId", async () => {
      // Scan both items
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem2.code,
      });

      // Verify both scans exist
      const scansBefore = await db.query.scavengerHuntScans.findMany({
        where: eq(scavengerHuntScans.userId, testUser.user.id),
      });
      expect(scansBefore.length).toBe(2);

      // Delete specific scan
      const result = await organizerCaller.scavengerHunt.deleteScanByUserId({
        userId: testUser.user.id,
        itemId: testItem.id,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Scan deleted successfully");

      // Verify only the specified scan was deleted
      const scansAfter = await db.query.scavengerHuntScans.findMany({
        where: eq(scavengerHuntScans.userId, testUser.user.id),
      });
      expect(scansAfter.length).toBe(1);
      expect(scansAfter[0]?.itemId).toBe(testItem2.id);
    });

    test("deducts points from balance and earned balance when deleting scan", async () => {
      // Scan an item to give the user points
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem.code,
      });

      // Verify user has points
      const userBefore = await db.query.users.findFirst({
        where: eq(users.id, testUser.user.id),
      });
      expect(userBefore?.scavengerHuntBalance).toBe(testItem.points);
      expect(userBefore?.scavengerHuntEarned).toBe(testItem.points);

      // Delete the scan
      await organizerCaller.scavengerHunt.deleteScanByUserId({
        userId: testUser.user.id,
        itemId: testItem.id,
      });

      // Verify points were deducted
      const userAfter = await db.query.users.findFirst({
        where: eq(users.id, testUser.user.id),
      });
      expect(userAfter?.scavengerHuntBalance).toBe(0);
      expect(userAfter?.scavengerHuntEarned).toBe(0);
    });

    test("deducts correct points when deleting scan with multiple items", async () => {
      // Scan multiple items
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem.code,
      });
      await organizerCaller.scavengerHunt.scan({
        userId: testUser.user.id,
        itemCode: testItem2.code,
      });

      const totalPoints = testItem.points + testItem2.points;

      // Verify user has total points
      const userBefore = await db.query.users.findFirst({
        where: eq(users.id, testUser.user.id),
      });
      expect(userBefore?.scavengerHuntBalance).toBe(totalPoints);

      // Delete one scan
      await organizerCaller.scavengerHunt.deleteScanByUserId({
        userId: testUser.user.id,
        itemId: testItem.id,
      });

      // Verify only that item's points were deducted
      const userAfter = await db.query.users.findFirst({
        where: eq(users.id, testUser.user.id),
      });
      expect(userAfter?.scavengerHuntBalance).toBe(testItem2.points);
      expect(userAfter?.scavengerHuntEarned).toBe(testItem2.points);
    });

    test("throws error when scan does not exist for user", async () => {
      try {
        await organizerCaller.scavengerHunt.deleteScanByUserId({
          userId: testUser.user.id,
          itemId: testItem.id,
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Scan not found for this user and item");
      }
    });

    test("throws error when item does not exist", async () => {
      try {
        await organizerCaller.scavengerHunt.deleteScanByUserId({
          userId: testUser.user.id,
          itemId: 99999, // Non-existent item ID
        });
        expect.fail("Route should return a TRPCError");
      } catch (err) {
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("NOT_FOUND");
        expect(trpcErr.message).toBe("Item not found");
      }
    });

    test("throws error if user is not an organizer", async () => {
      try {
        await caller.scavengerHunt.deleteScanByUserId({
          userId: testUser.user.id,
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
        unauthenticatedCaller.scavengerHunt.deleteScanByUserId({
          userId: testUser.user.id,
          itemId: testItem.id,
        }),
      ).rejects.toThrow();
    });
  });
});
