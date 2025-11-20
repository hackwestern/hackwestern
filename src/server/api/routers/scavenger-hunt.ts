import { alias } from "drizzle-orm/pg-core";
import { eq, and, sql, or, isNull, gt, desc } from "drizzle-orm";
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
const recordScan = async (
  userId: string,
  scannerId: string,
  points: number,
  itemId: number,
) => {
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

      // Record the scan with scanner ID
      await tx.insert(scavengerHuntScans).values({
        userId: userId,
        itemId: itemId,
        scannerId: scannerId,
      });
    });
  }, "Failed to add points");
};

export const scavengerHuntRouter = createTRPCRouter({
  // Get All Scavenger Hunt Items
  getAllScavengerHuntItems: publicProcedure.query(async () => {
    try {
      const items = await db.query.scavengerHuntItems.findMany({
        orderBy: (items, { asc }) => [asc(items.code)],
      });

      return items;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch items: " + JSON.stringify(error),
      });
    }
  }),

  // Get Scavenger Hunt Item by Code
  getScavengerHuntItem: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      return withErrorHandling(async () => {
        const { code } = input;
        return await getScavengerHuntItemByItemCode(code);
      }, "Failed to fetch item");
    }),

  // Get Scavenger Hunt Item by ID
  getScavengerHuntItemById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const { id } = input;
        const item = await db.query.scavengerHuntItems.findFirst({
          where: eq(scavengerHuntItems.id, id),
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

  // Scan Item (only accessible to organizers (users can't scan items themselves))
  scan: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        itemId: z.number().optional(),
        itemCode: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, itemId, itemCode } = input;
        const scannerId = ctx.session.user.id; // Get the organizer who is scanning

        // Check if item exists - prefer itemId over itemCode
        let item;
        if (itemId) {
          item = await db.query.scavengerHuntItems.findFirst({
            where: eq(scavengerHuntItems.id, itemId),
          });
        } else if (itemCode) {
          item = await db.query.scavengerHuntItems.findFirst({
            where: eq(scavengerHuntItems.code, itemCode),
          });
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Either itemId or itemCode must be provided",
          });
        }

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

        // Record the scan with scanner ID
        await recordScan(userId, scannerId, item.points, item.id);
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

  // Get User Info by UserId (only accessible to organizers)
  getUserById: protectedOrganizerProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const { userId } = input;

        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user: " + JSON.stringify(error),
        });
      }
    }),

  // Get All Scans (only accessible to organizers)
  getAllScans: protectedOrganizerProcedure
    .input(
      z.object({
        filter: z
          .enum([
            "all",
            "meals",
            "workshops",
            "activities",
            "attendance",
            "wins",
            "bonus",
          ])
          .optional()
          .default("all"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { filter } = input;

        // Create alias for scanner user table
        const scannerUsers = alias(users, "scanner");

        // Get all scans with user, item, and scanner info using joins
        const allScans = await db
          .select({
            userId: scavengerHuntScans.userId,
            itemId: scavengerHuntScans.itemId,
            scannerId: scavengerHuntScans.scannerId,
            createdAt: scavengerHuntScans.createdAt,
            userName: users.name,
            userEmail: users.email,
            itemCode: scavengerHuntItems.code,
            itemDescription: scavengerHuntItems.description,
            scannerName: scannerUsers.name,
            scannerEmail: scannerUsers.email,
          })
          .from(scavengerHuntScans)
          .innerJoin(users, eq(scavengerHuntScans.userId, users.id))
          .innerJoin(
            scavengerHuntItems,
            eq(scavengerHuntScans.itemId, scavengerHuntItems.id),
          )
          .leftJoin(
            scannerUsers,
            eq(scavengerHuntScans.scannerId, scannerUsers.id),
          )
          .orderBy(desc(scavengerHuntScans.createdAt));

        // Filter by category based on item code suffix
        let filteredScans = allScans;
        if (filter === "meals") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_meal"),
          );
        } else if (filter === "workshops") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_ws"),
          );
        } else if (filter === "activities") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_act"),
          );
        } else if (filter === "attendance") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_att"),
          );
        } else if (filter === "wins") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_win"),
          );
        } else if (filter === "bonus") {
          filteredScans = allScans.filter((scan) =>
            scan.itemCode?.endsWith("_bonus"),
          );
        }

        // Format the data for display
        return filteredScans.map((scan) => ({
          id: `${scan.userId}-${scan.itemId}`,
          hackerName: scan.userName ?? scan.userEmail ?? scan.userId,
          event: scan.itemDescription ?? scan.itemCode ?? "Unknown",
          scanner:
            scan.scannerName ??
            scan.scannerEmail ??
            scan.scannerId ??
            "Organizer", // Use actual scanner name from database
          day: scan.createdAt
            ? new Date(scan.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "N/A",
          time: scan.createdAt
            ? new Date(scan.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "N/A",
          createdAt: scan.createdAt,
        }));
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch scans: " + JSON.stringify(error),
        });
      }
    }),
});
