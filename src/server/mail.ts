import { env } from "~/env";
import { sendViaMailjet } from "./mail-mailjet";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  data: { delivered: string[]; queued: string[]; bounced: string[] } | null;
  error: { message: string } | null;
}

/**
 * Sends an outbound email via Mailjet (Send API v3.1). All app email —
 * transactional (signup/verify/reset/application confirmations) and the
 * re-engagement drip — flows through here. Sender identity is set per call via
 * `options.from`; transactional and marketing use distinct sending subdomains
 * (and, in Mailjet, distinct subaccounts) so a marketing-complaint spike can't
 * sink transactional deliverability.
 */
export const sendEmail = async (
  options: SendEmailOptions,
): Promise<SendEmailResult> => {
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    const message =
      "Email not sent: MAILJET_API_KEY / MAILJET_SECRET_KEY are not configured.";
    console.error(message);
    return { data: null, error: { message } };
  }

  return sendViaMailjet(options, {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  });
};
