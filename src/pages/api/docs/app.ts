/**
 * Serves the generated API/page map (`src/generated/app.json`).
 *
 * Not public: callers must send `Authorization: Bearer <APP_MAP_TOKEN>`. The
 * file lives under `src/`, not `public/`, so it is only reachable through here.
 * Regenerate with `npm run map:generate` (CI does this on every push to main).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "~/env";
import appMap from "~/generated/app.json";

const digest = (value: string) => createHash("sha256").update(value).digest();

function isAuthorized(req: NextApiRequest): boolean {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match || !env.APP_MAP_TOKEN) return false;
  // Hash first so the comparison is constant-time regardless of length.
  return timingSafeEqual(digest(match[1]!), digest(env.APP_MAP_TOKEN));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!env.APP_MAP_TOKEN) {
    return res.status(503).json({ message: "App map is not configured" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    ...appMap,
    meta: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      baseUrl: env.NEXTAUTH_URL ?? null,
    },
  });
}
