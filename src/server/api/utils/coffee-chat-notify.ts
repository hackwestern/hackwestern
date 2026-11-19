import { eq, inArray } from "drizzle-orm";

import { isAdmittedStatus } from "~/lib/admission";
import {
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import {
  sendCoffeeChatChangeEmail,
  sendCoffeeChatOfferEmail,
} from "~/server/api/utils/coffee-chat-email";
import { mirrorCoffeeChats } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import {
  sendCoffeeChatDm,
  type CoffeeChatDmResult,
} from "~/server/slack/coffee-chat-dm";

/**
 * Coffee chat notifications. The router calls notifyCoffeeChat after the DB
 * write has committed; each channel (email, Slack DM, sheet mirror) runs on
 * its own and a failure is logged, never thrown, so a notification can't
 * fail or hold up the sponsor's or hacker's action. The hacker hears by
 * Slack first; the email goes out only if the DM wasn't sent.
 */

export type CoffeeChatEvent =
  | "offered"
  | "accepted"
  | "declined"
  | "cancelled"
  | "roomMoved";

/** One chat with what every channel needs to describe it. */
export type CoffeeChatNotice = {
  chatId: string;
  sponsorName: string;
  /** The email they applied with: the Slack fallback and the email's To. */
  hackerEmail: string | null;
  /** The email they said they use on Slack; tried on Slack first. */
  hackerSlackEmail: string | null;
  hackerFirstName: string;
  /** Accepted or confirmed (src/lib/admission.ts) right now. */
  admitted: boolean;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: CoffeeChatStatus;
  /** Session invites only (null for old per-slot requests). */
  placementId: string | null;
  repName: string | null;
  /** A session invite's answer-by time; null = 20 min before the chat. */
  expiresAt: Date | null;
};

export async function loadCoffeeChatNotice(
  chatId: string,
): Promise<CoffeeChatNotice | null> {
  return (await loadCoffeeChatNotices([chatId]))[0] ?? null;
}

/**
 * Notices for several chats in one read. `conn` may be a transaction, so a
 * caller can snapshot rows it is about to change or delete.
 */
export async function loadCoffeeChatNotices(
  chatIds: readonly string[],
  conn: Pick<typeof db, "select"> = db,
): Promise<CoffeeChatNotice[]> {
  if (chatIds.length === 0) return [];
  const rows = await conn
    .select({
      chatId: coffeeChats.id,
      sponsorName: sponsorJudgingSponsors.name,
      email: users.email,
      slackEmail: users.slackEmail,
      userName: users.name,
      userType: users.type,
      firstName: applications.firstName,
      appStatus: applications.status,
      slotTime: coffeeChats.slotTime,
      expiresAt: coffeeChats.expiresAt,
      durationMinutes: coffeeChats.durationMinutes,
      room: coffeeChats.room,
      status: coffeeChats.status,
      placementId: coffeeChats.placementId,
      repName: coffeeChats.repName,
    })
    .from(coffeeChats)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
    )
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .where(inArray(coffeeChats.id, [...chatIds]));
  return rows.map((row) => {
    const hackerFirstName =
      [row.firstName, row.userName?.trim().split(/\s+/)[0]]
        .map((name) => name?.trim() ?? "")
        .find((name) => name.length > 0) ?? "";
    return {
      chatId: row.chatId,
      sponsorName: row.sponsorName,
      hackerEmail: row.email,
      hackerSlackEmail: row.slackEmail,
      hackerFirstName,
      admitted: row.userType === "hacker" && isAdmittedStatus(row.appStatus),
      slotTime: row.slotTime,
      durationMinutes: row.durationMinutes,
      room: row.room,
      status: row.status,
      placementId: row.placementId,
      repName: row.repName,
      expiresAt: row.expiresAt,
    };
  });
}

/** The error's message only: never the request, headers, or credentials. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Longest the Slack attempt may take, so the email fallback still has time
 * inside NOTIFY_TIMEOUT_MS.
 */
export const SLACK_TIMEOUT_MS = 1200;

