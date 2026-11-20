import { TRPCError } from "@trpc/server";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { env } from "~/env";
import type { CoffeeChatAnswer } from "~/server/api/utils/coffee-chat-expiry";
import { loadCoffeeChatNotice } from "~/server/api/utils/coffee-chat-notify";
import { respondToCoffeeChat } from "~/server/api/utils/coffee-chat-respond";
import { db } from "~/server/db";
import { coffeeChats, users } from "~/server/db/schema";
import { slackApi, type SlackResponse } from "~/server/slack/client";
import {
  COFFEE_CHAT_ACCEPT_ACTION,
  COFFEE_CHAT_DECLINE_ACTION,
  coffeeChatDetailsBlock,
} from "~/server/slack/coffee-chat-dm";
import {
  handlePresentationConfirm,
  isPresentationConfirm,
} from "~/server/slack/presentation-interactions";
import { verifySlackRequest } from "~/server/slack/verify";

/**
 * Accept / Decline clicks from the coffee chat DM (T23), behind
 * /api/slack/interactions. The request must carry a valid Slack signature.
 * The click acts for the Slack user who clicked, matched to a hacker by
 * their Slack email, and only on that hacker's own chat; the answer goes
 * through the same rules as the /live buttons (respondToCoffeeChat).
 */

const copy = coffeeChatNotifyCopy.slack.result;

/**
 * Slack wants the HTTP answer within 3 s. Each slow step is capped, one after
 * another: users.info 0.6 s, the board lock wait for a session invite 0.8 s
 * (then a decline is saved without its refill and the next round fills the
 * seat), notify and the next hacker's invite 0.8 s (side by side),
 * response_url 0.6 s. Worst case about 2.8 s plus the DB queries, inside
 * Slack's 3 s in practice. If it ever misses, the answer is still saved and
 * the DM still updates through response_url.
 */
export const INTERACTION_STEP_TIMEOUT_MS = 600;
export const INTERACTION_NOTIFY_TIMEOUT_MS = 800;
export const INTERACTION_BOARD_LOCK_TIMEOUT_MS = 800;

const ANSWERS: Record<string, CoffeeChatAnswer> = {
  [COFFEE_CHAT_ACCEPT_ACTION]: "accept",
  [COFFEE_CHAT_DECLINE_ACTION]: "decline",
};

export const payloadSchema = z.object({
  type: z.string(),
  user: z.object({ id: z.string() }).optional(),
  response_url: z.string().optional(),
  channel: z.object({ id: z.string() }).optional(),
  container: z
    .object({ channel_id: z.string().optional() })
    .passthrough()
    .optional(),
  actions: z
    .array(z.object({ action_id: z.string(), value: z.string().optional() }))
    .optional(),
});

export type InteractionOutcome =
  | "ignored"
  | "accepted"
  | "declined"
  | "confirmed"
  | "changed"
  | "notYours"
  | "notPending"
  | "failed";

export type Deps = { token?: string; fetch?: typeof fetch; now?: Date };

export type UserInfo = SlackResponse & {
  user?: { profile?: { email?: string } };
};

/**
 * The hacker who owns `chatId` when the clicking Slack user is them: the
 * Slack account's email is their account email or the Slack email they
 * set on /live. Null otherwise.
 */
