import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { createInsertSchema } from "drizzle-zod";
import { scavengerHuntScans, scavengerHuntItems } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { z } from "zod";

const scavengerHuntScanCreateSchema = createInsertSchema(scavengerHuntScans)
  .omit({ createdAt: true, itemId: true })
  .extend({
    itemCode: z.string().min(1).max(12),
  });

export const scavengerHuntRouter = createTRPCRouter({
  scan: publicProcedure
    .input(scavengerHuntScanCreateSchema)
    .mutation(async ({ input }) => {
      try {
        const item = await db.query.scavengerHuntItems.findFirst({
          where: ({ code }, { eq }) => eq(code, input.itemCode),
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scavenger hunt item not found",
          });
        }

        const existingScan = await db.query.scavengerHuntScans.findFirst({
          where: ({ userId, itemId }, { eq }) =>
            eq(userId, input.userId) && eq(itemId, item.id),
        });

        if (existingScan) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already scanned this item",
          });
        }

        const inserted = await db
          .insert(scavengerHuntScans)
          .values({ userId: input.userId, itemId: item.id })
          .returning();

        return inserted[0];
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to record scan: " + JSON.stringify(error),
            });
      }
    }),
});
