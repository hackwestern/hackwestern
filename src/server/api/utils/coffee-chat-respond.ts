import { TRPCError } from "@trpc/server";
import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";

import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  answeredStatus,
  coffeeChatTimes,
  type CoffeeChatAnswer,
} from "~/server/api/utils/coffee-chat-expiry";
import {
  deliverInviteNotices,
  lockBoard,
  refillSeatsAfterNo,
  type InviteJob,
} from "~/server/api/utils/coffee-chat-invites";
import {
  NOTIFY_TIMEOUT_MS,
  notifyCoffeeChat,
} from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import { coffeeChats } from "~/server/db/schema";

/**
 * A hacker accepts or declines one of their own coffee chat requests (T16).
 * Shared by the tRPC `respond` mutation (/live) and the Slack buttons (T23).
 * Someone else's chat is a 404 (NOT_FOUND); an answer the rules don't allow
 * any more is a 409 (CONFLICT). Notifies (sheet mirror) after the commit,
 * waiting at most `notifyTimeoutMs` (Slack needs its answer within 3 s).
 *
 * Declining a session invite (it has a placement) offers the seat to the
 * next candidate in the same transaction, under the board lock like every
 * invite write (refillSeatsAfterNo); that hacker's invite goes out after
 * the commit (the delivery sweep retries it if this is cut off).
 */
export async function respondToCoffeeChat(
  userId: string,
  input: { chatId: string; answer: CoffeeChatAnswer },
  now: Date = new Date(),
  notifyTimeoutMs: number = NOTIFY_TIMEOUT_MS,
) {
  const result = await db.transaction(async (tx) => {
    const mine = and(
      eq(coffeeChats.id, input.chatId),
      eq(coffeeChats.userId, userId),
    );
    // A session invite: the board lock first, before the row lock, the
    // order a round takes them in.
    const [peek] = await tx
      .select({ placementId: coffeeChats.placementId })
      .from(coffeeChats)
      .where(mine);
    if (peek?.placementId) await lockBoard(tx);
    const [chat] = await tx
      .select({
        id: coffeeChats.id,
        sponsorId: coffeeChats.sponsorId,
        placementId: coffeeChats.placementId,
        status: coffeeChats.status,
        slotTime: coffeeChats.slotTime,
        expiresAt: coffeeChats.expiresAt,
      })
      .from(coffeeChats)
      .where(mine)
      .for("update");
    if (!chat) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: coffeeChatCopy.errors.chatNotFound,
      });
    }
    const next = answeredStatus(chat, input.answer, now);
    if (!next) {
      throw new TRPCError({
        code: "CONFLICT",
        message: coffeeChatCopy.errors.notPending,
      });
    }
    await tx
      .update(coffeeChats)
      .set({ status: next, respondedAt: now })
      .where(eq(coffeeChats.id, chat.id));
    // The seat goes to the next hacker now, not in a later round.
    const jobs: InviteJob[] =
      next === "declined" && chat.placementId
        ? await refillSeatsAfterNo(tx, chat.sponsorId, { now })
        : [];
    return {
      answer: {
        chatId: chat.id,
        ...coffeeChatTimes({ ...chat, status: next }, now),
      },
      jobs,
    };
  });
  const { answer, jobs } = result;
  // After the commit; capped in time, never throws. The next hacker's
  // invite keeps going after the cap (waitUntil); the sweep retries it.
  const delivery = jobs.length ? deliverInviteNotices(jobs) : null;
  if (delivery) waitUntil(delivery);
  const event = answer.status === "accepted" ? "accepted" : "declined";
  await Promise.all([
    notifyCoffeeChat(event, { id: answer.chatId }, notifyTimeoutMs),
    delivery && capped(delivery, notifyTimeoutMs),
  ]);
  return answer;
}

/** Wait for `work` at most `ms`. */
async function capped(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    work,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timer);
}
