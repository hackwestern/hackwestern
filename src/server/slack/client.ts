/**
 * A tiny Slack Web API client over fetch (no SDK). Arguments go form-encoded,
 * which every method accepts; objects (like `blocks`) are sent as JSON
 * strings. The token goes in the Authorization header, never in a log.
 */

export type SlackResponse = { ok: boolean; error?: string } & Record<
  string,
  unknown
>;

export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
    /** Seconds Slack asked us to wait (Retry-After on a 429). */
    readonly retryAfter: number | null = null,
  ) {
    super(`Slack ${method} failed: ${code}`);
    this.name = "SlackApiError";
  }
}

/** Per-request cap, inside the notifier's overall cap. */
export const SLACK_TIMEOUT_MS = 2000;

/**
 * Call one Slack method. Resolves with the body when `ok`, otherwise throws
 * a SlackApiError carrying Slack's error code (e.g. "users_not_found").
 */
export async function slackApi<T extends SlackResponse = SlackResponse>(
  token: string,
  method: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = SLACK_TIMEOUT_MS,
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    body.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const response = await fetchImpl(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const wait = Number(response.headers.get("retry-after"));
    throw new SlackApiError(
      method,
      `http_${response.status}`,
      Number.isFinite(wait) && wait >= 0 ? wait : null,
    );
  }
  const data = (await response.json()) as T;
  if (!data.ok) throw new SlackApiError(method, data.error ?? "unknown_error");
  return data;
}

/** Escape text for Slack mrkdwn (&, <, > are control characters). */
export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
