import type { NextApiRequest, NextApiResponse } from "next";
import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// A judge's request can wait behind the round-end queue of submits; give it
// time instead of the platform's short default (same as the sweep route).
export const config = { maxDuration: 60 };

// Procedures that send an email. One batched request may call each at most
// once, so the firewall's per-request rate limit also limits emails.
const EMAIL_PROCEDURES = new Set([
  "auth.reset",
  "auth.create",
  "auth.resendEmail",
  "preregistration.create",
]);

const handler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});

export default function trpcHandler(req: NextApiRequest, res: NextApiResponse) {
  const paths = String(req.query.trpc ?? "").split(",");
  const emailPaths = paths.filter((path) => EMAIL_PROCEDURES.has(path));
  if (emailPaths.length > 1) {
    res.status(400).json({ error: "Too many email requests in one batch" });
    return;
  }
  return handler(req, res);
}
