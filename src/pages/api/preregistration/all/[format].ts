import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { db } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  switch (req.method) {
    case "GET":
      return await GET(req, res);
    default:
      return res.status(405).json({ message: "Method not allowed" });
  }
}

const formatQuerySchema = z.enum(["json", "csv"]);

async function GET(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession();

    if (!session) return res.status(401).json({ message: "Unauthorized" });
    if (!session.user)
      return res.status(404).json({ message: "User not found" });

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id),
    });
    const userType = user?.type;

    if (userType !== "organizer") {
      return res.status(403).json({ message: "Not an organizer. Forbidden." });
    }

    const format = formatQuerySchema.parse(req.query?.format);

    if (format === "json") {
      return jsonHandler(req, res);
    }

    if (format === "csv") {
      return csvHandler(req, res);
    }
  } catch (e) {
    console.log(
      `Something went wrong while responding to api/preregistration/all`,
      e,
    );
    return res.status(500).send({ message: "Internal server error" });
  }
}

async function jsonHandler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: finish body
}

async function csvHandler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: finish body
}
