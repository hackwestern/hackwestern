import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { createCsvFile } from "~/utils/csv";

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

const paramsSchema = z.object({
  format: z.enum(["json", "csv"]),
});

async function GET(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerAuthSession({ req, res });
    console.log(session);

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

    const format = paramsSchema.parse(req.query).format;

    if (format === "csv") {
      return csvHandler(res);
    }

    return jsonHandler(res);
  } catch (e) {
    console.log(
      `Something went wrong while responding to api/preregistration/all`,
      e,
    );
    return res.status(500).send({ message: "Internal server error" });
  }
}

async function jsonHandler(res: NextApiResponse) {
  const preregistrations = await db.query.preregistrations.findMany();

  return res.status(200).json(preregistrations);
}

const FILE_NAME = "preregistrations.csv";

async function csvHandler(res: NextApiResponse) {
  const preregistrations = await db.query.preregistrations.findMany();
  const fileString = createCsvFile(preregistrations);

  res.setHeader("Content-disposition", `attachment; filename=${FILE_NAME}`);
  res.setHeader("Content-Type", "text/csv; charset=UTF-8");

  res.send(fileString);
}
