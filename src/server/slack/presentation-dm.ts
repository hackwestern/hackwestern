import { LIVE_URL } from "~/content/coffee-chat-notify";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { escapeSlackText } from "~/server/slack/client";
import { dmHacker } from "~/server/slack/dm";

const copy = sponsorPresentationsCopy.slack;

export type TeamPresentation = {
  sponsorName: string;
  room: string;
  /** Minutes after midnight on judging day. */
  start: number;
};

/** The DM: one line per presentation, in time order, and the /live link. */
export function presentationDmMessage(
  teamName: string,
  slots: readonly TeamPresentation[],
) {
  const lines = [...slots]
    .sort((a, b) => a.start - b.start)
    .map((s) =>
      copy.line(
        formatPresentationTime(s.start),
        escapeSlackText(s.sponsorName),
        escapeSlackText(s.room),
      ),
    );
  return {
    text: copy.text(teamName),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [copy.heading(escapeSlackText(teamName)), ...lines].join("\n"),
        },
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

export type PresentationDmResult = "sent" | "not-found" | "failed";

/**
 * Send one team member their presentation times; never throws. The single
 * place a presentation DM goes out, so a notification record can be
 * written beside it later. Same lookup as coffee chats: their Slack email
 * first, then the email they applied with.
 */
export async function sendPresentationDm(
  token: string,
  member: { email: string | null; slackEmail?: string | null },
  teamName: string,
  slots: readonly TeamPresentation[],
  fetchImpl: typeof fetch = fetch,
): Promise<PresentationDmResult> {
  if (!member.email) return "not-found";
  try {
    return await dmHacker(
      token,
      member,
      presentationDmMessage(teamName, slots),
      fetchImpl,
    );
  } catch (error) {
    console.error(
      "presentation slack DM failed:",
      error instanceof Error ? error.message : String(error),
    );
    return "failed";
  }
}
