import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { applications, dayOfRegistrations, users } from "~/server/db/schema";

const hackerLookupInput = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.userId ?? d.email, {
    message: "Provide either userId or email",
  });

/** Resolves a userId from either a direct id or an email lookup. */
async function resolveHackerId(input: { userId?: string; email?: string }) {
  if (input.userId) return input.userId;

  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email!),
    columns: { id: true },
  });

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email" });
  }

  return user.id;
}

export const checkInRouter = createTRPCRouter({
  /**
   * Marks a hacker as physically signed in at the event.
   * Called by an organizer after verifying the hacker's ID at the door.
   * Creates a dayOfRegistrations record if one doesn't exist yet, then sets signedInAt.
   */
  signInHacker: protectedOrganizerProcedure
    .input(hackerLookupInput)
    .mutation(async ({ input }) => {
      const hackerId = await resolveHackerId(input);

      const application = await db.query.applications.findFirst({
        where: eq(applications.userId, hackerId),
        columns: { userId: true, status: true },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No application found for this user",
        });
      }

      if (application.status !== "ACCEPTED" && application.status !== "CONFIRMED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Application status is ${application.status} — only ACCEPTED or CONFIRMED hackers can check in`,
        });
      }

      const existing = await db.query.dayOfRegistrations.findFirst({
        where: eq(dayOfRegistrations.userId, hackerId),
        columns: { signedInAt: true },
      });

      if (existing?.signedInAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Hacker already signed in at ${existing.signedInAt.toISOString()}`,
        });
      }

      const now = new Date();

      if (existing) {
        const [updated] = await db
          .update(dayOfRegistrations)
          .set({ signedInAt: now, approved: true })
          .where(eq(dayOfRegistrations.userId, hackerId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(dayOfRegistrations)
        .values({ userId: hackerId, signedInAt: now, approved: true })
        .returning();

      return created;
    }),

  /**
   * Returns whether a hacker's application was approved (ACCEPTED/CONFIRMED)
   * and whether they have been signed in on the day.
   * Used by organizers to confirm eligibility before letting someone in.
   */
  checkIsHackerApproved: protectedOrganizerProcedure
    .input(hackerLookupInput)
    .query(async ({ input }) => {
      const hackerId = await resolveHackerId(input);

      const [application, dayOf] = await Promise.all([
        db.query.applications.findFirst({
          where: eq(applications.userId, hackerId),
          columns: { userId: true, status: true, firstName: true, lastName: true },
        }),
        db.query.dayOfRegistrations.findFirst({
          where: eq(dayOfRegistrations.userId, hackerId),
          columns: { approved: true, signedInAt: true },
        }),
      ]);

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No application found for this user",
        });
      }

      const isAccepted =
        application.status === "ACCEPTED" || application.status === "CONFIRMED";

      return {
        userId: application.userId,
        firstName: application.firstName,
        lastName: application.lastName,
        status: application.status,
        isApproved: isAccepted,
        signedInAt: dayOf?.signedInAt ?? null,
        approvedOnDayOf: dayOf?.approved ?? false,
      };
    }),
});
