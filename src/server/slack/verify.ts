import { createHmac, timingSafeEqual } from "crypto";

/**
 * Check that a request really came from Slack (signing secret, v0 scheme):
 * the `x-slack-signature` header must be `v0=` + HMAC-SHA256 of
 * `v0:{x-slack-request-timestamp}:{raw body}`, and the timestamp within five
 * minutes of now (stops replays). Compared in constant time.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */

export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

export function slackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
): string {
  const digest = createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  return `v0=${digest}`;
}

export function verifySlackRequest(opts: {
  signingSecret: string | undefined;
  timestamp: string | string[] | undefined;
  signature: string | string[] | undefined;
  rawBody: string;
  now?: Date;
}): boolean {
  const { signingSecret, timestamp, signature, rawBody } = opts;
  if (!signingSecret) return false;
  if (typeof timestamp !== "string" || typeof signature !== "string") {
    return false;
  }
  if (!/^\d+$/.test(timestamp)) return false;
  const nowSeconds = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (
    Math.abs(nowSeconds - Number(timestamp)) > SLACK_SIGNATURE_MAX_AGE_SECONDS
  ) {
    return false;
  }
  const expected = Buffer.from(
    slackSignature(signingSecret, timestamp, rawBody),
  );
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
