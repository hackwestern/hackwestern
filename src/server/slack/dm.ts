import { slackLookupEmails } from "~/lib/slack-email";
import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

type LookupResponse = SlackResponse & {
  user?: {
    id?: string;
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  };
};
type OpenResponse = SlackResponse & { channel?: { id?: string } };

/**
 * The Slack user with this email (id and the name Slack shows), or null
 * when no Slack user has it. Any other Slack failure throws a
 * SlackApiError.
 */
export async function lookupSlackUser(
  token: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs?: number,
): Promise<{ id: string; name: string | null } | null> {
  try {
    const found = await slackApi<LookupResponse>(
      token,
      "users.lookupByEmail",
      { email },
      fetchImpl,
      timeoutMs,
    );
    const user = found.user;
    if (!user?.id) return null;
    const name =
      [user.profile?.display_name, user.profile?.real_name, user.real_name]
        .map((n) => n?.trim() ?? "")
        .find((n) => n.length > 0) ?? null;
    return { id: user.id, name };
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "users_not_found") {
      return null;
    }
    throw error;
  }
}

/** The Slack user id for an email, or null (see lookupSlackUser). */
export async function findSlackUserId(
  token: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  return (await lookupSlackUser(token, email, fetchImpl))?.id ?? null;
}

/**
 * Open the bot's DM with the first Slack user found by `emails`, tried in
 * order. Null when no email matches a Slack user. Any other Slack failure
 * throws a SlackApiError.
 */
export async function openDmByEmails(
  token: string,
  emails: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  let slackUserId: string | null = null;
  for (const email of emails) {
    slackUserId = await findSlackUserId(token, email, fetchImpl);
    if (slackUserId) break;
  }
  if (!slackUserId) return null;

  const opened = await slackApi<OpenResponse>(
    token,
    "conversations.open",
    { users: slackUserId },
    fetchImpl,
  );
  const channel = opened.channel?.id;
  if (!channel) throw new SlackApiError("conversations.open", "no_channel");
  return channel;
}

/**
 * DM the first Slack user found by `emails` (openDmByEmails), then post
 * `message` (chat.postMessage args minus `channel`). "not-found" when no
 * email matches a Slack user. Any other Slack failure throws a
 * SlackApiError.
 */
export async function dmByEmails(
  token: string,
  emails: readonly string[],
  message: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "not-found"> {
  const channel = await openDmByEmails(token, emails, fetchImpl);
  if (!channel) return "not-found";
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
