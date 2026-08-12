import type { SendEmailOptions, SendEmailResult } from "./mail";

/** Mailjet API key + secret for the sending (sub)account. */
export interface MailjetCreds {
  apiKey: string;
  secretKey: string;
}

/** Subset of the Mailjet Send API v3.1 response we care about. */
interface MailjetV31Response {
  Messages?: {
    Status?: string;
    To?: { Email?: string; MessageID?: string }[];
    Errors?: { ErrorMessage?: string; ErrorCode?: string }[];
  }[];
}

/**
 * Parse an RFC 5322 display-name address ("Name <email>") into Mailjet's
 * `{ Email, Name }` object, falling back to a bare `{ Email }`.
 */
export function parseAddress(input: string): { Email: string; Name?: string } {
  const match = /^\s*(.+?)\s*<([^>]+)>\s*$/.exec(input);
  if (match?.[1] && match[2]) {
    return { Email: match[2].trim(), Name: match[1].replace(/^"|"$/g, "") };
  }
  return { Email: input.trim() };
}

/**
 * Sends an outbound email via the Mailjet Send API v3.1.
 * POST https://api.mailjet.com/v3.1/send — Basic auth (apiKey:secretKey).
 *
 * NOTE vs Cloudflare: Mailjet does NOT report permanent bounces synchronously
 * in the send response — a hard bounce surfaces later via Mailjet's event API /
 * suppression list. So `bounced` here is always empty; the drip's
 * send-response bounce marking (scripts/send-campaign.ts classifyResult) goes
 * quiet on Mailjet and must be replaced by a suppression sync (see the
 * migration runbook). Mailjet still auto-suppresses known-bad addresses, so no
 * mail is sent to them.
 */
export async function sendViaMailjet(
  options: SendEmailOptions,
  creds: MailjetCreds,
): Promise<SendEmailResult> {
  const recipients = (
    Array.isArray(options.to) ? options.to : [options.to]
  ).map((email) => ({ Email: email }));
  const from = parseAddress(
    options.from ?? "Hack Western Team <hello@hackwestern.com>",
  );
  const auth = Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString(
    "base64",
  );

  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: from,
            To: recipients,
            Subject: options.subject,
            HTMLPart: options.html,
            TextPart: options.text ?? options.html.replace(/<[^>]*>?/gm, ""),
            ...(options.replyTo ? { ReplyTo: { Email: options.replyTo } } : {}),
            ...(options.headers ? { Headers: options.headers } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Mailjet API Error:", response.status, errorBody);
      return {
        data: null,
        error: {
          message: `Mailjet API error ${response.status}: ${errorBody}`,
        },
      };
    }

    const resData = (await response.json()) as MailjetV31Response;
    const message = resData.Messages?.[0];

    // Per-message failure surfaces as Status:"error" (HTTP is still 200).
    if (!message || message.Status !== "success") {
      const reason =
        message?.Errors?.[0]?.ErrorMessage ?? "Mailjet send failed";
      console.error("Mailjet send rejected:", message?.Errors);
      return { data: null, error: { message: reason } };
    }

    const delivered = (message.To ?? [])
      .map((t) => t.Email ?? "")
      .filter(Boolean);
    return { data: { delivered, queued: [], bounced: [] }, error: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Mailjet Fetch Error:", reason);
    return { data: null, error: { message: reason } };
  }
}
