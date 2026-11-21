/**
 * Ping Logs types shared by the server (ping-log-sources.ts) and the page.
 * No server imports here: the page bundle includes this file.
 */

export const PING_KINDS = [
  "organizer",
  "autoPing",
  "coffee",
  "presentation",
  "help",
  "task",
  "marketing",
] as const;
export type PingKind = (typeof PING_KINDS)[number];

/** How a status reads at a glance. */
export type PingTone = "ok" | "waiting" | "problem" | "done";

export type PingEntry = {
  kind: PingKind;
  at: Date;
  to: string;
  about: string;
  /** Raw status key; the page turns it into words. */
  status: string;
  tone: PingTone;
  detail?: string;
  /** Auto-Ping only: the person's role ("Mentor", "Volunteer", "Judge"). */
  group?: string;
};

/** A row of the Auto-Ping sheet's Queue tab, as much as the log needs. */
export type AutoPingQueueRow = {
  role: string;
  name: string;
  email: string;
  /** Messages tab key ("Check-in: Mentor"); blank on a not-on-Slack row. */
  message: string;
  /** ISO time; blank on a not-on-Slack row. */
  postAt: string;
  /** While held: the blank fill-in the message is waiting on. */
  hash: string;
  status: string;
  /** ISO time of the bot's last change to the row. */
  updated: string;
};

const AUTO_PING_TONE: Record<string, PingTone> = {
  scheduled: "waiting",
  sent: "ok",
  cancelled: "done",
  held: "problem",
  "not-on-slack": "problem",
};

/**
 * Auto-Ping's own record of each mentor, volunteer and judge DM as log
 * rows. The bot marks a queued DM "sent" on its next pass, so a "scheduled"
 * row whose time has passed already went out.
 */
export function autoPingEntries(
  queue: AutoPingQueueRow[],
  now: number,
): PingEntry[] {
  return queue.map((r) => {
    const postAt = Date.parse(r.postAt);
    const updated = Date.parse(r.updated);
    const at = !Number.isNaN(postAt)
      ? postAt
      : !Number.isNaN(updated)
        ? updated
        : now;
    const status =
      r.status === "scheduled" && at <= now ? "sent" : r.status || "cancelled";
    return {
      kind: "autoPing",
      at: new Date(at),
      to: r.name || r.email,
      about: r.message,
      status: `autoPing.${status}`,
      tone: AUTO_PING_TONE[status] ?? "done",
      detail: status === "held" && r.hash ? r.hash : undefined,
      group: r.role || undefined,
    };
  });
}
