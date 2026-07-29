import { env } from "~/env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  data: { id?: string; success?: boolean } | null;
  error: { message: string } | null;
}

/**
 * Sends an outbound email using Cloudflare Email Service REST API.
 * API Endpoint: POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send
 */
export const sendEmail = async (
  options: SendEmailOptions,
): Promise<SendEmailResult> => {
  const recipients = Array.isArray(options.to)
    ? options.to.map((email) => ({ email }))
    : [{ email: options.to }];

  const fromEmail = options.from ?? "Hack Western Team <hello@hackwestern.com>";

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
          to: recipients,
          from: { email: fromEmail },
          subject: options.subject,
          html: options.html,
          text: options.text ?? options.html.replace(/<[^>]*>?/gm, ""),
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Cloudflare Email API Error:", response.status, errorBody);
      return {
        data: null,
        error: { message: `Cloudflare Email API error ${response.status}: ${errorBody}` },
      };
    }

    const resData = (await response.json()) as { success?: boolean; result?: { id?: string } };
    return {
      data: { id: resData.result?.id ?? "cf-email-ok", success: resData.success },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cloudflare Email Fetch Error:", message);
    return {
      data: null,
      error: { message },
    };
  }
};
