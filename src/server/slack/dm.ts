import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

type LookupResponse = SlackResponse & { user?: { id?: string } };
type OpenResponse = SlackResponse & { channel?: { id?: string } };

/**
 * DM one person by their email: look them up, open the DM, post `message`
 * (chat.postMessage args minus `channel`). "not-found" when no Slack user
 * has that email. Any other Slack failure throws a SlackApiError.
 */
export async function dmByEmail(
  token: string,
  email: string,
  message: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "not-found"> {
  let slackUserId: string | undefined;
  try {
    const found = await slackApi<LookupResponse>(
      token,
      "users.lookupByEmail",
      { email },
      fetchImpl,
    );
    slackUserId = found.user?.id;
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "users_not_found") {
      return "not-found";
    }
    throw error;
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