async function hackerForSlackUser(
  slackUserId: string,
  chatId: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const info = await slackApi<UserInfo>(
    token,
    "users.info",
    { user: slackUserId },
    fetchImpl,
    INTERACTION_STEP_TIMEOUT_MS,
  );
  const email = info.user?.profile?.email?.trim().toLowerCase();
  if (!email) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(coffeeChats)
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .where(
      and(
        eq(coffeeChats.id, chatId),
        or(
          sql`lower(${users.email}) = ${email}`,
          sql`lower(${users.slackEmail}) = ${email}`,
        ),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * True when the click came from a direct message with the bot (Slack DM
 * channel ids start with "D"). The offer buttons are only ever posted in
 * the DM the bot opened with the hacker it found (dmHacker).
 */
export function isDirectMessage(
  payload: z.infer<typeof payloadSchema>,
): boolean {
  const channelId = payload.channel?.id ?? payload.container?.channel_id;
  return typeof channelId === "string" && channelId.startsWith("D");
}

/** Post the result back to the DM through Slack's response_url. */
export async function reply(
  responseUrl: string | undefined,
  message: Record<string, unknown>,
  fetchImpl: typeof fetch,
) {
  // Only Slack's own hook host: never post to a URL from elsewhere.
  if (!responseUrl?.startsWith("https://hooks.slack.com/")) return;
  // The answer is already saved; a failed or slow update is only logged.
  try {
    const response = await fetchImpl(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(INTERACTION_STEP_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Slack response_url update failed: ${response.status}`);
    }
  } catch (error) {
    console.error(
      "Slack response_url update failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Replace the DM: chat details plus the result, no buttons. */
async function resultMessage(chatId: string, text: string) {
  const notice = await loadCoffeeChatNotice(chatId);
  return {
    replace_original: true,
    text,
    blocks: [
      ...(notice ? [coffeeChatDetailsBlock(notice)] : []),
      { type: "context", elements: [{ type: "mrkdwn", text }] },
    ],
  };
}

/** A note only the clicker sees; the DM and its buttons stay. */
export const ephemeral = (text: string) => ({
  response_type: "ephemeral",
  replace_original: false,
  text,
});

/** Act on one parsed interaction payload. */
export async function handleCoffeeChatInteraction(
  rawPayload: unknown,
  deps: Deps = {},
): Promise<InteractionOutcome> {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success || parsed.data.type !== "block_actions") return "ignored";
  const payload = parsed.data;
  const action = payload.actions?.find((a) => a.action_id in ANSWERS);
  if (!action) return "ignored";
  const answer = ANSWERS[action.action_id]!;
  const fetchImpl = deps.fetch ?? fetch;
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  const chatId = z.string().uuid().safeParse(action.value);

  const fail = async (outcome: "notYours" | "failed") => {
    await reply(payload.response_url, ephemeral(copy[outcome]), fetchImpl);
    return outcome;
  };

  if (!chatId.success || !payload.user) return fail("notYours");
  // Only a click in a 1:1 DM with the bot counts. The request is signed by
  // Slack, so a "D…" channel is the bot's DM with the clicker: the clicker
  // is the person the offer was DM'd to. That narrows a wrong Slack email
  // (docs/decisions.md, 2026-11-18) to the one person who got the DM.
  if (!isDirectMessage(payload)) return fail("notYours");
  if (!token) return fail("failed");

  let userId: string | null;
  try {
    userId = await hackerForSlackUser(
      payload.user.id,
      chatId.data,
      token,
      fetchImpl,
    );
  } catch (error) {
    console.error(
      "Slack users.info failed:",
      error instanceof Error ? error.message : String(error),
    );
    return fail("failed");
  }
  if (!userId) return fail("notYours");

  try {
    const result = await respondToCoffeeChat(
      userId,
      { chatId: chatId.data, answer },
      deps.now,
      INTERACTION_NOTIFY_TIMEOUT_MS,
      { boardLockTimeoutMs: INTERACTION_BOARD_LOCK_TIMEOUT_MS },
    );
    const outcome = result.status === "accepted" ? "accepted" : "declined";
    await reply(
      payload.response_url,
      await resultMessage(result.chatId, copy[outcome]),
      fetchImpl,
    );
    return outcome;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return fail("notYours");
    }
    if (error instanceof TRPCError && error.code === "CONFLICT") {
      await reply(
        payload.response_url,
        await resultMessage(chatId.data, copy.notPending),
        fetchImpl,
      );
      return "notPending";
    }
    console.error(
      "Slack coffee chat answer failed:",
      error instanceof Error ? error.message : String(error),
    );
    return fail("failed");
  }
}

/**
 * The whole endpoint minus Next.js: verify the signature over the raw body,
 * read the form-encoded `payload`, act on it. 401 when the signature is
 * missing, wrong, or stale; 400 when there's no readable payload.
 */
export async function handleSlackInteractionRequest(
  request: {
    rawBody: string;
    timestamp: string | string[] | undefined;
    signature: string | string[] | undefined;
  },
  deps: Deps & { signingSecret?: string } = {},
): Promise<{ status: number; outcome?: InteractionOutcome }> {
  const signingSecret =
    "signingSecret" in deps ? deps.signingSecret : env.SLACK_SIGNING_SECRET;
  if (
    !verifySlackRequest({
      signingSecret,
      timestamp: request.timestamp,
      signature: request.signature,
      rawBody: request.rawBody,
      now: deps.now,
    })
  ) {
    return { status: 401 };
  }
  const field = new URLSearchParams(request.rawBody).get("payload");
  let payload: unknown;
  try {
    payload = JSON.parse(field ?? "");
  } catch {
    return { status: 400 };
  }
  // The presentation DM's Confirm button; everything else is coffee chats.
  const outcome = isPresentationConfirm(payload)
    ? await handlePresentationConfirm(payload, deps)
    : await handleCoffeeChatInteraction(payload, deps);
  return { status: 200, outcome };
}
