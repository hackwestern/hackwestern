import z from "zod";
import { AnyRouter } from "@trpc/server";
import { RouterSchema } from "~/utils/load_testing/routeSchema";
import zodToJsonSchema from "zod-to-json-schema";

export function walkRouter(router: AnyRouter, prefix = ""): RouterSchema {
  let results: RouterSchema = {};

  const record = router._def;

  // procedures at this level
  if (record.procedures) {
    for (const [name, proc] of Object.entries(record.procedures)) {
      const fullPath: string = prefix ? `${prefix}.${name}` : name;

      const input = (proc as any)._def.inputs?.[0];
      const safeInput = input == undefined ? z.object({}) : input;

      const jsonSchema: unknown = zodToJsonSchema(safeInput, {
        target: "jsonSchema7",
        definitions: {},
      });

      results[fullPath] = {
        path: fullPath,
        input: jsonSchema,
        type: (proc as any)._def.type,
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
