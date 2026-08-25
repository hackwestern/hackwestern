import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { createInsertSchema } from "drizzle-zod";
import { preregistrations } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { manageContact } from "~/server/mailjet-contacts";
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
        //
        // Send to `normalized`, NOT `input.email`. Mailjet's Send API creates a
        // contact from whatever address it delivered to, so sending to the raw
        // input filed "Foo.Bar@gmail.com" while the list write below files
        // "foobar@gmail.com" — two Mailjet contacts for one mailbox, billed and
        // mailed separately. A prod audit on 2026-08-25 found 2,552 contacts
        // collapsing to 2,481 unique addresses; this was the cause.
        const { error } = await sendViaMailjet(
          {
            from: "Hack Western Team <hello@hackwestern.com>",
            to: normalized,
            subject: "You're signed up for Hack Western 13 updates!",
            html: signupTemplate(
              normalized,
              `${BASE}/unsubscribe?token=${unsubscribeToken}`,
            ),
            headers: {
              "List-Unsubscribe": `<${BASE}/api/unsubscribe?token=${unsubscribeToken}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          },
          { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
        );

        if (error) {
          console.error("Error sending preregistration email:", error);
        }

        // File the contact under the marketing list. Sending alone creates the
        // contact but files it under no list, so dashboard campaigns — which can
        // only target a list — never see preregistration signups. `addnoforce`
        // keeps a previous unsubscribe intact if this address opted out before.
        // Best-effort: the row is already committed, so a Mailjet failure here
        // must not turn a successful signup into an error for the user.
        if (env.MAILJET_CONTACT_LIST_ID) {
          const listed = await manageContact(
            env.MAILJET_CONTACT_LIST_ID,
            normalized,
            { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
          );
          if (!listed.ok) {
            console.error(
              "Error adding preregistration to Mailjet list:",
              listed.error,
            );
          }
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
