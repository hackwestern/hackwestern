import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  tags: z.array(z.string()),
  maybe: z.string().optional(),
  nullableVal: z.number().nullable(),
  createdAt: z.date(),
  role: z.enum(["a", "b", "c"]),
  flag: z.literal(true),
  nested: z.object({ x: z.boolean() }).optional(),
});

const jsonSchema = zodToJsonSchema(schema);
console.log(JSON.stringify(jsonSchema, null, 2));
