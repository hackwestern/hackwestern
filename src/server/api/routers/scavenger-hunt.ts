import { alias } from "drizzle-orm/pg-core";
import {
  eq,
  ne,
  and,
  sql,
  or,
  isNull,
  isNotNull,
  gt,
  desc,
  ilike,
  count,
  inArray,
} from "drizzle-orm";
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
  scavengerHuntActivityType,
  applications,
} from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { isUserApprovedForEvent } from "~/server/api/utils/approval";
import { resolveScannedUserId } from "~/server/api/utils/hacker-id";
import { admittedStatuses } from "~/lib/admission";

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
const _getUserScans = async (userId: string) => {
  const scans = await db.query.scavengerHuntScans.findMany({
    where: eq(scavengerHuntScans.userId, userId),
  });

  // If no scans are found, return an empty array instead of crash
  return scans ?? [];
};

// * Helper Functions *
// A future deletedAt is a scheduled close
const notDeleted = () =>
  or(
    isNull(scavengerHuntItems.deletedAt),
    gt(scavengerHuntItems.deletedAt, new Date()),
  );

// Scannable: not deleted and not a draft or disabled
const isOpen = () => and(eq(scavengerHuntItems.status, "active"), notDeleted());

// * Safe Functions: Check is done within the transaction to avoid race conditions */
const redeemPrize = async (
  userId: string,
  rewardId: number,
  costPoints: number,
  checkQuantity = false,
  scannerId?: string,
) => {
  return withErrorHandling(async () => {
    await db.transaction(async (tx) => {
      // Get reward to check quantity if needed
      const reward = await tx.query.scavengerHuntRewards.findFirst({
        where: eq(scavengerHuntRewards.id, rewardId),
      });
      if (!reward) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reward not found",
        });
      }

      // Check if reward is out of stock (if quantity is tracked)
      if (reward.quantity !== null && reward.quantity <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: checkQuantity
            ? "Reward is out of stock"
            : "We are out of this prize unfortunately",
        });
      }

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

      // Deduct quantity for prizes with quantity
      if (reward.quantity !== null && reward.quantity > 0) {
        await tx
          .update(scavengerHuntRewards)
          .set({
            quantity: sql`${scavengerHuntRewards.quantity} - 1`,
          })
          .where(eq(scavengerHuntRewards.id, rewardId));
      }

      // Record that we have redeemed an item
      await tx.insert(scavengerHuntRedemptions).values({
        userId: userId,
        rewardId: rewardId,
        scannerId,
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
  activityType: ActivityType = "attendance",
) => {
  return withErrorHandling(async () => {
    await db.transaction(async (tx) => {
      // Check if user has already scanned this item for this activity type (a hacker can attend and win the same activity)
      const scan = await tx.query.scavengerHuntScans.findFirst({
        where: and(
          eq(scavengerHuntScans.userId, userId),
          eq(scavengerHuntScans.itemId, itemId),
          eq(scavengerHuntScans.activityType, activityType),
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
        activityType,
      });
    });
  }, "Failed to add points");
};

const FILTER_TYPES = {
  meals: "meal",
  workshops: "workshop",
  sponsor_workshops: "sponsor_workshop",
  bonus: "bonus",
} as const;

type ActivityType = (typeof scavengerHuntActivityType.enumValues)[number];

export const scavengerHuntRouter = createTRPCRouter({
  // Get All Scavenger Hunt Items
  getAllScavengerHuntItems: publicProcedure.query(async () => {
    try {
      const items = await db.query.scavengerHuntItems.findMany({
        where: isOpen(),
        orderBy: (items, { asc }) => [asc(items.name)],
      });

      return items;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch items: " + JSON.stringify(error),
      });
    }
  }),

  // Scavenger hunt tasks (open bonus items) for the Scavenger Hunt tab on
  // /live, with whether the current user has already been scanned for each
  getTasks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: scavengerHuntItems.id,
        name: scavengerHuntItems.name,
        points: scavengerHuntItems.points,
        scannedAt: sql<Date | null>`min(${scavengerHuntScans.createdAt})`,
      })
      .from(scavengerHuntItems)
      .leftJoin(
        scavengerHuntScans,
        and(
          eq(scavengerHuntScans.itemId, scavengerHuntItems.id),
          eq(scavengerHuntScans.userId, ctx.session.user.id),
        ),
      )
      .where(and(eq(scavengerHuntItems.type, "bonus"), isOpen()))
      .groupBy(scavengerHuntItems.id)
      .orderBy(scavengerHuntItems.points, scavengerHuntItems.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      points: row.points,
      // Raw SQL aggregates come back as strings
      scannedAt: row.scannedAt ? new Date(row.scannedAt) : null,
    }));
  }),

  // Get All Scavenger Hunt Rewards (only accessible to organizers)
  getAllRewards: protectedOrganizerProcedure.query(async () => {
    try {
      const rewards = await db.query.scavengerHuntRewards.findMany({
        orderBy: (rewards, { asc }) => [asc(rewards.name)],
      });

      return rewards;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch rewards: " + JSON.stringify(error),
      });
    }
  }),

  // Get Reward by ID (only accessible to organizers)
  getRewardById: protectedOrganizerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const { id } = input;
        const reward = await db.query.scavengerHuntRewards.findFirst({
          where: eq(scavengerHuntRewards.id, id),
        });

        if (!reward) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reward not found",
          });
        }

        return reward;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch reward: " + JSON.stringify(error),
        });
      }
    }),

  // Get Scavenger Hunt Item by ID
  getScavengerHuntItemById: protectedOrganizerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const { id } = input;
        const item = await db.query.scavengerHuntItems.findFirst({
          where: and(eq(scavengerHuntItems.id, id), isOpen()),
        });

        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
        }

        return item;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
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
        itemId: z.number(),
        activityType: z.enum(scavengerHuntActivityType.enumValues).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { itemId } = input;
        const userId = await resolveScannedUserId(input.userId);
        const scannerId = ctx.session.user.id; // Get the organizer who is scanning

        // Deleted items can't be scanned; a future deletedAt is a scheduled close.
        const item = await db.query.scavengerHuntItems.findFirst({
          where: and(eq(scavengerHuntItems.id, itemId), notDeleted()),
        });

        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
        }
        if (item.status !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `This activity is ${item.status === "draft" ? "a draft" : "disabled"} and can't be scanned`,
          });
        }

        // Check if user exists
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Only approved hackers (or organizers/sponsors) can be scanned.
        // This prevents unapproved applicants from earning points, meals, or
        // other rewards with a self-generated QR code.
        const isApproved = await isUserApprovedForEvent(userId);
        if (!isApproved) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "This hacker has not been approved to attend and cannot be scanned.",
          });
        }

        // Record the scan with scanner ID
        const activityType = input.activityType ?? "attendance";
        if (activityType === "win" && item.winPoints === null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This activity can't be won",
          });
        }
        const points =
          activityType === "win" ? (item.winPoints ?? 0) : item.points;
        await recordScan(userId, scannerId, points, item.id, activityType);
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

  // All hackers in descending order of EARNED points
  getLeaderboard: protectedOrganizerProcedure
    .input(z.object({ limit: z.number().int().min(1) }))
    .query(async ({ input }) => {
      return await db
        .select({
          id: users.id,
          // Email sign-ups have no users.name, so prefer the (required) application name
          name: sql<
            string | null
          >`coalesce(nullif(concat_ws(' ', ${applications.firstName}, ${applications.lastName}), ''), ${users.name})`,
          earned: users.scavengerHuntEarned,
        })
        .from(users)
        .innerJoin(applications, eq(applications.userId, users.id))
        .where(
          and(
            eq(users.type, "hacker"),
            inArray(applications.status, [...admittedStatuses()]),
          ),
        )
        .orderBy(sql`${users.scavengerHuntEarned} desc nulls last`, users.id)
        .limit(input.limit);
    }),

  // Self-redeem endpoint: hackers redeem rewards themselves. Not used, since organizers redeem by scanning (redeemForUser).
  // // Redeem a Reward (only accessible to users)
  // redeem: protectedProcedure
  //   .input(
  //     z.object({
  //       rewardId: z.number(),
  //     }),
  //   )
  //   .mutation(async ({ input, ctx }) => {
  //     return withErrorHandling(async () => {
  //       const { rewardId } = input;
  //       const userId = ctx.session.user.id;
  //
  //       // Check if reward exists
  //       const reward = await db.query.scavengerHuntRewards.findFirst({
  //         where: eq(scavengerHuntRewards.id, rewardId),
  //       });
  //       if (!reward) {
  //         throw new TRPCError({
  //           code: "NOT_FOUND",
  //           message: "Reward not found",
  //         });
  //       }
  //
  //       await redeemPrize(userId, rewardId, reward.costPoints);
  //
  //       return {
  //         success: true,
  //         message: "Reward redeemed successfully",
  //       };
  //     }, "Failed to redeem reward");
  //   }),

  // Redeem a Reward for a User (only accessible to organizers)
  redeemForUser: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        rewardId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return withErrorHandling(async () => {
        const { rewardId } = input;
        const userId = await resolveScannedUserId(input.userId);

        // Get user info before redemption (for return value and to verify user exists)
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

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

        // Redeem prize with quantity checking
        await redeemPrize(
          userId,
          rewardId,
          reward.costPoints,
          true,
          ctx.session.user.id,
        );

        // Fetch updated reward to return current quantity
        const updatedReward = await db.query.scavengerHuntRewards.findFirst({
          where: eq(scavengerHuntRewards.id, rewardId),
        });

        // Return success with user info and updated reward info to avoid extra API calls
        return {
          success: true,
          message: "Reward redeemed successfully",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          reward: updatedReward
            ? {
                id: updatedReward.id,
                name: updatedReward.name,
                quantity: updatedReward.quantity,
                costPoints: updatedReward.costPoints,
              }
            : undefined,
        };
      }, "Failed to redeem reward");
    }),

  // Get all Scans for the current user (only accessible to users)
  // Includes both scans (positive points) and redemptions (negative points)
  getScans: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get scans with item information using join
    const scans = await db
      .select({
        userId: scavengerHuntScans.userId,
        itemId: scavengerHuntScans.itemId,
        createdAt: scavengerHuntScans.createdAt,
        itemName: scavengerHuntItems.name,
        itemPoints: scavengerHuntItems.points,
        itemWinPoints: scavengerHuntItems.winPoints,
        itemType: scavengerHuntItems.type,
        activityType: scavengerHuntScans.activityType,
      })
      .from(scavengerHuntScans)
      .innerJoin(
        scavengerHuntItems,
        eq(scavengerHuntScans.itemId, scavengerHuntItems.id),
      )
      .where(eq(scavengerHuntScans.userId, userId));

    // Get redemptions with reward information using join
    const redemptions = await db
      .select({
        userId: scavengerHuntRedemptions.userId,
        rewardId: scavengerHuntRedemptions.rewardId,
        createdAt: scavengerHuntRedemptions.createdAt,
        rewardName: scavengerHuntRewards.name,
        rewardDescription: scavengerHuntRewards.description,
        costPoints: scavengerHuntRewards.costPoints,
      })
      .from(scavengerHuntRedemptions)
      .innerJoin(
        scavengerHuntRewards,
        eq(scavengerHuntRedemptions.rewardId, scavengerHuntRewards.id),
      )
      .where(eq(scavengerHuntRedemptions.userId, userId));

    // Combine scans and redemptions into a unified list
    const scanEntries = scans.map((scan) => ({
      id: `scan-${scan.userId}-${scan.itemId}-${scan.activityType}`,
      type: "scan" as const,
      itemId: scan.itemId,
      itemType: scan.itemType,
      itemName: scan.itemName,
      points:
        (scan.activityType === "win" ? scan.itemWinPoints : scan.itemPoints) ??
        0,
      createdAt: scan.createdAt,
    }));

    const redemptionEntries = redemptions.map((redemption) => ({
      id: `redemption-${redemption.userId}-${redemption.rewardId}-${redemption.createdAt?.getTime()}`,
      type: "redemption" as const,
      rewardId: redemption.rewardId,
      itemType: null,
      itemName:
        redemption.rewardName ?? redemption.rewardDescription ?? "Reward",
      points: -(redemption.costPoints ?? 0), // Negative points for redemptions
      createdAt: redemption.createdAt,
    }));

    // Combine and sort by date (most recent first)
    const allEntries = [...scanEntries, ...redemptionEntries].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return allEntries;
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
        const userId = await resolveScannedUserId(input.userId);

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
            "sponsor_workshops",
            "activities",
            "attendance",
            "wins",
            "bonus",
            "rewards",
          ])
          .optional()
          .default("all"),
        search: z.string().trim().max(100).optional().default(""),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(100).optional().default(25),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { filter, search, page, pageSize } = input;

        // Create alias for scanner user table
        const scannerUsers = alias(users, "scanner");

        const conditions: SQL[] = [];
        if (filter === "activities") {
          conditions.push(ne(scavengerHuntItems.type, "meal"));
        } else if (filter === "attendance") {
          conditions.push(
            eq(scavengerHuntScans.activityType, "attendance"),
            isNotNull(scavengerHuntItems.winPoints),
          );
        } else if (filter === "wins") {
          conditions.push(eq(scavengerHuntScans.activityType, "win"));
        } else if (filter !== "all" && filter !== "rewards") {
          conditions.push(eq(scavengerHuntItems.type, FILTER_TYPES[filter]));
        }
        const redemptionConditions: SQL[] = [];
        if (search) {
          const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
          conditions.push(
            or(
              ilike(users.name, pattern),
              ilike(users.email, pattern),
              ilike(scavengerHuntItems.name, pattern),
              ilike(scannerUsers.name, pattern),
            )!,
          );
          redemptionConditions.push(
            or(
              ilike(users.name, pattern),
              ilike(users.email, pattern),
              ilike(scavengerHuntRewards.name, pattern),
              ilike(scannerUsers.name, pattern),
            )!,
          );
        }
        const where = conditions.length ? and(...conditions) : undefined;
        const redemptionWhere = redemptionConditions.length
          ? and(...redemptionConditions)
          : undefined;

        const includeScans = filter !== "rewards";
        const includeRedemptions = filter === "all" || filter === "rewards";

        // With both sources, take the first page * pageSize rows of each, then merge and cut out the page
        const offset = (page - 1) * pageSize;
        const merged = includeScans && includeRedemptions;
        const limit = merged ? page * pageSize : pageSize;
        const sourceOffset = merged ? 0 : offset;

        const [[totals], [redemptionTotals]] = await Promise.all([
          includeScans
            ? db
                .select({ total: count() })
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
                .where(where)
            : [{ total: 0 }],
          includeRedemptions
            ? db
                .select({ total: count() })
                .from(scavengerHuntRedemptions)
                .innerJoin(users, eq(scavengerHuntRedemptions.userId, users.id))
                .innerJoin(
                  scavengerHuntRewards,
                  eq(
                    scavengerHuntRedemptions.rewardId,
                    scavengerHuntRewards.id,
                  ),
                )
                .leftJoin(
                  scannerUsers,
                  eq(scavengerHuntRedemptions.scannerId, scannerUsers.id),
                )
                .where(redemptionWhere)
            : [{ total: 0 }],
        ]);

        const total = (totals?.total ?? 0) + (redemptionTotals?.total ?? 0);

        // Skip the row queries past the last page, so a large page number can't load every row
        const inRange = offset < total;

        // Get one page of scans with user, item, and scanner info using joins
        const [pageScans, pageRedemptions] = await Promise.all([
          includeScans && inRange
            ? db
                .select({
                  userId: scavengerHuntScans.userId,
                  itemId: scavengerHuntScans.itemId,
                  scannerId: scavengerHuntScans.scannerId,
                  createdAt: scavengerHuntScans.createdAt,
                  userName: users.name,
                  userEmail: users.email,
                  itemName: scavengerHuntItems.name,
                  itemType: scavengerHuntItems.type,
                  activityType: scavengerHuntScans.activityType,
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
                .where(where)
                .orderBy(
                  desc(scavengerHuntScans.createdAt),
                  scavengerHuntScans.userId,
                  scavengerHuntScans.itemId,
                )
                .limit(limit)
                .offset(sourceOffset)
            : [],
          includeRedemptions && inRange
            ? db
                .select({
                  id: scavengerHuntRedemptions.id,
                  userId: scavengerHuntRedemptions.userId,
                  scannerId: scavengerHuntRedemptions.scannerId,
                  createdAt: scavengerHuntRedemptions.createdAt,
                  userName: users.name,
                  userEmail: users.email,
                  rewardName: scavengerHuntRewards.name,
                  scannerName: scannerUsers.name,
                  scannerEmail: scannerUsers.email,
                })
                .from(scavengerHuntRedemptions)
                .innerJoin(users, eq(scavengerHuntRedemptions.userId, users.id))
                .innerJoin(
                  scavengerHuntRewards,
                  eq(
                    scavengerHuntRedemptions.rewardId,
                    scavengerHuntRewards.id,
                  ),
                )
                .leftJoin(
                  scannerUsers,
                  eq(scavengerHuntRedemptions.scannerId, scannerUsers.id),
                )
                .where(redemptionWhere)
                .orderBy(
                  desc(scavengerHuntRedemptions.createdAt),
                  desc(scavengerHuntRedemptions.id),
                )
                .limit(limit)
                .offset(sourceOffset)
            : [],
        ]);

        const formatDay = (date: Date | null) =>
          date
            ? new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "N/A";
        const formatTime = (date: Date | null) =>
          date
            ? new Date(date).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "N/A";

        // Format the data for display
        const scanRows = pageScans.map((scan) => ({
          id: `${scan.userId}-${scan.itemId}-${scan.activityType}`,
          hackerName: scan.userName ?? scan.userEmail ?? scan.userId,
          event: `${scan.itemName}${scan.activityType === "win" ? " (Win)" : ""}`,
          type: scan.itemType as string,
          activityType: scan.activityType as string | null,
          scanner:
            scan.scannerName ??
            scan.scannerEmail ??
            scan.scannerId ??
            "Organizer", // Use actual scanner name from database
          day: formatDay(scan.createdAt),
          time: formatTime(scan.createdAt),
          createdAt: scan.createdAt,
        }));
        const redemptionRows = pageRedemptions.map((redemption) => ({
          id: `redemption-${redemption.id}`,
          hackerName:
            redemption.userName ?? redemption.userEmail ?? redemption.userId,
          event: `${redemption.rewardName} (Reward)`,
          type: "reward",
          activityType: null,
          scanner:
            redemption.scannerName ??
            redemption.scannerEmail ??
            redemption.scannerId ??
            "—",
          day: formatDay(redemption.createdAt),
          time: formatTime(redemption.createdAt),
          createdAt: redemption.createdAt,
        }));

        const scans = merged
          ? [...scanRows, ...redemptionRows]
              .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
              .slice(offset, offset + pageSize)
          : [...scanRows, ...redemptionRows];

        return {
          scans,
          total,
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch scans: " + JSON.stringify(error),
        });
      }
    }),
});
