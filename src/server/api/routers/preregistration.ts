import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { createInsertSchema } from "drizzle-zod";
import { preregistrations } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { sendEmail } from "~/server/mail";
import { normalizeEmail, generateUnsubscribeToken } from "~/server/subscribers";
import { validateSignupEmail } from "~/server/email-validation";
import { env } from "~/env";
import { signupTemplate } from "./email-templates";

// Email links must be canonical + permanent — never a per-deployment preview
// URL (which may be scheme-less or expire) — so hardcode the public domain
// rather than trusting the deployment's NEXTAUTH_URL.
const BASE = "https://www.hackwestern.com";

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
        // Reject junk addresses before we send (and record) a confirmation, so
        // a bad signup never generates a bounce that hurts our sender reputation.
        const validation = await validateSignupEmail(
          input.email,
          env.KICKBOX_API_KEY,
        );
        if (!validation.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.reason,
          });
        }

        // Normalize once and use it for BOTH lookups and the insert. An earlier
        // version checked preregistrations against the raw input while storing the
        // raw input too, so "Arjun.gr97@gmail.com" and "arjun.gr97@gmail.com" were
        // different rows: the lookup missed, and the unique index is byte-exact so it
        // did not fire either. The same person signed up twice and got two of every
        // email. Gmail dot-stripping widens that further — "a.rjun.gr97@" is the same
        // mailbox again.
        const normalized = normalizeEmail(input.email);
        const [existingPreregistration, existingSubscriber] = await Promise.all(
          [
            db.query.preregistrations.findFirst({
              where: ({ email }, { eq }) => eq(email, normalized),
            }),
            db.query.emailSubscribers.findFirst({
              where: ({ email }, { eq }) => eq(email, normalized),
            }),
          ],
        );

        if (Boolean(existingPreregistration) || Boolean(existingSubscriber)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "You're already signed up for Hack Western updates. No need to register again.",
          });
        }

        const unsubscribeToken = generateUnsubscribeToken();
        const createdPreregistration = await db
          .insert(preregistrations)
          // Stored normalized, so the lookups above can ever match it.
          .values({ ...input, email: normalized, unsubscribeToken })
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
