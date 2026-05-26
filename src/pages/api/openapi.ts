import type { NextApiRequest, NextApiResponse } from "next";
import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "~/server/api/root";

export default async function GET(req: NextApiRequest, res: NextApiResponse) {
  const doc = generateOpenApiDocument(appRouter, {
    title: "tRPC OpenAPI",
    version: "1.0.0",
    baseUrl: "http://localhost:3000",
    defs: {},
  });

  console.log(doc);

  return res.status(500);
}