/** The DM result, or "failed" if Slack hasn't answered in time. */
async function dmWithTimeout(
  notice: CoffeeChatNotice,
  event: CoffeeChatEvent,
): Promise<CoffeeChatDmResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CoffeeChatDmResult>((resolve) => {
    timer = setTimeout(() => {
      console.error(
        `coffee chat slack DM still running after ${SLACK_TIMEOUT_MS} ms; falling back to email`,
      );
      resolve("failed");
    }, SLACK_TIMEOUT_MS);
  });
  const result = await Promise.race([
    sendCoffeeChatDm(notice, {}, dmEvent(event)),
    timeout,
  ]);
  clearTimeout(timer);
  return result;
}

/** Events the hacker hears about by Slack, then email. */
const hackerEvents = new Set<CoffeeChatEvent>([
  "offered",
  "cancelled",
  "roomMoved",
]);

function dmEvent(event: CoffeeChatEvent) {
  return event === "cancelled" || event === "roomMoved" ? event : "offered";
}

/**
 * Whether the hacker is told. A cancel notice needs the chat to be cancelled
 * now (the router only cancels pending or accepted chats); a room move only
 * matters while the chat is pending or accepted, never declined or expired.
 */
function hackerHears(event: CoffeeChatEvent, notice: CoffeeChatNotice) {
  if (event === "cancelled") return notice.status === "cancelled";
  if (event === "roomMoved") {
    const status = effectiveCoffeeChatStatus(notice);
    return status === "pending" || status === "accepted";
  }
  return true;
}

type Channel = (
  event: CoffeeChatEvent,
  load: () => Promise<CoffeeChatNotice | null>,
  dm: () => Promise<CoffeeChatDmResult | null>,
) => Promise<unknown>;

const channels: Record<string, Channel> = {
  // Waits for the Slack attempt, then sends only if the DM wasn't sent.
  email: async (event, load, dm) => {
    if (!hackerEvents.has(event)) return;
    const notice = await load();
    if (!notice || !hackerHears(event, notice)) return;
    if ((await dm()) === "sent") return;
    if (event === "cancelled" || event === "roomMoved") {
      await sendCoffeeChatChangeEmail(event, notice);
    } else {
      await sendCoffeeChatOfferEmail(notice);
    }
  },
  slack: async (event, _load, dm) => {
    if (!hackerEvents.has(event)) return;
    await dm();
  },
  // Every change rewrites the bookings tab; logs its own failures.
  sheet: () => mirrorCoffeeChats(),
};

/**
 * Longest a notification may hold up the action that triggered it. On
 * Vercel, work after the response is sent can be frozen, so callers await
 * notifyCoffeeChat; this cap keeps a slow channel from slowing the action.
 */
export const NOTIFY_TIMEOUT_MS = 2500;

/**
 * Tell everyone who needs to know about a chat change. Await it after the DB
 * commit, before responding. Runs every channel at once and resolves when
 * all have settled or after `timeoutMs`, whichever comes first. Never
 * rejects: channel failures are logged.
 */
export async function notifyCoffeeChat(
  event: CoffeeChatEvent,
  chat: { id: string },
  timeoutMs: number = NOTIFY_TIMEOUT_MS,
): Promise<void> {
  // Loaded once, and only by channels that need it.
  let notice: Promise<CoffeeChatNotice | null> | undefined;
  const load = () => (notice ??= loadCoffeeChatNotice(chat.id));
  // One Slack attempt, shared by the slack and email channels.
  let dmResult: Promise<CoffeeChatDmResult | null> | undefined;
  const dm = () =>
    (dmResult ??= load().then((n) =>
      n && hackerHears(event, n) ? dmWithTimeout(n, event) : null,
    ));
  const names = Object.keys(channels);
  const all = Promise.allSettled(
    names.map((name) => channels[name]!(event, load, dm)),
  ).then((results) =>
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `coffee chat ${names[i]} notification failed (${event}):`,
          errorMessage(result.reason),
        );
      }
    }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.error(
        `coffee chat notifications (${event}) still running after ${timeoutMs} ms; not waiting`,
      );
      resolve();
    }, timeoutMs);
  });
  await Promise.race([all, cap]);
  clearTimeout(timer);
}
