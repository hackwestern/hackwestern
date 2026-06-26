import type { NextApiRequest, NextApiResponse } from "next";
import { appRouter } from "~/server/api/root";
import type { RouterSchema } from "~/utils/load_testing/routeSchema";
import { walkRouter } from "../../utils/load_testing/walkRouter";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const procs: RouterSchema = walkRouter(appRouter);

  return res.status(200).json(procs);
}
