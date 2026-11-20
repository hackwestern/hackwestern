import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { resolveScannedUserId } from "~/server/api/utils/hacker-id";
import { eq } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Check if user is authenticated as organizer
  const session = await getServerAuthSession({ req, res });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fetch user from database to check their type
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!dbUser || dbUser.type !== "organizer") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ message: "userId is required" });
    }

    // Badges and wallet passes carry the hacker ID, not the account id
    const user = await db.query.users.findFirst({
      where: eq(users.id, await resolveScannedUserId(userId)),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // The application name matches their photo ID at check-in; the account
    // name is empty for email sign-ups and can be a nickname otherwise
    const application = await db.query.applications.findFirst({
      where: eq(applications.userId, user.id),
      columns: {
        firstName: true,
        lastName: true,
        realm: true,
        shirtSize: true,
      },
    });
    const appName = [application?.firstName, application?.lastName]
      .filter(Boolean)
      .join(" ");

    return res.status(200).json({
      id: user.id,
      name: appName || user.name,
      email: user.email,
      realm: application?.realm ?? null,
      shirtSize: application?.shirtSize ?? null,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      message: "Failed to fetch user: " + JSON.stringify(error),
    });
  }
}
