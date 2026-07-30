import { env } from "~/env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Cloudflare's REST `from` accepts either a bare email string or a
 * `{ address, name }` object. Callers may pass an RFC 5322 display-name form
 * ("Name <email>"); split it into the object form so the sender name is
 * preserved, falling back to a bare string when there's no display name.
 */
const parseFrom = (
  from: string,
): string | { address: string; name: string } => {
  const match = /^\s*(.+?)\s*<([^>]+)>\s*$/.exec(from);
  if (match?.[1] && match[2]) {
    return { name: match[1].replace(/^"|"$/g, ""), address: match[2].trim() };
  }
  return from.trim();
};

/** Shape of the Cloudflare Email Sending REST response. */
interface CloudflareSendResponse {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: {
    delivered?: string[];
    permanent_bounces?: string[];
    queued?: string[];
  } | null;
}

export interface SendEmailResult {
  data: { delivered: string[]; queued: string[]; bounced: string[] } | null;
  error: { message: string } | null;
}

/**
 * Sends an outbound email using Cloudflare Email Service REST API.
 * API Endpoint: POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send
 */
export const sendEmail = async (
  options: SendEmailOptions,
): Promise<SendEmailResult> => {
  const from = parseFrom(
    options.from ?? "Hack Western Team <hello@hackwestern.com>",
  );

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: options.to,
          from,
          subject: options.subject,
          html: options.html,
          text: options.text ?? options.html.replace(/<[^>]*>?/gm, ""),
          // Cloudflare's `reply_to` is a first-class field, NOT a custom header.
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
          ...(options.headers ? { headers: options.headers } : {}),
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Cloudflare Email API Error:", response.status, errorBody);
      return {
        data: null,
        error: {
          message: `Cloudflare Email API error ${response.status}: ${errorBody}`,
        },
      };
    }

    const resData = (await response.json()) as CloudflareSendResponse;

    // Cloudflare can return HTTP 200 with success:false (e.g. unverified sender).
    if (resData.success === false) {
      const message =
        resData.errors?.[0]?.message ??
        "Cloudflare Email API returned success:false";
      console.error("Cloudflare Email API rejected send:", resData.errors);
      return { data: null, error: { message } };
    }

    const delivered = resData.result?.delivered ?? [];
    const queued = resData.result?.queued ?? [];
    const bounced = resData.result?.permanent_bounces ?? [];

    // Nothing delivered or queued, only bounces => the message reached no one.
    if (delivered.length === 0 && queued.length === 0 && bounced.length > 0) {
      return {
        data: null,
        error: { message: `Email permanently bounced: ${bounced.join(", ")}` },
      };
    }

    return { data: { delivered, queued, bounced }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cloudflare Email Fetch Error:", message);
    return {
      data: null,
      error: { message },
    };
  }
};
