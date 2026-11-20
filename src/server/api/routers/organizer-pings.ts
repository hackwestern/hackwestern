import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { sharedSheetRead } from "~/server/api/utils/sponsor-sheets";
import { loadOrganizerData } from "~/server/slack/organizer-load";
import {
  botHealth,
  pingRows,
  plannedPings,
  slackQueue,
} from "~/server/slack/organizer-ping-log";

/** Run of show changes show up within a minute, like the bot's own sync. */
const PLAN_TTL_MS = 60_000;

export const organizerPingsRouter = createTRPCRouter({
  /** Bot health plus every organizer ping: sent, queued, or not queued. */
  log: protectedOrganizerProcedure.query(async () => {
    const token = process.env.SLACK_BOT_TOKEN?.trim();
    if (!token) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "SLACK_BOT_TOKEN isn't set on this site.",
      });
    }
    const [data, queue] = await Promise.all([
      sharedSheetRead("organizer-ping-plan", PLAN_TTL_MS, () =>
        loadOrganizerData({ ...process.env }),
      ),
      slackQueue(token),
    ]);
    const now = Date.now();
    return {
      now: new Date(now),
      bot: botHealth(queue, now),
      pings: pingRows(plannedPings(data.plan, data.tasks), queue, now),
    };
  }),
});
