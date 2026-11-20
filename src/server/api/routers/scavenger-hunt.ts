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
  scavengerHuntItemType,
  applications,
} from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { isUserApprovedForEvent } from "~/server/api/utils/approval";
import {
  isUniqueViolation,
  resolveScannedUserId,
} from "~/server/api/utils/hacker-id";
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

const activityNotFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "This activity was deleted. Refresh the page.",
  });

const rewardNotDeleted = () => isNull(scavengerHuntRewards.deletedAt);

// Redeemable: not deleted and not a draft or disabled
const rewardIsOpen = () =>
  and(eq(scavengerHuntRewards.status, "active"), rewardNotDeleted());

const rewardNotFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "This reward was deleted. Refresh the page.",
  });

// * Safe Functions: Check is done within the transaction to avoid race conditions */
// Returns the points the reward cost
const redeemPrize = async (
  userId: string,
  rewardId: number,
  checkQuantity = false,
  scannerId?: string,
  expectedCost?: number, // The price the scanner showed
) => {
  return withErrorHandling(async () => {
    return db.transaction(async (tx) => {
      // Locked so concurrent redemptions can't oversell or change the price mid-way
      const [reward] = await tx
        .select()
        .from(scavengerHuntRewards)
        .where(and(eq(scavengerHuntRewards.id, rewardId), rewardIsOpen()))
        .for("update");
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

      // Locked so two redemptions for one hacker can't both spend the same points
      const [user] = await tx
        .select({ scavengerHuntBalance: users.scavengerHuntBalance })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      const { costPoints } = reward;
      if (expectedCost !== undefined && expectedCost !== costPoints) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The price changed to ${costPoints} points. Check the new price and scan again.`,
        });
      }
      // Check if user has enough points to redeem reward (using transaction); no balance yet counts as 0
      if ((user.scavengerHuntBalance ?? 0) < costPoints) {
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
        costPoints,
      });
      return costPoints;
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

  // Get All Scavenger Hunt Rewards (only accessible to organizers)
  getAllRewards: protectedOrganizerProcedure.query(async () => {
    try {
      const rewards = await db.query.scavengerHuntRewards.findMany({
        where: rewardIsOpen(),
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
          where: and(eq(scavengerHuntRewards.id, id), rewardIsOpen()),
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

  // * ACTIVITIES (organizer Activities tab) * //
  getScavengerHuntItems: protectedOrganizerProcedure.query(async () => {
    return withErrorHandling(
      () =>
        db
          .select({
            id: scavengerHuntItems.id,
            name: scavengerHuntItems.name,
            type: scavengerHuntItems.type,
            points: scavengerHuntItems.points,
            winPoints: scavengerHuntItems.winPoints,
            status: scavengerHuntItems.status,
            startsAt: scavengerHuntItems.startsAt,
            endsAt: scavengerHuntItems.endsAt,
            room: scavengerHuntItems.room,
            // Attendance only, so a winner (attendance + win rows) counts once
            scans: sql<number>`count(${scavengerHuntScans.userId}) filter (where ${scavengerHuntScans.activityType} = 'attendance')::int`,
            winScans: sql<number>`count(${scavengerHuntScans.userId}) filter (where ${scavengerHuntScans.activityType} = 'win')::int`,
          })
          .from(scavengerHuntItems)
          .leftJoin(
            scavengerHuntScans,
            eq(scavengerHuntScans.itemId, scavengerHuntItems.id),
          )
          .where(notDeleted())
          .groupBy(scavengerHuntItems.id)
          .orderBy(scavengerHuntItems.startsAt, scavengerHuntItems.id),
      "Failed to fetch activities",
    );
  }),

  saveActivity: protectedOrganizerProcedure
    .input(
      z
        .object({
          id: z.number().optional(), // Omit to create
          name: z.string().trim().min(1).max(100),
          type: z.enum(scavengerHuntItemType.enumValues),
          startsAt: z.date(),
          endsAt: z.date(),
          room: z
            .string()
            .trim()
            .nullable()
            .transform((r) => (r ? r : null)),
          points: z.number().int().min(0).max(32767),
          winPoints: z.number().int().min(0).max(32767).nullable(), // Set only for winnable activities
          status: z.enum(["draft", "active"]).optional(),
        })
        .refine((a) => a.endsAt > a.startsAt, {
          message: "End time must be after start time",
        }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const { id, winPoints, status, ...rest } = input;
        const values = {
          ...rest,
          winPoints: input.type === "activity" ? winPoints : null,
          ...(status && { status }),
        };

        const duplicateName = () =>
          new TRPCError({
            code: "CONFLICT",
            message: `An activity named "${input.name}" already exists`,
          });
        // The unique index also blocks this; checking first gives a clear message
        const duplicate = await db.query.scavengerHuntItems.findFirst({
          columns: { id: true },
          where: and(
            sql`lower(${scavengerHuntItems.name}) = lower(${input.name})`,
            notDeleted(),
            id !== undefined ? ne(scavengerHuntItems.id, id) : undefined,
          ),
        });
        if (duplicate) throw duplicateName();

        // A new or changed end time must be in the future. The start can be in
        // the past (an activity that already started), and an unchanged past end
        // can stay, so a finished activity can still be edited. Compared by
        // minute, because the form only sends minutes.
        const existing =
          id !== undefined
            ? await db.query.scavengerHuntItems.findFirst({
                columns: { endsAt: true },
                where: and(eq(scavengerHuntItems.id, id), notDeleted()),
              })
            : undefined;
        if (id !== undefined && !existing) throw activityNotFound();
        const minute = (d: Date) => Math.floor(d.getTime() / 60_000);
        const now = minute(new Date());
        const endChanged =
          !existing || minute(existing.endsAt) !== minute(input.endsAt);
        if (endChanged && minute(input.endsAt) <= now) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "End time must be in the future",
          });
        }

        try {
          if (id !== undefined) {
            await db.transaction(async (tx) => {
              // Locked so two edits can't both adjust balances from the same old points
              const [old] = await tx
                .select({
                  points: scavengerHuntItems.points,
                  winPoints: scavengerHuntItems.winPoints,
                })
                .from(scavengerHuntItems)
                .where(and(eq(scavengerHuntItems.id, id), notDeleted()))
                .for("update");
              if (!old) throw activityNotFound();

              // Hackers who scanned this item get the point difference. A win
              // scan on an item that is no longer winnable is worth 0.
              const attendanceDelta = values.points - old.points;
              const winDelta = (values.winPoints ?? 0) - (old.winPoints ?? 0);
              if (attendanceDelta !== 0 || winDelta !== 0) {
                await tx.execute(sql`
                  UPDATE "user" u SET
                    scavenger_hunt_earned = COALESCE(u.scavenger_hunt_earned, 0) + d.delta,
                    scavenger_hunt_balance = COALESCE(u.scavenger_hunt_balance, 0) + d.delta
                  FROM (
                    SELECT user_id, SUM(CASE WHEN activity_type = 'win' THEN ${winDelta}::int ELSE ${attendanceDelta}::int END) AS delta
                    FROM scavenger_hunt_scan
                    WHERE item_id = ${id}
                    GROUP BY user_id
                  ) d
                  WHERE u.id = d.user_id`);
              }

              await tx
                .update(scavengerHuntItems)
                .set(values)
                .where(eq(scavengerHuntItems.id, id));
            });
            return;
          }
          await db.insert(scavengerHuntItems).values(values);
        } catch (error) {
          // Another organizer saved the same name after the check above
          if (isUniqueViolation(error)) throw duplicateName();
          throw error;
        }
      }, "Failed to save activity");
    }),

  setActivityStatus: protectedOrganizerProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "active", "disabled"]),
      }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const updated = await db
          .update(scavengerHuntItems)
          .set({ status: input.status })
          .where(and(eq(scavengerHuntItems.id, input.id), notDeleted()))
          .returning({ id: scavengerHuntItems.id });
        if (!updated.length) throw activityNotFound();
      }, "Failed to update activity");
    }),

  // * REWARDS (organizer Rewards tab) * //
  getScavengerHuntRewards: protectedOrganizerProcedure.query(async () => {
    return withErrorHandling(
      () =>
        db
          .select({
            id: scavengerHuntRewards.id,
            name: scavengerHuntRewards.name,
            description: scavengerHuntRewards.description,
            costPoints: scavengerHuntRewards.costPoints,
            quantity: scavengerHuntRewards.quantity,
            status: scavengerHuntRewards.status,
            redemptions: sql<number>`count(${scavengerHuntRedemptions.id})::int`,
          })
          .from(scavengerHuntRewards)
          .leftJoin(
            scavengerHuntRedemptions,
            eq(scavengerHuntRedemptions.rewardId, scavengerHuntRewards.id),
          )
          .where(rewardNotDeleted())
          .groupBy(scavengerHuntRewards.id)
          .orderBy(scavengerHuntRewards.name, scavengerHuntRewards.id),
      "Failed to fetch rewards",
    );
  }),

  // An edit changes only the fields it sends, so a stale quantity can't undo redemptions
  saveReward: protectedOrganizerProcedure
    .input(
      z
        .object({
          id: z.number().optional(), // Omit to create
          name: z.string().trim().min(1).max(255).optional(),
          description: z
            .string()
            .trim()
            .nullable()
            .transform((d) => (d ? d : null))
            .optional(),
          costPoints: z.number().int().min(0).max(32767).optional(),
          quantity: z
            .number()
            .int()
            .min(0)
            .max(2147483647)
            .nullable()
            .optional(), // Null means unlimited
          status: z.enum(["draft", "active"]).optional(),
        })
        .refine(
          (r) =>
            r.id !== undefined ||
            (r.name !== undefined && r.costPoints !== undefined),
          { message: "A new reward needs a name and a cost" },
        ),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const { id, name, description, costPoints, quantity, status } = input;

        const duplicateName = () =>
          new TRPCError({
            code: "CONFLICT",
            message: `A reward named "${name}" already exists`,
          });
        // The unique index also blocks this; checking first gives a clear message
        if (name !== undefined) {
          const duplicate = await db.query.scavengerHuntRewards.findFirst({
            columns: { id: true },
            where: and(
              sql`lower(${scavengerHuntRewards.name}) = lower(${name})`,
              rewardNotDeleted(),
              id !== undefined ? ne(scavengerHuntRewards.id, id) : undefined,
            ),
          });
          if (duplicate) throw duplicateName();
        }

        try {
          if (id === undefined) {
            // The refine above makes sure both are set
            await db.insert(scavengerHuntRewards).values({
              name: name!,
              costPoints: costPoints!,
              description,
              quantity,
              status,
            });
            return;
          }
          const values: Partial<typeof scavengerHuntRewards.$inferInsert> = {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(costPoints !== undefined && { costPoints }),
            ...(quantity !== undefined && { quantity }),
            ...(status !== undefined && { status }),
          };
          const where = and(
            eq(scavengerHuntRewards.id, id),
            rewardNotDeleted(),
          );
          // Nothing changed: only check that the reward still exists
          const updated = Object.keys(values).length
            ? await db
                .update(scavengerHuntRewards)
                .set(values)
                .where(where)
                .returning({ id: scavengerHuntRewards.id })
            : await db
                .select({ id: scavengerHuntRewards.id })
                .from(scavengerHuntRewards)
                .where(where);
          if (!updated.length) throw rewardNotFound();
        } catch (error) {
          // Another organizer saved the same name after the check above
          if (isUniqueViolation(error)) throw duplicateName();
          throw error;
        }
      }, "Failed to save reward");
    }),

  setRewardStatus: protectedOrganizerProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "active", "disabled"]),
      }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        const updated = await db
          .update(scavengerHuntRewards)
          .set({ status: input.status })
          .where(and(eq(scavengerHuntRewards.id, input.id), rewardNotDeleted()))
          .returning({ id: scavengerHuntRewards.id });
        if (!updated.length) throw rewardNotFound();
      }, "Failed to update reward");
    }),

  // Soft delete, so past redemptions keep their reward
  deleteReward: protectedOrganizerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        await db
          .update(scavengerHuntRewards)
          .set({ deletedAt: new Date() })
          .where(
            and(eq(scavengerHuntRewards.id, input.id), rewardNotDeleted()),
          );
      }, "Failed to delete reward");
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
        expectedCost: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return withErrorHandling(async () => {
        const { rewardId, expectedCost } = input;
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

        // Redeem prize with quantity checking
        const pointsUsed = await redeemPrize(
          userId,
          rewardId,
          true,
          ctx.session.user.id,
          expectedCost,
        );

        // Fetch updated reward to return current quantity
        const updatedReward = await db.query.scavengerHuntRewards.findFirst({
          where: eq(scavengerHuntRewards.id, rewardId),
        });

        // Return success with user info and updated reward info to avoid extra API calls
        return {
          success: true,
          message: "Reward redeemed successfully",
          pointsUsed,
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
        costPoints: scavengerHuntRedemptions.costPoints,
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

  // Takes back the points the scan gave, at the item's current points
  deleteScan: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        itemId: z.number(),
        activityType: z.enum(scavengerHuntActivityType.enumValues),
      }),
    )
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        await db.transaction(async (tx) => {
          const [scan] = await tx
            .delete(scavengerHuntScans)
            .where(
              and(
                eq(scavengerHuntScans.userId, input.userId),
                eq(scavengerHuntScans.itemId, input.itemId),
                eq(scavengerHuntScans.activityType, input.activityType),
              ),
            )
            .returning({ itemId: scavengerHuntScans.itemId });
          if (!scan) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "This scan was already deleted. Refresh the page.",
            });
          }
          const item = await tx.query.scavengerHuntItems.findFirst({
            columns: { points: true, winPoints: true },
            where: eq(scavengerHuntItems.id, input.itemId),
          });
          // A win scan on an item that is no longer winnable is worth 0
          const points =
            input.activityType === "win"
              ? (item?.winPoints ?? 0)
              : (item?.points ?? 0);
          if (points !== 0) {
            await addPoints(tx, input.userId, -points, true);
          }
        });
      }, "Failed to delete scan");
    }),

  // Refunds the price paid and puts the reward back in stock
  deleteRedemption: protectedOrganizerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return withErrorHandling(async () => {
        await db.transaction(async (tx) => {
          const [redemption] = await tx
            .delete(scavengerHuntRedemptions)
            .where(eq(scavengerHuntRedemptions.id, input.id))
            .returning({
              userId: scavengerHuntRedemptions.userId,
              rewardId: scavengerHuntRedemptions.rewardId,
              costPoints: scavengerHuntRedemptions.costPoints,
            });
          if (!redemption) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "This redemption was already deleted. Refresh the page.",
            });
          }
          await tx
            .update(scavengerHuntRewards)
            .set({
              quantity: sql`${scavengerHuntRewards.quantity} + 1`,
            })
            .where(eq(scavengerHuntRewards.id, redemption.rewardId));
          // Redeeming took points from the balance only, so only the balance goes back
          await tx
            .update(users)
            .set({
              scavengerHuntBalance: sql`coalesce(${users.scavengerHuntBalance}, 0) + ${redemption.costPoints}`,
            })
            .where(eq(users.id, redemption.userId));
        });
      }, "Failed to delete redemption");
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
          target: {
            kind: "scan" as const,
            userId: scan.userId,
            itemId: scan.itemId,
            activityType: scan.activityType,
          },
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
          target: { kind: "redemption" as const, id: redemption.id },
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
