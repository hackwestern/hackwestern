import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { LIVE_URL, coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { env } from "~/env";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import { inviteText } from "~/server/api/utils/coffee-chat-invite-text";
import type { CoffeeChatNotice } from "~/server/api/utils/coffee-chat-notify";
import { sendViaMailjet } from "~/server/mail-mailjet";
import {
  coffeeChatChangeText,
  type CoffeeChatChangeEvent,
} from "~/server/api/utils/coffee-chat-change-text";

/**
 * The email a hacker gets when a sponsor offers them a coffee chat (T17).
 * One per offer, only to admitted hackers; they answer on /live.
 */

const copy = coffeeChatNotifyCopy.email;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A paragraph of the Hack Western email layout; `inner` is HTML. */
export const emailParagraph = (inner: string) =>
  `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0b2238">${inner}</p>`;

/** The layout's one call-to-action button. */
export const emailButton = (href: string, label: string) =>
  `<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#0b6bc4;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(label)}</a></p>`;

/** The card the blocks (already HTML) sit in. */
export const emailShell = (blocks: readonly string[]) =>
  `<div style="background-color:#f3f7fc;padding:24px 0"><div style="margin:0 auto;max-width:560px;background:#ffffff;border-radius:12px;padding:32px">${blocks.join("")}</div></div>`;

type OfferDetails = Pick<
  CoffeeChatNotice,
  "sponsorName" | "hackerFirstName" | "slotTime" | "durationMinutes" | "room"
> &
  Partial<
    Pick<CoffeeChatNotice, "placementId" | "repName" | "expiresAt" | "group">
  > & {
    /** A changed session invite the hacker must confirm again. */
    reconfirm?: boolean;
  };

/** A session invite (coffee-chat-invites): rep, building, answer-by. */
export function sessionInviteEmail(chat: OfferDetails) {
  const inv = coffeeChatInvitesCopy.email;
  const { when, where, answerBy } = inviteText({
    sponsorName: chat.sponsorName,
    slotTime: chat.slotTime,
    durationMinutes: chat.durationMinutes,
    room: chat.room,
    repName: chat.repName ?? null,
    expiresAt: chat.expiresAt ?? null,
  });
  const subject = chat.reconfirm
    ? inv.reconfirmSubject(chat.sponsorName)
    : inv.subject(chat.sponsorName, chat.group);
  const intro = inv.intro(chat.sponsorName, chat.repName ?? null, chat.group);
  const deadline = inv.deadline(answerBy ?? when);
  const lines: [string, string][] = [
    [copy.whenLabel, when],
    [copy.whereLabel, where],
    ...(chat.repName
      ? ([[inv.repLabel, chat.repName]] as [string, string][])
      : []),
    ...(answerBy
      ? ([[inv.answerByLabel, answerBy]] as [string, string][])
      : []),
  ];
  const text = [
    copy.greeting(chat.hackerFirstName),
    "",
    ...(chat.reconfirm ? [inv.reconfirm, ""] : []),
    intro,
    "",
    ...lines.map(([k, v]) => `${k}: ${v}`),
    "",
    `${copy.action}: ${LIVE_URL}`,
    "",
    deadline,
    "",
    copy.signoff,
    "",
  ].join("\n");
  const p = emailParagraph;
  const html = emailShell([
    p(escapeHtml(copy.greeting(chat.hackerFirstName))),
    ...(chat.reconfirm
      ? [p(`<strong>${escapeHtml(inv.reconfirm)}</strong>`)]
      : []),
    p(escapeHtml(intro)),
    p(
      lines
        .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`)
        .join("<br>"),
    ),
    emailButton(LIVE_URL, copy.action),
    p(escapeHtml(deadline)),
    p(escapeHtml(copy.signoff)),
  ]);
  return { subject, html, text };
}

export function coffeeChatOfferEmail(chat: OfferDetails) {
  if (chat.placementId) return sessionInviteEmail(chat);
  const when = coffeeChatNotifyCopy.when(
    formatCoffeeChatTime(chat.slotTime),
    chat.durationMinutes,
  );
  const where = chat.room ?? coffeeChatNotifyCopy.roomTba;
  const subject = copy.subject(chat.sponsorName);

  const text = [
    copy.greeting(chat.hackerFirstName),
    "",
    copy.intro(chat.sponsorName),
    "",
    `${copy.whenLabel}: ${when}`,
    `${copy.whereLabel}: ${where}`,
    "",
    `${copy.action}: ${LIVE_URL}`,
    "",
    copy.deadline,
    "",
    copy.signoff,
    "",
  ].join("\n");

  const p = emailParagraph;
  const html = emailShell([
    p(escapeHtml(copy.greeting(chat.hackerFirstName))),
    p(escapeHtml(copy.intro(chat.sponsorName))),
    p(
      `<strong>${escapeHtml(copy.whenLabel)}:</strong> ${escapeHtml(when)}<br><strong>${escapeHtml(copy.whereLabel)}:</strong> ${escapeHtml(where)}`,
    ),
    emailButton(LIVE_URL, copy.action),
    p(escapeHtml(copy.deadline)),
    p(escapeHtml(copy.signoff)),
  ]);

  return { subject, html, text };
}

export function coffeeChatChangeEmail(
  event: CoffeeChatChangeEvent,
  chat: OfferDetails,
) {
  const change = coffeeChatNotifyCopy.change;
  const subject = change.emailSubject[event](chat.sponsorName);
  const line = coffeeChatChangeText(event, chat);
  const text = [
    copy.greeting(chat.hackerFirstName),
    "",
    line,
    "",
    `${change.emailAction}: ${LIVE_URL}`,
    "",
    copy.signoff,
    "",
  ].join("\n");
  const p = emailParagraph;
  const html = emailShell([
    p(escapeHtml(copy.greeting(chat.hackerFirstName))),
    p(escapeHtml(line)),
    emailButton(LIVE_URL, change.emailAction),
    p(escapeHtml(copy.signoff)),
  ]);
  return { subject, html, text };
}

/** Same skips and errors as sendCoffeeChatOfferEmail. */
export async function sendCoffeeChatChangeEmail(
  event: CoffeeChatChangeEvent,
  chat: CoffeeChatNotice,
): Promise<boolean> {
  if (!chat.admitted || !chat.hackerEmail) return false;
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) return false;
  const { subject, html, text } = coffeeChatChangeEmail(event, chat);
  const { error } = await sendViaMailjet(
    { from: copy.from, to: chat.hackerEmail, subject, html, text },
    { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
  );
  if (error) throw new Error(`Mailjet send failed: ${error.message}`);
  return true;
}

/**
 * Send the offer email. Skipped (returns false) for anyone not admitted,
 * with no email address, or when Mailjet isn't configured. Throws when
 * Mailjet rejects the send, so the caller logs it.
 */
export async function sendCoffeeChatOfferEmail(
  chat: CoffeeChatNotice & { reconfirm?: boolean },
): Promise<boolean> {
  if (!chat.admitted || !chat.hackerEmail) return false;
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) return false;
  const { subject, html, text } = coffeeChatOfferEmail(chat);
  const { error } = await sendViaMailjet(
    { from: copy.from, to: chat.hackerEmail, subject, html, text },
    { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
  );
  if (error) throw new Error(`Mailjet send failed: ${error.message}`);
  return true;
}
