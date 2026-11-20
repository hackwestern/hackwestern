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
import { loadOrganizerData, slackId } from "~/server/slack/organizer-load";
import {
  botHealth,
  organizerHealth,
  pingRows,
  plannedPings,
  slackQueue,
  type BotHealth,
  type OrganizerHealth,
  type PingStatus,
  type Reach,
} from "~/server/slack/organizer-ping-log";

/** Run of show changes show up within a minute, like the bot's own sync. */
const PLAN_TTL_MS = 60_000;
/** Slack accounts rarely change; look them up again every 10 minutes. */
const REACH_TTL_MS = 10 * 60_000;

/** A run-of-show task nobody gets pinged for, and why. */
export type UnpingedTask = {
  at: Date;
  title: string;
  /** Why the sheet skipped it, or the owner names nobody recognized. */
  reason?: string;
  unknownNames?: string;
};

const ORGANIZER_TONE: Record<PingStatus, PingTone> = {
  queued: "waiting",
  notQueued: "problem",
  sent: "ok",
};

/** Run-of-show reminders: the sheet's plan matched to Slack's queue. */
async function organizerPings(now: number): Promise<{
  bot: BotHealth;
  health: OrganizerHealth;
  unpinged: UnpingedTask[];
  entries: PingEntry[];
}> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error("SLACK_BOT_TOKEN isn't set on this site.");
  const config = { ...process.env };
  const [data, queue] = await Promise.all([
    sharedSheetRead("organizer-ping-plan", PLAN_TTL_MS, () =>
      loadOrganizerData(config),
    ),
    slackQueue(token),
  ]);
  // Can each person with pings be DMed? Same lookup the bot uses.
  const names = [...new Set(data.plan.map((r) => r.recipientName))].sort();
  const reach = await sharedSheetRead(
    `organizer-ping-reach:${names.join(",")}`,
    REACH_TTL_MS,
    async () => {
      const byName = new Map(data.people.map((p) => [p.name, p]));
      const unmatched = new Set(data.unmatched);
      const found = await Promise.all(
        names.map((name) => slackId(config, token, byName.get(name), name)),
      );
      return new Map<string, Reach>(
        names.map((name, i) => [
          name,
          found[i] ? "ok" : unmatched.has(name) ? "noContact" : "noSlack",
        ]),
      );
    },
  );
  const rows = pingRows(plannedPings(data.plan, data.tasks), queue, now);
  return {
    bot: botHealth(queue, now),
    health: organizerHealth(rows, reach, now),
    unpinged: [
      ...data.skipped.map((s) => ({
        at: s.at,
        title: s.title,
        reason: s.reason,
      })),
      ...data.unrecognized.map((u) => ({
        at: u.at,
        title: u.title,
        unknownNames: u.names.join(", "),
      })),
    ].sort((a, b) => +a.at - +b.at),
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
      health: organizer.ok ? organizer.value.health : null,
      unpinged: organizer.ok ? organizer.value.unpinged : [],
      organizerError: organizer.ok ? null : organizer.message,
      entries: [
        ...(organizer.ok ? organizer.value.entries : []),
        ...other.entries,
      ],
      failed,
    };
  }),
});
