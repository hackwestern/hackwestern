import type { NextApiRequest, NextApiResponse } from "next";
import { appRouter } from "~/server/api/root";
import { AnyRouter } from "@trpc/server";
import z from "zod";
import { RouterSchema } from "~/utils/load_testing/routeSchema";
import zodToJsonSchema from "zod-to-json-schema";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const procs = walkRouter(appRouter);

  return res.status(200).json(procs);
}

export function walkRouter(router: AnyRouter, prefix = ""): RouterSchema {
  var results: RouterSchema = {};

  const record = router._def;

  // procedures at this level
  if (record.procedures) {
    for (const [name, proc] of Object.entries(record.procedures)) {
      const fullPath: string = prefix ? `${prefix}.${name}` : name;

      // @ts-expect-error
      const input = proc._def.inputs?.[0];
      const safeInput = input == undefined ? z.object({}) : input;
      const jsonSchema: unknown = zodToJsonSchema(safeInput, {
        target: "jsonSchema7",
        definitions: {},
      });

      results[fullPath] = {
        path: fullPath,
        input: jsonSchema,
        // @ts-expect-error
        type: proc._def.type,
      };
    }
  }

  // nested procedures
  if (record.router) {
    for (const [key, child] of Object.entries(record.router)) {
      results = {
        ...results,
        ...walkRouter(child as AnyRouter, prefix ? `${prefix}.${key}` : key),
      };
    }
  }

  return results;
}
