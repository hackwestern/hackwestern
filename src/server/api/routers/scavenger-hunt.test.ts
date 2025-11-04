import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { eq, and } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
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
describe("scavengerHuntRouter", () => {
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
        expect(false).toBe(true);
      } catch (err){
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
        expect(false).toBe(true);
      } catch (err){
        expect(err).toBeInstanceOf(TRPCError);
        const trpcErr = err as TRPCError;
        expect(trpcErr.code).toBe("FORBIDDEN");
        expect(trpcErr.message).toBe("User is not an organizer");
      }
    });

    // getPoints tests
    describe("getPoints", () => {
      test("returns earned and balance for user", async () => {
        const points = await caller.scavengerHunt.getPoints();
        expect(points).toHaveProperty("earned");
        expect(points).toHaveProperty("balance");
      });
    });
  });
});
