import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import {
  formatPresentationTime,
  PRESENTATION_PITCH_MINUTES,
  PRESENTATION_QA_MINUTES,
} from "~/lib/sponsor-presentations";
import { escapeSlackText } from "~/server/slack/client";
import { dmHacker } from "~/server/slack/dm";

const copy = sponsorPresentationsCopy.slack;

/** The DM's "Confirm our times" button (presentation-interactions.ts). */
export const PRESENTATION_CONFIRM_ACTION = "presentation_confirm";

/** What the Confirm button carries: the team and the times it was sent. */
export type ConfirmButtonValue = { teamId: string; key: string };

export const encodeConfirmValue = (v: ConfirmButtonValue) =>
  JSON.stringify({ t: v.teamId, k: v.key });

export function decodeConfirmValue(
  value: string | undefined,
): ConfirmButtonValue | null {
  try {
    const parsed = JSON.parse(value ?? "") as { t?: unknown; k?: unknown };
    return typeof parsed.t === "string" && typeof parsed.k === "string"
      ? { teamId: parsed.t, key: parsed.k }
      : null;
  } catch {
    return null;
  }
}

export type TeamPresentation = {
  sponsorName: string;
  room: string;
  /** Minutes after midnight on judging day. */
  start: number;
};

/**
 * The DM: one line per presentation, in time order, and the /live link.
 * With `confirm`, a "Confirm our times" button (one member's tap covers
 * the team); with `result`, that line in place of the button.
 */
export function presentationDmMessage(
  teamName: string,
  slots: readonly TeamPresentation[],
  {
    confirm,
    result,
  }: { confirm?: ConfirmButtonValue; result?: string } = {},
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
          {
            type: "mrkdwn",
            text: copy.footer(PRESENTATION_PITCH_MINUTES, PRESENTATION_QA_MINUTES),
          },
        ],
      },
      ...(confirm && !result
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  style: "primary",
                  action_id: PRESENTATION_CONFIRM_ACTION,
                  text: { type: "plain_text", text: copy.confirmButton },
                  value: encodeConfirmValue(confirm),
                },
              ],
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: copy.confirmHint }],
            },
          ]
        : []),
      ...(result
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: result }] }]
        : []),
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
  confirm?: ConfirmButtonValue,
): Promise<PresentationDmResult> {
  if (!member.email) return "not-found";
  try {
    return await dmHacker(
      token,
      member,
      presentationDmMessage(teamName, slots, { confirm }),
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
