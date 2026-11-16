import type { NextApiRequest, NextApiResponse } from "next";

import { handleSlackEvent } from "~/server/slack/sponsor-help-events";

// Slack signs the exact bytes it sends, so read the raw body ourselves.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function header(req: NextApiRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Slack Events API endpoint (sponsor help claims; see the runbook). */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const result = await handleSlackEvent({
    rawBody: await readRawBody(req),
    timestamp: header(req, "x-slack-request-timestamp"),
    signature: header(req, "x-slack-signature"),
    retryNum: header(req, "x-slack-retry-num"),
  });
  return res.status(result.status).json(result.body);
}
