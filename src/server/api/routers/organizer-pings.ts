import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import {
  otherPings,
  type PingEntry,
  type PingKind,
  type PingTone,
} from "~/server/api/utils/ping-log-sources";
import { sharedSheetRead } from "~/server/api/utils/sponsor-sheets";
import { loadOrganizerData } from "~/server/slack/organizer-load";
import {
  botHealth,
  pingRows,
  plannedPings,
  slackQueue,
  type BotHealth,
  type PingStatus,
} from "~/server/slack/organizer-ping-log";

/** Run of show changes show up within a minute, like the bot's own sync. */
const PLAN_TTL_MS = 60_000;

const ORGANIZER_TONE: Record<PingStatus, PingTone> = {
  queued: "waiting",
  notQueued: "problem",
  sent: "ok",
};

/** Run-of-show reminders: the sheet's plan matched to Slack's queue. */
async function organizerPings(now: number): Promise<{
  bot: BotHealth;
  entries: PingEntry[];
}> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error("SLACK_BOT_TOKEN isn't set on this site.");
  const [data, queue] = await Promise.all([
    sharedSheetRead("organizer-ping-plan", PLAN_TTL_MS, () =>
      loadOrganizerData({ ...process.env }),
    ),
    slackQueue(token),
  ]);
  const rows = pingRows(plannedPings(data.plan, data.tasks), queue, now);
  return {
    bot: botHealth(queue, now),
    entries: rows.map((r) => ({
      kind: "organizer",
      at: r.postAt,
      to: r.to,
      about: r.title,
      status: `organizer.${r.status}`,
      tone: ORGANIZER_TONE[r.status],
      detail: r.text,
    })),
  };
}

export const organizerPingsRouter = createTRPCRouter({
  /**
   * Every ping the site and the reminder bot send, newest data each call.
   * Each source loads on its own: one failing doesn't hide the others.
   */
  log: protectedOrganizerProcedure.query(async () => {
    const now = Date.now();
    const [organizer, other] = await Promise.all([
      organizerPings(now).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({
          ok: false as const,
          message: error instanceof Error ? error.message : String(error),
        }),
      ),
      otherPings(),
    ]);
    const failed: PingKind[] = [...other.failed];
    if (!organizer.ok) failed.push("organizer");
    return {
      now: new Date(now),
      bot: organizer.ok ? organizer.value.bot : null,
      organizerError: organizer.ok ? null : organizer.message,
      entries: [
        ...(organizer.ok ? organizer.value.entries : []),
        ...other.entries,
      ],
      failed,
    };
  }),
});
