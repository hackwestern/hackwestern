/**
 * Vercel cron (vercel.json, every minute): syncs both Slack ping bots with
 * their sheets. All the rules are in src/server/slack/pings-cron.ts; see
 * docs/vercel-pings.md for turning it on and switching over from the laptop.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls.
 */
import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "~/env";
import { runAutoPing } from "~/server/slack/auto-ping-run";
import { dbStore, withPingsLock } from "~/server/slack/bot-state-db";
import { runOrganizer } from "~/server/slack/organizer-run";
import { botSettings, decide, runPings } from "~/server/slack/pings-cron";

export const config = { maxDuration: 300 };

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

  // The bots read their settings (tokens, sheet keys, on-switches) by name.
  const settings = process.env as Record<string, string | undefined>;
  const decision = decide(settings);
  if (!decision.run) {
    if (decision.failed) console.error(`[pings] ${decision.reason}`);
    return res
      .status(decision.failed ? 500 : 200)
      .json({ skipped: decision.reason });
  }

  const bots = botSettings(settings, decision.dryRun);
  const result = await withPingsLock(() =>
    runPings(
      {
        env: bots,
        store: dbStore,
        organizer: (dryRun) =>
          runOrganizer("--sync", bots, {
            store: dbStore,
            dryRun,
            heartbeat: true,
          }),
        autoPingSync: (dryRun) => runAutoPing("--sync", bots, { dryRun }),
        autoPingFinal: (dryRun) =>
          runAutoPing("--send-final", bots, { dryRun }),
      },
      decision.dryRun,
    ),
  );
  if (!result)
    return res.status(200).json({ skipped: "another sync is running" });
  console.log(`[pings] ${JSON.stringify(result)}`);
  return res.status(result.failed ? 500 : 200).json(result);
}
