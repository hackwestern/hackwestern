import {
  coffeeChatExpiresAt,
  coffeeChatStartsAt,
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";

/**
 * Expiry and answering rules for a hacker's coffee chat request (T16).
 * Expiry is computed on read: a stored "pending" past 20 minutes before the
 * chat reads as "expired" (effectiveCoffeeChatStatus), so no background job
 * is needed and an expired request can never be accepted.
 */

export type CoffeeChatAnswer = "accept" | "decline";

type ChatClock = { status: CoffeeChatStatus; slotTime: string };

/** A chat as shown right now: effective status plus its key times (ISO). */
export function coffeeChatTimes(chat: ChatClock, now: Date = new Date()) {
  return {
    status: effectiveCoffeeChatStatus(chat, now),
    startsAt: coffeeChatStartsAt(chat.slotTime).toISOString(),
    expiresAt: coffeeChatExpiresAt(chat.slotTime).toISOString(),
  };
}

/**
 * The status an answer moves the chat to, or null when it can't be given.
 * Accept: only while pending (not expired). Decline: while pending, or
 * after accepting as long as the chat hasn't started (frees the seat).
 */
export function answeredStatus(
  chat: ChatClock,
  answer: CoffeeChatAnswer,
  now: Date = new Date(),
): "accepted" | "declined" | null {
  const status = effectiveCoffeeChatStatus(chat, now);
  if (answer === "accept") return status === "pending" ? "accepted" : null;
  if (status === "pending") return "declined";
  if (status === "accepted" && now < coffeeChatStartsAt(chat.slotTime)) {
    return "declined";
  }
  return null;
}
