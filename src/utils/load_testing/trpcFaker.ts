import { faker } from "@faker-js/faker";
import z, { type ZodType } from "zod";
import { fake, setFaker } from "zod-schema-faker/v4";

interface OpenAPIParam {
  in: string;
  name: string;
  schema: unknown;
}
export interface OpenAPISchema {
  paths: Record<
    string,
    {
      get?: {
        parameters: OpenAPIParam[];
      };
      post?: {
        requestBody?: {
          required: boolean;
          content: {
            "application/json": {
              schema: unknown;
            };
          };
        };
      };
    }
  >;
}

export class TRPCFaker {
  private input:
    | {
        method: "QUERY";
        schema: Record<string, ZodType>;
      }
    | { method: "MUTATE"; schema: ZodType };

  private overriddenFields: Record<string, () => unknown>;

  static {
    setFaker(faker);
  }

  constructor(schema: OpenAPISchema, route: string) {
    const path = schema.paths[route];

    if (path == undefined) {
      throw new Error(
        `The specified route does not exist on this TRPC Schema, Route: ${route}`,
      );
    }

    if (path.get != undefined) {
      if (path.get.parameters == undefined) {
        this.input = { method: "QUERY", schema: {} };
      } else {
        this.input = {
          method: "QUERY",
          schema: Object.fromEntries(
            path.get.parameters.map((value) => {
              const schema = z.fromJSONSchema(value.schema);
              const schemaStrict =
                schema instanceof z.ZodObject ? schema.strict() : schema;

              return [value.name, schemaStrict];
            }),
          ),
        };
      }
    } else if (path.post != undefined) {
      const rawSchema =
        path.post.requestBody?.content["application/json"].schema;
      if (rawSchema == undefined) {
        this.input = { method: "MUTATE", schema: z.void() };
      } else {
        const schema = z.fromJSONSchema(rawSchema);
        const schemaStrict =
          schema instanceof z.ZodObject ? schema.strict() : schema;

        this.input = { method: "MUTATE", schema: schemaStrict };
      }
    } else {
      throw new Error("Unknown method");
    }

    this.overriddenFields = {};
  }

  /*
   * Generates fake data for the schema that is attached to this TRPC Faker
   */
  public generate(): unknown {
    switch (this.input.method) {
      case "QUERY":
        const payload = Object.fromEntries(
          Object.entries(this.input.schema).map(([key, value]) => {
            const override = this.overriddenFields[key];
            if (override != undefined) {
              const overrideValue = override();

              return [key, overrideValue];
            }
            try {
              return [key, customFaker(value, this.overriddenFields)];
            } catch (error) {
              console.log(error);

              throw new Error(
                "Unable to fake this value, this is likely due to the value containing a zod type that cannot be faked",
              );
            }
          }),
        );
        return payload;

      case "MUTATE":
        try {
          return customFaker(this.input.schema, this.overriddenFields);
        } catch (error) {
          console.log(error);

          throw new Error(
            "Unable to fake this value, this is likely due to the value containing a zod type that cannot be faked",
          );
        }
    }
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
    schema: OpenAPISchema,
    route: string,
  ): TRPCFaker {
    const trpc = new TRPCFaker(schema, route);

    trpc.addOverrideField("email", () => faker.internet.email());

    trpc.addOverrideField("password", () => {
      var password = faker.internet.password();
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
    Object.entries(schema.shape).forEach(([key, value]) => {
      if (replacers[key] != undefined) {
        obj[key] = replacers[key]();
      } else {
        try {
          obj[key] = fake(value);
        } catch {
          throw new Error(`Field ${key} could not be faked`);
        }
      }
    });
    return obj;
  } else {
    try {
      return fake(schema);
    } catch {
      throw new Error(`Schema ${schema.type} could not be faked`);
    }
  }
}
