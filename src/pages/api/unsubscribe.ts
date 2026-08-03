import type { NextApiRequest, NextApiResponse } from "next";
import { unsubscribeByToken } from "~/server/subscribers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token =
    (req.query.token as string | undefined) ??
    (typeof req.body === "object" && req.body
      ? ((req.body as Record<string, unknown>).token as string | undefined)
      : undefined);

  // RFC 8058 one-click unsubscribe (used by the List-Unsubscribe header).
  if (req.method === "POST") {
    if (!token) return res.status(400).end();
    const matched = await unsubscribeByToken(token);
    return res.status(matched ? 200 : 404).end();
  }

  // GET (someone opened the header URL in a browser) → the on-brand page,
  // which performs + confirms the unsubscribe.
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return res.redirect(307, `/unsubscribe${q}`);
}
