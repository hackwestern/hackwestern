import {
  createTRPCRouter,
} from "~/server/api/trpc";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "~/server/db";
import { rotatingQrCode } from "~/server/db/schema";
import {protectedProcedure} from "~/server/api/trpc";

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY!;

export function createQrToken(payload: { userId: string; eventId: number }, expiresIn: string) {
  return jwt.sign(payload, JWT_SECRET_KEY as jwt.Secret, { expiresIn: parseInt(expiresIn, 10) });
}

export const rotatingQrCodeRouter = createTRPCRouter({
    getQRCode: protectedProcedure
      .input(z.object({ eventId: z.number().int() }))
      .query(async ({ input, ctx }) => {
        try {
          const eventId = input.eventId;
    
          // Fetch QR Code from DB for this event
          const qrCode = await db.query.rotatingQrCode.findFirst({
            where: eq(rotatingQrCode.id, eventId),
          });
    
          // Check if QR exists & is expired
          if (qrCode && new Date(qrCode.expires) < new Date()) {
            await db.delete(rotatingQrCode).where(eq(rotatingQrCode.id, eventId));
          } else if (qrCode) {
            return qrCode; // valid existing code
          }
    
          // Generate new token (JWT)
          const token = createQrToken(
            { userId: ctx.session.user.id, eventId },
            "30s" // expires in 30 seconds
          );
    
          // Insert new QR Code into DB
          const expires = new Date(Date.now() + 30_000);
          const newQRCode = await db
            .insert(rotatingQrCode)
            .values({
              id: eventId,
              expires,
              creatorId: ctx.session.user.id,
              eventId,
              token,
            })
            .returning();
    
          return newQRCode[0];
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch QR code: " + JSON.stringify(error),
          });
        }
      })
});
