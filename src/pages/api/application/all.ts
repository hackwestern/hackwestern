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
  mlh: z.string().length(0).optional(),
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

    const params = paramsSchema.parse(req.query);
    const format = params.format;
    const isMlh = params.mlh === "" || !!params.mlh;

    if (format === "csv") {
      return csvHandler(isMlh, res);
    }

    return jsonHandler(isMlh, res);
  } catch (e) {
    console.log(
      `Something went wrong while responding to api/preregistration/all`,
      e,
    );
    return res.status(500).send({ message: "Internal server error" });
  }
}

function getMlhApplications() {
  return db.query.applications.findMany({
    columns: {
      firstName: true,
      lastName: true,
      age: true,
      phoneNumber: true,
      school: true,
      levelOfStudy: true,
      countryOfResidence: true,
      agreeCodeOfConduct: true,
      agreeShareWithMLH: true,
      agreeEmailsFromMLH: true,
    },
    with: {
      user: {
        columns: {
          email: true,
        },
      },
    },
    where: ({ status }, { eq }) => eq(status, "ACCEPTED"),
  });
}

function getApplications() {
  return db.query.applications.findMany({
    with: {
      user: true,
    },
  });
}

async function getApplicationObjects(isMlh: boolean) {
  const applications = isMlh
    ? await getMlhApplications()
    : await getApplications();

  return applications.map((application) => {
    const { user, ...rest } = application;
    return {
      ...user,
      ...rest,
    };
  });
}

async function jsonHandler(isMlh: boolean, res: NextApiResponse) {
  const applications = await getApplicationObjects(isMlh);

  return res.status(200).json(applications);
}

const FILE_NAME = "applications.csv";

async function csvHandler(isMlh: boolean, res: NextApiResponse) {
  const applications = await getApplicationObjects(isMlh);
  const fileString = createCsvFile(applications);

  res.setHeader("Content-disposition", `attachment; filename=${FILE_NAME}`);
  res.setHeader("Content-Type", "text/csv; charset=UTF-8");

  res.send(fileString);
}
