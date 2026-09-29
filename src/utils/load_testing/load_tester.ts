import { SharedArray } from "k6/data";
import http from "k6/http";
import { OpenAPISchema, TRPCFaker } from "./trpcFaker";
import { check } from "k6";
import type { LoadTestingUser } from "./authPrep";
import exec from "k6/execution";

const testUsersENV: string | undefined = __ENV.USERS;
const requiresAuth = testUsersENV != undefined && testUsersENV != "";

const testUsers: LoadTestingUser[] = new SharedArray("users", () => {
  if (testUsersENV == undefined || testUsersENV == "") {
    return [];
  } else {
    return JSON.parse(testUsersENV);
  }
});

const vuCookies: Record<string, string> = {};

const route: string = __ENV.ROUTE ?? "";
if (route == "") {
  throw new Error(
    "No ROUTE environment variable found or the ROUTE is empty, you must specify the route to load test on",
  );
}

var url: string = __ENV.TRPC_URL ?? "http://localhost:3000/api/trpc/";
if (!url.endsWith("/")) {
  url = url + "/";
}

export const options = {
  vus: 10,
  duration: "30s",
};

interface EntryPointData {
  schema: OpenAPISchema;
  url: string;
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

  const url = createUrl(route);

  return { schema: schema, url: url };
}

export default function (data: EntryPointData) {
  const vuId = exec.vu.idInInstance - 1;
  const iteration = exec.vu.iterationInInstance;

  if (requiresAuth && iteration == 0) {
    const testUser = testUsers[vuId];
    if (testUser == undefined) {
      throw new Error(`Unable to get a test user with vu id ${vuId}`);
    } else {
      login(testUser);
    }
  }

  const faker = TRPCFaker.defaultTRPCFaker(data.schema, route);

  const method = faker.getMethod();

  const payload = faker.generate();

  switch (method) {
    case "QUERY":
      getRequest(payload, data.url);
      break;
    case "MUTATE":
      postRequest(payload, data.url);
      break;
  }
}

function getRequest(payload: unknown, url: string) {
  const json = JSON.stringify({ json: payload });
  const res = http.get(url + `?input=${encodeURIComponent(json)}`, {
    cookies: vuCookies,
  });

  // console.log("REQUEST ", payload);
  // if (res.body) {
  //   console.log("RESPONSE ", res.body);
  // }
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
    cookies: vuCookies,
  });

  // console.log("REQUEST ", payload);
  // if (res.body) {
  //   console.log("RESPONSE ", res.body);
  // }
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}

function createUrl(route: string) {
  return url + route;
}

function login(user: LoadTestingUser) {
  const csrfURL = "http://localhost:3000/api/auth/csrf";
  const loginURL = "http://localhost:3000/api/auth/callback/credentials";
  const callbackUrl = "http://localhost:3000/live?tab=home";

  const username = user.email;
  const password = user.password;

  const csrfRes = http.get(csrfURL);

  const responseBody: { csrfToken: string } = JSON.parse(csrfRes.body);

  if (responseBody.csrfToken == undefined) {
    throw new Error("Unable to get next-auth csrf token");
  }

  const body = urlEncodeObject({
    username: username,
    password: password,
    csrfToken: responseBody.csrfToken,
    callbackUrl: callbackUrl,
    redirect: false,
    json: true,
  });

  http.post(loginURL, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const jarAfter = http.cookieJar();

  const sessionToken =
    jarAfter.cookiesForURL(loginURL)["next-auth.session-token"]?.[0];
  const csrfToken =
    jarAfter.cookiesForURL(loginURL)["next-auth.csrf-token"]?.[0];

  if (sessionToken == undefined) {
    throw new Error("Unable to login, no session token is present");
  }
  if (csrfToken == undefined) {
    throw new Error("Unable to login, no csrf token is present");
  }

  vuCookies["next-auth.session-token"] = sessionToken;
  vuCookies["next-auth.csrf-token"];
}

function urlEncodeObject(obj) {
  return Object.keys(obj)
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]))
    .join("&");
}
