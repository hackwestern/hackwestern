/**
 * Which email a hacker is found by on Slack, and where their email notices
 * go (docs/decisions.md, 2026-11-18). Pure, so the rule is unit tested.
 *
 * - Slack: the email they said they use on Slack (set on /live) first,
 *   then the email they applied with.
 * - Email (Mailjet), when Slack can't find them with either: always the
 *   email they applied with, never the Slack email.
 */

import { z } from "zod";

/** Same limit as the column (user.slack_email). */
export const SLACK_EMAIL_MAX = 255;

/** Trimmed and lowercased, like account emails (normalizeAuthEmail). */
export const canonicalEmail = (raw: string) => raw.trim().toLowerCase();

/**
 * What to store for a Slack email the hacker typed: null when blank or the
 * same as their account email (nothing to try first).
 */
export function slackEmailToStore(
  raw: string | null | undefined,
  accountEmail: string | null | undefined,
): string | null {
  const email = canonicalEmail(raw ?? "");
  if (!email) return null;
  if (accountEmail && email === canonicalEmail(accountEmail)) return null;
  return email;
}

/**
 * The emails to look the hacker up by on Slack, in order: Slack email,
 * then application email. No blanks, no repeats.
 */
export function slackLookupEmails(hacker: {
  slackEmail?: string | null;
  email: string | null;
}): string[] {
  const out: string[] = [];
  for (const raw of [hacker.slackEmail, hacker.email]) {
    const email = raw?.trim();
    if (!email) continue;
    if (out.some((e) => canonicalEmail(e) === canonicalEmail(email))) continue;
    out.push(email);
  }
  return out;
}

/**
 * What the hacker may submit: blank (clears it) or an email. Checked on
 * /live before sending and again by the server; `message` is the copy.
 */
export const slackEmailInput = (message: string) =>
  z
    .string()
    .trim()
    .max(SLACK_EMAIL_MAX, message)
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      message,
    );
