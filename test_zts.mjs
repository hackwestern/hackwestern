import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().optional(),
  role: z.enum(["admin", "user"]),
  agreeToTerms: z.literal(true),
});

console.log(JSON.stringify(zodToJsonSchema(schema), null, 2));
