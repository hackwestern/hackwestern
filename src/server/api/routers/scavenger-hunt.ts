import { eq, and, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import type { Transaction } from "~/server/db";
import {
  scavengerHuntItems,
  scavengerHuntScans,
  users,
  scavengerHuntRewards,
  scavengerHuntRedemptions,
} from "~/server/db/schema";
import { TRPCError } from "@trpc/server";

// ! Unsafe Functions: Need to check if caller can add points before invoking */
export const addPoints = async (
  tx: Transaction,
  userId: string,
  points: number,
) => {
  try {
    const updateData: Record<string, SQL> = {
      scavengerHuntBalance: sql`scavenger_hunt_balance + ${points}`,
    };

    if (points > 0) {
      updateData.scavengerHuntEarned = sql`scavenger_hunt_earned + ${points}`;
    }

    const [updatedUser]: {
      scavengerHuntEarned: number | null;
      scavengerHuntBalance: number | null;
    }[] = await tx
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        scavengerHuntEarned: users.scavengerHuntEarned,
        scavengerHuntBalance: users.scavengerHuntBalance,
      });

    if (!updatedUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `User ${userId} not found when updating points`,
      });
    }

    return updatedUser;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Failed to add points: " +
        (error instanceof Error ? error.message : JSON.stringify(error)),
    });
  }
};

// ! Unsafe Functions: Need to check if caller is allowed to check points on userId before invoking */
const getUserPoints = async (userId: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  return {
    earned: user.scavengerHuntEarned,
    balance: user.scavengerHuntBalance,
  };
};

// ! Unsafe Functions: Need to check if caller is allowed to get redemptions before invoking */
const getUserRedemptions = async (userId: string) => {
  const redemptions = await db.query.scavengerHuntRedemptions.findMany({
    where: eq(scavengerHuntRedemptions.userId, userId),
  });

  // If no redemptions are found, return an empty array instead of crash
  return redemptions ?? [];
};

// ! Unsafe Functions: Need to check if caller is allowed to get scans before invoking */
const getUserScans = async (userId: string) => {
  const scans = await db.query.scavengerHuntScans.findMany({
    where: eq(scavengerHuntScans.userId, userId),
  });

  // If no scans are found, return an empty array instead of crash
  return scans ?? [];
};

// * Safe Functions: Check is done within the transaction to avoid race conditions */
const redeemPrize = async (
  userId: string,
  rewardId: number,
  costPoints: number,
) => {
  try {
    await db.transaction(async (tx) => {
      // Check if user has enough points to redeem reward (using transaction)
      const user = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      if (
        user.scavengerHuntBalance !== null &&
        user.scavengerHuntBalance < costPoints
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User does not have enough points to redeem reward",
        });
      }

      // Deduct points to user
      await addPoints(tx, userId, -costPoints);

      // Record that we have redeemed an item
      await tx.insert(scavengerHuntRedemptions).values({
        userId: userId,
        rewardId: rewardId,
      });
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to redeem item: " + JSON.stringify(error),
    });
  }
};

// * Safe Functions: Check is done within the transaction to avoid race conditions */
const recordScan = async (userId: string, points: number, itemId: number) => {
  try {
    await db.transaction(async (tx) => {
      // Check if user has already scanned this item
      const scan = await tx.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, userId),
          eq(scavengerHuntScans.itemId, itemId),
        ),
      });
      if (scan) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item already scanned",
        });
      }

      // Add points to user and record the scan
      await addPoints(tx, userId, points);

      // Record the scan
      await tx.insert(scavengerHuntScans).values({
        userId: userId,
        itemId: itemId,
      });
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to add points: " + JSON.stringify(error),
    });
  }
};

export const scavengerHuntRouter = createTRPCRouter({
  // Get Scavenger Hunt Item (not sure if we need this tbh)
  getScavengerHuntItem: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      try {
        const { code } = input;
        const item = await db.query.scavengerHuntItems.findFirst({
          where: eq(scavengerHuntItems.code, code),
        });

        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
        }

        return item;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch item: " + JSON.stringify(error),
        });
      }
    }),

  // Gets a User's Own Points
  getPoints: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return await getUserPoints(userId);
  }),

  // Gets a User's Points by UserId (only accessible to organizers)
  getPointsByUserId: protectedOrganizerProcedure
    .input(z.object({ requestedUserId: z.string() }))
    .query(async ({ input }) => {
      const { requestedUserId } = input;

      // Get points for requestedUserId
      return await getUserPoints(requestedUserId);
    }),

  // Redeem a Reward (only accessible to users)
  redeem: protectedProcedure
    .input(
      z.object({
        rewardId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { rewardId } = input;
        const userId = ctx.session.user.id;

        // Check if reward exists
        const reward = await db.query.scavengerHuntRewards.findFirst({
          where: eq(scavengerHuntRewards.id, rewardId),
        });
        if (!reward) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reward not found",
          });
        }

        await redeemPrize(userId, rewardId, reward.costPoints);

        return {
          success: true,
          message: "Reward redeemed successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to redeem reward: " + JSON.stringify(error),
        });
      }
    }),

  // Get all Redemptions (only accessible to users)
  getRedemptions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get redemptions for userId
    return await getUserRedemptions(userId);
  }),

  // Get a User's Redemptions by UserId (only accessible to organizers)
  getRedemptionByUserId: protectedOrganizerProcedure
    .input(z.object({ requestedUserId: z.string() }))
    .query(async ({ input }) => {
      const { requestedUserId } = input;

      // Check if requestedUserId exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, requestedUserId),
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Get redemptions for requestedUserId
      return await getUserRedemptions(requestedUserId);
    }),

  // Scan Item (only accessible to organizers (users can't scan items themselves))
  scan: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        itemCode: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { userId, itemCode } = input;

        // Check if item exists
        const item = await db.query.scavengerHuntItems.findFirst({
          where: eq(scavengerHuntItems.code, itemCode),
        });
        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
        }

        // Check if user exists
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Record the scan
        await recordScan(userId, item.points, item.id);
        return {
          success: true,
          message: "Item scanned successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to scan item: " + JSON.stringify(error),
        });
      }
    }),

  // Get Scans (user's get their own scans)
  getScans: protectedOrganizerProcedure.query(async ({ ctx }) => {
    // Get scans for itemId
    return await getUserScans(ctx.session.user.id);
  }),

  // Get Scans by UserId (only accessible to organizers)
  getScansByUserId: protectedOrganizerProcedure
    .input(z.object({ requestedUserId: z.string() }))
    .query(async ({ input }) => {
      const { requestedUserId } = input;

      // Get scans for requestedUserId
      return await getUserScans(requestedUserId);
    }),

  // Add a Scavenger Hunt Item (only accessible to organizers)
  addScavengerHuntItem: protectedOrganizerProcedure
    .input(
      z.object({
        item: z.object({
          code: z.string(),
          points: z.number(),
          description: z.string(),
        }),
      }),
    )

    .mutation(async ({ input }) => {
      const { item } = input;
      try {
        // Add the item to the database
        await db.insert(scavengerHuntItems).values({
          code: item.code,
          points: item.points,
          description: item.description,
        });

        return {
          success: true,
          message: "Item added successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add item: " + JSON.stringify(error),
        });
      }
    }),
});
