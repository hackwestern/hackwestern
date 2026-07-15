import { faker } from "@faker-js/faker";
import z, { type ZodType } from "zod";
import { type RouterSchema } from "./routeSchema";
import jsonSchemaToZod from "json-schema-to-zod";

export class TRPCFaker {
  private input: { input: ZodType; method: "query" | "mutation" };

  private overriddenFields: Record<string, () => unknown>;
  constructor(schema: RouterSchema, route: string) {
    const path = schema[route];

    if (path == undefined) {
      throw new Error(
        `The specified route does not exist on this TRPC Schema, Route: ${route}`,
      );
    }
    if (path.type == "subscription") {
      throw new Error("This does not support SUBSCRIPTION yet sorry");
    }
    this.input = {
      input: fromJSONSchema(path.input),
      method: path.type,
    };

    this.overriddenFields = {};
  }

  /*
   * Generates fake data for the schema that is attached to this TRPC Faker
   */
  public generate(): unknown {
    return customFaker(this.input.input, this.overriddenFields);
  }
  /*
   * Adds an override faker for the specified field
   *
   * If the faker encounters a parameter that is equal to field it will call
   * the specified callback rather then generate fake data, this allows for custom
   * faking logic for fields that have specific requirements
   *
   * Only valid for get operations which have parameters
   *
   * ISSUE: we should try and support this for the body too
   */
  public addOverrideField(field: string, callback: () => unknown) {
    this.overriddenFields[field] = callback;
  }

  public getMethod() {
    return this.input.method;
  }

  public static defaultTRPCFaker(
    schema: RouterSchema,
    route: string,
  ): TRPCFaker {
    const trpc = new TRPCFaker(schema, route);

    trpc.addOverrideField("email", () => faker.internet.email());

    trpc.addOverrideField("password", () => {
      let password = faker.internet.password();
      const number = /[0-9]/;
      const symbol = /[_+=-@#%$]/;
      if (!number.test(password)) {
        password = password + String(faker.number.int(10));
      }
      if (!symbol.test(password)) {
        password = password + "_";
      }
      return password;
    });

    return trpc;
  }
}

function customFaker(
  schema: ZodType,
  replacers: Record<string, () => unknown>,
): unknown {
  if (schema instanceof z.ZodObject) {
    const obj: Record<string, unknown> = {};
    Object.entries(schema.shape as [string, unknown]).forEach(
      ([key, value]) => {
        if (replacers[key] != undefined) {
          obj[key] = replacers[key]();
        } else {
          try {
            obj[key] = fakeFromZod(value as ZodType);
          } catch {
            throw new Error(`Field ${key} could not be faked`);
          }
        }
      },
    );
    return obj;
  } else {
    try {
      return fakeFromZod(schema);
    } catch {
      throw new Error(
        `Schema could not be faked, Schema: ${JSON.stringify(schema, null, 2)}`,
      );
    }
  }
}
function fromJSONSchema(schema: unknown): ZodType {
  try {
    // @ts-expect-error This works
    const str_zod = jsonSchemaToZod(schema, { zodVersion: 3 });

    // This is literally cancer but idk what else to do on zod v3
    const translator = new Function("z", `return ${str_zod};`);

    const t: ZodType = translator(z);
    return t;
  } catch (error) {
    console.log(error);
    throw new Error("Unable to parse JSON schema into zod type");
  }
}

export function fakeFromZod(schema: ZodType): unknown {
  if (schema instanceof z.ZodAny) {
    return faker.lorem.word();
  }

  if (schema instanceof z.ZodString) {
    return faker.lorem.word();
  }

  if (schema instanceof z.ZodNumber) {
    return faker.number.int();
  }

  if (schema instanceof z.ZodBoolean) {
    return faker.datatype.boolean();
  }

  if (schema instanceof z.ZodDate) {
    return faker.date.recent();
  }

  if (schema instanceof z.ZodEnum) {
    const options = schema.options;
    return faker.helpers.arrayElement(options);
  }

  if (schema instanceof z.ZodLiteral) {
    return schema.value;
  }

  if (schema instanceof z.ZodArray) {
    return [];
  }

  if (schema instanceof z.ZodOptional) {
    return fakeFromZod(schema.unwrap() as ZodType);
  }

  if (schema instanceof z.ZodNullable) {
    return fakeFromZod(schema.unwrap() as ZodType);
  }

  throw new Error(`Unsupported schema: ${schema.constructor.name}`);
}
