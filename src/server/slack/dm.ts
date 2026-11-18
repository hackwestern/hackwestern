import { slackLookupEmails } from "~/lib/slack-email";
import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

type LookupResponse = SlackResponse & { user?: { id?: string } };
type OpenResponse = SlackResponse & { channel?: { id?: string } };

/**
 * The Slack user id for an email, or null when no Slack user has it. Any
 * other Slack failure throws a SlackApiError.
 */
export async function findSlackUserId(
  token: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const found = await slackApi<LookupResponse>(
      token,
      "users.lookupByEmail",
      { email },
      fetchImpl,
    );
    return found.user?.id ?? null;
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "users_not_found") {
      return null;
    }
    throw error;
  }
}

/**
 * DM the first Slack user found by `emails`, tried in order: look them up,
 * open the DM, post `message` (chat.postMessage args minus `channel`).
 * "not-found" when no email matches a Slack user. Any other Slack failure
 * throws a SlackApiError.
 */
export async function dmByEmails(
  token: string,
  emails: readonly string[],
  message: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "not-found"> {
  let slackUserId: string | null = null;
  for (const email of emails) {
    slackUserId = await findSlackUserId(token, email, fetchImpl);
    if (slackUserId) break;
  }
  if (!slackUserId) return "not-found";

  const opened = await slackApi<OpenResponse>(
    token,
    "conversations.open",
    { users: slackUserId },
    fetchImpl,
  );
  const channel = opened.channel?.id;
  if (!channel) throw new SlackApiError("conversations.open", "no_channel");

  await slackApi(token, "chat.postMessage", { channel, ...message }, fetchImpl);
  return "sent";
}

/**
 * DM a hacker: found by the email they use on Slack first, then the email
 * they applied with (src/lib/slack-email.ts). Every hacker DM goes
 * through here.
 */
export function dmHacker(
  token: string,
  hacker: { slackEmail?: string | null; email: string | null },
  message: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "not-found"> {
  return dmByEmails(token, slackLookupEmails(hacker), message, fetchImpl);
}
