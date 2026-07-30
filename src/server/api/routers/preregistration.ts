import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { createInsertSchema } from "drizzle-zod";
import { preregistrations } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { sendEmail } from "~/server/mail";
import { normalizeEmail, generateUnsubscribeToken } from "~/server/subscribers";
import { signupTemplate } from "./email-templates";
import { env } from "~/env";

const BASE =
  env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://www.hackwestern.com";

const preregistrationCreateSchema = createInsertSchema(preregistrations).omit({
  createdAt: true,
  id: true,
  unsubscribeToken: true,
  unsubscribedAt: true,
});

export const preregistrationRouter = createTRPCRouter({
  create: publicProcedure
    .input(preregistrationCreateSchema)
    .mutation(async ({ input }) => {
      try {
        const normalized = normalizeEmail(input.email);
        const [existingPreregistration, existingSubscriber] = await Promise.all(
          [
            db.query.preregistrations.findFirst({
              where: ({ email }, { eq }) => eq(email, input.email),
            }),
            db.query.emailSubscribers.findFirst({
              where: ({ email }, { eq }) => eq(email, normalized),
            }),
          ],
        );

        if (Boolean(existingPreregistration) || Boolean(existingSubscriber)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Pre-registration with that email already exists.",
          });
        }

        const unsubscribeToken = generateUnsubscribeToken();
        const createdPreregistration = await db
          .insert(preregistrations)
          .values({ ...input, unsubscribeToken })
          .returning();

        // Send confirmation email. Don't fail the signup if the email bounces —
        // the preregistration is already saved.
        const { error } = await sendEmail({
          from: "Hack Western Team <hello@hackwestern.com>",
          to: input.email,
          subject: "You're signed up for Hack Western 13 updates!",
          html: signupTemplate(
            input.email,
            `${BASE}/unsubscribe?token=${unsubscribeToken}`,
          ),
          headers: {
            "List-Unsubscribe": `<${BASE}/api/unsubscribe?token=${unsubscribeToken}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (error) {
          console.error("Error sending preregistration email:", error);
        }

        return createdPreregistration[0];
      } catch (error) {
        throw error instanceof TRPCError
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Failed to create preregistration" + JSON.stringify(error),
            });
      }
    }),
});
