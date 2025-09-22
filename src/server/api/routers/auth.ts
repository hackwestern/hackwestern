import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { resend } from "~/server/mail";
import {
  resetPasswordTokens,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authOptions } from "~/server/auth";
import { type AdapterUser } from "next-auth/adapters";
import { resetTemplate, verifyTemplate } from "./email-templates";

const TOKEN_EXPIRY = 1000 * 60 * 11; // 11 minutes
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one symbol");
const HACK_WESTERN_EMAIL = "Hack Western Team <hello@hackwestern.com>";

const createInputSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: passwordSchema,
});

const setPasswordInputSchema = z.object({
  token: z.string().length(40, "Invalid token"),
  password: passwordSchema,
});

const requestVerifyEmail = async (user: AdapterUser) => {
  const token = randomBytes(20).toString("hex");
  const verifyLink = `https://hackwestern.com/verify?token=${token}`;

  await db.insert(verificationTokens).values({
    identifier: user.id,
    token: token,
    expires: new Date(Date.now() + TOKEN_EXPIRY),
  });

  return await resend.emails.send({
    from: HACK_WESTERN_EMAIL,
    to: user.email,
    subject: "Hack Western 12 Account Verification",
    html: verifyTemplate(verifyLink),
  });
};

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

      const { data: emailReq, error } = await resend.emails.send({
        from: HACK_WESTERN_EMAIL,
        to: input.email,
        subject: "Hack Western 12 Password Reset",
        html: resetTemplate(resetLink, user.name ?? "there"),
      });

      if (error) {
        console.error("Error sending reset email:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send reset email",
        });
      }

      console.log("Reset email sent:", emailReq);

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

        const createdUser = await adapter.createUser({
          email: input.email,
          emailVerified: null,
          id: "",
        });

        await db
          .update(users)
          .set({
            password: hashedPassword,
          })
          .where(eq(users.id, createdUser.id));

        const res = await requestVerifyEmail(createdUser);

        if (res.error) {
          console.error("Error sending verification email:", res.error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send verification email",
          });
        }

        console.log("Verification email sent:", res);

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

  checkVerified: publicProcedure.query(async ({ ctx }) => {
    if (!ctx?.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not logged in",
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      verified: user.emailVerified,
    };
  }),

  resendEmail: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx?.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not logged in",
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const res = await requestVerifyEmail(user);

    if (res.error) {
      console.error("Error sending verification email:", res.error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send verification email",
      });
    }

    console.log("Verification email resent:", res);

    return {
      success: true,
    };
  }),

  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const token = await db.query.verificationTokens.findFirst({
        where: eq(verificationTokens.token, input.token),
      });

      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification token not found",
        });
      }

      if (token.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification token expired",
        });
      }

      await db
        .update(users)
        .set({
          emailVerified: new Date(),
        })
        .where(eq(users.id, token.identifier));

      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, input.token));

      return {
        success: true,
      };
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
          message: "Verification token not found",
        });
      }

      if (token.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification token expired",
        });
      }

      await db
        .update(users)
        .set({
          emailVerified: new Date(),
        })
        .where(eq(users.id, token.userId));

      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, input.token));

      return {
        success: true,
      };
    }),
});
