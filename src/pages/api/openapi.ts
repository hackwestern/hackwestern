import type { NextApiRequest, NextApiResponse } from "next";
import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "~/server/api/root";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const doc = generateOpenApiDocument(appRouter, {
    title: "tRPC OpenAPI",
    version: "1.0.0",
    baseUrl: "http://localhost:3000",
  });

  return res.status(200).json(doc);
}
