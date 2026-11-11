import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { env } from "~/env";
import { DEVPOST_URL } from "~/utils/urls";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import {
  HIDE_CHECKLIST,
  RECORDED_STEPS,
  buildChecklist,
} from "~/lib/onboarding";

// Load the signed-in hacker's checklist. Null = not admitted, no checklist.
async function loadChecklist(userId: string) {
  const [application, user] = await Promise.all([
    db.query.applications.findFirst({
      where: eq(applications.userId, userId),
      columns: { status: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { onboardingSteps: true },
    }),
  ]);

  return buildChecklist({
    status: application?.status,
    recorded: user?.onboardingSteps ?? [],
  });
}

// Add a step to the user's list. Clicking twice (or from two tabs) is fine:
// it's only appended if it isn't there yet.
const record = (userId: string, step: string) =>
  db
    .update(users)
    .set({
      onboardingSteps: sql`array_append(${users.onboardingSteps}, ${step})`,
    })
    .where(
      sql`${users.id} = ${userId} and not (${step} = any(${users.onboardingSteps}))`,
    );

export const onboardingRouter = createTRPCRouter({
  // Checklist for the home page. `eligible: false` for anyone not admitted
  // (organizers, applicants, declined...), who don't see it.
  get: protectedProcedure.query(async ({ ctx }) => {
    const checklist = await loadChecklist(ctx.session.user.id);
    if (!checklist) return { eligible: false as const };

    return {
      eligible: true as const,
      ...checklist,
      links: {
        // TODO: generic placeholders until we have the real links
        slack: env.ONBOARDING_SLACK_URL ?? "https://slack.com",
        devpost: env.ONBOARDING_DEVPOST_URL ?? DEVPOST_URL,
      },
    };
  }),

  // A hacker clicked through a step we can't verify (Slack, Devpost, wallet).
  // Accepted / RSVP are derived and can't be set here.
  complete: protectedProcedure
    .input(z.object({ step: z.enum(RECORDED_STEPS) }))
    .mutation(async ({ ctx, input }) => {
      const checklist = await loadChecklist(ctx.session.user.id);
      if (!checklist) throw new TRPCError({ code: "FORBIDDEN" });

      await record(ctx.session.user.id, input.step);
      return { step: input.step };
    }),

  // "Hide checklist" on the finished card.
  hide: protectedProcedure.mutation(async ({ ctx }) => {
    const checklist = await loadChecklist(ctx.session.user.id);
    if (!checklist) throw new TRPCError({ code: "FORBIDDEN" });
    if (!checklist.allDone) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Finish the checklist before hiding it",
      });
    }

    await record(ctx.session.user.id, HIDE_CHECKLIST);
    return { hidden: true };
  }),
});
