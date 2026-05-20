import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";

export const checkInRouter = createTRPCRouter({
  /**
   * Marks a hacker as physically checked in at the event.
   * Called by an organizer after verifying the hacker's ID at the door.
   * Input accepts either a userId or an email so organizers can look up by either.
   */
  signInHacker: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
      }).refine((d) => d.userId ?? d.email, {
        message: "Provide either userId or email",
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const organizerId = ctx.session.user.id;

      // Resolve the hacker's userId from whichever identifier was provided
      let hackerId: string;

      if (input.userId) {
        hackerId = input.userId;
      } else {
        const user = await db.query.users.findFirst({
          where: eq(users.email, input.email!),
          columns: { id: true },
        });
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email" });
        }
        hackerId = user.id;
      }

      const application = await db.query.applications.findFirst({
        where: eq(applications.userId, hackerId),
        columns: { userId: true, status: true, checkedInAt: true },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No application found for this user",
        });
      }

      if (application.status !== "ACCEPTED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Hacker application status is ${application.status} — only ACCEPTED hackers can check in`,
        });
      }

      if (application.checkedInAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Hacker already checked in at ${application.checkedInAt.toISOString()}`,
        });
      }

      const [updated] = await db
        .update(applications)
        .set({
          checkedInAt: new Date(),
          checkedInByUserId: organizerId,
        })
        .where(eq(applications.userId, hackerId))
        .returning({
          userId: applications.userId,
          checkedInAt: applications.checkedInAt,
          checkedInByUserId: applications.checkedInByUserId,
        });

      return updated;
    }),

  /**
   * Returns whether a hacker's application was approved (status = ACCEPTED).
   * Used by organizers to confirm eligibility before letting someone in.
   */
  checkIsHackerApproved: protectedOrganizerProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
      }).refine((d) => d.userId ?? d.email, {
        message: "Provide either userId or email",
      }),
    )
    .query(async ({ input }) => {
      let hackerId: string;

      if (input.userId) {
        hackerId = input.userId;
      } else {
        const user = await db.query.users.findFirst({
          where: eq(users.email, input.email!),
          columns: { id: true },
        });
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email" });
        }
        hackerId = user.id;
      }

      const application = await db.query.applications.findFirst({
        where: eq(applications.userId, hackerId),
        columns: {
          userId: true,
          status: true,
          firstName: true,
          lastName: true,
          checkedInAt: true,
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No application found for this user",
        });
      }

      return {
        userId: application.userId,
        firstName: application.firstName,
        lastName: application.lastName,
        status: application.status,
        isApproved: application.status === "ACCEPTED",
        checkedInAt: application.checkedInAt ?? null,
      };
    }),
});
