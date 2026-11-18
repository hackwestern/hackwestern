// Task pings tab screenshots. Usage: node mocks/task-pings-tab-v1/capture.mjs
// Signs in as the local test organizer (redesign-organizer-1) with a minted
// next-auth JWT (NEXTAUTH_SECRET=local-dev-only-secret). Dev server on :3031.
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3031";
const DIR = "mocks/task-pings-tab-v1";
const token = await encode({
  token: {
    sub: "redesign-organizer-1",
    name: "Redesign Organizer",
    email: "redesign.organizer@test.local",
  },
  secret: "local-dev-only-secret",
});
const browser = await chromium.launch();
for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await context.newPage();
  for (const [name, path] of [
    ["pings", "?tab=pings"],
    ["legacy-help", "?tab=help"],
    ["schedule", "?tab=schedule"],
  ]) {
    await page.goto(`${BASE}/internal/sponsors${path}`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    await page.waitForTimeout(2500);
    console.log(name, width, page.url());
    await page.screenshot({
      path: `${DIR}/${name}-${width}.png`,
      fullPage: name !== "legacy-help",
    });
  }
  await context.close();
}
await browser.close();
console.log("done");
