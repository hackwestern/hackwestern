import { eq } from "drizzle-orm";

import { isAdmittedStatus } from "~/lib/admission";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import { sendCoffeeChatOfferEmail } from "~/server/api/utils/coffee-chat-email";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

/**
 * Coffee chat notifications. The router calls notifyCoffeeChat after the DB
 * write has committed; each channel (email, Slack DM, sheet mirror) runs on
 * its own and a failure is logged, never thrown, so a notification can't
 * fail or hold up the sponsor's or hacker's action.
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
  hackerEmail: string | null;
  hackerFirstName: string;
  /** Accepted or confirmed (src/lib/admission.ts) right now. */
  admitted: boolean;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: CoffeeChatStatus;
};

export async function loadCoffeeChatNotice(
  chatId: string,
): Promise<CoffeeChatNotice | null> {
  const [row] = await db
    .select({
      chatId: coffeeChats.id,
      sponsorName: sponsorJudgingSponsors.name,
      email: users.email,
      userName: users.name,
      userType: users.type,
      firstName: applications.firstName,
      appStatus: applications.status,
      slotTime: coffeeChats.slotTime,
      durationMinutes: coffeeChats.durationMinutes,
      room: coffeeChats.room,
      status: coffeeChats.status,
    })
    .from(coffeeChats)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
    )
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .where(eq(coffeeChats.id, chatId));
  if (!row) return null;
  const hackerFirstName =
    [row.firstName, row.userName?.trim().split(/\s+/)[0]]
      .map((name) => name?.trim() ?? "")
      .find((name) => name.length > 0) ?? "";
  return {
    chatId: row.chatId,
    sponsorName: row.sponsorName,
    hackerEmail: row.email,
    hackerFirstName,
    admitted: row.userType === "hacker" && isAdmittedStatus(row.appStatus),
    slotTime: row.slotTime,
    durationMinutes: row.durationMinutes,
    room: row.room,
    status: row.status,
  };
}

/** The error's message only: never the request, headers, or credentials. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Channel = (
  event: CoffeeChatEvent,
  load: () => Promise<CoffeeChatNotice | null>,
) => Promise<unknown>;

const channels: Record<string, Channel> = {
  email: async (event, load) => {
    if (event !== "offered") return;
    const notice = await load();
    if (notice) await sendCoffeeChatOfferEmail(notice);
  },
};

/**
 * Tell everyone who needs to know about a chat change. Call after the DB
 * commit and don't await it (`void notifyCoffeeChat(...)`); the returned
 * promise never rejects, so tests can await it.
 */
export async function notifyCoffeeChat(
  event: CoffeeChatEvent,
  chat: { id: string },
): Promise<void> {
  // Loaded once, and only by channels that need it.
  let notice: Promise<CoffeeChatNotice | null> | undefined;
  const load = () => (notice ??= loadCoffeeChatNotice(chat.id));
  await Promise.all(
    Object.entries(channels).map(([name, send]) =>
      send(event, load).catch((error: unknown) => {
        console.error(
          `coffee chat ${name} notification failed (${event}):`,
          errorMessage(error),
        );
      }),
    ),
  );
}
