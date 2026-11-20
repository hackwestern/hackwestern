import type { NextApiRequest, NextApiResponse } from "next";

import { handleSlackInteractionRequest } from "~/server/slack/coffee-chat-interactions";

/**
 * Slack interactivity Request URL (docs/runbooks/slack-coffee-chat-bot.md):
 * Accept / Decline clicks on the coffee chat DM. The signature covers the
 * raw body, so Next's body parser is off. Logic and tests live in
 * src/server/slack/coffee-chat-interactions.ts.
 */
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer),
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  const { status } = await handleSlackInteractionRequest({
    rawBody: await readRawBody(req),
    timestamp: req.headers["x-slack-request-timestamp"],
    signature: req.headers["x-slack-signature"],
  });
  return res.status(status).end();
}
