import { exit } from "process";
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

const fakeTRPC = new TRPCFaker(schema, path);

const fakeParams = fakeTRPC.generate();
console.log("Faked ", fakeParams);

exit(0);
