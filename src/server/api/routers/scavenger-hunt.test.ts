import { beforeEach, afterEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { scavengerHuntItems, scavengerHuntRewards, scavengerHuntScans, scavengerHuntRedemptions, users } from "~/server/db/schema";
import { mockSession, mockOrganizerSession } from "~/server/auth";

// ---- helpers ----
const insertTestUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
  const generatedId = `user_${Date.now()}_${Math.random()}`;
  const [user] = await db
    .insert(users)
    .values({
      id: generatedId,
      email: `${generatedId}@example.com`,
      name: "Test User",
      type: "hacker",
      scavengerHuntEarned: 0,
      scavengerHuntBalance: 0,
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("Failed to insert test user");
  return user;
};

const insertTestItem = async (overrides: Partial<typeof scavengerHuntItems.$inferInsert> = {}) => {
  const [item] = await db
    .insert(scavengerHuntItems)
    .values({
      code: `123456789012`,
      points: 25,
      ...overrides,
    })
    .returning();
  if (!item) throw new Error("Failed to insert test item");
  return item;
};

const insertTestReward = async (overrides: Partial<typeof scavengerHuntRewards.$inferInsert> = {}) => {
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

// ---- tests ----
describe("scavengerHuntRouter", () => {
  let testUser: any;
  let session: any;
  let ctx: any;
  let caller: any;

  beforeEach(async () => {
    testUser = await insertTestUser();
    session = await mockSession(db);
    ctx = createInnerTRPCContext({ session });
    caller = createCaller(ctx);
  });

  afterEach(async () => {
    await db.delete(scavengerHuntScans).where(eq(scavengerHuntScans.userId, testUser.id));
    await db.delete(scavengerHuntRedemptions).where(eq(scavengerHuntRedemptions.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  // ---------------------------
  describe("getScavengerHuntItem", () => {
    test.only("returns inserted item", async () => {
      const item = await insertTestItem();

      const result = await caller.scavengerHunt.getScavengerHuntItem({ code: item.code });

      console.log("result", "adfafas");
      console.log("item", "cat");
      expect(result.id).toBe(item.id);
    });

    test("throws error if code not found", async () => {
      await expect(
        caller.scavengerHunt.getScavengerHuntItem({ code: "nonexistent" })
      ).rejects.toThrow();
    });
  });

  // ---------------------------
  describe("scan", () => {
    test("successfully scans and awards points", async () => {
      const item = await insertTestItem();
      const result = await caller.scavengerHunt.scan({ code: item.code });
      expect(result.success).toBe(true);

      const scans = await db.query.scavengerHuntScans.findMany({
        where: eq(scavengerHuntScans.userId, testUser.id),
      });
      expect(scans.length).toBe(1);

      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      });
      expect(updatedUser?.scavengerHuntBalance).toBe(item.points);
    });

    test("throws error if scanning same item twice", async () => {
      const item = await insertTestItem();
      await caller.scavengerHunt.scan({ code: item.code });
      await expect(
        caller.scavengerHunt.scan({ code: item.code })
      ).rejects.toThrow();
    });
  });

  // ---------------------------
  describe("getPoints", () => {
    test("returns earned and balance for user", async () => {
      const points = await caller.scavengerHunt.getPoints();
      expect(points).toHaveProperty("earned");
      expect(points).toHaveProperty("balance");
    });
  });

  // ---------------------------
  describe("redeem", () => {
    test("redeems item and reduces balance", async () => {
      const item = await insertTestItem();
      const reward = await insertTestReward({ costPoints: 5 });

      // Earn some points
      await caller.scavengerHunt.scan({ code: item.code });

      const result = await caller.scavengerHunt.redeem({ rewardId: reward.id });
      expect(result.success).toBe(true);

      const redemptions = await db.query.scavengerHuntRedemptions.findMany({
        where: eq(scavengerHuntRedemptions.userId, testUser.id),
      });
      expect(redemptions.length).toBe(1);

      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      });
      expect(updatedUser?.scavengerHuntBalance).toBe(item.points - reward.costPoints);
    });

    test("throws error if user doesn’t have enough points", async () => {
      const reward = await insertTestReward({ costPoints: 999 });
      await expect(
        caller.scavengerHunt.redeem({ rewardId: reward.id })
      ).rejects.toThrow();
    });
  });

  // ---------------------------
  describe("getRedemptions", () => {
    test("returns redemptions for user", async () => {
      const item = await insertTestItem();
      const reward = await insertTestReward({ costPoints: 5 });
      await caller.scavengerHunt.scan({ code: item.code });
      await caller.scavengerHunt.redeem({ rewardId: reward.id });

      const redemptions = await caller.scavengerHunt.getRedemptions();
      expect(Array.isArray(redemptions)).toBe(true);
      expect(redemptions.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------
  describe("getScans", () => {
    test("returns scans for user", async () => {
      const item = await insertTestItem();
      await caller.scavengerHunt.scan({ code: item.code });

      const scans = await caller.scavengerHunt.getScans();
      expect(Array.isArray(scans)).toBe(true);
      expect(scans.length).toBe(1);
    });
  });

  // ---------------------------
  describe("getLeadershipBoard", () => {
    test("returns top users", async () => {
      const board = await caller.scavengerHunt.getLeadershipBoard();
      expect(Array.isArray(board)).toBe(true);
      expect(board[0]).toHaveProperty("scavengerHuntEarned");
    });
  });

  // ---------------------------
  describe("organizer-only endpoints", () => {
    let organizerCaller: any;
    let organizerUser: any;

    beforeEach(async () => {
      organizerUser = await insertTestUser({ type: "organizer" });
      const orgSession = await mockOrganizerSession(db);
      const ctxOrg = createInnerTRPCContext({ session: orgSession });
      organizerCaller = createCaller(ctxOrg);
    });

    afterEach(async () => {
      await db.delete(users).where(eq(users.id, organizerUser.id));
    });

    test("getPointsByUserId works for organizer", async () => {
      const points = await organizerCaller.scavengerHunt.getPointsByUserId({
        requestedUserId: testUser.id,
      });
      expect(points).toHaveProperty("earned");
      expect(points).toHaveProperty("balance");
    });

    test("getScansByUserId works for organizer", async () => {
      const item = await insertTestItem();
      await caller.scavengerHunt.scan({ code: item.code });

      const scans = await organizerCaller.scavengerHunt.getScansByUserId({
        requestedUserId: testUser.id,
      });
      expect(Array.isArray(scans)).toBe(true);
      expect(scans.length).toBe(1);
    });

    test("getRedemptionsByUserId works for organizer", async () => {
      const item = await insertTestItem();
      const reward = await insertTestReward({ costPoints: 5 });
      await caller.scavengerHunt.scan({ code: item.code });
      await caller.scavengerHunt.redeem({ rewardId: reward.id });

      const redemptions = await organizerCaller.scavengerHunt.getRedemptionsByUserId({
        requestedUserId: testUser.id,
      });
      expect(Array.isArray(redemptions)).toBe(true);
      expect(redemptions.length).toBeGreaterThan(0);
    });
  });
});
