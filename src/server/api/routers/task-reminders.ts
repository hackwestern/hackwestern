import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { PING_LOG_MAX, PING_LOG_PAGE } from "~/lib/task-pings";
import {
  getTaskPingActivity,
  getTaskReminderStatus,
  syncTaskReminders,
} from "~/server/api/utils/task-reminders";

/**
 * Slack reminders for run-of-show tasks (T49), organizer-only. The sync
 * also runs on its own after each sheet read (run-of-show-sheet.ts).
 */
export const taskRemindersRouter = createTRPCRouter({
  status: protectedOrganizerProcedure.query(() => getTaskReminderStatus()),

  /** Task pings tab: next pings, recently resolved help, the ping log. */
  activity: protectedOrganizerProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(PING_LOG_MAX).default(PING_LOG_PAGE),
        })
        .default({}),
    )
    .query(({ input }) => getTaskPingActivity(new Date(), input.limit)),

  /** Re-sync now and wait for it. */
  sync: protectedOrganizerProcedure.mutation(async () => {
    const result = await syncTaskReminders();
    if (!result.ok && result.reason === "no-token") return result;
    if (!result.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Couldn't sync reminders",
      });
    }
    return result;
  }),
});
