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
  vus: 1,
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
  const faker = new TRPCFaker(data.schema, route);

  const payload = faker.generate();
  console.log(payload);

  sendRequest(payload, url);
}

function sendRequest(payload: unknown, url: string) {
  const json = JSON.stringify([payload]);

  const res = http.post(url + "?batch=1", json, {
    headers: {
      "Content-Type": "application/json",
    },
  });

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
