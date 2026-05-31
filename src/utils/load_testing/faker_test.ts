import { exit } from "process";
import { createTRPCClient, httpLink } from "@trpc/client";
import { AppRouter } from "~/server/api/root";
import superjson from "superjson";
import { OpenAPISchema, TRPCFaker } from "./trpcFaker";

// get the open api data
// ISSUE: convert this to some file reading??
const res = await fetch("http://localhost:3000/api/openapi");

if (res.status != 200) {
  console.error(
    "Unable to fetch schema, ensure that the nextjs server is running",
  );
  exit(1);
}

const schema: OpenAPISchema = await res.json();

const path = process.argv[2];
if (path == undefined) {
  console.error("Please specify the path to load testing as an argument");
  exit(1);
}

const fakeTRPC = TRPCFaker.defualtTRPCFaker(schema, path);

const fakeParams = fakeTRPC.generate();
console.log("Faked ", fakeParams);

// this section just tests the data
const client = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: "http://localhost:3000/api/trpc", // Your server endpoint
      transformer: superjson, // Enforces SuperJSON serialization
      fetch(url, options) {
        console.log("➡️ tRPC Request URL:", url);
        console.log("➡️ tRPC Request Options:", options);

        return fetch(url, options).then(async (res) => {
          const clone = res.clone();
          console.log("⬅️ tRPC Response:", await clone.text());
          return res;
        });
      },
    }),
  ],
});

// traverses the client to get to the desired path, this is kinda bad idk
const transformedPath: string[] = (() => {
  const removedAPI = path.replace("/api/", "").replace("/", ".");
  return removedAPI.split(".");
})();

const trpcProcedure = transformedPath.reduce((acc: any, key) => {
  return acc?.[key];
}, client);

if (!trpcProcedure || typeof trpcProcedure.query !== "function") {
  throw new Error(
    `Could not find a valid tRPC query procedure at path: ${transformedPath.join(".")}`,
  );
}

switch (fakeTRPC.getMethod()) {
  case "QUERY":
    const request1 = await trpcProcedure.query(fakeParams);
    console.log("TRPC QUERY Response", request1);

    break;
  case "MUTATE":
    const request = await trpcProcedure.mutate(fakeParams);
    console.log("TRPC MUTATE Response", request);

    break;
}
