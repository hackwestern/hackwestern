import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

// Imports for reset
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { resetPasswordTokens, users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const TOKEN_EXPIRY = 1000 * 60 * 10; // 10 minutes

export const login = createTRPCRouter({
  reset: publicProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ input }) => {

      // Fetch user by email
      const user = await db.query.users.findFirst({
        columns: { id: true },
        where: eq(users.email, input.email)
        });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      }

      const uid = user.id;

      // Generate reset token
      const resetToken = randomBytes(20).toString("hex"); // 20 byte hex string
      
      // Store reset token and expiry; replace existing if exists
      await db.insert(resetPasswordTokens)
        .values({
          userId: uid, 
          token: resetToken, 
          expires: new Date(Date.now() + TOKEN_EXPIRY)})
        .onConflictDoUpdate({ 
          target: resetPasswordTokens.userId, 
          set: { 
            token: resetToken, 
            expires: new Date(Date.now() + TOKEN_EXPIRY)}
      });

      const resetLink = `https://hackwestern.com/login/set-password?token=${resetToken}`;

      
      // TODO: send email with reset link

      return {
        success: true,
      };
  }),
});
