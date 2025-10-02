import { eq, and, sql, SQL } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db, Transaction } from "~/server/db";
import {
  scavengerHuntItems,
  scavengerHuntScans,
  users,
  scavengerHuntRewards,
  scavengerHuntRedemptions,
} from "~/server/db/schema";
import { TRPCError } from "@trpc/server";

// ! Unsafe Functions: Need to check if caller can add points before invoking */
export const _addPoints = async (
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

    const [updatedUser] = await tx
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

// ! Unsafe Functions: Need to check if caller already redeemed item already before invoking */
const recordScan = async (userId: string, points: number, itemId: number) => {
  try {
    await db.transaction(async (tx) => {
      // Add points to user
      await _addPoints(tx, userId, points);

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
};

// ! Unsafe Functions: Need to check if caller has enough points to redeem item before invoking */
const redeemItem = async (
  userId: string,
  rewardId: number,
  costPoints: number,
) => {
  try {
    await db.transaction(async (tx) => {
      // Add points to user
      await _addPoints(tx, userId, -costPoints);

      // Record that we have redeemed an item
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
};

export const scavengerHuntRouter = createTRPCRouter({
  // Get Scavenger Hunt Item
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
          where: and(
            eq(scavengerHuntScans.userId, ctx.session.user.id),
            eq(scavengerHuntScans.itemId, item.id),
          ),
        });
        if (scan) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Item already scanned",
          });
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
});
