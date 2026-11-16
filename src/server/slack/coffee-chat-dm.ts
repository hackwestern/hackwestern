import { LIVE_URL, coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { env } from "~/env";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import type { CoffeeChatNotice } from "~/server/api/utils/coffee-chat-notify";
import {
  SlackApiError,
  escapeSlackText,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

/**
 * Slack DM to a hacker when a sponsor offers a coffee chat (T22), with
 * Accept / Decline buttons that post to /api/slack/interactions (T23).
 * Skipped silently when SLACK_BOT_TOKEN is unset or Slack has no account
 * for the hacker's email; email and /live still cover them.
 */

export const COFFEE_CHAT_ACCEPT_ACTION = "coffee_chat_accept";
export const COFFEE_CHAT_DECLINE_ACTION = "coffee_chat_decline";

const copy = coffeeChatNotifyCopy.slack;

type ChatDetails = Pick<
  CoffeeChatNotice,
  "chatId" | "sponsorName" | "slotTime" | "durationMinutes" | "room"
>;

/** The chat's details as a Slack section block. */
export function coffeeChatDetailsBlock(chat: ChatDetails) {
  const when = coffeeChatNotifyCopy.when(
    formatCoffeeChatTime(chat.slotTime),
    chat.durationMinutes,
  );
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: copy.body(
        escapeSlackText(chat.sponsorName),
        when,
        escapeSlackText(chat.room ?? coffeeChatNotifyCopy.roomTba),
      ),
    },
  };
}

/** The DM: details, Accept / Decline buttons (value = chat id), /live link. */
export function coffeeChatDmMessage(chat: ChatDetails) {
  return {
    text: copy.text(chat.sponsorName),
    blocks: [
      coffeeChatDetailsBlock(chat),
      {
        type: "actions",
        block_id: "coffee_chat_answer",
        elements: [
          {
            type: "button",
            action_id: COFFEE_CHAT_ACCEPT_ACTION,
            style: "primary",
            text: { type: "plain_text", text: copy.accept },
            value: chat.chatId,
          },
          {
            type: "button",
            action_id: COFFEE_CHAT_DECLINE_ACTION,
            text: { type: "plain_text", text: copy.decline },
            value: chat.chatId,
          },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `${copy.footer} <${LIVE_URL}|${LIVE_URL}>` },
        ],
      },
    ],
  };
}

type LookupResponse = SlackResponse & { user?: { id?: string } };
type OpenResponse = SlackResponse & { channel?: { id?: string } };

/**
 * Send the offer DM. Returns false (no error) when skipped: no token, not
 * admitted, no email, or no Slack account with that email. Other Slack
 * errors throw so the caller logs them.
 */
export async function sendCoffeeChatDm(
  chat: CoffeeChatNotice,
  deps: { token?: string; fetch?: typeof fetch } = {},
): Promise<boolean> {
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  const fetchImpl = deps.fetch ?? fetch;
  if (!token || !chat.admitted || !chat.hackerEmail) return false;

  let slackUserId: string | undefined;
  try {
    const found = await slackApi<LookupResponse>(
      token,
      "users.lookupByEmail",
      { email: chat.hackerEmail },
      fetchImpl,
    );
    slackUserId = found.user?.id;
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "users_not_found") {
      return false;
    }
    throw error;
  }
  if (!slackUserId) return false;

  const opened = await slackApi<OpenResponse>(
    token,
    "conversations.open",
    { users: slackUserId },
    fetchImpl,
  );
  const channel = opened.channel?.id;
  if (!channel) throw new SlackApiError("conversations.open", "no_channel");

  await slackApi(
    token,
    "chat.postMessage",
    { channel, ...coffeeChatDmMessage(chat) },
    fetchImpl,
  );
  return true;
}
