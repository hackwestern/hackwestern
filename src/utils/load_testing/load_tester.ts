import { SharedArray } from "k6/data";
import http from "k6/http";
import { OpenAPISchema, TRPCFaker } from "./trpcFaker";
import { check } from "k6";

const route: string = __ENV.ROUTE ?? "";
if (route == "") {
  throw new Error(
    "No ROUTE environment variable found or the ROUTE is empty, you must specify the route to load test on",
  );
}

const url: string = __ENV.TRPC_URL ?? "http://localhost:3000/api/trpc/";

export const options = {
  vus: 20,
  duration: "30s",
};

interface EntryPointData {
  schema: OpenAPISchema;
}
const schemaData: OpenAPISchema[] = new SharedArray("schema", function () {
  return [JSON.parse(open("../../../api.json"))];
});
const schema = schemaData[0];

export function setup(): EntryPointData {
  if (schema == undefined) {
    throw new Error(
      "Unable to read the api.json file, this file should contain the OpenAPISpec of the repo and it should be located at the root",
    );
  }

  return { schema: schema };
}

export default function (data: EntryPointData) {
  const normalizedRoute = normalizeRoute(route);

  const url = createUrl(normalizedRoute);
  const faker = TRPCFaker.defaultTRPCFaker(data.schema, route);

  const method = faker.getMethod();

  const payload = faker.generate();
  console.log("REQUEST ", payload);

  switch (method) {
    case "QUERY":
      getRequest(payload, url);
      break;
    case "MUTATE":
      postRequest(payload, url);
      break;
  }
}

function getRequest(payload: unknown, url: string) {
  const json = JSON.stringify({ json: payload });
  const res = http.get(url + `?input=${encodeURIComponent(json)}`);

  if (res.body) {
    console.log("RESPONSE ", res.body);
  }
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}

function postRequest(payload: unknown, url: string) {
  const json = JSON.stringify({ json: payload });

  const res = http.post(url, json, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (res.body) {
    console.log("RESPONSE ", res.body);
  }
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}

function createUrl(route: string) {
  return url + route;
}

function normalizeRoute(route: string): string {
  return route.replace("/api/", "").replaceAll("/", ".");
}
