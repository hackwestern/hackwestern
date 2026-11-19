import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  answeredStatus,
  coffeeChatTimes,
  type CoffeeChatAnswer,
} from "~/server/api/utils/coffee-chat-expiry";
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
 */
export async function respondToCoffeeChat(
  userId: string,
  input: { chatId: string; answer: CoffeeChatAnswer },
  now: Date = new Date(),
  notifyTimeoutMs: number = NOTIFY_TIMEOUT_MS,
) {
  const result = await db.transaction(async (tx) => {
    const [chat] = await tx
      .select({
        id: coffeeChats.id,
        status: coffeeChats.status,
        slotTime: coffeeChats.slotTime,
        expiresAt: coffeeChats.expiresAt,
      })
      .from(coffeeChats)
      .where(
        and(eq(coffeeChats.id, input.chatId), eq(coffeeChats.userId, userId)),
      )
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
    return {
      chatId: chat.id,
      ...coffeeChatTimes({ ...chat, status: next }, now),
    };
  });
  // After the commit; capped in time, never throws.
  const event = result.status === "accepted" ? "accepted" : "declined";
  await notifyCoffeeChat(event, { id: result.chatId }, notifyTimeoutMs);
  return result;
}
