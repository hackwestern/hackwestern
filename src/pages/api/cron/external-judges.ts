/**
 * Vercel cron (vercel.json, every 5 minutes): adds the external judges in
 * EXTERNAL_JUDGE_EMAILS as general judges as soon as they have a Hack Western
 * account (src/server/judging/external-judges.ts). Judges added here still
 * need Auto-assign before judging starts.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "~/env";
import {
  addListedJudges,
  parseJudgeEmails,
} from "~/server/judging/external-judges";

function isAuthorized(req: NextApiRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isAuthorized(req))
    return res.status(401).json({ error: "unauthorized" });
  const result = await addListedJudges(
    parseJudgeEmails(env.EXTERNAL_JUDGE_EMAILS),
  );
  if (result.added.length > 0) {
    console.log(`[external judges] added ${result.added.join(", ")}`);
  }
  return res.status(200).json({
    added: result.added.length,
    waiting: result.waiting.length,
  });
}
