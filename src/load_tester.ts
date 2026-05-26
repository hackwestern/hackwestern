import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "./server/api/root";

const doc = generateOpenApiDocument(appRouter, {
  title: "tRPC OpenAPI",
  version: "1.0.0",
  baseUrl: "http://localhost:3000",
  defs: {},
});

console.log(doc);
