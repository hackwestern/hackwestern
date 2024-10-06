import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { mailjet } from "~/server/mail";
import { resetPasswordTokens, users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { resetTemplate } from "./password-reset-template";
import { authOptions } from "~/server/auth";

const TOKEN_EXPIRY = 1000 * 60 * 11; // 11 minutes
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one symbol");

const createInputSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: passwordSchema,
});

const setPasswordInputSchema = z.object({
  token: z.string().length(40, "Invalid token"),
  password: passwordSchema,
});

export const authRouter = createTRPCRouter({
  reset: publicProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ input }) => {
      // Fetch user by email
      const user = await db.query.users.findFirst({
        columns: { id: true, name: true },
        where: eq(users.email, input.email),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const uid = user.id;

      // Generate reset token
      const resetToken = randomBytes(20).toString("hex"); // 20 byte hex string

      // Store reset token and expiry; replace existing if exists
      await db
        .insert(resetPasswordTokens)
        .values({
          userId: uid,
          token: resetToken,
          expires: new Date(Date.now() + TOKEN_EXPIRY),
        })
        .onConflictDoUpdate({
          target: resetPasswordTokens.userId,
          set: {
            token: resetToken,
            expires: new Date(Date.now() + TOKEN_EXPIRY),
          },
        });

      const resetLink = `https://hackwestern.com/reset-password?token=${resetToken}`;
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
            HTMLPart: resetTemplate(resetLink, user.name ?? "there"),
            Subject: "Hack Western 11 Password Reset",
          },
        ],
      });

      emailReq
        .then((result) => {
          console.log(result);
        })
        .catch((err) => {
          console.error(err);
        });

      return {
        success: true,
      };
    }),

  create: publicProcedure
    .input(createInputSchema)
    .mutation(async ({ input }) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (user) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User already exists",
          });
        }

        const salt: string = await bcrypt.genSalt(10);
        const hashedPassword: string = await bcrypt.hash(input.password, salt);

        const adapter = authOptions.adapter;

        if (adapter?.createUser === undefined) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Adapter not found",
          });
        }

        // TODO: verify email
        const createdUser = await adapter.createUser({
          email: input.email,
          emailVerified: new Date(),
          id: "",
        });

        await db
          .update(users)
          .set({
            password: hashedPassword,
          })
          .where(eq(users.id, createdUser.id));
        return {
          success: true,
        };
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Failed to create user with password: " + JSON.stringify(error),
            });
      }
    }),

  setPassword: publicProcedure
    .input(setPasswordInputSchema)
    .mutation(async ({ input }) => {
      try {
        const token = await db.query.resetPasswordTokens.findFirst({
          where: eq(resetPasswordTokens.token, input.token),
        });

        if (!token) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Token not found",
          });
        }

        if (token.expires < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token has expired",
          });
        }

        const salt: string = await bcrypt.genSalt(10);
        const hashedPassword: string = await bcrypt.hash(input.password, salt);

        // update user password
        await db
          .update(users)
          .set({
            password: hashedPassword,
          })
          .where(eq(users.id, token.userId));

        // delete token after use
        await db
          .delete(resetPasswordTokens)
          .where(eq(resetPasswordTokens.token, input.token));

        return {
          success: true,
        };
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to set password: " + JSON.stringify(error),
            });
      }
    }),

  checkValidToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const token = await db.query.resetPasswordTokens.findFirst({
        where: eq(resetPasswordTokens.token, input.token),
      });

      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found",
        });
      }

      if (token.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token has expired",
        });
      }

      return {
        success: true,
      };
    }),
});
