import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { applications, dayOfRegistrations } from "~/server/db/schema";

export const checkInRouter = createTRPCRouter({
  /**
   * For manual check-ins when QR code doesn't work: 
   * Returns all accepted/confirmed applicants whose first or last name matches.
   * If multiple results are returned, the organizer should confirm by checking email.
   */
  searchByName: protectedOrganizerProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ input }) => {
      const name = input.name.trim();
      const parts = name.split(/\s+/);
      const firstName = parts[0]!;
      const lastName = parts.slice(1).join(" ");

      const matches = await db.query.applications.findMany({
        where: sql`lower(${applications.firstName}) = lower(${firstName}) AND lower(${applications.lastName}) = lower(${lastName})`,
        columns: {
          userId: true,
          firstName: true,
          lastName: true,
          status: true,
        },
        with: {
          user: { columns: { email: true } },
        },
      });

      return matches.map((a) => ({
        userId: a.userId,
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.user?.email ?? null,
        status: a.status,
      }));
    }),

  signInHacker: protectedOrganizerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await db.query.dayOfRegistrations.findFirst({
        where: eq(dayOfRegistrations.userId, input.userId),
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
          .where(eq(dayOfRegistrations.userId, input.userId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(dayOfRegistrations)
        .values({ userId: input.userId, signedInAt: now, approved: true })
        .returning();

      return created;
    }),

  /**
   * Returns whether a hacker is approved to attend and whether they've signed in.
   */
  checkIsHackerApproved: protectedOrganizerProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const [application, dayOf] = await Promise.all([
        db.query.applications.findFirst({
          where: eq(applications.userId, input.userId),
          columns: { userId: true, status: true, firstName: true, lastName: true },
        }),
        db.query.dayOfRegistrations.findFirst({
          where: eq(dayOfRegistrations.userId, input.userId),
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
