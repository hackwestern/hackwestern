import { TRPCError } from "@trpc/server";
import { waitUntil } from "@vercel/functions";
import { and, eq, sql } from "drizzle-orm";

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
  options: RespondOptions = {},
) {
  const { answer, jobs } = await recordAnswer(
    userId,
    input,
    now,
    options.boardLockTimeoutMs,
  );
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

export type RespondOptions = {
  /**
   * Slack only (its 3 s budget): wait at most this long for the board lock.
   * When it runs out, a decline is saved without its refill and the next
   * round (every 10 minutes, plus traffic) offers the seat.
   */
  boardLockTimeoutMs?: number;
};

/** Postgres SQLSTATE for a lock wait past lock_timeout (or NOWAIT). */
const LOCK_NOT_AVAILABLE = "55P03";

/**
 * Save the answer. A board lock wait past `boardLockTimeoutMs` saves a
 * decline again in a second, short transaction without the board lock and
 * without the refill: the chat row alone (NOWAIT, so it never waits twice).
 * A round that held the board lock meanwhile still counts the seat as taken,
 * so at worst the seat waits for the next round. An accept that times out
 * fails (the hacker can click again).
 */
async function recordAnswer(
  userId: string,
  input: { chatId: string; answer: CoffeeChatAnswer },
  now: Date,
  boardLockTimeoutMs: number | undefined,
) {
  try {
    return await onceMoreOnDeadlock(() =>
      answerInTransaction(userId, input, now, { boardLockTimeoutMs }),
    );
  } catch (error) {
    if (
      boardLockTimeoutMs === undefined ||
      input.answer !== "decline" ||
      !hasPgCode(error, LOCK_NOT_AVAILABLE)
    ) {
      throw error;
    }
    console.warn(
      "coffee chat decline: board busy past the Slack budget; saved without the refill",
    );
    return answerInTransaction(userId, input, now, { withoutBoard: true });
  }
}

/** Record the answer (and a decline's refill) in one transaction. */
async function answerInTransaction(
  userId: string,
  input: { chatId: string; answer: CoffeeChatAnswer },
  now: Date,
  mode: { boardLockTimeoutMs?: number; withoutBoard?: boolean },
) {
  return db.transaction(async (tx) => {
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
    if (peek?.placementId && !mode.withoutBoard) {
      if (mode.boardLockTimeoutMs !== undefined) {
        // Every lock wait from here on, the board lock first (55P03 after).
        const ms = Math.max(1, Math.round(mode.boardLockTimeoutMs));
        await tx.execute(sql.raw(`set local lock_timeout = '${ms}ms'`));
      }
      await lockBoard(tx);
    }
    const row = tx
      .select({
        id: coffeeChats.id,
        sponsorId: coffeeChats.sponsorId,
        placementId: coffeeChats.placementId,
        status: coffeeChats.status,
        slotTime: coffeeChats.slotTime,
        expiresAt: coffeeChats.expiresAt,
      })
      .from(coffeeChats)
      .where(mine);
    const [chat] = mode.withoutBoard
      ? await row.for("update", { noWait: true })
      : await row.for("update");
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
      next === "declined" && chat.placementId && !mode.withoutBoard
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
}

/** Postgres SQLSTATE for a deadlock: the victim's transaction is rolled back. */
const DEADLOCK_DETECTED = "40P01";

/** True when `error` (or anything down its cause chain) has this SQLSTATE. */
export function hasPgCode(error: unknown, code: string): boolean {
  let e: unknown = error;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === code) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Run `work` (one whole transaction) once more when Postgres rolled it back
 * as a deadlock victim. Every writer takes the board lock, then the sponsor
 * row, then the chat row, so this is a safety net, not the plan.
 */
async function onceMoreOnDeadlock<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!hasPgCode(error, DEADLOCK_DETECTED)) throw error;
    return work();
  }
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
