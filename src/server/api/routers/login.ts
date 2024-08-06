import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Imports for reset
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { mailjet } from "~/server/mail";
import { resetPasswordTokens, users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { resetTemplate } from "./password-reset-template";

const TOKEN_EXPIRY = 1000 * 60 * 10; // 10 minutes

export const loginRouter = createTRPCRouter({
  reset: publicProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ input }) => {

      // Fetch user by email
      const user = await db.query.users.findFirst({
        columns: { id: true, name: true },
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
      const emailReq = mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "hello@hackwestern.com",
              Name: "Hack Western Team",
            },
            To: [
              {
                Email: input.email,
                Name: user.name,
              },
            ],
            Variables: {
              resetLink: resetLink,
            },
            HTMLPart: resetTemplate(resetLink),
            Subject: "Hack Western 11 Password Reset",
          }
        ]
      })
      // TODO: send email with reset link

      emailReq.then(( result ) => {
        console.log(result);
      })
      .catch((err) => {
        console.error(err);
      });

      return {
        success: true,
      };
  }),
});
