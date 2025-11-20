import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import type { Transaction } from "~/server/db";
import { scavengerHuntScans, scavengerHuntItems, users } from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Hardcoded test scanner info
const TEST_SCANNER_ID = "37507f9f-5e9b-4daf-bb65-6a6798495b76";

// Add points function (same as in scavenger-hunt router)
async function addPoints(
  tx: Transaction,
  userId: string,
  points: number,
) {
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
}

// Reuse the recordScan function logic but with test scanner
async function recordTestScan(
  userId: string,
  points: number,
  itemId: number,
  scannerId: string,
) {
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

    // Add points to user
    await addPoints(tx, userId, points);

    // Record the scan with test scanner ID
    await tx.insert(scavengerHuntScans).values({
      userId: userId,
      itemId: itemId,
      scannerId: scannerId,
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { userId, itemId, scannerId } = req.body;

    if (!userId || !itemId) {
      return res.status(400).json({ message: "userId and itemId are required" });
    }

    // Use provided scannerId or fallback to test scanner
    const finalScannerId = scannerId || TEST_SCANNER_ID;

    // Check if item exists
    const item = await db.query.scavengerHuntItems.findFirst({
      where: eq(scavengerHuntItems.id, itemId),
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Record the scan
    await recordTestScan(userId, item.points, item.id, finalScannerId);

    return res.status(200).json({
      success: true,
      message: "Item scanned successfully",
    });
  } catch (error) {
    console.error("Test scan error:", error);
    if (error instanceof TRPCError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Failed to scan item: " + JSON.stringify(error),
    });
  }
}

