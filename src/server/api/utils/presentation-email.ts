import { LIVE_URL } from "~/content/coffee-chat-notify";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { env } from "~/env";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import {
  emailButton,
  emailParagraph,
  emailShell,
  escapeHtml,
} from "~/server/api/utils/coffee-chat-email";
import { sendViaMailjet } from "~/server/mail-mailjet";
import type { TeamPresentation } from "~/server/slack/presentation-dm";

/**
 * The presentation times by email, for a team member Slack can't find
 * (docs/flows/sponsor-judging.md). Same times as the Slack DM, same
 * Mailjet path and layout as the coffee chat emails.
 */

const copy = sponsorPresentationsCopy.email;

/** First word of the member's name, or "" (greeting says "Hi there"). */
const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] ?? "";

export function presentationEmail(
  member: { name: string | null },
  teamName: string,
  slots: readonly TeamPresentation[],
) {
  const lines = [...slots]
    .sort((a, b) => a.start - b.start)
    .map((s) =>
      copy.line(formatPresentationTime(s.start), s.sponsorName, s.room),
    );
  const greeting = copy.greeting(firstName(member.name));
  const text = [
    greeting,
    "",
    copy.intro(teamName),
    "",
    ...lines,
    "",
    `${copy.action}: ${LIVE_URL}`,
    "",
    copy.signoff,
    "",
  ].join("\n");
  const html = emailShell([
    emailParagraph(escapeHtml(greeting)),
    emailParagraph(escapeHtml(copy.intro(teamName))),
    emailParagraph(lines.map(escapeHtml).join("<br>")),
    emailButton(LIVE_URL, copy.action),
    emailParagraph(escapeHtml(copy.signoff)),
  ]);
  return { subject: copy.subject(teamName), html, text };
}

export type PresentationEmailResult = "emailed" | "not-found" | "failed";

/**
 * Email one member their times; never throws. "not-found" when they have
 * no email address; "failed" when Mailjet isn't configured or rejects it.
 */
export async function sendPresentationEmail(
  member: { email: string | null; name: string | null },
  teamName: string,
  slots: readonly TeamPresentation[],
): Promise<PresentationEmailResult> {
  if (!member.email) return "not-found";
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error("presentation email skipped: Mailjet isn't configured");
    return "failed";
  }
  try {
    const { subject, html, text } = presentationEmail(member, teamName, slots);
    const { error } = await sendViaMailjet(
      { from: copy.from, to: member.email, subject, html, text },
      { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
    );
    if (error) {
      console.error("presentation email failed:", error.message);
      return "failed";
    }
    return "emailed";
  } catch (error) {
    console.error(
      "presentation email failed:",
      error instanceof Error ? error.message : String(error),
    );
    return "failed";
  }
}
