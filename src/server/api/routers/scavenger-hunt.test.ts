import { afterEach, describe, expect, test } from "vitest";
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

const testUser = await insertTestUser();
const session = await mockSession(db);
const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

// ---- tests ----
describe("scavengerHuntRouter", () => {
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
});
