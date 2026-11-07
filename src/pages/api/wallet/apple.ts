import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { isUserApprovedForEvent } from "~/server/api/utils/approval";
import { getOrCreateHackerId } from "~/server/api/utils/hacker-id";
import { buildApplePass } from "~/server/wallet/apple-pass";

// Env vars may hold PEMs with literal "\n" instead of newlines.
const pem = (value: string) => value.replace(/\\n/g, "\n");

/**
 * Signs and returns the signed-in user's Apple Wallet pass. Served as a plain
 * file with the Wallet MIME type so iPhone Safari opens it straight in Wallet.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const session = await getServerAuthSession({ req, res });
  if (!session) {
    return res.status(401).send("Log in to get your Hack Western pass.");
  }
  const userId = session.user.id;

  // Same gate as the scanners: only admitted hackers (and organizers/sponsors)
  // get a pass, so nobody else ends up holding a working QR code.
  if (!(await isUserApprovedForEvent(userId))) {
    return res
      .status(403)
      .send("Only accepted hackers can get a Hack Western pass.");
  }

  const [user, application] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, type: true },
    }),
    db.query.applications.findFirst({
      where: eq(applications.userId, userId),
      columns: {
        firstName: true,
        lastName: true,
        school: true,
        schoolOther: true,
        realm: true,
      },
    }),
  ]);
  const hackerId = await getOrCreateHackerId(userId);

  const appName = [application?.firstName, application?.lastName]
    .filter(Boolean)
    .join(" ");
  const school =
    application?.school === "Other"
      ? application.schoolOther
      : application?.school;

  const pass = buildApplePass(
    {
      userId,
      hackerId,
      name: appName !== "" ? appName : (user?.name ?? "Hacker"),
      school: school ?? null,
      role: (user?.type ?? "hacker").toUpperCase(),
      realm: application?.realm ?? null,
    },
    req.query.look === "realm" ? "realm" : "teal",
    {
      wwdr: pem(env.APPLE_WWDR_CERT),
      signerCert: pem(env.APPLE_SIGNER_CERT),
      signerKey: pem(env.APPLE_SIGNER_KEY),
      signerKeyPassphrase: env.APPLE_CERT_PASS,
    },
  );

  res.setHeader("Content-Type", "application/vnd.apple.pkpass");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="hackwestern13.pkpass"',
  );
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(pass);
}
