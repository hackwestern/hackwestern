import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";

import { db } from "~/server/db";

/**
 * Dev-only sign-in for testing on a phone (no console to paste a cookie).
 * Off unless NODE_ENV is development AND DEV_LOGIN_KEY is set; the link
 * must carry that key. Signs in as an existing local user (default the
 * walkthrough organizer) and redirects to the organizer home.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = process.env.DEV_LOGIN_KEY;
  if (process.env.NODE_ENV !== "development" || !key || req.query.key !== key) {
    res.status(404).end();
    return;
  }
  const id = typeof req.query.as === "string" ? req.query.as : "walkthrough-noah";
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) });
  if (!user) {
    res.status(404).end();
    return;
  }
  const token = await encode({
    token: { sub: user.id, name: user.name, email: user.email },
    secret: process.env.NEXTAUTH_SECRET ?? "local-dev-only-secret",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.setHeader(
    "Set-Cookie",
    `next-auth.session-token=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
  );
  res.redirect(302, "/internal/sponsors");
}
