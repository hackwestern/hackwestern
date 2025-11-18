import { eq, and, sql, or, isNull, gt } from "drizzle-orm";
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

// Helper function to handle TRPC errors consistently
const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${errorMessage}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    });
  }
};

// ! Unsafe Functions: Need to check if caller can add points before invoking */
export const addPoints = async (
  tx: Transaction,
  userId: string,
  points: number,
  decrementEarnedBalance = false,
) => {
  return withErrorHandling(async () => {
    const updateData: Record<string, SQL> = {
      scavengerHuntBalance: sql`scavenger_hunt_balance + ${points}`,
    };

    if (points > 0 || decrementEarnedBalance) {
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
  }, "Failed to add points");
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

// * Helper Functions *
// (anyone can use this function) Gets the scavenger hunt item while keeping in mind soft-deletion
const getScavengerHuntItemByItemCode = async (itemCode: string) => {
  const now = new Date();

  const item = await db.query.scavengerHuntItems.findFirst({
    where: and(
      eq(scavengerHuntItems.code, itemCode),
      or(
        isNull(scavengerHuntItems.deletedAt),
        gt(scavengerHuntItems.deletedAt, now),
      ),
    ),
  });
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
  }

  return item;
};

// * Safe Functions: Check is done within the transaction to avoid race conditions */
const redeemPrize = async (
  userId: string,
  rewardId: number,
  costPoints: number,
) => {
  return withErrorHandling(async () => {
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
  }, "Failed to redeem item");
};

// * Safe Functions: Check is done within the transaction to avoid race conditions */
const recordScan = async (userId: string, points: number, itemId: number) => {
  return withErrorHandling(async () => {
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
  }, "Failed to add points");
};

export const scavengerHuntRouter = createTRPCRouter({
  // * SCAVENGER HUNT ITEM ENDPOINTS * //
  // Get Scavenger Hunt Item
  getScavengerHuntItem: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      return withErrorHandling(async () => {
        const { code } = input;
        return await getScavengerHuntItemByItemCode(code);
      }, "Failed to fetch item");
    }),

  // Get Scavenge All Scavenger Hunt Items
  getAllScavengerHuntItems: publicProcedure.query(async () => {
    return await db.query.scavengerHuntItems.findMany({
      where: isNull(scavengerHuntItems.deletedAt),
    });
  }),
  
  // Add a Scavenger Hunt Item (only accessible to organizers)
  addScanvengerHuntItem: protectedOrganizerProcedure
    .input(
      z.object({
        item: z.object({
          code: z.string(),
          points: z.number(),
          description: z.string(),
          deletedAt: z.date().optional(), // Optional: schedule deletion at a specific time for specific events with deadlines
        }),
      }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const { item } = input;
        // Add the item to the database
        await db.insert(scavengerHuntItems).values({
          code: item.code,
          points: item.points,
          description: item.description,
          deletedAt: item.deletedAt,
        });

        return {
          success: true,
          message: "Item added successfully",
        };
      }, "Failed to add item");
    }),

  // Delete a Scavenger Hunt Item (only accessible to organizers)
  // Soft delete: sets deletedAt timestamp instead of actually deleting the record
  deleteScavengerHuntItem: protectedOrganizerProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const { itemId } = input;
        await db
          .update(scavengerHuntItems)
          .set({ deletedAt: new Date() })
          .where(eq(scavengerHuntItems.id, itemId));
      }, "Failed to delete item");
    }),

  // * POINTS ENDPOINTS * //
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
      return withErrorHandling(async () => {
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
      }, "Failed to redeem reward");
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
      return withErrorHandling(async () => {
        const { userId, itemCode } = input;

        // Check if item exists and is not soft-deleted (or scheduled for future deletion)
        const item = await getScavengerHuntItemByItemCode(itemCode);

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
      }, "Failed to scan item");
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

  // Delete a Scan by UserId and ItemId (only accessible to organizers)
  deleteScanByUserId: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        itemId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const { userId, itemId } = input;

        await db.transaction(async (tx) => {
          // Get the item to know how many points to deduct
          const scavengerHuntItem = await tx.query.scavengerHuntItems.findFirst(
            {
              where: eq(scavengerHuntItems.id, itemId),
            },
          );

          if (!scavengerHuntItem) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Item not found",
            });
          }

          // Check to see if the scan exists and if enough time has passed
          const scanExists = await tx.query.scavengerHuntScans.findFirst({
            where: and(
              eq(scavengerHuntScans.userId, userId),
              eq(scavengerHuntScans.itemId, itemId),
            ),
          });
          if (!scanExists) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Scan not found for this user and item",
            });
          }

          // Delete the scan and check if anything was deleted
          await tx
            .delete(scavengerHuntScans)
            .where(
              and(
                eq(scavengerHuntScans.userId, userId),
                eq(scavengerHuntScans.itemId, itemId),
              ),
            );

          // Deduct points
          await addPoints(tx, userId, -scavengerHuntItem.points, true);
        });

        return {
          success: true,
          message: "Scan deleted successfully",
        };
      }, "Failed to delete scan");
    }),
});
