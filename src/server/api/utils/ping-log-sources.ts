import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  marketingNotificationReminders,
  sponsorHelpRequests,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  taskReminders,
  teams,
  users,
} from "~/server/db/schema";
import type { PingEntry, PingKind, PingTone } from "~/lib/ping-log";

/**
 * Every other kind of ping the site sends, read from the tables each feature
 * already keeps (read-only; nothing new is recorded). Organizer run-of-show
 * reminders come from Slack's queue instead (organizer-ping-log.ts).
 */

/** Newest rows per source: plenty for one weekend, keeps the page fast. */
const LIMIT = 500;

function personName(
  app: { firstName: string | null; lastName: string | null } | null,
  user: { name: string | null; email: string | null } | null,
): string {
  const full = [app?.firstName, app?.lastName].filter(Boolean).join(" ");
  // First non-empty of: application name, account name, email.
  return [full, user?.name, user?.email].find((v) => v) ?? "Unknown hacker";
}

/** Coffee chat invites DMed to hackers (notified_at is set when it's sent). */
export async function coffeePings(): Promise<PingEntry[]> {
  const rows = await db
    .select({
      notifiedAt: coffeeChats.notifiedAt,
      status: coffeeChats.status,
      slotTime: coffeeChats.slotTime,
      round: coffeeChats.round,
      sponsor: sponsorJudgingSponsors.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
      name: users.name,
      email: users.email,
    })
    .from(coffeeChats)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
    )
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .where(isNotNull(coffeeChats.notifiedAt))
    .orderBy(desc(coffeeChats.notifiedAt))
    .limit(LIMIT);
  const tone: Record<string, PingTone> = {
    pending: "waiting",
    accepted: "ok",
    declined: "done",
    expired: "problem",
    cancelled: "done",
  };
  return rows.map((r) => ({
    kind: "coffee",
    at: r.notifiedAt!,
    to: personName(r, r),
    about: `${r.sponsor} · ${r.slotTime}${r.round ? ` · round ${r.round}` : ""}`,
    status: `coffee.${r.status}`,
    tone: tone[r.status] ?? "waiting",
  }));
}

/** Judging presentation times sent to each team member. */
export async function presentationPings(): Promise<PingEntry[]> {
  const rows = await db
    .select({
      sentAt: sponsorPresentationNotices.sentAt,
      claimedAt: sponsorPresentationNotices.claimedAt,
      status: sponsorPresentationNotices.status,
      team: teams.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
      name: users.name,
      email: users.email,
    })
    .from(sponsorPresentationNotices)
    .innerJoin(teams, eq(teams.id, sponsorPresentationNotices.teamId))
    .innerJoin(users, eq(users.id, sponsorPresentationNotices.userId))
    .leftJoin(
      applications,
      eq(applications.userId, sponsorPresentationNotices.userId),
    )
    .orderBy(desc(sponsorPresentationNotices.claimedAt))
    .limit(LIMIT);
  const tone: Record<string, PingTone> = {
    sent: "ok",
    emailed: "ok",
    sending: "waiting",
    "not-found": "problem",
    failed: "problem",
  };
  return rows.map((r) => ({
    kind: "presentation",
    at: r.sentAt ?? r.claimedAt,
    to: personName(r, r),
    about: r.team,
    status: `presentation.${r.status}`,
    tone: tone[r.status] ?? "waiting",
  }));
}

/** Sponsor help requests posted to the team channel (and their re-pings). */
export async function helpPings(): Promise<PingEntry[]> {
  const rows = await db
    .select({
      createdAt: sponsorHelpRequests.createdAt,
      reason: sponsorHelpRequests.reason,
      status: sponsorHelpRequests.status,
      slackTs: sponsorHelpRequests.slackTs,
      pingCount: sponsorHelpRequests.pingCount,
      claimedByName: sponsorHelpRequests.claimedByName,
      location: sponsorHelpRequests.location,
      sponsor: sponsorJudgingSponsors.name,
    })
    .from(sponsorHelpRequests)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, sponsorHelpRequests.sponsorId),
    )
    .orderBy(desc(sponsorHelpRequests.createdAt))
    .limit(LIMIT);
  return rows.map((r) => {
    const posted = r.slackTs !== null;
    const status = !posted ? "help.notPosted" : `help.${r.status}`;
    const tone: PingTone = !posted
      ? "problem"
      : r.status === "open"
        ? "waiting"
        : r.status === "claimed"
          ? "ok"
          : "done";
    const extra = [
      r.pingCount ? `re-pinged ${r.pingCount}×` : null,
      r.claimedByName ? `claimed by ${r.claimedByName}` : null,
      r.location,
    ].filter(Boolean);
    return {
      kind: "help",
      at: r.createdAt,
      to: r.sponsor,
      about: r.reason,
      status,
      tone,
      detail: extra.join(" · ") || undefined,
    };
  });
}

/** Site-run task reminders (scheduled Slack messages at a task's start). */
export async function taskPings(): Promise<PingEntry[]> {
  const rows = await db
    .select()
    .from(taskReminders)
    .orderBy(desc(taskReminders.postAt))
    .limit(LIMIT);
  return rows.map((r) => ({
    kind: "task",
    at: r.postAt,
    to: r.owner,
    about: r.task,
    status: `scheduled.${r.status}`,
    tone: scheduledTone(r.status),
    detail: r.error ?? undefined,
  }));
}

/** Marketing team post reminders. */
export async function marketingPings(): Promise<PingEntry[]> {
  const rows = await db
    .select()
    .from(marketingNotificationReminders)
    .orderBy(desc(marketingNotificationReminders.postAt))
    .limit(LIMIT);
  return rows.map((r) => ({
    kind: "marketing",
    at: r.postAt,
    to: r.recipientName,
    about: r.text.split("\n")[0] ?? "",
    status: `scheduled.${r.status}`,
    tone: scheduledTone(r.status),
    detail: r.error ?? undefined,
  }));
}

function scheduledTone(status: string): PingTone {
  if (status === "scheduled") return "waiting";
  if (status === "failed") return "problem";
  return "done";
}

/** Each source on its own, so one failing table doesn't blank the page. */
export async function otherPings(): Promise<{
  entries: PingEntry[];
  failed: PingKind[];
}> {
  const sources: [PingKind, () => Promise<PingEntry[]>][] = [
    ["coffee", coffeePings],
    ["presentation", presentationPings],
    ["help", helpPings],
    ["task", taskPings],
    ["marketing", marketingPings],
  ];
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  const entries: PingEntry[] = [];
  const failed: PingKind[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") entries.push(...result.value);
    else {
      failed.push(sources[i]![0]);
      console.error(`ping log: ${sources[i]![0]} failed`, result.reason);
    }
  });
  return { entries, failed };
}
