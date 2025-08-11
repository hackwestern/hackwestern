import { eq, and, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { db, Transaction } from "~/server/db";
import { scavengerHuntItems, scavengerHuntScans, users, scavengerHuntRewards, scavengerHuntRedemptions } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";

// Helper Functions
// ! Unsafe Functions: Need to check if caller can add points before invoking */
const addPoints = async (tx: Transaction, userId: string, points: number) => {
  try {
    const updateData: Record<string, any> = {
      scavengerHuntBalance: sql`scavenger_hunt_balance + ${points}`,
    };

    // If user is redeeming points, we don't want to subtract to earned points
    if (points > 0) {
      updateData.scavengerHuntEarned = sql`scavenger_hunt_earned + ${points}`;
    }

    const [updatedUser] = await tx
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        scavengerHuntEarned: users.scavengerHuntEarned,
        scavengerHuntBalance: users.scavengerHuntBalance,
      });

    return updatedUser;

  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to add points: " + JSON.stringify(error),
    });
  }
};

// ! Unsafe Functions: Need to check if caller already redeemed item already before invoking */
const recordScan = async (userId: string, points: number, itemId: number) => {
  try {
    await db.transaction(async (tx) => {
      // Add points to user
      await addPoints(tx, userId, points);

      // Mark that points have been added to user
      await tx.insert(scavengerHuntScans).values({
        userId: userId,
        itemId: itemId,
      });
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to add points: " + JSON.stringify(error),
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
}

// ! Unsafe Functions: Need to check if caller has enough points to redeem item before invoking */
const redeemItem = async (userId: string, rewardId: number, costPoints: number) => {
  try {
    await db.transaction(async (tx) => {
      // Add points to user
      await addPoints(tx, userId, -costPoints);

      // Create Transaction Record
      await tx.insert(scavengerHuntRedemptions).values({
        userId: userId,
        rewardId: rewardId,
      });
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to redeem item: " + JSON.stringify(error),
    });
  }
}

export const scavengerHuntRouter = createTRPCRouter({
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

  // Scan Item
  scan: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { code } = input;
        const item = await db.query.scavengerHuntItems.findFirst({
          where: eq(scavengerHuntItems.code, code),
        });

        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
        }

        // Check if user has already scanned this item
        const scan = await db.query.scavengerHuntScans.findFirst({
          where: and(eq(scavengerHuntScans.userId, ctx.session.user.id), eq(scavengerHuntScans.itemId, item.id)),
        });
        if (scan) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Item already scanned" });
        }

        await recordScan(ctx.session.user.id, item.points, item.id);

        return {
          success: true,
          message: "Item scanned successfully",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to scan item: " + JSON.stringify(error),
        });
      }
    }),

  getPoints: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return await getUserPoints(userId);
  }),

  getPointsByUserId: protectedProcedure.input(z.object({ requestedUserId: z.string() })).query(async ({ input, ctx }) => {
    const { requestedUserId } = input;
    const userId = ctx.session.user.id;

    // TODO: Replace with protectedOrganizerProcedure
    const authUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!authUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (authUser.type !== "organizer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "User is not authorized to view points" });
    }

    // Get points for requestedUserId
    return await getUserPoints(requestedUserId);
  }),


  // Redeem
  redeem: protectedProcedure.input(z.object({ rewardId: z.number() })).mutation(async ({ input, ctx }) => {
    const { rewardId } = input;
    const userId = ctx.session.user.id;

    // Find Reward Data By rewardId
    const reward = await db.query.scavengerHuntRewards.findFirst({
      where: eq(scavengerHuntRewards.id, rewardId),
    });

    if (!reward) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found" });
    }

    // Check If User Has Enough Points
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (user.scavengerHuntBalance === null || user.scavengerHuntBalance < Math.abs(reward.costPoints)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "User does not have enough points" });
    }

    // Redeeming Item
    await redeemItem(userId, rewardId, reward.costPoints);

    return {
      success: true,
      message: "Item redeemed successfully",
    };
  }),

  getRedemptions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    return await db.query.scavengerHuntRedemptions.findMany({
      where: eq(scavengerHuntRedemptions.userId, userId),
    });
  }),

  getRedemptionsByUserId: protectedProcedure.input(z.object({ requestedUserId: z.string() })).query(async ({ input, ctx }) => {
    const { requestedUserId } = input;
    const userId = ctx.session.user.id;

    // TODO: Replace with protectedOrganizerProcedure
    const authUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!authUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (authUser.type !== "organizer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "User is not authorized to view redemptions" });
    }

    return await db.query.scavengerHuntRedemptions.findMany({
      where: eq(scavengerHuntRedemptions.userId, requestedUserId),
    });
  }),


  // Scans
  getScans: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    return await db.query.scavengerHuntScans.findMany({
      where: eq(scavengerHuntScans.userId, userId),
    });
  }),

  getScansByUserId: protectedProcedure.input(z.object({ requestedUserId: z.string() })).query(async ({ input, ctx }) => {
    const { requestedUserId } = input;
    const userId = ctx.session.user.id;

    // TODO: Replace with protectedOrganizerProcedure
    const authUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    }); 

    if (!authUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (authUser.type !== "organizer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "User is not authorized to view scans" });
    }

    return await db.query.scavengerHuntScans.findMany({
      where: eq(scavengerHuntScans.userId, requestedUserId),
    });
  }),

  // Leadership Board
  getLeadershipBoard: protectedProcedure.query(async ({}) => {
    try {
      const top10Users = await db
      .select({
        name: users.name,
        image: users.image,
        scavengerHuntEarned: users.scavengerHuntEarned,
        scavengerHuntBalance: users.scavengerHuntBalance,
      })
      .from(users)
      .orderBy(asc(users.scavengerHuntEarned))
      .limit(10);

      return top10Users;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch leadership board: " + JSON.stringify(error),
      });
    }
  }),
});
