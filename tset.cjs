const { exec } = require("child_process");

const sessionToken =
  "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..-vCVqraKMhn9Rg7f.QrRVaWZo_RIVyUh_peXURc9XPxrq34eK57vz9X8eoy6yCEc-DqIoRjaff4OxxuaBUDOKXz3egid6WH_FgS2-5hP_VPreUbJv5Mid436rKqWiMHDIJq1_p7oKz5cpIPhDiHJkaeKDpZakl4x8Z7LnFeFltyzLn9iF8mWuJOi876j75hhknUS0ulzioqOXVGR9hIjYoacyXdoj6KQ2T-PVBpmzlJUVGBvZfB05IwyL3C90RPfk_CImAZUf4VtqvK3bLc-dMMHHWcgrBFrRBQ.rSUIRT3DMr3MkL3UuM7ytA";
// insert any valid cookie

// Step 2: Construct full curl command
const curlCommand = `curl 'http://localhost:3000/api/trpc/application.getAppStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D' \
  -X GET \
  -H 'content-type: application/json' \
  -H 'cookie: next-auth.session-token=${sessionToken}' \
  --data-raw '{}'`;

console.log("Executing tRPC call...\n");
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`⚠️ Stderr: ${stderr}`);
  }
  console.log(`✅ Response:\n${stdout}`);
});